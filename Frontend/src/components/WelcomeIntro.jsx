import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Zap } from 'lucide-react';

const WelcomeIntro = ({ userName, onComplete }) => {
  // Auto-advance after 3.2 seconds
  useEffect(() => {
    const timer = setTimeout(onComplete, 3200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#060611] overflow-hidden"
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
        className="mb-8 p-5 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl"
      >
        <Brain size={52} className="text-indigo-300" strokeWidth={1.8} />
      </motion.div>

      {/* Greeting */}
      <div className="text-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg text-indigo-300/80 font-semibold tracking-widest uppercase mb-3"
        >
          Welcome to Florix AI
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.65, type: 'spring', stiffness: 120, damping: 16 }}
          className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 leading-tight pb-2"
        >
          Hello, {firstName}!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="text-xl text-white/50 mt-5 font-light max-w-md mx-auto"
        >
          Your AI-powered learning workspace is ready.
        </motion.p>
      </div>

      {/* Floating icons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="flex items-center gap-3 mt-10"
      >
        {[Sparkles, Zap, Sparkles].map((Icon, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
            className="text-indigo-400/60"
          >
            <Icon size={20} />
          </motion.div>
        ))}
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="absolute bottom-12 w-48 h-1 bg-white/10 rounded-full overflow-hidden"
      >
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.8, delay: 0.4, ease: 'linear' }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
        />
      </motion.div>
    </motion.div>
  );
};

export default WelcomeIntro;
