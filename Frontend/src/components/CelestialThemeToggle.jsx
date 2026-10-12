import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 4-Point Celestial Diamond Sparkle Star SVG
 */
function SparkleStar({ size = 10, fill = '#FFFFFF', glow = '#C7D2FE', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ filter: `drop-shadow(0 0 ${Math.max(2, size * 0.45)}px ${glow})` }}
    >
      <path
        d="M8 0C8 4.4 4.4 8 0 8C4.4 8 8 11.6 8 16C8 11.6 11.6 8 16 8C11.6 8 8 4.4 8 0Z"
        fill={fill}
      />
    </svg>
  );
}

/**
 * CelestialThemeToggle
 *
 * Cinematic, high-framerate sunrise & moonlight toggle engine.
 * Fully GPU-composited with zero lag, cushioned harmonic spring landing,
 * ultra-prominent twinkling stardust sprinkles, and radiant toggle burst particles.
 */
export default function CelestialThemeToggle({
  isDarkMode,
  toggleTheme,
  className = '',
  size = 'md',
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

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

  const burstRadius = {
    sm: 16,
    md: 21,
    lg: 26,
  }[size] || 21;

  // 6 Radial Burst Sprinkle Angles (in degrees)
  const burstAngles = [15, 75, 135, 195, 255, 315];

  const handleToggle = (e) => {
    setBurstKey((prev) => (prev + 1) % 1000);
    toggleTheme?.(e);
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', damping: 18, stiffness: 400 }}
      aria-label={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      data-tooltip-pos="bottom"
      className={`relative ${sizeClasses} rounded-full flex items-center justify-center cursor-pointer select-none border transition-colors duration-300 backdrop-blur-md will-change-transform ${
        isDarkMode
          ? 'bg-gradient-to-br from-indigo-950/95 via-slate-900/95 to-zinc-950/95 border-indigo-500/40 text-indigo-200 shadow-lg shadow-indigo-950/60 hover:border-indigo-400/80 hover:shadow-indigo-500/20'
          : 'bg-gradient-to-br from-amber-100/95 via-orange-50/95 to-sky-100/95 border-amber-300/80 text-amber-600 shadow-lg shadow-amber-300/40 hover:border-amber-400 hover:shadow-amber-400/30'
      } ${className}`}
      style={{ transform: 'translateZ(0)' }}
    >
      {/* ── Internal Atmospheric Glow Mask (Contained in circle) ── */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-75'
          }`}
          style={{
            background: isDarkMode
              ? 'radial-gradient(circle at 50% 50%, rgba(129, 140, 248, 0.35) 0%, rgba(15, 23, 42, 0) 72%)'
              : 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.42) 0%, rgba(254, 243, 199, 0) 72%)',
          }}
        />
        {/* Soft specular sheen across the upper lens */}
        <div
          className={`absolute -top-1 inset-x-0 h-1/2 rounded-t-full transition-opacity duration-300 ${
            isDarkMode
              ? 'bg-gradient-to-b from-white/10 to-transparent'
              : 'bg-gradient-to-b from-white/40 to-transparent'
          }`}
        />
      </div>

      {/* ── Radiant Stardust Burst Sprinkles (Fires On Click) ── */}
      <AnimatePresence>
        {burstKey > 0 && (
          <div key={`burst-container-${burstKey}`} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {burstAngles.map((deg, idx) => {
              const rad = (deg * Math.PI) / 180;
              const targetX = Math.cos(rad) * burstRadius;
              const targetY = Math.sin(rad) * burstRadius;
              const isGolden = !isDarkMode;

              return (
                <motion.div
                  key={`burst-p-${burstKey}-${idx}`}
                  className="absolute pointer-events-none"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: targetX,
                    y: targetY,
                    scale: [0, 1.4, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                    delay: idx * 0.02,
                  }}
                >
                  <SparkleStar
                    size={size === 'sm' ? 7 : 9}
                    fill={isGolden ? (idx % 2 === 0 ? '#FDE047' : '#F59E0B') : (idx % 2 === 0 ? '#FFFFFF' : '#A5F3FC')}
                    glow={isGolden ? '#F59E0B' : '#818CF8'}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* ── Celestial Horizon Container (Cushioned Landing Physics) ── */}
      <AnimatePresence mode="wait" initial={false}>
        {isDarkMode ? (
          /* ═══════════════════════════════════════════════════════════════════════
             NIGHT / MOONLIGHT HORIZON WITH VIBRANT STARDUST SPRINKLES
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-moon"
            initial={{ scale: 0.68, rotate: -15, y: 4, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            exit={{
              scale: 0.65,
              rotate: 15,
              y: -4,
              opacity: 0,
              transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
            }}
            transition={{
              type: 'spring',
              stiffness: 210,
              damping: 22,
              mass: 0.85,
            }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* ✧ Prominent Sprinkle 1: Diamond Star Sparkle (Top-Left) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '12%', left: '14%' }}
              animate={
                isHovered
                  ? { scale: [0.9, 1.45, 0.9], rotate: [0, 90, 180], opacity: [0.75, 1, 0.75] }
                  : { scale: [0.85, 1.25, 0.85], rotate: [0, 45, 90], opacity: [0.7, 1, 0.7] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 8 : 10}
                fill="#FFFFFF"
                glow="#93C5FD"
              />
            </motion.div>

            {/* ✧ Prominent Sprinkle 2: Cyan Ice Diamond (Top-Right) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '14%', right: '14%' }}
              animate={
                isHovered
                  ? { scale: [0.85, 1.4, 0.85], rotate: [0, -90, -180], opacity: [0.7, 1, 0.7] }
                  : { scale: [0.8, 1.2, 0.8], rotate: [0, -45, -90], opacity: [0.65, 0.95, 0.65] }
              }
              transition={{ duration: 2.6, repeat: Infinity, delay: 0.4, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 7 : 9}
                fill="#A5F3FC"
                glow="#38BDF8"
              />
            </motion.div>

            {/* ✨ Prominent Sprinkle 3: Glowing Aqua Pearl (Bottom-Right) ✨ */}
            <motion.span
              className="absolute rounded-full bg-cyan-200 shadow-[0_0_7px_#67e8f9] pointer-events-none"
              style={{
                width: size === 'sm' ? 3.5 : 4.5,
                height: size === 'sm' ? 3.5 : 4.5,
                bottom: '16%',
                right: '16%',
              }}
              animate={
                isHovered
                  ? { scale: [0.8, 1.5, 0.8], opacity: [0.6, 1, 0.6] }
                  : { scale: [0.85, 1.3, 0.85], opacity: [0.55, 0.95, 0.55] }
              }
              transition={{ duration: 2.4, repeat: Infinity, delay: 0.8, ease: 'easeInOut' }}
            />

            {/* ✨ Prominent Sprinkle 4: Lavender Starlight Crystal (Bottom-Left) ✨ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ bottom: '15%', left: '16%' }}
              animate={
                isHovered
                  ? { scale: [0.8, 1.35, 0.8], rotate: [0, 45, 90], opacity: [0.65, 1, 0.65] }
                  : { scale: [0.75, 1.15, 0.75], rotate: [0, 30, 60], opacity: [0.6, 0.9, 0.6] }
              }
              transition={{ duration: 2.8, repeat: Infinity, delay: 1.2, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 6 : 8}
                fill="#E0E7FF"
                glow="#818CF8"
              />
            </motion.div>

            {/* 🌙 Sculpted Crescent Moon SVG (Luminous Gradient + Craters) 🌙 */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_8px_rgba(165,180,252,0.85)]"
            >
              <defs>
                <linearGradient id="celestialMoonGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFFFFF" />
                  <stop offset="0.45" stopColor="#E0E7FF" />
                  <stop offset="1" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                fill="url(#celestialMoonGrad)"
                stroke="#C7D2FE"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Moon Surface Crater Accents */}
              <circle cx="10" cy="11.5" r="1.15" fill="#818CF8" fillOpacity="0.55" />
              <circle cx="13" cy="15" r="0.9" fill="#818CF8" fillOpacity="0.5" />
              <circle cx="8" cy="15.5" r="0.7" fill="#818CF8" fillOpacity="0.45" />
            </svg>
          </motion.div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
             SUNRISE / DAYLIGHT HORIZON WITH RADIANT SOLAR SPRINKLES & SUNBEAMS
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-sun"
            initial={{ scale: 0.68, rotate: 15, y: -4, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            exit={{
              scale: 0.65,
              rotate: -15,
              y: 4,
              opacity: 0,
              transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
            }}
            transition={{
              type: 'spring',
              stiffness: 210,
              damping: 22,
              mass: 0.85,
            }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* ☀️ Pulsing Sunrise Corona Glow ☀️ */}
            <motion.span
              className="absolute w-7 h-7 rounded-full bg-gradient-to-r from-amber-300/50 via-orange-400/40 to-amber-200/50 blur-[3px] pointer-events-none"
              animate={{
                scale: isHovered ? [1.1, 1.4, 1.1] : [1, 1.25, 1],
                opacity: isHovered ? [0.75, 1, 0.75] : [0.6, 0.88, 0.6],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* ☀️ Smooth Continuous Rotating Sunbeam Rays (360° GPU Spin) ☀️ */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            >
              <svg
                width={iconSizes + 6}
                height={iconSizes + 6}
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 8 Radial Sunrise Beams */}
                <line x1="14" y1="2" x2="14" y2="5.5" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="14" y1="22.5" x2="14" y2="26" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="14" x2="5.5" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="22.5" y1="14" x2="26" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="5.5" y1="5.5" x2="8" y2="8" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="20" x2="22.5" y2="22.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5.5" y1="22.5" x2="8" y2="20" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="8" x2="22.5" y2="5.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.div>

            {/* ✧ Solar Sprinkle 1: Radiant Golden Star (Top-Right) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '12%', right: '14%' }}
              animate={
                isHovered
                  ? { scale: [0.9, 1.45, 0.9], rotate: [0, 90, 180], opacity: [0.8, 1, 0.8] }
                  : { scale: [0.85, 1.25, 0.85], rotate: [0, 45, 90], opacity: [0.75, 1, 0.75] }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 8 : 10}
                fill="#FDE047"
                glow="#F59E0B"
              />
            </motion.div>

            {/* ✧ Solar Sprinkle 2: Amber Sunburst Star (Top-Left) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '14%', left: '14%' }}
              animate={
                isHovered
                  ? { scale: [0.85, 1.4, 0.85], rotate: [0, -90, -180], opacity: [0.75, 1, 0.75] }
                  : { scale: [0.8, 1.2, 0.8], rotate: [0, -45, -90], opacity: [0.7, 0.95, 0.7] }
              }
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.35, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 7 : 9}
                fill="#F59E0B"
                glow="#EA580C"
              />
            </motion.div>

            {/* ✨ Solar Sprinkle 3: Warm Orange Stardust Crystal (Bottom-Left) ✨ */}
            <motion.span
              className="absolute rounded-full bg-amber-400 shadow-[0_0_7px_#f59e0b] pointer-events-none"
              style={{
                width: size === 'sm' ? 3.5 : 4.5,
                height: size === 'sm' ? 3.5 : 4.5,
                bottom: '15%',
                left: '16%',
              }}
              animate={
                isHovered
                  ? { scale: [0.8, 1.5, 0.8], opacity: [0.7, 1, 0.7] }
                  : { scale: [0.85, 1.3, 0.85], opacity: [0.65, 0.95, 0.65] }
              }
              transition={{ duration: 2.4, repeat: Infinity, delay: 0.7, ease: 'easeInOut' }}
            />

            {/* ✧ Solar Sprinkle 4: Brilliant Morning Light Star (Bottom-Right) ✧ */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ bottom: '14%', right: '16%' }}
              animate={
                isHovered
                  ? { scale: [0.8, 1.35, 0.8], rotate: [0, 45, 90], opacity: [0.75, 1, 0.75] }
                  : { scale: [0.75, 1.15, 0.75], rotate: [0, 30, 60], opacity: [0.68, 0.92, 0.68] }
              }
              transition={{ duration: 2.8, repeat: Infinity, delay: 1.1, ease: 'easeInOut' }}
            >
              <SparkleStar
                size={size === 'sm' ? 6 : 8}
                fill="#FEF08A"
                glow="#F59E0B"
              />
            </motion.div>

            {/* ☀️ Radiant Golden Sun Core SVG ☀️ */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]"
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
                r="5.4"
                fill="url(#celestialSunGrad)"
                stroke="#FBBF24"
                strokeWidth="1.3"
              />
              {/* Sunrise Horizon Shimmer */}
              <ellipse cx="12" cy="9.8" rx="3.2" ry="1.4" fill="#FEF08A" fillOpacity="0.75" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
