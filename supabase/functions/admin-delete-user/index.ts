import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey || !authHeader) {
      return new Response(JSON.stringify({ error: "Missing configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: requesterData, error: requesterError } = await userClient.auth.getUser(token);
    if (requesterError || !requesterData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterId = requesterData.user.id;
    const { data: requesterRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .maybeSingle();

    if (!requesterRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId || userId === requesterId) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (targetRole) {
      return new Response(JSON.stringify({ error: "Cannot delete admin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, shop_name")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: userSales } = await adminClient.from("sales").select("id").eq("user_id", userId);
    const { data: userPurchases } = await adminClient.from("purchases").select("id").eq("user_id", userId);

    if (userSales?.length) {
      await adminClient.from("sale_items").delete().in("sale_id", userSales.map((s) => s.id));
    }
    if (userPurchases?.length) {
      await adminClient.from("purchase_items").delete().in("purchase_id", userPurchases.map((p) => p.id));
    }

    await Promise.all([
      adminClient.from("sales").delete().eq("user_id", userId),
      adminClient.from("purchases").delete().eq("user_id", userId),
      adminClient.from("products").delete().eq("user_id", userId),
      adminClient.from("customers").delete().eq("user_id", userId),
      adminClient.from("suppliers").delete().eq("user_id", userId),
      adminClient.from("staffs").delete().eq("user_id", userId),
      adminClient.from("inventory_logs").delete().eq("user_id", userId),
      adminClient.from("due_payments").delete().eq("user_id", userId),
      adminClient.from("product_options").delete().eq("user_id", userId),
      adminClient.from("licenses").delete().eq("user_id", userId),
      adminClient.from("admin_messages").delete().eq("recipient_id", userId),
      adminClient.from("admin_messages").delete().eq("sender_id", userId),
      adminClient.from("profiles").delete().eq("user_id", userId),
      adminClient.from("user_roles").delete().eq("user_id", userId),
      adminClient.from("company_settings").delete().eq("user_id", userId),
      profile?.email
        ? adminClient.from("admin_messages").delete().eq("message_type", "new_signup").ilike("message", `%${profile.email}%`)
        : Promise.resolve(),
      profile?.shop_name
        ? adminClient.from("admin_messages").delete().eq("message_type", "new_signup").eq("subject", `🆕 নতুন সাইনআপ: ${profile.shop_name}`)
        : Promise.resolve(),
      profile?.shop_name
        ? adminClient.from("admin_messages").delete().eq("message_type", "new_signup").ilike("message", `%${profile.shop_name}%`)
        : Promise.resolve(),
    ]);

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return new Response(JSON.stringify({ error: authDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});