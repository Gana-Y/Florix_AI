import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Brain, Sparkles, Activity, ShieldCheck, Zap } from 'lucide-react';

const STEPS = [
  {
    title: 'Who are you?',
    subtitle: 'Help us personalise your experience',
    field: 'role',
    options: [
      { label: 'Student', emoji: '🎓' },
      { label: 'Working Professional', emoji: '💼' },
      { label: 'Researcher', emoji: '🔬' },
      { label: 'Freelancer', emoji: '🧑‍💻' },
      { label: 'Entrepreneur', emoji: '🚀' },
      { label: 'Educator', emoji: '📚' },
      { label: 'Job Seeker', emoji: '🎯' },
      { label: 'Other', emoji: '✨' },
    ],
  },
  {
    title: 'Your domain or field?',
    subtitle: 'We will tailor content suggestions for you',
    field: 'domain',
    options: [
      { label: 'Information Technology', emoji: '💻' },
      { label: 'Data Science & AI', emoji: '🤖' },
      { label: 'Medicine & Healthcare', emoji: '⚕️' },
      { label: 'Law', emoji: '⚖️' },
      { label: 'Business & Finance', emoji: '📈' },
      { label: 'Engineering', emoji: '⚙️' },
      { label: 'Design & Creative Arts', emoji: '🎨' },
      { label: 'Mathematics', emoji: '∑' },
      { label: 'Languages & Literature', emoji: '📖' },
      { label: 'Other', emoji: '🌐' },
    ],
  },
  {
    title: 'Where did you hear about us?',
    subtitle: 'We appreciate you spreading the word',
    field: 'source',
    options: [
      { label: 'Twitter / X', emoji: '𝕏' },
      { label: 'YouTube', emoji: '▶️' },
      { label: 'Instagram', emoji: '📸' },
      { label: 'LinkedIn', emoji: '🔗' },
      { label: 'Google Search', emoji: '🔍' },
      { label: 'Friend or Colleague', emoji: '🤝' },
      { label: 'Reddit', emoji: '👾' },
      { label: 'Product Hunt', emoji: '🐱' },
      { label: 'Other', emoji: '💬' },
    ],
  },
];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 80 : -80 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -80 : 80 }),
};

