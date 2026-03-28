import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

export default function SignupSuccess() {
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl border p-8 space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">
            {lang === 'bn' ? 'অ্যাকাউন্ট তৈরি হয়েছে!' : 'Account Created!'}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {lang === 'bn'
              ? 'আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। System Admin আপনার অ্যাকাউন্ট অ্যাক্টিভেট করলে আপনি লগইন করতে পারবেন। অনুগ্রহ করে অপেক্ষা করুন।'
              : 'Your account has been created successfully. You will be able to login once the System Admin activates your account. Please wait for activation.'}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">hourglass_top</span>
              <p className="text-sm font-bold text-amber-800">
                {lang === 'bn' ? 'অ্যাক্টিভেশন পেন্ডিং' : 'Activation Pending'}
              </p>
            </div>
            <p className="text-xs text-amber-700">
              {lang === 'bn'
                ? 'আপনার অ্যাকাউন্ট এখন পর্যালোচনাধীন। অ্যাডমিন অনুমোদন দিলে আপনাকে জানানো হবে।'
                : 'Your account is under review. You will be notified once admin approves it.'}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-left space-y-1">
            <p className="text-xs font-bold text-blue-800">{lang === 'bn' ? 'যোগাযোগ করুন:' : 'Contact us:'}</p>
            <p className="text-xs text-blue-700">📞 01777615690</p>
            <p className="text-xs text-blue-700">✉️ admin@dokani.com.bd</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            {lang === 'bn' ? 'লগইন পেজে যান' : 'Go to Login'}
          </Link>
        </div>
      </div>
    </div>
  );
}
