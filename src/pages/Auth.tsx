import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

export default function Auth() {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        toast.success(lang === 'bn' ? 'অ্যাকাউন্ট তৈরি হয়েছে! ইমেইল চেক করুন।' : 'Account created! Check your email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast.success(lang === 'bn' ? 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!' : 'Password reset link sent!');
      setMode('login');
    } catch (err: any) {
      toast.error(err.message);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="material-symbols-outlined text-white text-3xl">store</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">TilePOS</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lang === 'bn' ? 'আপনার ব্যবসা ম্যানেজ করুন সহজে' : 'Manage your business with ease'}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-full p-1 shadow-sm border flex">
            <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>English</button>
            <button onClick={() => setLang('bn')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${lang === 'bn' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>বাংলা</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border p-6 sm:p-8">
          {mode === 'reset' ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-xl font-bold text-center mb-2">
                {lang === 'bn' ? 'পাসওয়ার্ড রিসেট' : 'Reset Password'}
              </h2>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">
                {loading ? '...' : lang === 'bn' ? 'রিসেট লিংক পাঠান' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-sm text-blue-600 font-medium">
                {lang === 'bn' ? 'লগইনে ফিরুন' : 'Back to Login'}
              </button>
            </form>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setMode('login')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {lang === 'bn' ? 'লগইন' : 'Login'}
                </button>
                <button onClick={() => setMode('signup')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${mode === 'signup' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Sign Up'}
                </button>
              </div>

              {/* Google Login */}
              <button onClick={handleGoogleLogin} disabled={loading}
                className="w-full py-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {lang === 'bn' ? 'Google দিয়ে লগইন' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{lang === 'bn' ? 'অথবা' : 'or'}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">{lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
                </div>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('reset')} className="text-xs text-blue-600 font-medium">
                    {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
                  </button>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">
                  {loading ? '...' : mode === 'login' 
                    ? (lang === 'bn' ? 'লগইন' : 'Login') 
                    : (lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Account')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {lang === 'bn' ? 'নিরাপদ ক্লাউড ব্যাকআপ সহ' : 'With secure cloud backup'} · TilePOS v2.0
        </p>
      </div>
    </div>
  );
}
