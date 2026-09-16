import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

const WelcomeIntro = ({ userName, userId, onComplete }) => {
  // Retrieve saved onboarding answers from localStorage if available
  const onboardingData = useMemo(() => {
    try {
      const stored = localStorage.getItem(`florix_onboarding_${userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [userId]);

  // Auto-advance after 3.8 seconds
  useEffect(() => {
    const timer = setTimeout(onComplete, 3800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const firstName = userName?.trim().split(' ')[0] || 'Student';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#060611] overflow-hidden select-none"
    >
      {/* Animated background orbs */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: 0.25 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] bg-indigo-600 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.3, ease: 'easeOut' }}
        className="absolute bottom-[-20%] right-[-20%] w-[60vw] h-[60vw] bg-purple-600 rounded-full blur-[120px] pointer-events-none"
      />

      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
        className="mb-6 p-5 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl shadow-indigo-500/20"
      >
        <Brain size={52} className="text-indigo-300" strokeWidth={1.8} />
      </motion.div>

      {/* Greeting & Customization */}
      <div className="text-center px-6 max-w-2xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-sm sm:text-base text-indigo-300/80 font-semibold tracking-widest uppercase mb-3 flex items-center justify-center gap-2"
        >
          <Sparkles size={16} className="text-indigo-400" /> Welcome to Florix AI
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 120, damping: 16 }}
          className="text-5xl sm:text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 leading-tight pb-2"
        >
          Hello, {firstName}!
        </motion.h1>

        {/* Personalized field indicator */}
        {onboardingData?.domain && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs sm:text-sm text-indigo-300 font-medium mt-2 mb-3"
          >
            <CheckCircle2 size={14} className="text-emerald-400" />
            Configured for {onboardingData.role || 'Learner'} • {onboardingData.domain}
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="text-lg sm:text-xl text-white/60 mt-3 font-light max-w-md mx-auto"
        >
          Your AI-powered learning workspace is fully calibrated and ready.
        </motion.p>

        {/* Interactive Enter Workspace Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="mt-8 flex justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99,102,241,0.5)' }}
            whileTap={{ scale: 0.96 }}
            onClick={onComplete}
            className="px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 flex items-center gap-2.5 transition-all cursor-pointer"
          >
            Enter Workspace <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="absolute bottom-10 w-52 h-1 bg-white/10 rounded-full overflow-hidden"
      >
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 3.5, delay: 0.3, ease: 'linear' }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
        />
      </motion.div>
    </motion.div>
  );
};

export default WelcomeIntro;
