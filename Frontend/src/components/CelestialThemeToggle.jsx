import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CelestialThemeToggle
 *
 * A cinematic sunrise and moon celestial toggle engine built with Framer Motion.
 * Features:
 * - Orbital sunrise: Dawn flare, golden solar core, rotating radiating beams, and warm corona glow.
 * - Luminous moon: Silver-crescent ascent, crater accents, night aura, and twinkling stars.
 * - Celestial Frost Globe (Option A): Drifting micro-snow crystals with hover flurry physics.
 * - Smooth physical spring transitions, hover scaling, and atmospheric glassmorphism.
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
      transition={{ type: 'spring', damping: 15, stiffness: 350 }}
      aria-label={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      title={isDarkMode ? 'Switch to Sunrise (Light Mode)' : 'Switch to Moonlight (Dark Mode)'}
      className={`relative ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border transition-colors duration-500 backdrop-blur-xl ${
        isDarkMode
          ? 'bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-zinc-950/90 border-indigo-500/30 text-indigo-200 shadow-md shadow-indigo-950/50 hover:border-indigo-400/50 hover:shadow-indigo-500/20'
          : 'bg-gradient-to-br from-amber-100/90 via-orange-50/90 to-sky-100/90 border-amber-300/60 text-amber-600 shadow-md shadow-amber-200/50 hover:border-amber-400 hover:shadow-amber-400/30'
      } ${className}`}
    >
      {/* ── Atmospheric Glow Background ────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-full"
        animate={{
          background: isDarkMode
            ? isHovered
              ? 'radial-gradient(circle at 50% 50%, rgba(165, 180, 252, 0.35) 0%, rgba(99, 102, 241, 0.15) 50%, rgba(15, 23, 42, 0) 75%)'
              : 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.25) 0%, rgba(15, 23, 42, 0) 70%)'
            : isHovered
            ? 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.45) 0%, rgba(254, 243, 199, 0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.35) 0%, rgba(254, 243, 199, 0) 70%)',
        }}
        transition={{ duration: 0.5 }}
      />

      {/* ── Celestial Bodies Animation Container ───────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {isDarkMode ? (
          /* ═══════════════════════════════════════════════════════════════════════
             NIGHT / MOON HORIZON
             ═══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="celestial-moon"
            initial={{ y: 22, rotate: -35, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
            exit={{ y: -22, rotate: 35, opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', damping: 16, stiffness: 220 }}
            className="relative flex items-center justify-center w-full h-full pointer-events-none"
          >
            {/* Twinkling Star 1 (Top Left) */}
            <motion.span
              className="absolute w-1 h-1 rounded-full bg-indigo-200 shadow-[0_0_4px_#c7d2fe]"
              style={{ top: '22%', left: '24%' }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.75, 1.25, 0.75],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Twinkling Star 2 (Bottom Right) */}
            <motion.span
              className="absolute w-1.5 h-1.5 rounded-full bg-cyan-200 shadow-[0_0_4px_#a5f3fc]"
              style={{ bottom: '24%', right: '22%' }}
              animate={{
                opacity: [0.2, 0.9, 0.2],
                scale: [0.8, 1.3, 0.8],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                delay: 0.6,
                ease: 'easeInOut',
              }}
            />

            {/* Micro Star 3 (Top Right) */}
            <motion.span
              className="absolute w-0.5 h-0.5 rounded-full bg-white shadow-[0_0_2px_#ffffff]"
              style={{ top: '28%', right: '26%' }}
              animate={{
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: 1.1,
                ease: 'easeInOut',
              }}
            />

            {/* ── ❄️ Celestial Frost & Micro Snow Crystals (Option A) ───────────── */}
            {/* Snow Crystal 1: Dendritic 6-Point Snowflake (Upper Left) */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '16%', left: '18%' }}
              animate={
                isHovered
                  ? {
                      y: [-12, 16],
                      x: [-2, 3, -1],
                      rotate: [0, 180, 360],
                      opacity: [0, 0.95, 0.95, 0.4, 0],
                      scale: [0.8, 1.15, 0.8],
                    }
                  : {
                      y: [-8, 12],
                      x: [-1.5, 2, -1],
                      rotate: [0, 120, 240, 360],
                      opacity: [0, 0.85, 0.9, 0.3, 0],
                      scale: [0.85, 1.05, 0.85],
                    }
              }
              transition={{
                duration: isHovered ? 2.2 : 4.4,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-[0_0_3px_rgba(255,255,255,0.9)]"
              >
                <line x1="7" y1="1" x2="7" y2="13" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                <line x1="1.8" y1="4" x2="12.2" y2="10" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                <line x1="1.8" y1="10" x2="12.2" y2="4" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                <path d="M5.5 2.5L7 4L8.5 2.5" stroke="#E0F2FE" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.5 11.5L7 10L8.5 11.5" stroke="#E0F2FE" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7" cy="7" r="1.1" fill="#FFFFFF" />
              </svg>
            </motion.div>

            {/* Snow Crystal 2: 4-Point Stella Diamond Frost (Upper Right) */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ top: '22%', right: '16%' }}
              animate={
                isHovered
                  ? {
                      y: [-10, 16],
                      x: [2, -2.5, 1],
                      rotate: [0, -180, -360],
                      opacity: [0, 0.95, 1, 0.35, 0],
                      scale: [0.8, 1.25, 0.8],
                    }
                  : {
                      y: [-7, 11],
                      x: [1.5, -1.5, 1],
                      rotate: [0, -90, -180, -270, -360],
                      opacity: [0, 0.8, 0.9, 0.25, 0],
                      scale: [0.85, 1.1, 0.85],
                    }
              }
              transition={{
                duration: isHovered ? 2.6 : 5.0,
                repeat: Infinity,
                delay: 1.1,
                ease: 'linear',
              }}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-[0_0_4px_rgba(224,242,254,0.95)]"
              >
                <path
                  d="M6 0L7.4 4.6L12 6L7.4 7.4L6 12L4.6 7.4L0 6L4.6 4.6Z"
                  fill="#FFFFFF"
                />
                <circle cx="6" cy="6" r="1.2" fill="#BAE6FD" />
              </svg>
            </motion.div>

            {/* Snow Crystal 3: Hexagonal Prism Micro-Ice Flake (Lower Left) */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ bottom: '18%', left: '26%' }}
              animate={
                isHovered
                  ? {
                      y: [-8, 14],
                      x: [1, -2, 2],
                      rotate: [0, 180, 360],
                      opacity: [0, 0.85, 0.95, 0.2, 0],
                      scale: [0.75, 1.2, 0.75],
                    }
                  : {
                      y: [-5, 10],
                      x: [0.8, -1.5, 1.2],
                      rotate: [0, 120, 240, 360],
                      opacity: [0, 0.7, 0.85, 0.15, 0],
                      scale: [0.8, 1.05, 0.8],
                    }
              }
              transition={{
                duration: isHovered ? 2.1 : 4.1,
                repeat: Infinity,
                delay: 2.2,
                ease: 'linear',
              }}
            >
              <svg
                width="7"
                height="7"
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-[0_0_3px_rgba(255,255,255,0.85)]"
              >
                <line x1="5" y1="1" x2="5" y2="9" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="1.5" y1="3" x2="8.5" y2="7" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="1.5" y1="7" x2="8.5" y2="3" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
                <circle cx="5" cy="5" r="0.8" fill="#E0F2FE" />
              </svg>
            </motion.div>

            {/* Snow Crystal 4: Delicate Glacial Stardust Particle (Center Right) */}
            <motion.span
              className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_4px_#ffffff] pointer-events-none"
              style={{ top: '48%', right: '22%' }}
              animate={
                isHovered
                  ? {
                      y: [-6, 12],
                      x: [-1, 2, -1],
                      opacity: [0, 0.9, 1, 0.2, 0],
                      scale: [0.6, 1.3, 0.6],
                    }
                  : {
                      y: [-4, 8],
                      x: [-0.8, 1.5, -0.8],
                      opacity: [0, 0.7, 0.85, 0.1, 0],
                      scale: [0.7, 1.1, 0.7],
                    }
              }
              transition={{
                duration: isHovered ? 1.9 : 3.6,
                repeat: Infinity,
                delay: 0.5,
                ease: 'linear',
              }}
            />

            {/* Sculpted Crescent Moon SVG */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_6px_rgba(165,180,252,0.6)]"
            >
              <defs>
                <linearGradient id="moonGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F8FAFC" />
                  <stop offset="0.5" stopColor="#E0E7FF" />
                  <stop offset="1" stopColor="#818CF8" />
                </linearGradient>
                <filter id="moonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                fill="url(#moonGradient)"
                stroke="#C7D2FE"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#moonGlow)"
              />
              {/* Moon Surface Crater Accents */}
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
            initial={{ y: 22, rotate: -45, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
            exit={{ y: -22, rotate: 45, opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', damping: 15, stiffness: 220 }}
            className="relative flex items-center justify-center w-full h-full pointer-events-none"
          >
            {/* Pulsing Warm Sunrise Corona */}
            <motion.span
              className="absolute w-6 h-6 rounded-full bg-gradient-to-r from-amber-300/40 via-orange-400/30 to-amber-200/40 blur-[3px]"
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.5, 0.85, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Rotating Sunbeams Rays */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            >
              <svg
                width={iconSizes + 4}
                height={iconSizes + 4}
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 8 Radial Sunrise Rays */}
                <line x1="14" y1="2" x2="14" y2="5" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="14" y1="23" x2="14" y2="26" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="2" y1="14" x2="5" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="23" y1="14" x2="26" y2="14" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="5.5" y1="5.5" x2="7.6" y2="7.6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20.4" y1="20.4" x2="22.5" y2="22.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5.5" y1="22.5" x2="7.6" y2="20.4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20.4" y1="7.6" x2="22.5" y2="5.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.div>

            {/* Radiant Golden Sun Core SVG */}
            <svg
              width={iconSizes}
              height={iconSizes}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]"
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
              {/* Sunrise Horizon Shimmer */}
              <ellipse cx="12" cy="10" rx="3" ry="1.4" fill="#FEF08A" fillOpacity="0.65" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
