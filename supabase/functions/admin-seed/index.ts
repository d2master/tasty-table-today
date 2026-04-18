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
    } else {
      // Garante que a senha está correta e o email confirmado
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (updErr) throw updErr;
      console.log("Senha do admin sincronizada:", userId);
    }

    // Garante registro em admin_users
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!adminRow) {
      const { error: insertErr } = await supabase
        .from("admin_users")
        .insert({ user_id: userId });
      if (insertErr) throw insertErr;
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
