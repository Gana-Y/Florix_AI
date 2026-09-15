import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import {
  Brain, Upload, MessageSquare, BookOpen, Zap, Shield,
  ArrowRight, Sparkles, CheckCircle, Star, Camera,
  TrendingUp, Quote, Users, FileText, Award,
} from 'lucide-react';
import QuantumCore3D from '../components/QuantumCore3D';

/* ─── Mouse Spotlight Hook ─────────────────────────────── */
const useCursorSpotlight = () => {
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 25, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 25, mass: 0.5 });

  useEffect(() => {
    const move = (e) => { mouseX.set(e.clientX); mouseY.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mouseX, mouseY]);

  return { springX, springY };
};

/* ─── 3D Tilt Card ─────────────────────────────────────── */
const TiltCard = ({ children, className, glowColor = 'rgba(99,102,241,0.25)' }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);

  const rotateX = useTransform(y, [-60, 60], [10, -10]);
  const rotateY = useTransform(x, [-60, 60], [-10, 10]);
  const glowX = useTransform(x, [-60, 60], ['20%', '80%']);
  const glowY = useTransform(y, [-60, 60], ['20%', '80%']);

  const springRotX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0); y.set(0); setIsHovered(false);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: springRotX,
        rotateY: springRotY,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
      }}
      className={`relative overflow-hidden backdrop-blur-xl bg-[#0a0d18]/85 ${className}`}
    >
      {/* Moving inner glow on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-2xl"
            style={{
              left: glowX,
              top: glowY,
              background: glowColor,
              filter: 'blur(40px)',
              transform: 'translate(-50%, -50%)',
              opacity: 0.6,
            }}
          />
        )}
      </AnimatePresence>
      <div style={{ transform: 'translateZ(20px)' }}>{children}</div>
    </motion.div>
  );
};

/* ─── Floating Particle ────────────────────────────────── */
const Particle = ({ delay, x, y, size, duration }) => (
  <motion.div
    className="absolute rounded-full bg-indigo-400/30 pointer-events-none"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2], scale: [1, 1.3, 1] }}
    transition={{ duration, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

/* ─── Animated Counter ─────────────────────────────────── */
const AnimatedCounter = ({ value, suffix, isDecimal }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
    }, 1800 / steps);
    return () => clearInterval(timer);
  }, [isInView, value, isDecimal]);

  return <span ref={ref}>{isDecimal ? count.toFixed(1) : count.toLocaleString()}{suffix}</span>;
};

/* ─── Magnetic Button ──────────────────────────────────── */
const MagneticButton = ({ children, onClick, className }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 400, damping: 25 });
  const springY = useSpring(y, { stiffness: 400, damping: 25 });

  const handleMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.35);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.35);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
};

/* ─── Data ─────────────────────────────────────────────── */
const features = [
  { icon: Upload,        title: 'Upload & Learn',        desc: 'Upload PDFs, paste text, add YouTube links, or record audio. Florix AI processes everything instantly.', gradient: 'from-blue-500 to-cyan-400',    glow: 'rgba(59,130,246,0.3)',   border: 'hover:border-blue-500/40' },
  { icon: MessageSquare, title: 'Chat with Your Docs',   desc: 'Ask questions about your content. Get accurate, context-aware answers from your own study materials.',   gradient: 'from-indigo-500 to-purple-500', glow: 'rgba(99,102,241,0.3)',  border: 'hover:border-indigo-500/40' },
  { icon: Zap,           title: 'Smart Quizzes',          desc: 'Auto-generated multiple-choice quizzes from any content. Test yourself and track your score over time.',  gradient: 'from-amber-500 to-orange-400',  glow: 'rgba(245,158,11,0.3)',  border: 'hover:border-amber-500/40' },
  { icon: BookOpen,      title: 'Flashcard Decks',        desc: 'AI-generated flashcard decks built from your study materials. Study smarter, not harder.',                gradient: 'from-emerald-500 to-teal-400',  glow: 'rgba(16,185,129,0.3)', border: 'hover:border-emerald-500/40' },
  { icon: Sparkles,      title: 'AI Summaries',           desc: 'Get structured Markdown summaries of any document in seconds. Highlight the essentials instantly.',       gradient: 'from-purple-500 to-pink-500',   glow: 'rgba(168,85,247,0.3)', border: 'hover:border-purple-500/40' },
  { icon: Camera,        title: 'Screenshot OCR',         desc: 'Upload images, diagrams, or screenshots. Gemini Vision extracts and explains every detail for you.',      gradient: 'from-rose-500 to-red-400',      glow: 'rgba(244,63,94,0.3)',  border: 'hover:border-rose-500/40' },
];