const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState({ role: '', domain: '', source: '' });
  const currentStep = STEPS[step];
  const selected = answers[currentStep.field];
  const isLast = step === STEPS.length - 1;

  const handleSelect = (label) => {
    setAnswers(prev => ({ ...prev, [currentStep.field]: label }));
  };

  const handleNext = () => {
    if (!selected) return;
    if (isLast) {
      onComplete(answers);
    } else {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    setStep(s => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#04060e] text-white overflow-hidden flex flex-col lg:flex-row">
      
      {/* ── LEFT HALF: AUTHENTIC 4K LASER BEAM & FLORIX AI APP DECK ── */}
      <div className="hidden lg:flex lg:w-1/2 relative h-full overflow-hidden items-center justify-center bg-[#04060e] select-none">
        {/* The single board that supports the beam - curvy & translucent */}
        <div
          className="absolute rounded-[20px] bg-[#080e1c]/70 backdrop-blur-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_30px_rgba(56,189,248,0.04)]"
          style={{ left: '8%', width: '77.7%', top: '44%', height: '42.5%', zIndex: 10 }}
        />

        {/* Authentic 4K Laser Beam Video (Screen blend mode renders black box transparent, beam & waterfall 100% luminous) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute max-w-none pointer-events-none"
            style={{
              width: '146%',
              height: 'auto',
              left: '-19%',
              top: '-3%',
              filter: 'contrast(1.18) brightness(1.06) saturate(1.15)',
              mixBlendMode: 'screen',
            }}
          >
            <source src="/videos/onboarding-beam.webm" type="video/webm" />
            <source src="/videos/onboarding-beam.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Ambient Atmospheric Lightning Flash across Upper Clouds */}
        <motion.div
          animate={{
            opacity: [0.05, 0.25, 0.05, 0.5, 0.1, 0.05],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            times: [0, 0.42, 0.45, 0.48, 0.52, 1],
            ease: "easeInOut",
          }}
          className="absolute inset-0 bg-gradient-to-b from-indigo-500/15 via-transparent to-transparent mix-blend-screen pointer-events-none"
          style={{ zIndex: 16 }}
        />

        {/* Atmospheric Edge Vignettes */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#04060e] to-transparent pointer-events-none z-20" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#04060e] to-transparent pointer-events-none z-20" />
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#04060e] to-transparent pointer-events-none z-20" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#04060e] to-transparent pointer-events-none z-20" />

        {/* Brand Header */}
        <div className="absolute top-8 left-8 z-30 flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl">
            <Brain size={24} className="text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-black tracking-widest uppercase text-white block">FLORIX AI</span>
            <span className="text-[10px] tracking-wider text-indigo-300/70 font-semibold block">INTELLIGENT ACADEMIC WORKSPACE</span>
          </div>
        </div>

        {/* Content inside the single board (comfortably shifted downside below the flare line) */}
        <div
          className="absolute pointer-events-none flex flex-col items-center justify-center text-center px-6"
          style={{ left: '8%', width: '77.7%', top: '58.5%', height: '29%', zIndex: 25 }}
        >
          {/* Brand Eyebrow */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-[1px] bg-gradient-to-r from-transparent to-cyan-400/60" />
            <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-cyan-300 font-bold uppercase">
              INTELLIGENT WORKSPACE
            </span>
            <div className="w-5 h-[1px] bg-gradient-to-l from-transparent to-cyan-400/60" />
          </div>

          {/* Core Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="text-3xl sm:text-4xl lg:text-[38px] font-black tracking-[0.32em] text-white drop-shadow-[0_0_35px_rgba(129,140,248,0.65)] select-none leading-none my-1"
          >
            FLORIX
          </motion.h1>

          {/* Subtitle */}
          <span className="text-[9.5px] sm:text-[10.5px] tracking-[0.22em] text-indigo-300/75 uppercase font-semibold mb-2">
            Next-Gen Academic Engine
          </span>

          {/* Small Florix AI Intro */}
          <p className="text-[11px] sm:text-[12px] leading-relaxed text-zinc-300/85 max-w-[360px] font-normal mb-2.5">
            Your unified cognitive workspace engineered to analyze research papers, synthesize complex lectures, and accelerate academic mastery.
          </p>

          {/* Intelligent Capabilities Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/[0.04] border border-white/10 text-cyan-300/90 tracking-wide">
              ✦ Autonomous RAG
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/[0.04] border border-white/10 text-indigo-300/90 tracking-wide">
              ✦ Concept Synthesis
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/[0.04] border border-white/10 text-purple-300/90 tracking-wide">
              ✦ Deep Recall
            </span>
          </div>
        </div>

      </div>

      {/* ── MOBILE TOP BANNER (< lg) ── */}
      <div className="lg:hidden relative w-full h-44 sm:h-52 shrink-0 overflow-hidden bg-[#04060e]">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover mix-blend-lighten pointer-events-none scale-105"
          style={{
            filter: 'contrast(1.26) brightness(1.15) saturate(1.32)',
          }}
        >
          <source src="/videos/onboarding-beam.webm" type="video/webm" />
          <source src="/videos/onboarding-beam.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060e] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="p-1.5 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
            <Brain size={18} className="text-indigo-400" />
          </div>
          <span className="text-xs font-black tracking-wider uppercase text-white">FLORIX AI</span>
        </div>
      </div>

      {/* ── RIGHT HALF: 3 ONBOARDING QUESTIONS ── */}
      <div className="flex-1 h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto custom-scrollbar relative z-10 bg-[#04060e]">
        
        {/* Top Progress & Header */}
        <div className="max-w-xl w-full mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Step {step + 1}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs text-zinc-400 font-medium">Setup</span>
            </div>

            {/* Glowing Segmented Progress Bar */}
            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === step ? 32 : 10,
                    backgroundColor: i <= step ? '#818cf8' : 'rgba(255,255,255,0.12)',
                    boxShadow: i === step ? '0 0 12px rgba(129,140,248,0.5)' : 'none',
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-2 rounded-full"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Step Content Area */}
        <div className="max-w-xl w-full mx-auto my-auto py-4">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">
                  {currentStep.title}
                </h2>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                  {currentStep.subtitle}
                </p>
              </div>

              {/* Options Grid: Sleek, horizontal cards that never squish or clip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentStep.options.map((opt) => {
                  const isSelected = selected === opt.label;
                  return (
                    <motion.button
                      key={opt.label}
                      onClick={() => handleSelect(opt.label)}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 border-indigo-400 text-white shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-1 ring-indigo-400/50'
                          : 'bg-white/[0.04] border-white/10 text-zinc-300 hover:border-white/25 hover:text-white hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className="text-xl shrink-0 p-1 rounded-xl bg-white/[0.05] border border-white/5">{opt.emoji}</span>
                      <span className="text-xs sm:text-sm font-semibold leading-tight flex-1 truncate">{opt.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/50"
                        >
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Actions Area */}
        <div className="max-w-xl w-full mx-auto pt-6">
          <div className="flex items-center justify-between gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/15 text-zinc-400 font-semibold text-xs sm:text-sm disabled:opacity-20 hover:border-white/30 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Back
            </motion.button>

            <motion.button
              whileHover={{ scale: selected ? 1.02 : 1 }}
              whileTap={{ scale: selected ? 0.98 : 1 }}
              onClick={handleNext}
              disabled={!selected}
              className={`flex-1 flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-white transition-all cursor-pointer ${
                selected
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:brightness-110'
                  : 'bg-white/10 cursor-not-allowed opacity-35'
              }`}
            >
              <span>{isLast ? 'Get Started 🚀' : 'Continue'}</span>
              {!isLast && <ChevronRight size={16} />}
            </motion.button>
          </div>

          <p className="text-center text-zinc-500 text-[11px] mt-4 font-medium">
            Step {step + 1} of {STEPS.length} • Powered by Florix Intelligence
          </p>
        </div>

      </div>
    </div>
  );
};

export default OnboardingFlow;
