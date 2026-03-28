import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LicenseRecord {
  id: string;
  shop_name: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  annual_fee: number;
  license_expiry: string;
  is_blocked: boolean;
  blocked_reason: string;
  status: string;
}

interface LicenseStatus {
  loading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  license: LicenseRecord | null;
  reason: string;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseLicenseDate(date: string) {
  return new Date(`${date}T23:59:59.999Z`);
}

export function useLicenseStatus(): LicenseStatus {
  const { user } = useAuth();
  const [state, setState] = useState<LicenseStatus>({
    loading: true,
    isAdmin: false,
    isBlocked: false,
    license: null,
    reason: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      if (!user) {
        if (!cancelled) {
          setState({ loading: false, isAdmin: false, isBlocked: false, license: null, reason: "" });
        }
        return;
      }

      try {
        const [{ data: adminRole }, { data: license }] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle(),
          supabase
            .from("licenses")
            .select("id, shop_name, owner_name, owner_phone, owner_email, annual_fee, license_expiry, is_blocked, blocked_reason, status")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (adminRole) {
          setState({ loading: false, isAdmin: true, isBlocked: false, license: license as LicenseRecord | null, reason: "" });
          return;
        }

        const typedLicense = (license as LicenseRecord | null) ?? null;
        if (!typedLicense) {
          setState({ loading: false, isAdmin: false, isBlocked: false, license: null, reason: "" });
          return;
        }

        const expiryDate = parseLicenseDate(typedLicense.license_expiry);
        const graceEndsAt = addDays(expiryDate, 2);
        const autoExpired = Date.now() > graceEndsAt.getTime();
        const isBlocked = typedLicense.is_blocked || autoExpired;
        const reason = typedLicense.blocked_reason || (autoExpired ? "License expired and grace period has ended." : "");

        setState({
          loading: false,
          isAdmin: false,
          isBlocked,
          license: typedLicense,
          reason,
        });
      } catch {
        if (!cancelled) {
          setState({ loading: false, isAdmin: false, isBlocked: false, license: null, reason: "" });
        }
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}