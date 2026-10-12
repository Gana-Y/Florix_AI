import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelestialThemeToggle
 *
 * A high-performance, 60fps cinematic sunrise and moon toggle engine.
 * Fully GPU-composited with zero lag, instant spring responsiveness,
 * and elegant celestial aesthetics.
 */
export default function CelestialThemeToggle({
  isDarkMode,
  toggleTheme,
  className = '',
  size = 'md',
}) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size] || 'w-10 h-10';

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 26,
  }[size] || 22;

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      aria-label={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip-pos="bottom"
      className={`relative ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border transition-colors duration-300 backdrop-blur-md will-change-transform ${
        isDarkMode
          ? 'bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-zinc-950/90 border-indigo-500/30 text-indigo-200 shadow-md shadow-indigo-950/50 hover:border-indigo-400/50'
          : 'bg-gradient-to-br from-amber-100/90 via-orange-50/90 to-sky-100/90 border-amber-300/60 text-amber-600 shadow-md shadow-amber-200/50 hover:border-amber-400'
      } ${className}`}
      style={{ transform: 'translateZ(0)' }}
    >
      {/* ── Atmospheric Glow Background (GPU Composited) ── */}
      <div
        className={`absolute inset-0 pointer-events-none rounded-full transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-70'
        }`}
        style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 50% 50%, rgba(129, 140, 248, 0.28) 0%, rgba(15, 23, 42, 0) 72%)'
            : 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.35) 0%, rgba(254, 243, 199, 0) 72%)',
        }}
      />

      {/* ── Celestial Bodies Animation Container (Instant Zero-Lag Transition) ── */}
      <AnimatePresence initial={false}>
        {isDarkMode ? (
          /* ═══════════════════════════════════════════════════════════════════════
             NIGHT / MOON HORIZON
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-moon"
            initial={{ y: 14, rotate: -25, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
            exit={{ y: -14, rotate: 25, opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* Twinkling Starlight 1 */}
            <motion.span
              className="absolute w-1 h-1 rounded-full bg-indigo-200 shadow-[0_0_3px_#c7d2fe]"
              style={{ top: '22%', left: '24%' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Twinkling Starlight 2 */}
            <motion.span
              className="absolute w-1 h-1 rounded-full bg-cyan-200 shadow-[0_0_3px_#a5f3fc]"
              style={{ bottom: '24%', right: '22%' }}
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.6, ease: 'easeInOut' }}
            />

            {/* Micro Snow Frost Crystal 1 */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '18%', right: '20%' }}
              animate={isHovered ? { y: [-2, 4], opacity: [0.4, 0.9, 0.4] } : { y: [-1, 2], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                <line x1="5" y1="1" x2="5" y2="9" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
                <circle cx="5" cy="5" r="0.8" fill="#BAE6FD" />
              </svg>
            </motion.div>

            {/* Sculpted Crescent Moon SVG */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_4px_rgba(165,180,252,0.6)]"
            >
              <defs>
                <linearGradient id="moonGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F8FAFC" />
                  <stop offset="0.5" stopColor="#E0E7FF" />
                  <stop offset="1" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                fill="url(#moonGradient)"
                stroke="#C7D2FE"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="11.5" r="1" fill="#818CF8" fillOpacity="0.45" />
              <circle cx="13" cy="15" r="0.8" fill="#818CF8" fillOpacity="0.4" />
              <circle cx="8" cy="15.5" r="0.6" fill="#818CF8" fillOpacity="0.35" />
            </svg>
          </motion.div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
             SUNRISE / DAYLIGHT HORIZON
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-sun"
            initial={{ y: 14, rotate: -25, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
            exit={{ y: -14, rotate: 25, opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* Rotating Sunbeams Rays */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <svg
                width={iconSizes + 4}
                height={iconSizes + 4}
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line x1="14" y1="2" x2="14" y2="5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="14" y1="23" x2="14" y2="26" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="14" x2="5" y2="14" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="23" y1="14" x2="26" y2="14" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5.5" y1="5.5" x2="7.6" y2="7.6" stroke="#F97316" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="20.4" y1="20.4" x2="22.5" y2="22.5" stroke="#F97316" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="5.5" y1="22.5" x2="7.6" y2="20.4" stroke="#F97316" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="20.4" y1="7.6" x2="22.5" y2="5.5" stroke="#F97316" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </motion.div>

            {/* Radiant Golden Sun Core SVG */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_5px_rgba(245,158,11,0.6)]"
            >
              <defs>
                <linearGradient id="sunCoreGradient" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FDE047" />
                  <stop offset="0.45" stopColor="#F59E0B" />
                  <stop offset="1" stopColor="#EA580C" />
                </linearGradient>
              </defs>
              <circle
                cx="12"
                cy="12"
                r="5.2"
                fill="url(#sunCoreGradient)"
                stroke="#FBBF24"
                strokeWidth="1.2"
              />
              <ellipse cx="12" cy="10" rx="3" ry="1.4" fill="#FEF08A" fillOpacity="0.65" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
