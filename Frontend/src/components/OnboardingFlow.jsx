import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState({ role: '', domain: '', source: '' });
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.55;
    }
  }, []);

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
    if (step === 0) {
      navigate('/');
    } else {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };



  return (
    <div className="fixed inset-0 z-[90] bg-[#02040a] text-white overflow-hidden flex flex-col lg:flex-row">

      {/* 🌌 FULL-SCREEN CINEMATIC BLACK HOLE BACKGROUND (100% UNBROKEN VIEW) 🌌 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 0.55; }}
          onPlay={(e) => { e.currentTarget.playbackRate = 0.55; }}
          className="w-full h-full object-cover scale-[1.02] pointer-events-none"
          style={{
            filter: 'brightness(0.96) contrast(1.12) saturate(1.22)',
          }}
        >
          <source src="/videos/SpaceVideo.mp4" type="video/mp4" />
        </video>
        {/* Soft edge-only vignette (no center splits or vertical dividers) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 40% 50%, transparent 45%, rgba(2,4,10,0.55) 100%)' }}
        />
      </div>

      {/* ── TOP-LEFT ORBITAL BRAND HUD ── */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-30 flex items-center gap-3 select-none">
        <div className="p-2.5 bg-black/45 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_0_25px_rgba(0,0,0,0.8)]">
          <Brain size={24} className="text-cyan-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-widest uppercase text-white block">FLORIX AI</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-mono tracking-wider">ORBITAL STATION</span>
          </div>
          <span className="text-[10px] tracking-wider text-indigo-200/80 font-medium block">DEEP COGNITIVE CALIBRATION</span>
        </div>
      </div>



      {/* ── LEFT HALF: UNOBSTRUCTED VISTA OF GARGANTUA / BLACK HOLE ── */}
      <div className="hidden lg:flex lg:w-5/12 relative h-full pointer-events-none z-10" />

      {/* ── MOBILE HEADER (< lg) ── */}
      <div className="lg:hidden relative w-full pt-6 px-6 pb-2 shrink-0 z-20 flex items-center gap-2">
        <div className="p-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/20">
          <Brain size={18} className="text-cyan-400" />
        </div>
        <span className="text-xs font-black tracking-wider uppercase text-white">FLORIX AI</span>
      </div>

      {/* ── RIGHT HALF: FLOATING HOLOGRAPHIC COCKPIT CONSOLE (ZERO SCROLLBARS, ZERO LINES) ── */}
      <div
        data-lenis-prevent="true"
        className="flex-1 h-full flex flex-col justify-between p-4 sm:p-6 lg:p-7 overflow-y-auto no-scrollbar scroll-smooth relative z-20 bg-transparent"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >

        {/* Top Progress & Telemetry */}
        <div className="max-w-xl w-full mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">MISSION STEP {step + 1}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-xs text-zinc-300 font-medium">03</span>
            </div>

            {/* Glowing Segmented Space Progress Bar */}
            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === step ? 36 : 10,
                    backgroundColor: i <= step ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                    boxShadow: i === step ? '0 0 16px rgba(56,189,248,0.7)' : 'none',
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-2 rounded-full"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Floating Holographic Console Box */}
        <div className="max-w-xl w-full mx-auto my-auto py-1">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative p-5 sm:p-7 rounded-3xl bg-black/45 border border-white/15 backdrop-blur-md shadow-[0_20px_70px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] select-none"
            >
              {/* Sci-Fi HUD Corner Reticles */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />

              <div className="mb-4 sm:mb-5">
                <span className="text-[10px] tracking-[0.25em] text-cyan-400 font-mono uppercase block mb-1">
                  ✦ COGNITIVE PROFILE TELEMETRY
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] mb-1.5">
                  {currentStep.title}
                </h2>
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                  {currentStep.subtitle}
                </p>
              </div>

              {/* Options Grid: Holographic Interactive Pads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentStep.options.map((opt) => {
                  const isSelected = selected === opt.label;
                  return (
                    <motion.button
                      key={opt.label}
                      onClick={() => handleSelect(opt.label)}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer backdrop-blur-md ${
                        isSelected
                          ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_25px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/60'
                          : 'bg-black/50 border-white/15 text-zinc-200 hover:border-cyan-400/50 hover:text-white hover:bg-black/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                      }`}
                    >
                      <span className="text-lg sm:text-xl shrink-0 p-1.5 rounded-xl bg-white/[0.08] border border-white/10">{opt.emoji}</span>
                      <span className="text-xs sm:text-sm font-semibold leading-tight flex-1 truncate drop-shadow">{opt.label}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center shrink-0 shadow-md shadow-cyan-400/50"
                        >
                          <Check size={12} className="text-black" strokeWidth={3} />
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
        <div className="max-w-xl w-full mx-auto pt-4">
          <div className="flex items-center justify-between gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBack}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black/45 border border-white/20 text-zinc-300 font-semibold text-xs sm:text-sm hover:border-white/40 hover:text-white transition-all cursor-pointer backdrop-blur-sm shadow-lg hover:bg-black/65"
            >
              <ChevronLeft size={16} />
              <span>{step === 0 ? 'Exit to Home' : 'Back'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: selected ? 1.02 : 1 }}
              whileTap={{ scale: selected ? 0.98 : 1 }}
              onClick={handleNext}
              disabled={!selected}
              className={`flex-1 flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-xs sm:text-sm text-white transition-all cursor-pointer shadow-xl ${
                selected
                  ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 ring-1 ring-cyan-400/50'
                  : 'bg-white/10 cursor-not-allowed opacity-35'
              }`}
            >
              <span>{isLast ? 'Initiate Workspace 🚀' : 'Confirm & Proceed'}</span>
              {!isLast && <ChevronRight size={16} />}
            </motion.button>
          </div>

          <p className="text-center text-zinc-400 text-[11px] mt-4 font-mono font-medium drop-shadow">
            SECTOR 0{step + 1} OF 0{STEPS.length} // FLORIX COGNITIVE TELEMETRY
          </p>
        </div>

      </div>
    </div>
  );
};

export default OnboardingFlow;
