import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { Mail, KeyRound, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

/**
 * ForgotPasswordPage — two-step flow:
 * Step 1: Enter email → receive demo token (production: email link)
 * Step 2: Enter token + new password → password reset
 */
const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(1); // 1 = email, 2 = reset
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSendReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: email.trim() });
      addToast('Reset token generated!', 'success');
      // In production, don't show the token — it's only shown for demo purposes
      if (res.data.demo_token) {
        setToken(res.data.demo_token);
      }
      setStep(2);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/reset-password', { token, new_password: newPassword });
      setDone(true);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Reset failed. Token may be expired.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 16 },
    show:   { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25 } },
  };

  if (done) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-md bg-white/70 dark:bg-[#0c0d1b]/50 backdrop-blur-2xl sm:backdrop-blur-3xl border border-white/60 dark:border-white/[0.14] rounded-[28px] sm:rounded-[32px] p-8 sm:p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2),0_0_50px_rgba(99,102,241,0.06)] transition-all duration-300 overflow-hidden"
      >
        {/* Subtle Ambient Sheen at Top of Glass */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-2xl"
          aria-hidden="true"
        />
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-3">Password Reset!</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <motion.button
          whileHover={{ scale: 1.012 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login')}
          className="w-full py-4 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:brightness-110 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 cursor-pointer text-sm sm:text-base"
        >
          Back to Sign In
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative w-full max-w-md bg-white/70 dark:bg-[#0c0d1b]/50 backdrop-blur-2xl sm:backdrop-blur-3xl border border-white/60 dark:border-white/[0.14] rounded-[28px] sm:rounded-[32px] p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2),0_0_50px_rgba(99,102,241,0.06)] transition-all duration-300 overflow-hidden"
    >
      {/* Subtle Ambient Sheen at Top of Glass */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-2xl"
        aria-hidden="true"
      />

      {/* Back button */}
      <button
        onClick={() => navigate('/login')}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/40 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-white text-xs font-semibold mb-6 transition-all group cursor-pointer backdrop-blur-md hover:bg-white/60 dark:hover:bg-white/[0.1] hover:border-white/20"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to Sign In
      </button>

      {/* Step 1: Email */}
      {step === 1 && (
        <>
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/10">
            <Mail size={26} className="text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Forgot Password?</h2>
          <p className="text-slate-400 dark:text-zinc-500 text-xs sm:text-sm mb-6 font-medium leading-relaxed">
            Enter your email address and we'll send you a reset link.
          </p>
          <form onSubmit={handleSendReset} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-100 rounded-2xl px-4.5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/5 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 shadow-sm"
              />
            </div>
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.012 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 flex items-center justify-center gap-2.5 text-sm sm:text-base cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send Reset Link <ArrowLeft size={16} className="rotate-180" /></>}
            </motion.button>
          </form>
        </>
      )}

      {/* Step 2: Token + New Password */}
      {step === 2 && (
        <>
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/10">
            <KeyRound size={26} className="text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Set New Password</h2>
          <p className="text-slate-400 dark:text-zinc-500 text-xs sm:text-sm mb-6 font-medium leading-relaxed">
            Enter the reset token and your new password below.
          </p>

          {/* Demo token notice */}
          {token && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-5 text-sm">
              <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">🔑 Demo Reset Token (Auto-filled)</p>
              <p className="text-amber-600 dark:text-amber-500/80 text-xs">For demonstration, the reset token is filled automatically. In production, this goes to your email.</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">Reset Token</label>
              <input
                type="text"
                required
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste your reset token"
                className="w-full bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-100 rounded-2xl px-4.5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/5 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">New Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-100 rounded-2xl px-4.5 py-3.5 pr-12 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/5 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 shadow-sm"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-500 transition-colors cursor-pointer">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">Confirm Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-100 rounded-2xl px-4.5 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/5 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 shadow-sm"
              />
            </div>
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.012 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 flex items-center justify-center gap-2.5 text-sm sm:text-base cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset Password'}
            </motion.button>
          </form>
        </>
      )}
    </motion.div>
  );
};

export default ForgotPasswordPage;
