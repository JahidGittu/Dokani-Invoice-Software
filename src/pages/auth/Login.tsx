import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);

  // Auto-slide every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => setSlide(prev => (prev + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  if (!authLoading && user) return <Navigate to="/" replace />;

  const slides = [
    {
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-sm">trending_up</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Total Sales</p>
              <p className="text-lg font-black text-gray-900">৳1,89,374</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-blue-50 rounded-lg p-2"><p className="text-[9px] text-gray-400">Products</p><p className="text-sm font-bold text-gray-900">1,248</p></div>
            <div className="flex-1 bg-green-50 rounded-lg p-2"><p className="text-[9px] text-gray-400">Customers</p><p className="text-sm font-bold text-gray-900">356</p></div>
            <div className="flex-1 bg-purple-50 rounded-lg p-2"><p className="text-[9px] text-gray-400">Orders</p><p className="text-sm font-bold text-gray-900">6,248</p></div>
          </div>
        </div>
      ),
      title: lang === 'bn' ? 'আপনার ব্যবসা ম্যানেজ করুন সহজে' : 'Effortlessly manage your business',
      desc: lang === 'bn' ? 'TilePOS দিয়ে আপনার টাইলস শোরুমের বিক্রয়, স্টক, কাস্টমার সব এক জায়গায়।' : 'Manage your tiles showroom sales, stock & customers all in one place.',
    },
    {
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-sm">receipt_long</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'bn' ? 'ইনভয়েস' : 'Invoice'} #INV-2458</p>
              <p className="text-lg font-black text-gray-900">৳52,480</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {['RAK Glossy 60x60 — 25 ctn', 'DBL Matt 40x40 — 10 ctn', 'Labour — ৳1,200'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="material-symbols-outlined text-gray-400 text-xs">check_circle</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      ),
      title: lang === 'bn' ? 'প্রফেশনাল ইনভয়েস তৈরি করুন' : 'Create professional invoices',
      desc: lang === 'bn' ? 'এক ক্লিকে ইনভয়েস প্রিন্ট করুন, PDF ডাউনলোড করুন।' : 'Print invoices or download PDFs with a single click.',
    },
    {
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-600 text-sm">group</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'bn' ? 'বকেয়া ট্র্যাকিং' : 'Due Tracking'}</p>
              <p className="text-lg font-black text-gray-900">৳1,25,000</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { name: 'আব্দুল করিম', due: '৳45,000', color: 'bg-red-50 text-red-600' },
              { name: 'রহিম উদ্দিন', due: '৳32,000', color: 'bg-orange-50 text-orange-600' },
              { name: 'জামাল হোসেন', due: '৳28,000', color: 'bg-yellow-50 text-yellow-600' },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-gray-700 font-medium">{c.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.color}`}>{c.due}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      title: lang === 'bn' ? 'বকেয়া ও লেনদেন ট্র্যাক করুন' : 'Track dues & transactions',
      desc: lang === 'bn' ? 'কাস্টমার ও সাপ্লায়ারের বকেয়া, আংশিক পেমেন্ট সব হিসাব রাখুন।' : 'Keep track of customer & supplier dues with partial payment support.',
    },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
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

  const handleResetPassword = async () => {
    if (!email) {
      toast.error(lang === 'bn' ? 'প্রথমে ইমেইল দিন' : 'Enter your email first');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast.success(lang === 'bn' ? 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!' : 'Password reset link sent!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 bg-white relative">
        {/* Logo */}
        <div className="absolute top-8 left-6 sm:left-12 lg:left-20 flex items-center gap-2.5">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">store</span>
          </div>
          <span className="text-xl font-black text-gray-900 tracking-tight">TilePOS</span>
        </div>

        {/* Language Toggle - top right */}
        <div className="absolute top-8 right-6 sm:right-12 lg:right-20">
          <div className="bg-gray-100 rounded-full p-0.5 flex">
            <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>EN</button>
            <button onClick={() => setLang('bn')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${lang === 'bn' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>বাং</button>
          </div>
        </div>

        <div className="max-w-[400px] w-full mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            {lang === 'bn' ? 'স্বাগতম!' : 'Welcome Back'}
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {lang === 'bn' ? 'আপনার অ্যাকাউন্টে লগইন করুন' : 'Enter your email and password to access your account.'}
          </p>

          {/* Google Login */}
          <button onClick={handleGoogleLogin} disabled={loading}
            className="w-full py-3 bg-white border border-gray-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all mb-5 disabled:opacity-50 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {lang === 'bn' ? 'Google দিয়ে লগইন' : 'Sign in with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase">{lang === 'bn' ? 'অথবা ইমেইল দিয়ে' : 'or continue with email'}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-600">{lang === 'bn' ? 'মনে রাখুন' : 'Remember me'}</span>
              </label>
              <button type="button" onClick={handleResetPassword} className="text-sm text-blue-600 font-semibold hover:text-blue-700">
                {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {lang === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...'}
                </span>
              ) : (lang === 'bn' ? 'লগইন করুন' : 'Log In')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {lang === 'bn' ? 'অ্যাকাউন্ট নেই?' : "Don't Have An Account?"}{' '}
            <Link to="/signup" className="text-blue-600 font-bold hover:text-blue-700">
              {lang === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'Register Now'}
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
        <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full bg-white/5" />

        <div className="relative z-10 text-center max-w-md">
          {/* Dashboard mockup card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20 shadow-2xl">
            <div className="bg-white rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600 text-sm">trending_up</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Total Sales</p>
                  <p className="text-lg font-black text-gray-900">৳1,89,374</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-blue-50 rounded-lg p-2">
                  <p className="text-[9px] text-gray-400">Products</p>
                  <p className="text-sm font-bold text-gray-900">1,248</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-lg p-2">
                  <p className="text-[9px] text-gray-400">Customers</p>
                  <p className="text-sm font-bold text-gray-900">356</p>
                </div>
                <div className="flex-1 bg-purple-50 rounded-lg p-2">
                  <p className="text-[9px] text-gray-400">Orders</p>
                  <p className="text-sm font-bold text-gray-900">6,248</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/20 rounded-lg h-16" />
              <div className="flex-1 bg-white/20 rounded-lg h-16" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            {lang === 'bn' ? 'আপনার ব্যবসা ম্যানেজ করুন সহজে' : 'Effortlessly manage your business'}
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            {lang === 'bn'
              ? 'TilePOS দিয়ে আপনার টাইলস শোরুমের বিক্রয়, স্টক, কাস্টমার সব এক জায়গায় ম্যানেজ করুন।'
              : 'Log in to access your POS dashboard and manage your tiles showroom sales, stock & customers.'}
          </p>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-6">
            <div className="w-2 h-2 rounded-full bg-white" />
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <div className="w-2 h-2 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
