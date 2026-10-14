import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX = 5;
const LOCK_MIN = 15;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email: rawEmail, password } = await req.json();
    const email = String(rawEmail ?? "").trim().toLowerCase();
    if (!email || !password || email.length > 255) return json({ error: "invalid" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });

    const { data: row } = await admin.from("login_attempts").select("*").eq("email", email).maybeSingle();
    const now = Date.now();
    if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
      return json({ error: "locked", locked_until: row.locked_until }, 429);
    }

    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const expired = row?.locked_until && new Date(row.locked_until).getTime() <= now;
      const count = (expired ? 0 : row?.failed_count ?? 0) + 1;
      const locked_until = count >= MAX ? new Date(now + LOCK_MIN * 60000).toISOString() : null;
      await admin.from("login_attempts").upsert({
        email, failed_count: count >= MAX ? 0 : count, locked_until, updated_at: new Date().toISOString(),
      });
      if (locked_until) return json({ error: "locked", locked_until }, 429);
      return json({ error: "invalid_credentials", remaining: MAX - count }, 401);
    }

    await admin.from("login_attempts").delete().eq("email", email);
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
