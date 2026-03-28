import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { useI18n } from '@/lib/i18n';
import LicenseExpiredView from '@/components/LicenseExpiredView';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, isRoleLoading, isAdmin } = useUserRole();
  const { loading: licenseLoading, isBlocked, license, reason } = useLicenseStatus();
  const { lang } = useI18n();

  if (authLoading || licenseLoading || isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin trying to access shop routes → redirect to admin
  if (isAdmin && !requireAdmin) return <Navigate to="/admin" replace />;

  // Non-admin trying to access admin routes
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;

  // Shop owner: no license = pending activation
  if (!requireAdmin && !isAdmin && !license && !isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl border p-8 space-y-5">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-amber-600 text-4xl">hourglass_top</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">
              {lang === 'bn' ? 'অ্যাকাউন্ট অ্যাক্টিভেশন অপেক্ষায়' : 'Account Pending Activation'}
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              {lang === 'bn'
                ? 'আপনার অ্যাকাউন্ট তৈরি হয়েছে কিন্তু এখনও System Admin দ্বারা অ্যাক্টিভেট করা হয়নি। অনুগ্রহ করে অপেক্ষা করুন অথবা নিচের নম্বরে যোগাযোগ করুন।'
                : 'Your account has been created but has not been activated by System Admin yet. Please wait or contact us below.'}
            </p>
            <div className="bg-blue-50 rounded-xl p-4 text-left space-y-1">
              <p className="text-xs font-bold text-blue-800">{lang === 'bn' ? 'যোগাযোগ করুন:' : 'Contact us:'}</p>
              <p className="text-xs text-blue-700">📞 01777615690</p>
              <p className="text-xs text-blue-700">✉️ admin@dokani.com.bd</p>
            </div>
            <button onClick={signOut} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
              <span className="material-symbols-outlined text-lg">logout</span>
              {lang === 'bn' ? 'লগআউট' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // License blocked/expired
  if (!requireAdmin && isBlocked) {
    return (
      <LicenseExpiredView
        shopName={license?.shop_name}
        ownerName={license?.owner_name}
        expiryDate={license?.license_expiry}
        annualFee={license?.annual_fee}
        supportPhone="01777615690"
        supportEmail="admin@dokani.com.bd"
        reason={reason}
        onSignOut={signOut}
      />
    );
  }

  return <>{children}</>;
}
