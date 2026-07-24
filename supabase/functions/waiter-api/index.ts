// Waiter self-service API: login, logout, me, tables, orders_for_table, update_status, place_order
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders as baseCors } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-waiter-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

async function requireWaiter(req: Request) {
  const token = req.headers.get("x-waiter-token");
  if (!token) return null;
  const { data, error } = await supabase.rpc("waiter_from_token", { _token: token });
  if (error || !data || data.length === 0) return null;
  return data[0] as { waiter_id: string; waiter_name: string; restaurant_id: string; restaurant_slug: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "login") {
      const parsed = z.object({
        slug: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(1),
      }).safeParse(body);
      if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
      const { data, error } = await supabase.rpc("waiter_login", {
        _slug: parsed.data.slug.toLowerCase().trim(),
        _username: parsed.data.username.toLowerCase().trim(),
        _password: parsed.data.password,
      });
      if (error || !data || data.length === 0) {
        return json({ error: "Usuário ou senha inválidos" }, 401);
      }
      return json({
        token: data[0].token,
        waiter: {
          id: data[0].waiter_id,
          name: data[0].waiter_name,
          restaurant_id: data[0].restaurant_id,
          restaurant_slug: data[0].restaurant_slug,
          restaurant_name: data[0].restaurant_name,
        },
      });
    }

    if (action === "logout") {
      const token = req.headers.get("x-waiter-token");
      if (token) await supabase.rpc("waiter_logout", { _token: token });
      return json({ ok: true });
    }

    const waiter = await requireWaiter(req);
    if (!waiter) return json({ error: "Não autenticado" }, 401);

    if (action === "me") {
      // include restaurant name
      const { data: r } = await supabase.from("restaurants")
        .select("name, table_count")
        .eq("id", waiter.restaurant_id).maybeSingle();
      return json({ waiter, restaurant: r });
    }

    if (action === "tables") {
      const { data, error } = await supabase.rpc("waiter_tables", { _waiter_id: waiter.waiter_id });
      if (error) return json({ error: "Erro ao carregar mesas" }, 500);
      return json({ tables: data });
    }

    if (action === "orders_for_table") {
      const parsed = z.object({ table_number: z.string() }).safeParse(body);
      if (!parsed.success) return json({ error: "Mesa inválida" }, 400);
      const { data, error } = await supabase.rpc("waiter_orders_for_table", {
        _waiter_id: waiter.waiter_id,
        _table_number: parsed.data.table_number,
      });
      if (error) return json({ error: "Erro" }, 500);
      // load items for each order
      const orderIds = (data || []).map((o: { id: string }) => o.id);
      let itemsByOrder: Record<string, unknown[]> = {};
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from("order_items")
          .select("order_id, product_name, quantity, price")
          .in("order_id", orderIds);
        itemsByOrder = (items || []).reduce((acc: Record<string, unknown[]>, it) => {
          (acc[it.order_id] ||= []).push(it);
          return acc;
        }, {});
      }
      return json({ orders: data, items: itemsByOrder });
    }

    if (action === "update_status") {
      const parsed = z.object({
        order_id: z.string().uuid(),
        status: z.enum(["pending","preparing","ready","done","cancelled"]),
      }).safeParse(body);
      if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
      const { error } = await supabase.rpc("waiter_update_order_status", {
        _waiter_id: waiter.waiter_id,
        _order_id: parsed.data.order_id,
        _status: parsed.data.status,
      });
      if (error) return json({ error: error.message.includes("another waiter") ? "Pedido de outro garçom" : "Não autorizado" }, 403);
      return json({ ok: true });
    }

    if (action === "menu") {
      // categories + available products for waiter's restaurant
      const { data: categories } = await supabase.from("categories")
        .select("id, name, display_order")
        .eq("restaurant_id", waiter.restaurant_id)
        .order("display_order");
      const { data: products } = await supabase.from("products")
        .select("id, name, price, promo_price, is_promo, category_id, image_url, is_available, track_stock, stock_quantity")
        .eq("restaurant_id", waiter.restaurant_id)
        .eq("is_available", true);
      return json({ categories: categories || [], products: (products || []).filter(p => !p.track_stock || (p.stock_quantity ?? 0) > 0) });
    }

    if (action === "place_order") {
      const parsed = z.object({
        table_number: z.string().min(1),
        items: z.array(ItemSchema).min(1).max(100),
        append_to_order_id: z.string().uuid().optional(),
        tip_enabled: z.boolean().optional().default(false),
      }).safeParse(body);
      if (!parsed.success) return json({ error: "Dados inválidos" }, 400);

      // Load restaurant slug and delegate to place-order via internal fetch (reuse pricing/stock logic)
      const { data: r } = await supabase.from("restaurants")
        .select("slug").eq("id", waiter.restaurant_id).maybeSingle();
      if (!r) return json({ error: "Lanchonete não encontrada" }, 404);

      const placeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/place-order`;
      const resp = await fetch(placeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          slug: r.slug,
          order_type: "table",
          customer_name: `Mesa ${parsed.data.table_number}`,
          table_number: parsed.data.table_number,
          items: parsed.data.items,
          append_to_order_id: parsed.data.append_to_order_id,
          tip_enabled: parsed.data.tip_enabled,
          waiter_id: waiter.waiter_id,
        }),
      });
      const payload = await resp.json();
      return json(payload, resp.status);
    }

    return json({ error: "Ação não encontrada" }, 404);
  } catch (err) {
    console.error("waiter-api error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
