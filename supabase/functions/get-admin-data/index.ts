import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Check if user is platform admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminCheck } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Get all restaurants
    const { data: restaurants } = await adminClient
      .from("restaurants")
      .select("id, name, slug, is_blocked, created_at, owner_id")
      .order("created_at", { ascending: false });

    if (!restaurants) {
      return new Response(JSON.stringify({ restaurants: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get owner emails from auth.users
    const ownerIds = [...new Set(restaurants.map((r: any) => r.owner_id))];
    const restaurantsWithEmail = [];

    for (const restaurant of restaurants) {
      const { data: { user: ownerUser } } = await adminClient.auth.admin.getUserById(restaurant.owner_id);
      restaurantsWithEmail.push({
        ...restaurant,
        owner_email: ownerUser?.email ?? "N/A",
      });
    }

    return new Response(JSON.stringify({ restaurants: restaurantsWithEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
