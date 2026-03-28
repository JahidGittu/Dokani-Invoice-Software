import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LicenseRow = {
  id: string;
  user_id: string;
  shop_name: string;
  owner_name: string;
  owner_email: string;
  annual_fee: number;
  license_expiry: string;
  is_blocked: boolean;
  blocked_reason: string;
};

function parseDate(date: string) {
  return new Date(`${date}T23:59:59.999Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const systemSenderId = adminRole?.user_id ?? null;

  const { data: licenses, error: licensesError } = await supabase
    .from("licenses")
    .select("id, user_id, shop_name, owner_name, owner_email, annual_fee, license_expiry, is_blocked, blocked_reason")
    .order("created_at", { ascending: true });

  if (licensesError) {
    return new Response(JSON.stringify({ error: licensesError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let warned = 0;
  let blocked = 0;
  const today = new Date();

  for (const license of (licenses ?? []) as LicenseRow[]) {
    const expiryDate = parseDate(license.license_expiry);
    const warningStartsAt = addDays(expiryDate, -7);
    const graceEndsAt = addDays(expiryDate, 2);

    if (!license.is_blocked && today.getTime() > graceEndsAt.getTime()) {
      const { error: updateError } = await supabase
        .from("licenses")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: "License expired and grace period ended.",
          status: "blocked",
        })
        .eq("id", license.id);

      if (!updateError) {
        blocked += 1;
        await supabase.from("admin_messages").insert({
          sender_id: systemSenderId ?? license.user_id,
          recipient_id: license.user_id,
          subject: "⛔ License blocked",
          message: `আপনার ${license.shop_name} লাইসেন্সের মেয়াদ ও ২ দিনের grace period শেষ হয়েছে। পুনরায় ব্যবহার করতে annual renewal fee ৳${Number(license.annual_fee || 0).toLocaleString()} পরিশোধ করুন।`,
          message_type: "license_warning",
          is_read: false,
        });
      }

      continue;
    }

    const inWarningWindow = today.getTime() >= warningStartsAt.getTime() && today.getTime() <= expiryDate.getTime();
    if (!license.is_blocked && inWarningWindow) {
      const { count } = await supabase
        .from("admin_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", license.user_id)
        .eq("message_type", "license_warning")
        .gte("created_at", warningStartsAt.toISOString());

      if (!count) {
        const { error: msgError } = await supabase.from("admin_messages").insert({
          sender_id: systemSenderId ?? license.user_id,
          recipient_id: license.user_id,
          subject: "⚠️ License expiring soon",
          message: `প্রিয় ${license.owner_name || "গ্রাহক"}, আপনার ${license.shop_name} লাইসেন্স ${license.license_expiry} তারিখে শেষ হবে। সময়মতো রিনিউ না করলে মেয়াদ শেষের ২ দিন পর access auto-block হয়ে যাবে। Renewal fee: ৳${Number(license.annual_fee || 0).toLocaleString()}.`,
          message_type: "license_warning",
          is_read: false,
        });

        if (!msgError) {
          warned += 1;
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: licenses?.length ?? 0, warned, blocked }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});