import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const ADMIN_EMAIL = "jamersonmalheiros@gmail.com";
const ADMIN_PASSWORD = "d2binhod2Lova!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verifica se já existe algum admin
    const { count, error: countError } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Admin já existe", created: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cria usuário no Supabase Auth (senha já é hasheada com segurança pelo Supabase)
    const { data: existing } = await supabase.auth.admin.listUsers();
    let userId = existing.users.find((u) => u.email === ADMIN_EMAIL)?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Insere na tabela admin_users
    const { error: insertErr } = await supabase
      .from("admin_users")
      .insert({ user_id: userId });
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ ok: true, created: true, email: ADMIN_EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("admin-seed error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
