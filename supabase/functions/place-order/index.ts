import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { generatePixPayload } from "./pix.ts";

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

const BodySchema = z.object({
  slug: z.string().min(1).max(120),
  order_type: z.enum(["table", "delivery"]),
  customer_name: z.string().trim().max(100).optional().default(""),
  customer_phone: z.string().trim().max(50).optional().default(""),
  table_number: z.string().trim().max(20).optional().default(""),
  observation: z.string().trim().max(500).optional().default(""),
  payment_method: z.enum(["pix", "debito", "credito", "dinheiro"]).optional(),
  delivery_address: z.string().trim().max(1000).optional().nullable(),
  delivery_maps_url: z.string().trim().max(2000).optional().nullable(),
  items: z.array(ItemSchema).min(1).max(100),
  append_to_order_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      console.error("place-order validation error:", parsed.error.flatten());
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch restaurant
    const { data: restaurant, error: rErr } = await supabase
      .from("restaurants")
      .select("id, name, slug, is_blocked, is_open, closed_message, table_count, service_mode, delivery_payment_methods, pix_enabled, pix_key, pix_key_type, pix_recipient_name, pix_city")
      .eq("slug", body.slug)
      .maybeSingle();

    if (rErr || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (restaurant.is_blocked) {
      return new Response(JSON.stringify({ error: "Restaurant unavailable" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (restaurant.is_open === false) {
      return new Response(JSON.stringify({ error: restaurant.closed_message || "Lanchonete fechada no momento" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceMode = (restaurant as { service_mode?: string }).service_mode ?? "both";
    if (serviceMode === "delivery" && body.order_type === "table") {
      return new Response(JSON.stringify({ error: "Esta lanchonete está aceitando apenas pedidos de delivery." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (serviceMode === "table" && body.order_type === "delivery") {
      return new Response(JSON.stringify({ error: "Esta lanchonete está aceitando apenas pedidos para mesa." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block check
    if (body.customer_phone) {
      const { data: blocked } = await supabase
        .from("blocked_customers")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .eq("customer_phone", body.customer_phone)
        .maybeSingle();
      if (blocked) {
        return new Response(JSON.stringify({ error: "Customer blocked" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch products to compute authoritative prices
    const productIds = [...new Set(body.items.map((i) => i.product_id))];
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, promo_price, is_promo, is_available, restaurant_id, track_stock, stock_quantity")
      .in("id", productIds);

    if (pErr || !products) {
      return new Response(JSON.stringify({ error: "Failed to load products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of body.items) {
      const p = productMap.get(item.product_id);
      if (!p || p.restaurant_id !== restaurant.id || !p.is_available) {
        return new Response(JSON.stringify({ error: "Invalid product in cart" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (p.track_stock && (p.stock_quantity ?? 0) < item.quantity) {
        return new Response(JSON.stringify({ error: `Sem estoque suficiente para "${p.name}"` }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build items with server-side pricing
    const computedItems = body.items.map((it) => {
      const p = productMap.get(it.product_id)!;
      const price = p.is_promo && p.promo_price != null ? Number(p.promo_price) : Number(p.price);
      return {
        product_id: p.id,
        product_name: p.name,
        quantity: it.quantity,
        price,
      };
    });

    const total = computedItems.reduce((s, i) => s + i.price * i.quantity, 0);

    // ===== APPEND MODE: add items to an existing table order =====
    if (body.append_to_order_id) {
      if (body.order_type !== "table") {
        return new Response(JSON.stringify({ error: "Apenas pedidos de mesa podem receber novos itens." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existing, error: exErr } = await supabase
        .from("orders")
        .select("id, restaurant_id, order_type, status, deleted_at, total")
        .eq("id", body.append_to_order_id)
        .maybeSingle();
      if (exErr || !existing) {
        return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.restaurant_id !== restaurant.id) {
        return new Response(JSON.stringify({ error: "Pedido não pertence a esta lanchonete." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.order_type !== "table") {
        return new Response(JSON.stringify({ error: "Só é possível adicionar itens em pedidos de mesa." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.deleted_at) {
        return new Response(JSON.stringify({ error: "Este pedido não está mais ativo." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["pending", "preparing", "ready"].includes(existing.status)) {
        return new Response(JSON.stringify({ error: "Este pedido já foi finalizado ou cancelado." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(computedItems.map((i) => ({ ...i, order_id: existing.id })));
      if (itemsError) {
        console.error("Append items insert error", itemsError);
        return new Response(JSON.stringify({ error: "Falha ao adicionar itens." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decrement stock (same logic as new order)
      const decrements = new Map<string, number>();
      for (const it of computedItems) {
        const p = productMap.get(it.product_id)!;
        if (p.track_stock) decrements.set(it.product_id, (decrements.get(it.product_id) ?? 0) + it.quantity);
      }
      if (decrements.size > 0) {
        const itemsPayload = Array.from(decrements, ([product_id, quantity]) => ({ product_id, quantity }));
        const { error: decErr } = await supabase.rpc("decrement_stock_for_order", { _items: itemsPayload });
        if (decErr) {
          // Roll back the appended items
          await supabase.from("order_items").delete().eq("order_id", existing.id).in("product_id", computedItems.map(i => i.product_id));
          const msg = decErr.message ?? "";
          const match = msg.match(/INSUFFICIENT_STOCK:(.+?)(?:$|")/);
          const productName = match ? match[1] : "produto";
          return new Response(JSON.stringify({ error: `Sem estoque suficiente para "${productName}"` }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const newTotal = Number(existing.total) + total;
      await supabase
        .from("orders")
        .update({ total: newTotal, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      return new Response(JSON.stringify({
        order_id: existing.id,
        total: newTotal,
        pix_copy_paste: null,
        pix_key: null,
        appended: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Validate order type-specific fields
    if (body.order_type === "table") {
      if (!body.table_number) {
        return new Response(JSON.stringify({ error: "Table number required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tableNum = parseInt(body.table_number, 10);
      const maxTables = (restaurant as { table_count?: number }).table_count ?? 0;
      if (!Number.isInteger(tableNum) || tableNum < 1 || tableNum > maxTables) {
        return new Response(JSON.stringify({ error: "Invalid table number" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check occupancy: any active (non-deleted) order for this table in pending/preparing
      const { data: occupying } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .eq("order_type", "table")
        .eq("table_number", body.table_number)
        .is("deleted_at", null)
        .in("status", ["pending", "preparing"])
        .limit(1);
      if (occupying && occupying.length > 0) {
        return new Response(JSON.stringify({ error: "Table already occupied" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (body.order_type === "delivery") {
      if (!body.customer_name || !body.customer_phone || !body.payment_method) {
        return new Response(JSON.stringify({ error: "Missing delivery fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const orderId = crypto.randomUUID();
    let pixCopyPaste: string | null = null;
    let pixKeyForDisplay: string | null = null;

    if (body.payment_method === "pix") {
      if (!restaurant.pix_enabled || !restaurant.pix_key || !restaurant.pix_key_type ||
          !restaurant.pix_recipient_name || !restaurant.pix_city) {
        return new Response(JSON.stringify({ error: "Pix not configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pixKeyForDisplay = restaurant.pix_key;
      pixCopyPaste = generatePixPayload({
        key: restaurant.pix_key,
        keyType: restaurant.pix_key_type as never,
        recipientName: restaurant.pix_recipient_name,
        city: restaurant.pix_city,
        amount: total,
        txid: orderId.replace(/-/g, "").slice(0, 25),
        description: `${restaurant.name} ${body.order_type === "delivery" ? "DELIVERY" : "MESA"}`,
      });
    }

    const orderRow: Record<string, unknown> = {
      id: orderId,
      restaurant_id: restaurant.id,
      status: "pending",
      total,
      order_type: body.order_type,
      customer_name: body.customer_name || "Cliente",
      customer_phone: body.customer_phone || null,
      table_number: body.order_type === "table" ? body.table_number : "",
      payment_method: body.payment_method ?? null,
      delivery_address: body.delivery_address ?? null,
      delivery_maps_url: body.delivery_maps_url ?? null,
      payment_status: body.payment_method === "pix" ? "awaiting_pix" : "pending",
      pix_copy_paste: pixCopyPaste,
    };

    const { error: orderError } = await supabase.from("orders").insert(orderRow);
    if (orderError) {
      console.error("Order insert error", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(computedItems.map((i) => ({ ...i, order_id: orderId })));

    if (itemsError) {
      console.error("Items insert error", itemsError);
      await supabase.from("orders").delete().eq("id", orderId);
      return new Response(JSON.stringify({ error: "Failed to save items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic stock decrement: aggregate quantities per tracked product, then call
    // a SECURITY DEFINER function that locks the rows (FOR UPDATE) and decrements
    // them in a single transaction. This is safe against concurrent carts —
    // simultaneous orders are serialized on the same product rows, and any
    // shortfall raises an exception that rolls back ALL decrements at once.
    const decrements = new Map<string, number>();
    for (const it of computedItems) {
      const p = productMap.get(it.product_id)!;
      if (p.track_stock) decrements.set(it.product_id, (decrements.get(it.product_id) ?? 0) + it.quantity);
    }
    if (decrements.size > 0) {
      const itemsPayload = Array.from(decrements, ([product_id, quantity]) => ({ product_id, quantity }));
      const { error: decErr } = await supabase.rpc("decrement_stock_for_order", { _items: itemsPayload });
      if (decErr) {
        // Roll back the order; stock changes (if any) were rolled back by the failed transaction.
        await supabase.from("orders").delete().eq("id", orderId);
        const msg = decErr.message ?? "";
        const match = msg.match(/INSUFFICIENT_STOCK:(.+?)(?:$|")/);
        const productName = match ? match[1] : "produto";
        return new Response(JSON.stringify({ error: `Sem estoque suficiente para "${productName}"` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      order_id: orderId,
      total,
      pix_copy_paste: pixCopyPaste,
      pix_key: pixKeyForDisplay,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("place-order error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
