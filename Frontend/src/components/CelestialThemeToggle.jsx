import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelestialThemeToggle
 *
 * Cinematic, high-framerate sunrise & moonlight toggle engine.
 * Fully GPU-composited with zero lag, instant spring responsiveness,
 * animated celestial sprinkles, stardust crystals, and solar beams.
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
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', damping: 18, stiffness: 420 }}
      aria-label={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip-pos="bottom"
      className={`relative ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border transition-colors duration-200 backdrop-blur-md will-change-transform ${
        isDarkMode
          ? 'bg-gradient-to-br from-indigo-950/95 via-slate-900/95 to-zinc-950/95 border-indigo-500/35 text-indigo-200 shadow-lg shadow-indigo-950/50 hover:border-indigo-400/60'
          : 'bg-gradient-to-br from-amber-100/95 via-orange-50/95 to-sky-100/95 border-amber-300/70 text-amber-600 shadow-lg shadow-amber-200/50 hover:border-amber-400'
      } ${className}`}
      style={{ transform: 'translateZ(0)' }}
    >
      {/* ── Atmospheric Ambient Radial Glow (GPU Composited) ── */}
      <div
        className={`absolute inset-0 pointer-events-none rounded-full transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-70'
        }`}
        style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 50% 50%, rgba(129, 140, 248, 0.32) 0%, rgba(15, 23, 42, 0) 72%)'
            : 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.38) 0%, rgba(254, 243, 199, 0) 72%)',
        }}
      />

      {/* ── Celestial Horizon Container (Simultaneous Instant Crossfade) ── */}
      <AnimatePresence initial={false}>
        {isDarkMode ? (
          /* ═══════════════════════════════════════════════════════════════════════
             NIGHT / MOONLIGHT HORIZON WITH STARDUST SPRINKLES
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-moon"
            initial={{ scale: 0.5, rotate: -35, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 35, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 380 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* ✧ Sprinkle 1: Diamond Star Sparkle (Top-Left) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '15%', left: '18%' }}
              animate={
                isHovered
                  ? { scale: [0.7, 1.35, 0.7], rotate: [0, 90, 180], opacity: [0.4, 1, 0.4] }
                  : { scale: [0.8, 1.15, 0.8], rotate: [0, 45, 90], opacity: [0.3, 0.85, 0.3] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 0C5 2.76 2.76 5 0 5C2.76 5 5 7.24 5 10C5 7.24 7.24 5 10 5C7.24 5 5 2.76 5 0Z"
                  fill="#E0E7FF"
                  className="drop-shadow-[0_0_3px_#c7d2fe]"
                />
              </svg>
            </motion.div>

            {/* ❄ Sprinkle 2: Glacial Snowflake Crystal (Top-Right) ❄ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '16%', right: '17%' }}
              animate={
                isHovered
                  ? { y: [-3, 4, -3], rotate: [0, 120, 240, 360], opacity: [0.3, 0.95, 0.3] }
                  : { y: [-2, 2, -2], rotate: [0, 90, 180], opacity: [0.25, 0.75, 0.25] }
              }
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                <line x1="5" y1="1" x2="5" y2="9" stroke="#FFFFFF" strokeWidth="0.85" strokeLinecap="round" />
                <line x1="1.5" y1="3" x2="8.5" y2="7" stroke="#FFFFFF" strokeWidth="0.85" strokeLinecap="round" />
                <line x1="1.5" y1="7" x2="8.5" y2="3" stroke="#FFFFFF" strokeWidth="0.85" strokeLinecap="round" />
                <circle cx="5" cy="5" r="0.9" fill="#BAE6FD" />
              </svg>
            </motion.div>

            {/* ✨ Sprinkle 3: Cyan Stardust Twinkle (Bottom-Right) ✨ */}
            <motion.span
              className="absolute w-1.5 h-1.5 rounded-full bg-cyan-200 shadow-[0_0_5px_#a5f3fc] pointer-events-none"
              style={{ bottom: '22%', right: '20%' }}
              animate={
                isHovered
                  ? { scale: [0.6, 1.4, 0.6], opacity: [0.3, 1, 0.3] }
                  : { scale: [0.7, 1.2, 0.7], opacity: [0.25, 0.8, 0.25] }
              }
              transition={{ duration: 2.4, repeat: Infinity, delay: 0.4, ease: 'easeInOut' }}
            />

            {/* ✨ Sprinkle 4: Indigo Micro Starlight (Bottom-Left) ✨ */}
            <motion.span
              className="absolute w-1 h-1 rounded-full bg-indigo-200 shadow-[0_0_4px_#c7d2fe] pointer-events-none"
              style={{ bottom: '28%', left: '22%' }}
              animate={
                isHovered
                  ? { scale: [0.5, 1.3, 0.5], opacity: [0.2, 0.95, 0.2] }
                  : { scale: [0.6, 1.1, 0.6], opacity: [0.2, 0.7, 0.2] }
              }
              transition={{ duration: 3, repeat: Infinity, delay: 0.9, ease: 'easeInOut' }}
            />

            {/* 🌙 Sculpted Crescent Moon SVG (Metallic Gradient + Craters) 🌙 */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_6px_rgba(165,180,252,0.7)]"
            >
              <defs>
                <linearGradient id="celestialMoonGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFFFFF" />
                  <stop offset="0.5" stopColor="#E0E7FF" />
                  <stop offset="1" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                fill="url(#celestialMoonGrad)"
                stroke="#C7D2FE"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Moon Surface Crater Accents */}
              <circle cx="10" cy="11.5" r="1.1" fill="#818CF8" fillOpacity="0.45" />
              <circle cx="13" cy="15" r="0.85" fill="#818CF8" fillOpacity="0.4" />
              <circle cx="8" cy="15.5" r="0.65" fill="#818CF8" fillOpacity="0.35" />
            </svg>
          </motion.div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
             SUNRISE / DAYLIGHT HORIZON WITH SOLAR SPRINKLES & SUNBEAMS
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-sun"
            initial={{ scale: 0.5, rotate: 35, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: -35, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 380 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* ☀️ Pulsing Sunrise Corona Glow ☀️ */}
            <motion.span
              className="absolute w-6 h-6 rounded-full bg-gradient-to-r from-amber-300/40 via-orange-400/35 to-amber-200/40 blur-[2px] pointer-events-none"
              animate={{
                scale: isHovered ? [1.1, 1.35, 1.1] : [1, 1.22, 1],
                opacity: isHovered ? [0.65, 0.95, 0.65] : [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* ☀️ Smooth Continuous Rotating Sunbeam Rays (360° GPU Spin) ☀️ */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <svg
                width={iconSizes + 6}
                height={iconSizes + 6}
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 8 Radial Sunrise Beams */}
                <line x1="14" y1="2" x2="14" y2="5.2" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="14" y1="22.8" x2="14" y2="26" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="14" x2="5.2" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="22.8" y1="14" x2="26" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="5.5" y1="5.5" x2="7.8" y2="7.8" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20.2" y1="20.2" x2="22.5" y2="22.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5.5" y1="22.5" x2="7.8" y2="20.2" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20.2" y1="7.8" x2="22.5" y2="5.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.div>

            {/* ✧ Solar Sprinkle 1: Golden Star Sparkle (Top-Right) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '14%', right: '16%' }}
              animate={
                isHovered
                  ? { scale: [0.7, 1.35, 0.7], rotate: [0, 90, 180], opacity: [0.4, 1, 0.4] }
                  : { scale: [0.8, 1.15, 0.8], rotate: [0, 45, 90], opacity: [0.3, 0.85, 0.3] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 0C5 2.76 2.76 5 0 5C2.76 5 5 7.24 5 10C5 7.24 7.24 5 10 5C7.24 5 5 2.76 5 0Z"
                  fill="#F59E0B"
                  className="drop-shadow-[0_0_3px_#fbbf24]"
                />
              </svg>
            </motion.div>

            {/* ✨ Solar Sprinkle 2: Amber Sun-Dust Sparkle (Bottom-Left) ✨ */}
            <motion.span
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_5px_#f59e0b] pointer-events-none"
              style={{ bottom: '18%', left: '16%' }}
              animate={
                isHovered
                  ? { scale: [0.6, 1.35, 0.6], opacity: [0.3, 1, 0.3] }
                  : { scale: [0.7, 1.15, 0.7], opacity: [0.25, 0.8, 0.25] }
              }
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5, ease: 'easeInOut' }}
            />

            {/* ✨ Solar Sprinkle 3: Warm Orange Stardust (Top-Left) ✨ */}
            <motion.span
              className="absolute w-1 h-1 rounded-full bg-orange-300 shadow-[0_0_4px_#ea580c] pointer-events-none"
              style={{ top: '22%', left: '18%' }}
              animate={
                isHovered
                  ? { scale: [0.5, 1.3, 0.5], opacity: [0.2, 0.95, 0.2] }
                  : { scale: [0.6, 1.1, 0.6], opacity: [0.2, 0.7, 0.2] }
              }
              transition={{ duration: 2.8, repeat: Infinity, delay: 0.9, ease: 'easeInOut' }}
            />

            {/* ☀️ Radiant Golden Sun Core SVG ☀️ */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_6px_rgba(245,158,11,0.75)]"
            >
              <defs>
                <linearGradient id="celestialSunGrad" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FDE047" />
                  <stop offset="0.45" stopColor="#F59E0B" />
                  <stop offset="1" stopColor="#EA580C" />
                </linearGradient>
              </defs>
              <circle
                cx="12"
                cy="12"
                r="5.3"
                fill="url(#celestialSunGrad)"
                stroke="#FBBF24"
                strokeWidth="1.25"
              />
              {/* Sunrise Horizon Shimmer */}
              <ellipse cx="12" cy="10" rx="3.1" ry="1.4" fill="#FEF08A" fillOpacity="0.7" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
