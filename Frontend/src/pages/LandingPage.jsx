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
  TrendingUp, Quote, Users, FileText, Award, Crown, Check,
} from 'lucide-react';
import CinematicStarfield from '../components/CinematicStarfield';
import FeatureShowcaseHuly from '../components/FeatureShowcaseHuly';
import KnowledgeStudioShowcase from '../components/KnowledgeStudioShowcase';
import ChronometerCTA from '../components/ChronometerCTA';

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

/* ─── 3D Tilt Card (GPU-Accelerated & Memoized) ───────────────────────── */
const TiltCard = React.memo(({ children, className, glowColor = 'rgba(99,102,241,0.25)' }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);

  const rotateX = useTransform(y, [-60, 60], [10, -10]);
  const rotateY = useTransform(x, [-60, 60], [-10, 10]);
  const glowX = useTransform(x, [-60, 60], [-50, 50]);
  const glowY = useTransform(y, [-60, 60], [-50, 50]);

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
        willChange: isHovered ? 'transform' : 'auto',
      }}
      className={`relative overflow-hidden bg-[#0a0d18]/92 border border-white/8 ${className}`}
    >
      {/* Moving inner glow on hover — strictly GPU transform (no top/left layout triggers) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute w-32 h-32 rounded-full blur-2xl top-1/2 left-1/2"
            style={{
              x: glowX,
              y: glowY,
              translateX: '-50%',
              translateY: '-50%',
              background: glowColor,
              filter: 'blur(40px)',
              willChange: 'transform',
            }}
          />
        )}
      </AnimatePresence>
      <div style={{ transform: 'translateZ(20px)' }}>{children}</div>
    </motion.div>
  );
});


/* ─── Animated Counter ─────────────────────────────────── */
const AnimatedCounter = React.memo(({ value, suffix, isDecimal }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const steps = 24;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
    }, 1200 / steps);
    return () => clearInterval(timer);
  }, [isInView, value, isDecimal]);

  return <span ref={ref}>{isDecimal ? count.toFixed(1) : count.toLocaleString()}{suffix}</span>;
});

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
  { value: 1500,  label: 'Students',  suffix: '+',  icon: Users,    isDecimal: false },
  { value: 1500,  label: 'Documents', suffix: '+',  icon: FileText, isDecimal: false },
  { value: 99,    label: 'Accuracy',  suffix: '%',  icon: Award,    isDecimal: false },
  { value: 4.9,   label: 'Rating',    suffix: '★',  icon: Star,     isDecimal: true  },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    icon: Star,
    badge: null,
    highlight: false,
    gradient: 'from-slate-500 to-slate-600',
    glow: 'rgba(148, 163, 184, 0.2)',
    border: 'border-white/10 hover:border-white/20',
    description: 'Perfect for exploring and getting started with AI learning.',
    features: [
      '10 study documents',
      'Images & PDFs (max 10 MB)',
      'Short videos (max 25 MB)',
      'Paste up to 500 words',
      '10 quizzes & 80 AI chats daily',
      '10 flashcards per session',
    ],
    ctaText: 'Get Started Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹799',
    period: 'month',
    icon: Zap,
    badge: 'Most Popular',
    highlight: true,
    gradient: 'from-indigo-500 to-purple-600',
    glow: 'rgba(99, 102, 241, 0.4)',
    border: 'border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.2)]',
    description: 'For dedicated students who need higher limits and rapid AI speeds.',
    features: [
      '50 study documents',
      'Files & PDFs (max 50 MB)',
      'Lecture videos (max 100 MB)',
      'Paste up to 4,000 words',
      'In-depth Web & YouTube scraping',
      '20 quizzes & 300 AI chats daily',
      '30 flashcards per session',
      'Priority AI response speeds',
    ],
    ctaText: 'Upgrade to Pro',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹1,599',
    period: 'month',
    icon: Crown,
    badge: 'Best Value',
    highlight: false,
    gradient: 'from-amber-500 to-orange-600',
    glow: 'rgba(245, 158, 11, 0.35)',
    border: 'border-amber-500/30 hover:border-amber-500/50',
    description: 'Zero restrictions, unlimited documents, and dedicated GPU compute.',
    features: [
      'Unlimited study documents',
      'Large files (max 100 MB)',
      'HD videos (max 250 MB)',
      'Paste up to 15,000 words',
      'Unlimited voice dictation',
      'Unlimited quizzes & AI chats',
      '50 flashcards per session',
      'Dedicated GPU Priority AI',
    ],
    ctaText: 'Get Ultimate Access',
  },
];

