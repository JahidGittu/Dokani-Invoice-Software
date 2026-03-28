import { createClient } from "npm:@supabase/supabase-js@2.100.1";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  userId: z.string().uuid(),
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureNoError<T extends { error: { message: string } | null }>(promise: Promise<T>) {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, { error: "Missing server configuration" });
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { error: "Unauthorized" });
    }

    const requesterId = claimsData.claims.sub;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(400, { error: parsed.error.flatten().fieldErrors });
    }

    const { userId } = parsed.data;
    if (userId === requesterId) {
      return json(400, { error: "Invalid user" });
    }

    const { data: requesterRole, error: requesterRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .maybeSingle();

    if (requesterRoleError) throw new Error(requesterRoleError.message);
    if (!requesterRole) {
      return json(403, { error: "Forbidden" });
    }

    const { data: targetRole, error: targetRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (targetRoleError) throw new Error(targetRoleError.message);
    if (targetRole) {
      return json(400, { error: "Cannot delete admin" });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("email, shop_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const { data: userSales, error: userSalesError } = await adminClient
      .from("sales")
      .select("id")
      .eq("user_id", userId);
    if (userSalesError) throw new Error(userSalesError.message);

    const { data: userPurchases, error: userPurchasesError } = await adminClient
      .from("purchases")
      .select("id")
      .eq("user_id", userId);
    if (userPurchasesError) throw new Error(userPurchasesError.message);

    if (userSales?.length) {
      await ensureNoError(adminClient.from("sale_items").delete().in("sale_id", userSales.map((sale) => sale.id)));
    }

    if (userPurchases?.length) {
      await ensureNoError(adminClient.from("purchase_items").delete().in("purchase_id", userPurchases.map((purchase) => purchase.id)));
    }

    await Promise.all([
      ensureNoError(adminClient.from("sales").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("purchases").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("products").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("customers").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("suppliers").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("staffs").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("inventory_logs").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("due_payments").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("product_options").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("licenses").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("admin_messages").delete().eq("recipient_id", userId)),
      ensureNoError(adminClient.from("admin_messages").delete().eq("sender_id", userId)),
      ensureNoError(adminClient.from("profiles").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("user_roles").delete().eq("user_id", userId)),
      ensureNoError(adminClient.from("company_settings").delete().eq("user_id", userId)),
      profile?.email
        ? ensureNoError(adminClient.from("admin_messages").delete().eq("message_type", "new_signup").ilike("message", `%${profile.email}%`))
        : Promise.resolve(),
      profile?.shop_name
        ? ensureNoError(adminClient.from("admin_messages").delete().eq("message_type", "new_signup").eq("subject", `🆕 নতুন সাইনআপ: ${profile.shop_name}`))
        : Promise.resolve(),
      profile?.shop_name
        ? ensureNoError(adminClient.from("admin_messages").delete().eq("message_type", "new_signup").ilike("message", `%${profile.shop_name}%`))
        : Promise.resolve(),
    ]);

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw new Error(authDeleteError.message);
    }

    return json(200, { success: true });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});