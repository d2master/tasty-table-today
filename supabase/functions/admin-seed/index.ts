import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require a shared secret header to invoke this function. The secret
    // must be provisioned in Supabase Edge Function secrets and is NEVER
    // sent to clients. This prevents unauthenticated public invocation.
    const expectedSecret = Deno.env.get("ADMIN_SEED_SECRET");
    if (!expectedSecret) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedSecret = req.headers.get("x-admin-seed-secret");
    if (providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmail = Deno.env.get("ADMIN_SEED_EMAIL");
    const adminPassword = Deno.env.get("ADMIN_SEED_PASSWORD");
    if (!adminEmail || !adminPassword) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    let userId = existing.users.find((u) => u.email === adminEmail)?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    const { data: anyAdmin } = await supabase
      .from("admin_users")
      .select("id, user_id")
      .limit(1)
      .maybeSingle();

    if (!anyAdmin) {
      const { error: insertErr } = await supabase
        .from("admin_users")
        .insert({ user_id: userId });
      if (insertErr) throw insertErr;
    }
    // Do NOT auto-update an existing admin record to point to a different user
    // — that would allow takeover if this function were ever invoked maliciously.

    // Do NOT return userId or email in the response body.
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-seed error:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
