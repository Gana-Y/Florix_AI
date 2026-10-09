import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelestialBellToggle
 *
 * Cinematic animated notification bell engine built with Framer Motion.
 * Adapts dynamically to Day (Light) Mode and Night (Dark) Mode with razor-sharp contrast:
 * - Day Mode: Rich Royal Indigo / Cyber Blue chime with polished specular metallic glares.
 * - Night Mode: Luminous Silver / Midnight Indigo starlight chime with atmospheric halo.
 * - Physics: Pendulum bell swing, counter-phase clapper oscillation, acoustic sound waves, and sparkles.
 */
export default function CelestialBellToggle({
  isOpen = false,
  onClick,
  counts = { due: 0, unread: 0 },
  className = '',
  size = 'md',
  isDarkMode,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [chimeKey, setChimeKey] = useState(0);

  // Auto-detect dark mode if prop is not passed directly
  const [internalDark, setInternalDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );

  useEffect(() => {
    if (typeof isDarkMode === 'boolean') {
      setInternalDark(isDarkMode);
      return;
    }
    const updateTheme = () => {
      setInternalDark(document.documentElement.classList.contains('dark'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [isDarkMode]);

  const isDark = typeof isDarkMode === 'boolean' ? isDarkMode : internalDark;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size] || 'w-10 h-10';

  const iconSizes = {
    sm: 17,
    md: 20,
    lg: 24,
  }[size] || 20;

  const hasDueAlert = (counts?.due || 0) > 0;
  const hasUnreadAlert = (counts?.unread || 0) > 0;

  const triggerChime = () => {
    setChimeKey(prev => prev + 1);
  };

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        triggerChime();
        onClick?.(e);
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        triggerChime();
      }}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', damping: 15, stiffness: 350 }}
      aria-label="Revision Reminders & Notifications"
      data-tooltip={hasDueAlert ? `${counts.due} Revision Alerts Due!` : 'Revision Reminders & Notifications'}
      data-tooltip-pos="bottom"
      className={`relative ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border transition-all duration-300 backdrop-blur-xl ${
        isDark
          ? isOpen
            ? 'bg-gradient-to-br from-indigo-900/90 via-slate-800/90 to-zinc-900/90 border-indigo-400 text-indigo-300 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30'
            : 'bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-zinc-950/90 border-indigo-500/30 text-indigo-200 shadow-md shadow-indigo-950/50 hover:border-indigo-400/60 hover:shadow-indigo-500/20'
          : isOpen
          ? 'bg-gradient-to-br from-indigo-50 via-white to-indigo-100/90 border-indigo-500 text-indigo-700 shadow-lg shadow-indigo-200/60 ring-2 ring-indigo-400/30'
          : 'bg-gradient-to-br from-white via-indigo-50/40 to-slate-100/90 border-slate-200 text-indigo-700 shadow-md shadow-slate-200/70 hover:border-indigo-400 hover:shadow-indigo-200/50 hover:bg-white'
      } ${className}`}
    >
      {/* ── Atmospheric Glow Background ────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-full"
        animate={{
          background: isDark
            ? hasDueAlert
              ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.28) 0%, rgba(15, 23, 42, 0) 70%)'
              : isOpen || isHovered
              ? 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.3) 0%, rgba(15, 23, 42, 0) 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0) 70%)'
            : hasDueAlert
            ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.22) 0%, rgba(255, 241, 242, 0) 70%)'
            : isOpen || isHovered
            ? 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.22) 0%, rgba(238, 242, 255, 0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.12) 0%, rgba(248, 250, 252, 0) 70%)',
        }}
        transition={{ duration: 0.4 }}
      />

      {/* ── Sonic Resonance Ripple Rings (Sound Waves) ─────────────────────────── */}
      <AnimatePresence>
        {(isHovered || hasDueAlert) && (
          <>
            <motion.span
              key={`sonic-wave-1-${chimeKey}`}
              className={`absolute inset-0 rounded-full pointer-events-none border ${
                isDark ? 'border-indigo-400/50' : 'border-indigo-500/40'
              }`}
              initial={{ scale: 0.7, opacity: 0.8 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
            {hasDueAlert && (
              <motion.span
                key={`sonic-wave-2-${chimeKey}`}
                className="absolute inset-0 rounded-full pointer-events-none border border-rose-400/40"
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, delay: 0.15, ease: 'easeOut' }}
              />
            )}
          </>
        )}
      </AnimatePresence>

      {/* ── Twinkling Acoustic Sparkles ───────────────────────────────────────── */}
      {isHovered && (
        <>
          <motion.span
            className={`absolute w-1 h-1 rounded-full pointer-events-none ${
              isDark
                ? 'bg-indigo-200 shadow-[0_0_4px_#c7d2fe]'
                : 'bg-indigo-600 shadow-[0_0_4px_#818cf8]'
            }`}
            style={{ top: '20%', right: '22%' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0.8], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.span
            className={`absolute w-0.5 h-0.5 rounded-full pointer-events-none ${
              isDark
                ? 'bg-cyan-200 shadow-[0_0_3px_#a5f3fc]'
                : 'bg-indigo-500 shadow-[0_0_3px_#6366f1]'
            }`}
            style={{ bottom: '24%', left: '22%' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 0.6], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          />
        </>
      )}

      {/* ── Pendulum Bell Engine (Swings with Spring Physics) ────────────────── */}
      <motion.div
        key={`bell-pendulum-${chimeKey}`}
        className="relative flex items-center justify-center pointer-events-none"
        style={{ transformOrigin: '50% 15%' }}
        animate={
          isHovered || hasDueAlert
            ? {
                rotate: [0, -18, 15, -10, 6, -2, 0],
              }
            : { rotate: 0 }
        }
        transition={{
          duration: 0.9,
          ease: [0.34, 1.56, 0.64, 1],
        }}
      >
        <svg
          width={iconSizes}
          height={iconSizes}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`relative ${
            isDark
              ? 'drop-shadow-[0_0_5px_rgba(129,140,248,0.55)]'
              : 'drop-shadow-[0_2px_4px_rgba(79,70,229,0.35)]'
          }`}
        >
          <defs>
            {/* Dark Mode Luminous Gradient */}
            <linearGradient id="bellGradNight" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.45" stopColor={hasDueAlert ? '#FDA4AF' : '#E0E7FF'} />
              <stop offset="1" stopColor={hasDueAlert ? '#F43F5E' : '#818CF8'} />
            </linearGradient>

            {/* Day Mode Rich Indigo/Blue Gradient with High Contrast */}
            <linearGradient id="bellGradDay" x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor={hasDueAlert ? '#FB7185' : '#6366F1'} />
              <stop offset="0.45" stopColor={hasDueAlert ? '#F43F5E' : '#4F46E5'} />
              <stop offset="1" stopColor={hasDueAlert ? '#BE123C' : '#3730A3'} />
            </linearGradient>

            <filter id="bellGlowNight" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Bell Top Suspension Loop */}
          <path
            d="M12 2C10.9 2 10 2.9 10 4V4.5C10.7 4.2 11.3 4 12 4C12.7 4 13.3 4.2 14 4.5V4C14 2.9 13.1 2 12 2Z"
            fill={isDark ? 'url(#bellGradNight)' : hasDueAlert ? '#E11D48' : '#4338CA'}
            opacity={isDark ? 0.9 : 1}
          />

          {/* Bell Canopy Body */}
          <path
            d="M6 9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9C18 13.5 19.5 15.5 20.5 16.5C20.8 16.8 20.6 17.5 20.1 17.5H3.9C3.4 17.5 3.2 16.8 3.5 16.5C4.5 15.5 6 13.5 6 9Z"
            fill={isDark ? 'url(#bellGradNight)' : 'url(#bellGradDay)'}
            stroke={
              isDark
                ? hasDueAlert
                  ? '#FB7185'
                  : '#C7D2FE'
                : hasDueAlert
                ? '#BE123C'
                : '#3730A3'
            }
            strokeWidth={isDark ? 1.15 : 1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={isDark ? 'url(#bellGlowNight)' : undefined}
          />

          {/* Bell Surface Reflection Glare Line (Crisp Metallic Sheen) */}
          <path
            d="M8.5 8C8.5 6 10 4.6 11.8 4.2"
            stroke="#FFFFFF"
            strokeWidth={isDark ? 0.9 : 1.1}
            strokeLinecap="round"
            opacity={isDark ? 0.65 : 0.85}
          />

          {/* Internal Swinging Clapper (Bead) with Counter-Phase Motion */}
          <motion.circle
            cx="12"
            cy="19"
            r="2.1"
            fill={
              isDark
                ? hasDueAlert
                  ? '#F43F5E'
                  : '#6366F1'
                : hasDueAlert
                ? '#E11D48'
                : '#312E81'
            }
            stroke={isDark ? '#E0E7FF' : '#FFFFFF'}
            strokeWidth={isDark ? 0.75 : 1}
            animate={
              isHovered || hasDueAlert
                ? {
                    x: [0, 2.2, -2.2, 1.4, -0.9, 0],
                  }
                : { x: 0 }
            }
            transition={{
              duration: 0.9,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          />
        </svg>
      </motion.div>

      {/* ── Status Notification Badges ────────────────────────────────────────── */}
      {hasDueAlert && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-md ring-2 ring-white dark:ring-zinc-900 pointer-events-none">
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60" />
          <span className="relative z-10">{counts.due > 9 ? '9+' : counts.due}</span>
        </span>
      )}

      {!hasDueAlert && hasUnreadAlert && (
        <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-900 shadow-[0_0_6px_#6366f1] pointer-events-none">
          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-50" />
        </span>
      )}
    </motion.button>
  );
}
