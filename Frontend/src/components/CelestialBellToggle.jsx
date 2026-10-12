import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelestialBellToggle
 *
 * Cinematic animated notification bell engine built with Framer Motion.
 * Optimized for high-framerate, 60fps GPU-composited performance.
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

  const isDark = typeof isDarkMode === 'boolean'
    ? isDarkMode
    : typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : true;

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
    setChimeKey(prev => (prev + 1) % 100);
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
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      aria-label="Revision Reminders & Notifications"
      data-tooltip={hasDueAlert ? `${counts.due} Revision Alerts Due!` : 'Revision Reminders & Notifications'}
      data-tooltip-pos="bottom"
      className={`relative ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border transition-colors duration-300 backdrop-blur-md will-change-transform ${
        isDark
          ? isOpen
            ? 'bg-gradient-to-br from-indigo-900/90 via-slate-800/90 to-zinc-900/90 border-indigo-400 text-indigo-300 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30'
            : 'bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-zinc-950/90 border-indigo-500/30 text-indigo-200 shadow-md shadow-indigo-950/50 hover:border-indigo-400/60'
          : isOpen
          ? 'bg-gradient-to-br from-indigo-50 via-white to-indigo-100/90 border-indigo-500 text-indigo-700 shadow-lg shadow-indigo-200/60 ring-2 ring-indigo-400/30'
          : 'bg-gradient-to-br from-white via-indigo-50/40 to-slate-100/90 border-slate-200 text-indigo-700 shadow-md shadow-slate-200/70 hover:border-indigo-400'
      } ${className}`}
      style={{ transform: 'translateZ(0)' }}
    >
      {/* ── Atmospheric Glow Background (GPU Composited) ── */}
      <div
        className={`absolute inset-0 pointer-events-none rounded-full transition-opacity duration-300 ${
          isHovered || isOpen ? 'opacity-100' : 'opacity-60'
        }`}
        style={{
          background: isDark
            ? hasDueAlert
              ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.28) 0%, rgba(15, 23, 42, 0) 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.25) 0%, rgba(15, 23, 42, 0) 70%)'
            : hasDueAlert
            ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.22) 0%, rgba(255, 241, 242, 0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.18) 0%, rgba(248, 250, 252, 0) 70%)',
        }}
      />

      {/* ── Sonic Resonance Ripple Rings (Sound Waves) ── */}
      <AnimatePresence>
        {(isHovered || hasDueAlert) && (
          <motion.span
            key={`sonic-wave-1-${chimeKey}`}
            className={`absolute inset-0 rounded-full pointer-events-none border will-change-transform ${
              isDark ? 'border-indigo-400/50' : 'border-indigo-500/40'
            }`}
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 1.45, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* ── Pendulum Bell Engine (Swings with Smooth Physics) ── */}
      <motion.div
        key={`bell-pendulum-${chimeKey}`}
        className="relative flex items-center justify-center pointer-events-none will-change-transform"
        style={{ transformOrigin: '50% 15%' }}
        animate={
          isHovered || hasDueAlert
            ? { rotate: [0, -14, 12, -8, 4, 0] }
            : { rotate: 0 }
        }
        transition={{
          duration: 0.7,
          ease: 'easeOut',
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
              ? 'drop-shadow-[0_0_4px_rgba(129,140,248,0.55)]'
              : 'drop-shadow-[0_2px_3px_rgba(79,70,229,0.3)]'
          }`}
        >
          <defs>
            <linearGradient id="bellGradNight" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.45" stopColor={hasDueAlert ? '#FDA4AF' : '#E0E7FF'} />
              <stop offset="1" stopColor={hasDueAlert ? '#F43F5E' : '#818CF8'} />
            </linearGradient>

            <linearGradient id="bellGradDay" x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor={hasDueAlert ? '#FB7185' : '#6366F1'} />
              <stop offset="0.45" stopColor={hasDueAlert ? '#F43F5E' : '#4F46E5'} />
              <stop offset="1" stopColor={hasDueAlert ? '#BE123C' : '#3730A3'} />
            </linearGradient>
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
                ? hasDueAlert ? '#FB7185' : '#C7D2FE'
                : hasDueAlert ? '#BE123C' : '#3730A3'
            }
            strokeWidth={isDark ? 1.15 : 1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Bell Surface Reflection Glare Line */}
          <path
            d="M8.5 8C8.5 6 10 4.6 11.8 4.2"
            stroke="#FFFFFF"
            strokeWidth={isDark ? 0.9 : 1.1}
            strokeLinecap="round"
            opacity={isDark ? 0.65 : 0.85}
          />

          {/* Internal Swinging Clapper */}
          <motion.circle
            cx="12"
            cy="19"
            r="2.1"
            fill={
              isDark
                ? hasDueAlert ? '#F43F5E' : '#A5B4FC'
                : hasDueAlert ? '#BE123C' : '#4338CA'
            }
            animate={
              isHovered || hasDueAlert
                ? { x: [0, 2.5, -2.5, 1.5, -1, 0] }
                : { x: 0 }
            }
            transition={{
              duration: 0.7,
              ease: 'easeOut',
            }}
          />
        </svg>

        {/* ── Active Due/Unread Badges ── */}
        {hasDueAlert ? (
          <motion.span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-[0_0_8px_rgba(244,63,94,0.9)] border-2 border-white dark:border-zinc-950"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {counts.due > 9 ? '9+' : counts.due}
          </motion.span>
        ) : hasUnreadAlert ? (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)] border-2 border-white dark:border-zinc-950" />
        ) : null}
      </motion.div>
    </motion.button>
  );
}
