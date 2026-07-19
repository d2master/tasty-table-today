import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SignupSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
  storeName: z.string().trim().min(3).max(120),
  trashPassword: z.string().regex(/^\d{4}$/),
  pixPassword: z.string().regex(/^\d{6}$/),
  phone: z.string().transform((value) => value.replace(/\D/g, "")).refine(
    (value) => value.length >= 10 && value.length <= 11,
    "invalid_phone",
  ),
  emailRedirectTo: z.string().url().optional(),
});

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const safeRedirectUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

const authErrorCode = (error: unknown) => {
  const maybeError = error as { code?: string; status?: number; message?: string };
  if (maybeError.code === "weak_password") return "weak_password";
  if (maybeError.status === 422 && maybeError.message?.toLowerCase().includes("weak")) return "weak_password";
  if (maybeError.message?.toLowerCase().includes("email")) return "invalid_email";
  return "signup_failed";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = SignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ code: "invalid_request", error: "Dados inválidos para cadastro." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ code: "service_unavailable", error: "Cadastro indisponível no momento." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: signupError } = await authClient.auth.signUp({
      email: body.email,
      password: body.password,
      options: { emailRedirectTo: safeRedirectUrl(body.emailRedirectTo) },
    });

    if (signupError) {
      console.warn("signup-restaurant auth rejected", {
        status: signupError.status,
        code: signupError.code,
      });
      return new Response(JSON.stringify({ code: authErrorCode(signupError), error: "Não foi possível criar sua conta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ code: "signup_failed", error: "Não foi possível criar sua conta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slugBase = generateSlug(body.storeName) || "lanchonete";
    const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
    const { error: restaurantError } = await adminClient.from("restaurants").insert({
      name: body.storeName,
      slug,
      owner_id: userId,
      trash_password: body.trashPassword,
      pix_password: body.pixPassword,
      owner_phone: body.phone,
    });

    if (restaurantError) {
      console.error("signup-restaurant restaurant insert failed", {
        code: restaurantError.code,
        details: restaurantError.details,
      });
      await adminClient.auth.admin.deleteUser(userId).catch((cleanupError) => {
        console.error("signup-restaurant cleanup failed", cleanupError);
      });

      return new Response(JSON.stringify({ code: "restaurant_failed", error: "Não foi possível criar sua lanchonete. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("signup-restaurant error", error);
    return new Response(JSON.stringify({ code: "unexpected_error", error: "Cadastro indisponível no momento." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});