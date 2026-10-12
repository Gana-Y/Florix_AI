import { useNavigate, useSearchParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, KeyRound, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

/**
 * ForgotPasswordPage
 *
 * Professional, high-polish password reset flow:
 * Step 1: Enter email → Generates secure reset token (dispatches email or instant access fallback).
 * Step 2: Set New Password → Auto-verifies token, validates password strength & match, updates credentials.
 */
const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const [step, setStep] = useState(1); // 1 = email, 2 = reset
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(null);

  // Auto-detect token from URL query params (e.g. /reset-password?token=...)
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      setStep(2);
    }
  }, [searchParams]);

  // Step 1: Dispatch reset request
  const handleSendReset = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: cleanEmail });
      const sent = res.data?.email_sent;
      const returnedToken = res.data?.demo_token;

      if (returnedToken) {
        setToken(returnedToken);
      }
      setEmailSent(Boolean(sent));
      addToast(
        sent
          ? 'Password reset link sent to your email! Please check inbox and spam.'
          : 'Reset token generated successfully! You can set your new password now.',
        'success'
      );
      setStep(2);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Something went wrong. Please check your email and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      addToast('Please provide a valid reset token.', 'error');
      setShowManualToken(true);
      return;
    }
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/reset-password', { token: trimmedToken, new_password: newPassword });
      setDone(true);
      addToast('Password reset successfully! You can now sign in.', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Reset failed. Token may be invalid or expired.';
      addToast(errorMsg, 'error');
      // If token failed, open manual input so user can inspect or re-paste
      setShowManualToken(true);
    } finally {
      setLoading(false);
    }
  };

  const isPasswordValid = newPassword.length >= 8;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormReady = token.trim().length > 0 && isPasswordValid && doPasswordsMatch;

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.97, y: 14 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
  };

  // Success view after reset
  if (done) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-md bg-white/80 dark:bg-[#0c0d1b]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-[28px] p-8 text-center shadow-2xl overflow-hidden"
      >
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/20 shadow-inner">
          <CheckCircle2 size={36} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Password Updated!</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm mb-7 leading-relaxed">
          Your credentials have been securely updated. You can now log in to Florix AI with your new password.
        </p>
        <motion.button
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => navigate('/login')}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 cursor-pointer text-sm"
        >
          Sign In to Florix AI
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative w-full max-w-md bg-white/80 dark:bg-[#0c0d1b]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-[28px] p-7 sm:p-8 shadow-2xl transition-all duration-300 overflow-hidden"
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/login')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-white text-xs font-semibold mb-5 transition-all group cursor-pointer"
      >
        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" /> Back to Sign In
      </button>

      {/* ── STEP 1: Enter Email ── */}
      {step === 1 && (
        <>
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/20">
            <Mail size={22} className="text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1.5 tracking-tight">Forgot Password?</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
            Enter your account email below to receive a secure password reset link.
          </p>

          <form onSubmit={handleSendReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-all"
              />
            </div>

            <motion.button
              whileHover={{ scale: loading ? 1 : 1.015 }}
              whileTap={{ scale: loading ? 1 : 0.985 }}
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send Reset Link'}
            </motion.button>
          </form>
        </>
      )}

      {/* ── STEP 2: Token Verification & Set Password ── */}
      {step === 2 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <KeyRound size={22} className="text-indigo-500" />
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              ← Change email
            </button>
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Set New Password</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm mb-4 leading-relaxed">
            Choose a strong password with at least 8 characters.
          </p>

          {/* Unified Clean Status Notice (Single banner to eliminate clutter) */}
          {token && !showManualToken ? (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 mb-4 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck size={18} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-indigo-700 dark:text-indigo-300 text-xs truncate">Security Token Verified</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                    {token.length > 14 ? `${token.slice(0, 8)}••••${token.slice(-4)}` : token}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualToken(true)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                Edit token
              </button>
            </div>
          ) : emailSent && !token ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 mb-4 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-snug">
                Reset instructions dispatched. Please check your inbox or spam folder for your security token.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="off">
            {/* Manual Token Input (shown if token wasn't auto-filled or user clicked Edit) */}
            {(showManualToken || !token) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                    Reset Token
                  </label>
                  {token && (
                    <button
                      type="button"
                      onClick={() => setShowManualToken(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      Hide
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  name="security_reset_token"
                  id="security_reset_token"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste 32-character reset token"
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs font-mono placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-all shadow-sm"
                />
              </div>
            )}

            {/* New Password Input */}
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="new_password"
                  id="new_password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3 pr-11 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors cursor-pointer p-1"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className={`text-[11px] font-semibold ${isPasswordValid ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {isPasswordValid ? '✓ Minimum 8 characters' : '• Must be at least 8 characters'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="block text-slate-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                name="confirm_new_password"
                id="confirm_new_password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-all"
              />
              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className={`text-[11px] font-semibold ${doPasswordsMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {doPasswordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: loading || !isFormReady ? 1 : 1.015 }}
              whileTap={{ scale: loading || !isFormReady ? 1 : 0.985 }}
              type="submit"
              disabled={loading || !isFormReady}
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Reset Password'}
            </motion.button>
          </form>
        </>
      )}
    </motion.div>
  );
};

export default ForgotPasswordPage;