const steps = [
  { step: '01', title: 'Create Free Account', desc: 'Sign up in 30 seconds. No credit card required.' },
  { step: '02', title: 'Upload Your Content',  desc: 'Add a PDF, YouTube video, website link, or paste text.' },
  { step: '03', title: 'Study with AI',        desc: 'Chat, quiz yourself, and learn faster than ever before.' },
];

const testimonials = [
  { name: 'Ananya S.', role: 'Medical Student',     text: 'This replaced all my textbook highlighting! I finished my anatomy revision in 2 hours instead of 2 days.', rating: 5, initials: 'AS' },
  { name: 'Rahul M.',  role: 'Engineering Student', text: 'Got 94% on my exam using Florix AI quizzes. The AI actually understands context — not just keywords.',       rating: 5, initials: 'RM' },
  { name: 'Priya K.',  role: 'Law Student',          text: 'The PDF chat feature is unreal. I can ask questions about case studies and get instant, precise answers.',    rating: 5, initials: 'PK' },
];

const trustedBy = ['PDF Documents', 'YouTube Videos', 'Web Articles', 'Audio Recordings', 'Screenshots & Images'];

const STATS = [
  { value: 10000, label: 'Students',  suffix: '+',  icon: Users,    isDecimal: false },
  { value: 50000, label: 'Documents', suffix: '+',  icon: FileText, isDecimal: false },
  { value: 99,    label: 'Accuracy',  suffix: '%',  icon: Award,    isDecimal: false },
  { value: 4.9,   label: 'Rating',    suffix: '★',  icon: Star,     isDecimal: true  },
];

const particles = Array.from({ length: 14 }, (_, i) => ({
  id: i, delay: i * 0.4,
  x: Math.random() * 100, y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  duration: Math.random() * 3 + 4,
}));

