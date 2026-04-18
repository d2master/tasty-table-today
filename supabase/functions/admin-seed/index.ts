import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "jamersonmalheiros@gmail.com";
const ADMIN_PASSWORD = "d2binhod2Lova!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Procura usuário por email
    const { data: existing, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    let userId = existing.users.find((u) => u.email === ADMIN_EMAIL)?.id;

    if (!userId) {
      // Cria novo usuário
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
      console.log("Admin user criado:", userId);
    }
    // Não sobrescreve a senha de um admin já existente — respeita redefinições feitas pelo usuário

    // Garante registro em admin_users (idempotente — respeita o singleton index)
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
    } else if (anyAdmin.user_id !== userId) {
      // Já existe um admin diferente — atualiza para apontar para o user correto
      const { error: updErr } = await supabase
        .from("admin_users")
        .update({ user_id: userId })
        .eq("id", anyAdmin.id);
      if (updErr) throw updErr;
    }

    return new Response(
      JSON.stringify({ ok: true, email: ADMIN_EMAIL, userId }),
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