/* ─── Animation Variants (Optimized 60fps) ───────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

/* ─── Component ─────────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();
  const { springX, springY } = useCursorSpotlight();
  const heroVideoRef = useRef(null);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        requestAnimationFrame(() => video.play().catch(() => {}));
      } else {
        video.pause();
      }
    }, { threshold: 0.05 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#060713] text-white relative select-none w-full max-w-[100vw] overflow-x-clip no-scrollbar">

      {/* ── Global Cursor Spotlight (GPU-Composited, Zero Reflow) ── */}
      <motion.div
        className="fixed pointer-events-none z-0"
        style={{
          x: springX,
          y: springY,
          left: 0,
          top: 0,
          translateX: '-50%',
          translateY: '-50%',
          width: 550,
          height: 550,
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.04) 45%, transparent 70%)',
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      />

      {/* ── Global Unified Atmospheric Lighting Canvas (Continuous Top-to-Bottom Flow) ── */}
      <div 
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none" 
        style={{ transform: 'translate3d(0, 0, 0)', contain: 'paint' }}
        aria-hidden="true"
      >
        {/* Upper Space Apex: Subtle cosmic violet wash */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1400px] h-[700px] bg-gradient-to-b from-indigo-600/12 via-purple-700/6 to-transparent rounded-full blur-[150px]" />

        {/* ── THE SEAMLESS TRANSITION CORRIDOR (Spans Hero-to-Features Boundary: y: 650px to 1400px) ── */}
        {/* Continuous gradual atmospheric wash: Dark -> subtle dark purple -> deep blue/purple -> lower section */}
        <div
          className="absolute top-[650px] left-0 w-full h-[750px]"
          style={{
            background: 'linear-gradient(180deg, rgba(6,7,19,0) 0%, rgba(18,14,38,0.25) 25%, rgba(32,22,68,0.38) 55%, rgba(20,15,45,0.20) 80%, rgba(6,7,19,0) 100%)',
          }}
        />

        {/* Deep blue/purple atmospheric aura in the lower hero & features header */}
        <div className="absolute top-[800px] left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-purple-600/10 via-indigo-600/12 to-transparent rounded-full blur-[160px]" />

        {/* ── Middle Sections Shining Diamond Stars (Sparse, Organic Celestial Accents) ── */}
        {/* Features Section Flanks */}
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '4%', top: '1120px', width: '2.5px', height: '2.5px', '--twinkle-dur': '5.0s', '--twinkle-delay': '0.8s' }} />
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '96%', top: '1280px', width: '2.6px', height: '2.6px', '--twinkle-dur': '4.6s', '--twinkle-delay': '2.1s' }} />
        {/* How It Works Flanks */}
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '6%', top: '1850px', width: '2.4px', height: '2.4px', '--twinkle-dur': '5.4s', '--twinkle-delay': '1.3s' }} />
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '94%', top: '2020px', width: '2.6px', height: '2.6px', '--twinkle-dur': '4.8s', '--twinkle-delay': '3.2s' }} />
        {/* Testimonials Flanks */}
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '5%', top: '2580px', width: '2.5px', height: '2.5px', '--twinkle-dur': '5.1s', '--twinkle-delay': '0.5s' }} />
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '95%', top: '2720px', width: '2.7px', height: '2.7px', '--twinkle-dur': '4.7s', '--twinkle-delay': '2.4s' }} />
        {/* CTA Banner Flanks */}
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '12%', top: '3220px', width: '2.5px', height: '2.5px', '--twinkle-dur': '5.0s', '--twinkle-delay': '1.7s' }} />
        <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '88%', top: '3250px', width: '2.6px', height: '2.6px', '--twinkle-dur': '4.4s', '--twinkle-delay': '3.0s' }} />

        {/* Features Section Lateral Cosmic Nebulae (Bleeds upward and downward naturally) */}
        <div className="absolute top-[1200px] left-[-15%] w-[800px] h-[800px] bg-purple-700/10 rounded-full blur-[180px]" />
        <div className="absolute top-[1400px] right-[-15%] w-[800px] h-[800px] bg-indigo-700/10 rounded-full blur-[180px]" />

        {/* How It Works & Testimonials Lateral Glows */}
        <div className="absolute top-[2100px] left-[-12%] w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[180px]" />
        <div className="absolute top-[2500px] right-[-12%] w-[750px] h-[750px] bg-purple-600/8 rounded-full blur-[180px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-30 flex items-center justify-between px-3.5 sm:px-6 md:px-16 py-3.5 sm:py-5 sticky top-0 backdrop-blur-md bg-transparent">
        {/* Header Subtle Shining Diamond Stars */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none -z-10" aria-hidden="true">
          <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '10%', top: '35%', width: '2.4px', height: '2.4px', '--twinkle-dur': '4.8s', '--twinkle-delay': '0.3s' }} />
          <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '48%', top: '22%', width: '2.6px', height: '2.6px', '--twinkle-dur': '5.2s', '--twinkle-delay': '1.7s' }} />
          <span className="absolute rounded-full bg-white animate-diamond" style={{ left: '92%', top: '40%', width: '2.5px', height: '2.5px', '--twinkle-dur': '4.6s', '--twinkle-delay': '2.8s' }} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <motion.div whileHover={{ rotate: 15, scale: 1.1 }} transition={{ type: 'spring', stiffness: 400 }}
            className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/25 cursor-pointer"
          >
            <Brain size={20} className="text-indigo-400 sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
          </motion.div>
          <span className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 cursor-default">
            Florix AI
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <a
            href="#pricing"
            className="hidden sm:inline-block text-sm font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Pricing
          </a>
          <motion.button
            whileHover={{ scale: 1.05, color: '#ffffff' }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={() => navigate('/login')}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2, boxShadow: '0 0 25px rgba(99,102,241,0.5)' }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={() => navigate('/signup')}
            className="px-3 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="sm:hidden">Get Started</span>
            <span className="hidden sm:inline">Get Started Free</span>
          </motion.button>
        </div>
      </nav>

      {/* ── Hero (Outer Full-Width & Full-Height Canvas) ── */}
      <section className="relative z-10 w-full min-h-[calc(100vh-80px)] flex flex-col justify-center items-center py-16 md:py-24">
        {/* ── Layer 4: 1080p Reflect-Style Black Hole Eclipse (Positioned to frame hero, non-blocking) ── */}
        <div
          className="absolute top-[115px] sm:top-[138px] md:top-[158px] lg:top-[178px] left-1/2 -translate-x-1/2 w-[950px] sm:w-[1220px] md:w-[1480px] lg:w-[1720px] pointer-events-none z-0 select-none opacity-88 mix-blend-screen overflow-hidden"
          style={{
            maskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black 20%, rgba(0,0,0,0.65) 45%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black 20%, rgba(0,0,0,0.65) 45%, transparent 75%)',
            filter: 'brightness(1.05)',
          }}
        >
          <video
            ref={heroVideoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-auto object-contain pointer-events-none"
          >
            <source src="/assets/hero-black-hole.webm" type="video/webm" />
            <source src="/assets/hero-black-hole.mp4" type="video/mp4" />
          </video>
        </div>

        {/* ── Layer 5: Sparse Cinematic Night-Sky Stars (Spans full canvas, corridors preserved) ── */}
        <CinematicStarfield />

        {/* ── Inner Hero Content Container (Preserved exact max-width and child layout) ── */}
        <div className="w-full max-w-5xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center relative z-10 w-full">
            {/* ── Layer 6: Localized Text Contrast Shield (Seamless, invisible contrast pillow) ── */}
            <div
              className="pointer-events-none absolute -inset-x-16 -top-12 -bottom-10 rounded-[72px] -z-10 select-none"
              style={{
                background: 'radial-gradient(ellipse 75% 65% at 50% 38%, rgba(6,7,19,0.90) 0%, rgba(6,7,19,0.58) 52%, transparent 100%)',
                filter: 'blur(20px)',
              }}
              aria-hidden="true"
            />

            {/* AI Badge (Layer 7) */}
            <motion.div
              variants={fadeUp}
              whileHover={{ scale: 1.05, borderColor: 'rgba(99,102,241,0.5)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full text-indigo-400 text-sm font-semibold mb-8 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.5)] cursor-default"
            >
              <motion.span animate={{ rotate: [0, 20, -10, 20, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                <Sparkles size={14} />
              </motion.span>
              Powered by Advanced AI
            </motion.div>

            {/* Hero Heading (Layer 7) */}
            <motion.h1
              variants={fadeUp}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[1.08] relative z-10"
            >
              <span className="text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                Study Smarter.
              </span>
              <br />
              <motion.span
                className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]"
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                style={{ backgroundSize: '200% 200%' }}
              >
                Learn 10× Faster.
              </motion.span>
            </motion.h1>

            {/* Subtitle (Layer 7) */}
            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl md:text-2xl text-zinc-300/90 max-w-2xl mx-auto mb-12 leading-relaxed relative z-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
            >
              Upload your study materials. Chat with an AI that actually knows your content.
              Auto-generate quizzes, flashcards, and summaries in seconds.
            </motion.p>

            {/* Buttons (Layer 8) */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 relative z-20">
              <motion.button
                whileHover={{ scale: 1.05, y: -3, boxShadow: '0 0 35px rgba(99,102,241,0.65)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={() => navigate('/signup')}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center gap-2 text-lg transition-all duration-300 w-full sm:w-auto justify-center cursor-pointer"
              >
                Start for Free <ArrowRight size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, y: -3, borderColor: 'rgba(255,255,255,0.35)', boxShadow: '0 0 20px rgba(255,255,255,0.15)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-2xl transition-all duration-300 text-lg w-full sm:w-auto cursor-pointer backdrop-blur-sm"
              >
                Sign In
              </motion.button>
            </motion.div>

            {/* Animated Stats (Layer 8) */}
            <motion.div variants={stagger} className="flex flex-wrap items-center justify-center gap-4 mb-12 relative z-20">
              {STATS.map((s, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ scale: 1.06, y: -3 }}
                  className="flex items-center gap-2.5 px-5 py-3 bg-[#0a0d18]/80 border border-white/10 rounded-2xl backdrop-blur-md cursor-default transition-shadow hover:shadow-[0_0_25px_rgba(99,102,241,0.25)]"
                >
                  <s.icon size={16} className="text-indigo-400 shrink-0" />
                  <span className="text-xl font-black text-white">
                    <AnimatedCounter value={s.value} suffix={s.suffix} isDecimal={s.isDecimal} />
                  </span>
                  <span className="text-zinc-400 text-sm">{s.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Works with pills (Layer 8) */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 relative z-20">
              <span className="text-zinc-500 text-sm">Works with:</span>
              {trustedBy.map((t, i) => (
                <motion.span
                  key={t}
                  whileHover={{ scale: 1.05, borderColor: 'rgba(99,102,241,0.5)' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0d18]/70 border border-white/8 rounded-full text-xs font-medium text-zinc-400 hover:text-indigo-300 transition-colors cursor-default backdrop-blur-sm"
                >
                  <CheckCircle size={12} className="text-emerald-500" /> {t}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      
      {/* ── Feature Showcase (Huly-Style Bidirectional Sync) ── */}
      <FeatureShowcaseHuly />

      {/* ── Knowledge Studio Showcase (Huly-Style Editorial Document Collaboration) ── */}
      <KnowledgeStudioShowcase />

      {/* ── Features ── */}
      <section className="relative z-10 px-6 md:px-16 py-24 max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '250px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Everything You Need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Study Smarter</span>
            </h2>
            <p className="text-zinc-400 text-lg">One platform. Every AI tool you need.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              >
                <TiltCard
                  glowColor={f.glow}
                  className={`p-6 bg-white/[0.04] border border-white/8 rounded-3xl transition-all duration-300 ${f.border} cursor-default h-full hover:border-indigo-500/30 hover:shadow-[0_10px_35px_rgba(99,102,241,0.15)]`}
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
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '250px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">How It Works</h2>
            <p className="text-zinc-400 text-lg">Get started in under 2 minutes.</p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-start justify-center gap-4 md:gap-0">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <motion.div
                  variants={fadeUp}
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  className="flex-1 px-4"
                >
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
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '250px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Loved by{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Students</span>
            </h2>
            <p className="text-zinc-400 text-lg">Join thousands who study smarter every day.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              >
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

      {/* ── Pricing & Upgrade Plans ── */}
      <section id="pricing" className="relative z-10 px-6 md:px-16 py-24 max-w-6xl mx-auto">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '250px' }}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold mb-4 cursor-default"
            >
              <Sparkles size={13} className="text-indigo-400" />
              <span>Transparent Plans • No Hidden Fees</span>
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Upgrade Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Study Power
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Start free and scale as you master new subjects. Cancel or upgrade whenever you want.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((p) => {
              const IconComponent = p.icon;
              return (
                <motion.div
                  key={p.id}
                  variants={fadeUp}
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  className="flex flex-col"
                >
                  <TiltCard
                    glowColor={p.glow}
                    className={`relative p-8 rounded-3xl transition-all duration-300 flex flex-col justify-between h-full cursor-default ${
                      p.highlight
                        ? 'bg-gradient-to-b from-indigo-950/40 via-[#0e1124] to-[#070914] border-2 border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.25)]'
                        : 'bg-white/[0.03] border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      {/* Plan Header: Icon + Name + Badge (in-flow, prevents text overlap) */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                            <IconComponent size={20} className="text-white" />
                          </div>
                          <h3 className="text-xl font-black text-white tracking-tight">{p.name}</h3>
                        </div>

                        {p.badge && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full shadow-md shadow-indigo-500/30 shrink-0">
                            <Crown size={11} className="text-amber-300" />
                            {p.badge}
                          </span>
                        )}
                      </div>

                      {/* Subtitle / Description (Full width, clear of badges) */}
                      <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px] mb-4">
                        {p.description}
                      </p>

                      {/* Price */}
                      <div className="flex items-baseline gap-1.5 my-6 pb-6 border-b border-white/10">
                        <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{p.price}</span>
                        <span className="text-zinc-500 text-sm font-medium">/{p.period}</span>
                      </div>

                      {/* Features List */}
                      <ul className="space-y-3 mb-8">
                        {p.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
                            <div className="mt-0.5 rounded-full p-0.5 bg-emerald-500/20 text-emerald-400 shrink-0">
                              <Check size={12} strokeWidth={3} />
                            </div>
                            <span className="leading-snug">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      onClick={() => navigate('/signup')}
                      className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        p.highlight
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span>{p.ctaText}</span>
                      <ArrowRight size={15} />
                    </motion.button>
                  </TiltCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── Chronometer CTA & Footer Section (Huly-Style Interactive Rotating Clock) ── */}
      <ChronometerCTA />
    </div>
  );
};

export default LandingPage;
