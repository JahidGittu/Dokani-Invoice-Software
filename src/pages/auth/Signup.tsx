import { useState, useEffect } from 'react';
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
  const [slide, setSlide] = useState(0);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Auto-slide every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => setSlide(prev => (prev + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  if (!authLoading && user && !signupSuccess) return <Navigate to="/" replace />;

  if (signupSuccess) {
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

  const slides = [
    {
      icon: 'rocket_launch',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-sm">rocket_launch</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'bn' ? 'সহজ সেটআপ' : 'Easy Setup'}</p>
              <p className="text-lg font-black text-gray-900">{lang === 'bn' ? '৫ মিনিটে শুরু' : 'Start in 5 min'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { step: '1', text: lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create account', done: true },
              { step: '2', text: lang === 'bn' ? 'দোকানের তথ্য দিন' : 'Add shop info', done: true },
              { step: '3', text: lang === 'bn' ? 'প্রোডাক্ট যোগ করুন' : 'Add products', done: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {s.done ? '✓' : s.step}
                </div>
                <span className="text-[11px] text-gray-700 font-medium">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      title: lang === 'bn' ? '৫ মিনিটে সবকিছু সেটআপ' : 'Set up everything in 5 minutes',
      desc: lang === 'bn' ? 'দোকানের নাম দিন, প্রোডাক্ট যোগ করুন, বিক্রয় শুরু করুন — এতটুকুই!' : 'Add your shop, products, and start selling — that simple!',
    },
    {
      icon: 'bar_chart',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-sm">bar_chart</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'bn' ? 'এই মাসের বিক্রয়' : "This Month's Sales"}</p>
              <p className="text-lg font-black text-gray-900">৳3,45,600</p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-emerald-600">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span className="text-xs font-bold">+18%</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 justify-center h-10">
            {[35, 55, 40, 70, 50, 85, 65, 90, 55, 75, 60, 45].map((h, i) => (
              <div key={i} className="w-3 rounded-t-sm bg-blue-400/60" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      ),
      title: lang === 'bn' ? 'ব্যবসার রিপোর্ট এক নজরে' : 'Business reports at a glance',
      desc: lang === 'bn' ? 'দৈনিক, সাপ্তাহিক, মাসিক — সব রিপোর্ট অটোমেটিক তৈরি হয়।' : 'Daily, weekly, monthly — all reports generated automatically.',
    },
    {
      icon: 'devices',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      mockup: (
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-sm">devices</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'bn' ? 'যেকোনো ডিভাইসে' : 'Any Device'}</p>
              <p className="text-lg font-black text-gray-900">{lang === 'bn' ? 'ক্লাউড সিঙ্ক' : 'Cloud Sync'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: 'smartphone', label: lang === 'bn' ? 'মোবাইল' : 'Mobile', color: 'bg-green-50 text-green-600' },
              { icon: 'laptop', label: lang === 'bn' ? 'ল্যাপটপ' : 'Laptop', color: 'bg-blue-50 text-blue-600' },
              { icon: 'tablet', label: lang === 'bn' ? 'ট্যাবলেট' : 'Tablet', color: 'bg-orange-50 text-orange-600' },
            ].map((d, i) => (
              <div key={i} className={`rounded-lg p-2.5 text-center ${d.color}`}>
                <span className="material-symbols-outlined text-xl mb-1 block">{d.icon}</span>
                <p className="text-[9px] font-bold">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      ),
      title: lang === 'bn' ? 'মোবাইল, ল্যাপটপ যেকোনো জায়গায়' : 'Access from anywhere, any device',
      desc: lang === 'bn' ? 'ক্লাউডে আপনার সব ডাটা নিরাপদ। ইন্টারনেট থাকলেই চলবে।' : 'Your data is safe in the cloud. Works wherever there is internet.',
    },
  ];


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            shop_name: shopName,
            phone: phone,
          }
        }
      });
      if (error) throw error;
      // Sign out immediately — user must wait for admin activation
      await supabase.auth.signOut();
      setSignupSuccess(true);
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
          <span className="text-xl font-black text-gray-900 tracking-tight">Dokani</span>
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
            {lang === 'bn' ? 'আপনার ব্যবসার জন্য অ্যাকাউন্ট তৈরি করুন' : 'Create an account to manage your business'}
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
          <span>© 2026 Dokani. All rights reserved.</span>
          <span>Privacy Policy</span>
        </div>
      </div>

      {/* Right Side - Blue Hero Panel with Auto-Slider */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden items-center justify-center p-12">
        {/* Decorative circles */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full bg-white/5" />

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Slide content with transition */}
          <div className="relative h-[380px]">
            {slides.map((s, i) => (
              <div
                key={i}
                className="absolute inset-0 transition-all duration-700 ease-in-out"
                style={{
                  opacity: slide === i ? 1 : 0,
                  transform: slide === i ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.95)',
                  pointerEvents: slide === i ? 'auto' : 'none',
                }}
              >
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20 shadow-2xl">
                  {s.mockup}
                </div>
                <h2 className="text-2xl font-black text-white mb-3">{s.title}</h2>
                <p className="text-blue-100 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Dot indicators - clickable */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`rounded-full transition-all duration-300 ${
                  slide === i ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
