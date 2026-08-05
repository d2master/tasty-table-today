// One-off maintenance: confirm e-mails of existing restaurant owners so they can log in.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== Deno.env.get("ADMIN_SEED_SECRET")) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let confirmed = 0;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (!u.email_confirmed_at && u.email) {
        const { error: e } = await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
        if (!e) confirmed++;
      }
    }
    if (users.length < 200) break;
  }

  return new Response(JSON.stringify({ ok: true, confirmed }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
