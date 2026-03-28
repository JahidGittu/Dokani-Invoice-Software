import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

export default function Signup() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            shop_name: shopName,
            phone: phone,
          }
        }
      });
      if (error) throw error;
      toast.success(lang === 'bn' ? 'অ্যাকাউন্ট তৈরি হয়েছে! ইমেইল চেক করুন।' : 'Account created! Check your email to verify.');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Signup Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 bg-white relative">
        {/* Logo */}
        <div className="absolute top-8 left-6 sm:left-12 lg:left-20 flex items-center gap-2.5">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">store</span>
          </div>
          <span className="text-xl font-black text-gray-900 tracking-tight">TilePOS</span>
        </div>

        {/* Language Toggle */}
        <div className="absolute top-8 right-6 sm:right-12 lg:right-20">
          <div className="bg-gray-100 rounded-full p-0.5 flex">
            <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>EN</button>
            <button onClick={() => setLang('bn')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'bn' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>বাং</button>
          </div>
        </div>

        <div className="max-w-[400px] w-full mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Create Account'}
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {lang === 'bn' ? 'আপনার ব্যবসার জন্য ফ্রি অ্যাকাউন্ট তৈরি করুন' : 'Create a free account to manage your business'}
          </p>

          {/* Google Signup */}
          <button onClick={handleGoogleLogin} disabled={loading}
            className="w-full py-3 bg-white border border-gray-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all mb-5 disabled:opacity-50 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {lang === 'bn' ? 'Google দিয়ে সাইন আপ' : 'Sign up with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase">{lang === 'bn' ? 'অথবা ইমেইল দিয়ে' : 'or continue with email'}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'bn' ? 'দোকানের নাম' : 'Shop Name'}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">storefront</span>
                <input type="text" value={shopName} onChange={e => setShopName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder={lang === 'bn' ? 'যেমন: রহমান টাইলস' : 'e.g. Rahman Tiles'} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">phone</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="01XXXXXXXXX" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'bn' ? 'ইমেইল' : 'Email Address'}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">lock</span>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-12 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {lang === 'bn' ? 'তৈরি হচ্ছে...' : 'Creating...'}
                </span>
              ) : (lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Account')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {lang === 'bn' ? 'আগে থেকে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
            <Link to="/login" className="text-blue-600 font-bold hover:text-blue-700">
              {lang === 'bn' ? 'লগইন করুন' : 'Log In'}
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-6 sm:left-12 lg:left-20 right-6 sm:right-12 lg:right-20 flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 TilePOS. All rights reserved.</span>
          <span>Privacy Policy</span>
        </div>
      </div>

      {/* Right Side - Blue Hero Panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden items-center justify-center p-12">
        {/* Decorative circles */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full bg-white/5" />

        <div className="relative z-10 text-center max-w-md">
          {/* Features list */}
          <div className="space-y-4 mb-8">
            {[
              { icon: 'inventory_2', title: lang === 'bn' ? 'স্টক ম্যানেজমেন্ট' : 'Stock Management', desc: lang === 'bn' ? 'সব প্রোডাক্ট ট্র্যাক করুন' : 'Track all your products' },
              { icon: 'point_of_sale', title: lang === 'bn' ? 'সেলস POS' : 'Sales POS', desc: lang === 'bn' ? 'দ্রুত বিক্রয় করুন' : 'Quick and easy billing' },
              { icon: 'group', title: lang === 'bn' ? 'কাস্টমার ম্যানেজমেন্ট' : 'Customer Management', desc: lang === 'bn' ? 'বাকি ও লেনদেন ট্র্যাক করুন' : 'Track dues & transactions' },
              { icon: 'bar_chart', title: lang === 'bn' ? 'রিপোর্ট ও এনালিটিক্স' : 'Reports & Analytics', desc: lang === 'bn' ? 'ব্যবসার হিসাব দেখুন' : 'Business insights at a glance' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-left">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white">{f.icon}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{f.title}</p>
                  <p className="text-blue-200 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-black text-white mb-3">
            {lang === 'bn' ? 'আজই শুরু করুন — ফ্রি!' : 'Start Today — It\'s Free!'}
          </h2>
          <p className="text-blue-100 text-sm">
            {lang === 'bn'
              ? 'বাংলাদেশের টাইলস শোরুমের জন্য সেরা POS সফটওয়্যার'
              : 'The best POS software for tiles showrooms in Bangladesh'}
          </p>
        </div>
      </div>
    </div>
  );
}