/* ─── Animation Variants ───────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

/* ─── Component ─────────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();
  const { springX, springY } = useCursorSpotlight();

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden relative">

      {/* ── Global Cursor Spotlight ── */}
      <motion.div
        className="fixed pointer-events-none z-0"
        style={{
          left: springX,
          top: springY,
          translateX: '-50%',
          translateY: '-50%',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          filter: 'blur(20px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* ── 3D Scroll-Driven Quantum Knowledge Core (Non-blocking, behind content) ── */}
      <QuantumCore3D />

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-16 py-5 sticky top-0 backdrop-blur-md bg-transparent">
        <div className="flex items-center gap-3">
          <motion.div whileHover={{ rotate: 15, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400 }}
            className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/25"
          >
            <Brain size={22} className="text-indigo-400" strokeWidth={2.5} />
          </motion.div>
          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Florix AI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-24 pb-20 max-w-5xl mx-auto overflow-hidden">
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((p) => <Particle key={p.id} {...p} />)}
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center relative z-10">
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full text-indigo-400 text-sm font-semibold mb-8"
          >
            <motion.span animate={{ rotate: [0, 20, -10, 20, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
              <Sparkles size={14} />
            </motion.span>
            Powered by Advanced AI
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.08]"
          >
            Study Smarter.{' '}
            <br />
            <motion.span
              className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400"
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              style={{ backgroundSize: '200% 200%' }}
            >
              Learn 10× Faster.
            </motion.span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Upload your study materials. Chat with an AI that actually knows your content.
            Auto-generate quizzes, flashcards, and summaries in seconds.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] flex items-center gap-2 text-lg transition-all duration-300 w-full sm:w-auto justify-center cursor-pointer"
            >
              Start for Free <ArrowRight size={20} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] text-white font-semibold rounded-2xl transition-all duration-300 text-lg w-full sm:w-auto cursor-pointer"
            >
              Sign In
            </button>
          </motion.div>

          {/* Animated Stats */}
          <motion.div variants={stagger} className="flex flex-wrap items-center justify-center gap-4 mb-12">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ scale: 1.06, y: -3 }}
                className="flex items-center gap-2.5 px-5 py-3 bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-sm cursor-default transition-shadow hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]"
              >
                <s.icon size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xl font-black text-white">
                  <AnimatedCounter value={s.value} suffix={s.suffix} isDecimal={s.isDecimal} />
                </span>
                <span className="text-zinc-500 text-sm">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Works with pills */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-zinc-600 text-sm">Works with:</span>
            {trustedBy.map((t, i) => (
              <motion.span
                key={t}
                whileHover={{ scale: 1.05, borderColor: 'rgba(99,102,241,0.5)' }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/8 rounded-full text-xs font-medium text-zinc-400 hover:text-indigo-400 transition-colors cursor-default"
              >
                <CheckCircle size={12} className="text-emerald-500" /> {t}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 px-6 md:px-16 py-24 max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Everything You Need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Study Smarter</span>
            </h2>
            <p className="text-zinc-400 text-lg">One platform. Every AI tool you need.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp}>
                <TiltCard
                  glowColor={f.glow}
                  className={`p-6 bg-white/[0.04] border border-white/8 rounded-3xl transition-all duration-300 ${f.border} cursor-default h-full`}
                >
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 6 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <f.icon size={22} className="text-white" />
                  </motion.div>
                  <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative z-10 px-6 py-24 max-w-4xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">How It Works</h2>
            <p className="text-zinc-400 text-lg">Get started in under 2 minutes.</p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-start justify-center gap-4 md:gap-0">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <motion.div variants={fadeUp} className="flex-1 px-4">
                  <TiltCard
                    glowColor="rgba(99,102,241,0.2)"
                    className="text-center group p-6 rounded-2xl border border-transparent hover:border-indigo-500/20 transition-all"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/25 flex items-center justify-center group-hover:border-indigo-500/50 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all"
                    >
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400">
                        {s.step}
                      </span>
                    </motion.div>
                    <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{s.desc}</p>
                  </TiltCard>
                </motion.div>
                {i < steps.length - 1 && (
                  <motion.div
                    variants={fadeUp}
                    className="hidden md:flex items-center justify-center self-start mt-10 shrink-0 text-indigo-500/40"
                  >
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowRight size={22} />
                    </motion.div>
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Testimonials ── */}
      <section className="relative z-10 px-6 md:px-16 py-24 max-w-5xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Loved by{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Students</span>
            </h2>
            <p className="text-zinc-400 text-lg">Join thousands who study smarter every day.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fadeUp}>
                <TiltCard
                  glowColor="rgba(99,102,241,0.2)"
                  className="p-6 bg-white/[0.04] border border-white/8 rounded-3xl hover:border-indigo-500/30 transition-all duration-300 h-full cursor-default"
                >
                  <Quote size={20} className="text-indigo-500/60 mb-4" />
                  <p className="text-zinc-300 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{t.name}</p>
                      <p className="text-zinc-500 text-xs">{t.role}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} size={12} className="text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="relative z-10 px-6 py-24 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <TiltCard
            glowColor="rgba(99,102,241,0.35)"
            className="p-12 rounded-[32px] border border-indigo-500/25 cursor-default"
            style={{ background: 'linear-gradient(135deg, rgba(12,15,28,0.95), rgba(18,14,35,0.92))', backdropFilter: 'blur(24px)', boxShadow: '0 0 80px rgba(99,102,241,0.15)' }}
          >
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-4xl md:text-5xl font-black mb-4 relative">Ready to Study Smarter?</h2>
            <p className="text-zinc-400 mb-8 text-lg relative">Start for free. No credit card. No limits on curiosity.</p>
            <button
              onClick={() => navigate('/signup')}
              className="relative px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-2xl shadow-indigo-500/40 text-lg transition-all"
            >
              Get Started Free →
            </button>
          </TiltCard>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 px-12 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-indigo-500" />
            <span className="font-bold text-zinc-400">Florix AI</span>
          </div>
          <p className="text-zinc-600 text-sm">© 2026 Florix AI — Intelligent Study Companion</p>
          <div className="flex gap-5">
            <button onClick={() => navigate('/login')} className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">Sign In</button>
            <button onClick={() => navigate('/signup')} className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">Get Started</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
