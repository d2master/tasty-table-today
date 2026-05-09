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
      .select("id, name, slug, is_blocked, table_count, pix_enabled, pix_key, pix_key_type, pix_recipient_name, pix_city")
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

    // Atomic stock decrement for tracked products. Aggregate quantities per product.
    const decrements = new Map<string, number>();
    for (const it of computedItems) {
      const p = productMap.get(it.product_id)!;
      if (p.track_stock) decrements.set(it.product_id, (decrements.get(it.product_id) ?? 0) + it.quantity);
    }
    const applied: Array<{ id: string; qty: number }> = [];
    for (const [pid, qty] of decrements) {
      const current = productMap.get(pid)!.stock_quantity ?? 0;
      const { data: updated, error: decErr } = await supabase
        .from("products")
        .update({ stock_quantity: current - qty })
        .eq("id", pid)
        .gte("stock_quantity", qty)
        .select("id");
      if (decErr || !updated || updated.length === 0) {
        // Rollback any prior decrements and the order
        for (const a of applied) {
          const cur = productMap.get(a.id)!.stock_quantity ?? 0;
          await supabase.from("products").update({ stock_quantity: cur }).eq("id", a.id);
        }
        await supabase.from("orders").delete().eq("id", orderId);
        return new Response(JSON.stringify({ error: `Sem estoque suficiente para "${productMap.get(pid)!.name}"` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      applied.push({ id: pid, qty });
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
