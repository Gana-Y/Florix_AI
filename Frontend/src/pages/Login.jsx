import { useNavigate } from 'react-router-dom';
import React, { useState, useContext } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Eye, EyeOff, ArrowLeft, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, oauthLogin } = useContext(AuthContext);
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailDirty, setEmailDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔮 Social OAuth States
  const [oauthModal, setOauthModal] = useState({ show: false, provider: '' });
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthName, setOauthName] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  const isEmailValid =
    email.trim().length > 0 &&
    !email.includes(' ') &&
    /^[\w\.-]+@[\w\.-]+\.\w+$/.test(email.trim());

  const isPasswordValid = password.length > 0;
  const isFormValid = isEmailValid && isPasswordValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent double-submit spam

    setEmailDirty(true);
    if (!isFormValid) {
      setError('Please enter a valid email address and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      addToast('Login successful! 🎉', 'success');
      if (res?.user?.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      if (!err.response) {
        setError('Server is offline. Please check your network connection or verify that the backend is running.');
      } else if (err.response.status === 401) {
        setError('Incorrect email or password. Please verify your credentials and try again.');
      } else {
        const errorMsg = err.response.data?.detail || err.message || 'Failed to login';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOauthSubmit = async (e) => {
    e.preventDefault();
    if (oauthLoading) return;
    setOauthLoading(true);
    setError('');
    try {
      const res = await oauthLogin(oauthModal.provider, oauthEmail.trim(), oauthName.trim());
      addToast(`Signed in successfully with ${oauthModal.provider === 'google' ? 'Google' : 'GitHub'}! 🎉`, 'success');
      setOauthModal({ show: false, provider: '' });
      if (res?.user?.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'OAuth Sign-in failed. Please try again.');
    } finally {
      setOauthLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 16 },
    show:   { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25, staggerChildren: 0.04 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
  };

  const modalVariants = {
    hidden:  { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
    exit:    { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.18 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      data-lenis-prevent="true"
      className="w-full max-w-md px-4"
    >
      <div className="relative bg-white/70 dark:bg-[#0c0d1b]/50 backdrop-blur-2xl sm:backdrop-blur-3xl border border-white/60 dark:border-white/[0.14] rounded-[28px] sm:rounded-[32px] p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2),0_0_50px_rgba(99,102,241,0.06)] transition-all duration-300 overflow-hidden">

        {/* Subtle Ambient Sheen at Top of Glass */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-2xl"
          aria-hidden="true"
        />

        {/* Back to Home Button */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/40 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-white text-xs font-semibold mb-6 transition-all group cursor-pointer backdrop-blur-md hover:bg-white/60 dark:hover:bg-white/[0.1] hover:border-white/20"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to Home
        </button>

        {/* Logo and Titles */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-indigo-500/15 dark:bg-indigo-500/20 backdrop-blur-xl rounded-2xl border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <Brain size={32} className="text-indigo-600 dark:text-cyan-300" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Florix AI
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm mt-1.5 font-medium">
            Welcome back — let's keep learning 🚀
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Compact Error Alert */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 backdrop-blur-md"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email field */}
          <motion.div variants={itemVariants} className="space-y-1">
            <label className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide px-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailDirty(true)}
              required
              placeholder="you@example.com"
              className={`w-full bg-white/50 dark:bg-black/30 backdrop-blur-md border text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 transition-all text-xs placeholder:text-slate-400 dark:placeholder:text-zinc-500 shadow-sm ${
                emailDirty && !isEmailValid
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15'
                  : 'border-slate-200/70 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-400 dark:focus:border-indigo-400 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/20 focus:bg-white/80 dark:focus:bg-black/45'
              }`}
            />
          </motion.div>

          {/* Password field */}
          <motion.div variants={itemVariants} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">Password</label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/50 dark:bg-black/30 backdrop-blur-md border border-slate-200/70 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3.5 pr-12 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/20 focus:bg-white/80 dark:focus:bg-black/45 transition-all text-xs placeholder:text-slate-400 dark:placeholder:text-zinc-500 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </motion.div>

          {/* Submit button */}
          <motion.div variants={itemVariants} className="pt-2">
            <motion.button
              type="submit"
              disabled={loading || !isFormValid}
              whileHover={{ scale: (loading || !isFormValid) ? 1 : 1.012, y: (loading || !isFormValid) ? 0 : -0.5 }}
              whileTap={{ scale: (loading || !isFormValid) ? 1 : 0.98 }}
              className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 flex items-center justify-center gap-2.5 text-sm sm:text-base cursor-pointer"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : 'Log In'}
            </motion.button>
          </motion.div>
        </form>

        {/* OR separator */}
        <motion.div variants={itemVariants} className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-200/60 dark:border-white/10"></div>
          <span className="flex-shrink mx-3.5 text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-widest">Or continue with</span>
          <div className="flex-grow border-t border-slate-200/60 dark:border-white/10"></div>
        </motion.div>

        {/* Social OAuth buttons */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => { setOauthModal({ show: true, provider: 'google' }); setOauthEmail('google-student@florix.ai'); setOauthName('Google Student'); }}
            className="flex items-center justify-center gap-2 py-3 border border-slate-200/70 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-white/25 bg-white/40 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 rounded-2xl text-xs font-bold transition-all hover:bg-white/60 dark:hover:bg-white/[0.08] backdrop-blur-md shadow-sm hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.68 0-8.5-3.82-8.5-8.5s3.82-8.5 8.5-8.5c2.182 0 4.114.786 5.618 2.29l3.055-3.055C18.665.98 15.655 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c7.064 0 11.758-4.964 11.758-11.973 0-.818-.082-1.418-.218-2.227H12.24z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => { setOauthModal({ show: true, provider: 'github' }); setOauthEmail('github-developer@florix.ai'); setOauthName('GitHub Developer'); }}
            className="flex items-center justify-center gap-2 py-3 border border-slate-200/70 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-white/25 bg-white/40 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 rounded-2xl text-xs font-bold transition-all hover:bg-white/60 dark:hover:bg-white/[0.08] backdrop-blur-md shadow-sm hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </button>
        </motion.div>

        <motion.p variants={itemVariants} className="text-center text-slate-400 dark:text-zinc-500 text-xs sm:text-sm mt-8 font-semibold">
          New here?{' '}
          <span
            onClick={() => navigate('/signup')}
            className="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline font-bold transition-all"
          >
            Create account
          </span>
        </motion.p>
      </div>

      {/* 🔮 Social OAuth Simulation Modal */}
      <AnimatePresence>
        {oauthModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setOauthModal({ show: false, provider: '' })}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <form onSubmit={handleOauthSubmit} className="flex flex-col gap-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-indigo-500/20">
                    <ShieldAlert size={24} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-white capitalize">
                    {oauthModal.provider} Login Simulator
                  </h3>
                  <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1.5 leading-relaxed font-medium">
                    Testing local sandbox. Simulates OAuth provider profile return for standard backend JWT generation.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Mock Name</label>
                    <input
                      type="text" required value={oauthName}
                      onChange={(e) => setOauthName(e.target.value)}
                      placeholder="OAuth User Name"
                      className="w-full p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Mock Email</label>
                    <input
                      type="email" required value={oauthEmail}
                      onChange={(e) => setOauthEmail(e.target.value)}
                      placeholder="user@oauth.com"
                      className="w-full p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 text-xs font-bold"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={oauthLoading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl disabled:opacity-50 transition-colors text-xs tracking-wide uppercase shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {oauthLoading ? <Loader2 className="animate-spin text-white" size={14} /> : 'Complete Social Login'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Login;