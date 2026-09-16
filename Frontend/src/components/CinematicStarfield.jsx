import React, { useMemo } from 'react';

/**
 * CinematicStarfield — Ultra-premium, sparse, organic night-sky starlight.
 * Enhanced with subtle Diamond-White shining stars at the top and bottom margins.
 */
const CinematicStarfield = () => {
  const stars = useMemo(() => [
    // ── Upper Atmosphere (Above Headline) ──
    { id: 1,  x: 6,  y: 4,  size: 1.5, opacity: 0.45, twinkle: true,  delay: 0.4, dur: 5.2 },
    { id: 2,  x: 14, y: 8,  size: 1.0, opacity: 0.28, twinkle: false },
    { id: 3,  x: 22, y: 5,  size: 1.5, opacity: 0.38, twinkle: true,  delay: 2.1, dur: 6.4 },
    { id: 4,  x: 34, y: 9,  size: 1.0, opacity: 0.22, twinkle: false },
    { id: 5,  x: 48, y: 4,  size: 1.0, opacity: 0.25, twinkle: false },
    { id: 6,  x: 62, y: 7,  size: 1.5, opacity: 0.40, twinkle: true,  delay: 1.3, dur: 4.8 },
    { id: 7,  x: 74, y: 5,  size: 1.0, opacity: 0.30, twinkle: false },
    { id: 8,  x: 85, y: 9,  size: 2.0, opacity: 0.50, twinkle: true,  delay: 3.5, dur: 7.0 },
    { id: 9,  x: 93, y: 6,  size: 1.0, opacity: 0.32, twinkle: false },
    { id: 10, x: 28, y: 14, size: 1.0, opacity: 0.24, twinkle: false },
    { id: 11, x: 70, y: 13, size: 1.0, opacity: 0.26, twinkle: false },
    { id: 12, x: 89, y: 16, size: 1.5, opacity: 0.42, twinkle: false },

    // ── Top Diamond-White Shining Stars ──
    { id: 101, x: 18, y: 6,  size: 2.4, opacity: 0.85, diamond: true, delay: 0.2, dur: 4.2 },
    { id: 102, x: 44, y: 4,  size: 2.6, opacity: 0.90, diamond: true, delay: 1.9, dur: 5.0 },
    { id: 103, x: 66, y: 6,  size: 2.4, opacity: 0.85, diamond: true, delay: 3.1, dur: 4.6 },
    { id: 104, x: 88, y: 5,  size: 2.8, opacity: 0.95, diamond: true, delay: 1.1, dur: 5.4 },

    // ── Left Celestial Gutter (Outside Text Column) ──
    { id: 13, x: 4,  y: 22, size: 1.0, opacity: 0.30, twinkle: false },
    { id: 14, x: 9,  y: 28, size: 2.0, opacity: 0.52, twinkle: true,  delay: 0.8, dur: 5.6 },
    { id: 15, x: 15, y: 34, size: 1.0, opacity: 0.25, twinkle: false },
    { id: 16, x: 5,  y: 42, size: 1.5, opacity: 0.36, twinkle: false },
    { id: 17, x: 11, y: 50, size: 1.0, opacity: 0.22, twinkle: true,  delay: 2.8, dur: 6.0 },
    { id: 18, x: 3,  y: 58, size: 1.5, opacity: 0.35, twinkle: false },
    { id: 19, x: 8,  y: 66, size: 1.0, opacity: 0.28, twinkle: false },
    { id: 20, x: 14, y: 74, size: 2.0, opacity: 0.48, twinkle: true,  delay: 1.7, dur: 4.5 },
    { id: 21, x: 6,  y: 82, size: 1.0, opacity: 0.24, twinkle: false },

    // ── Right Celestial Gutter (Outside Text Column) ──
    { id: 23, x: 95, y: 24, size: 1.0, opacity: 0.28, twinkle: false },
    { id: 24, x: 88, y: 30, size: 1.5, opacity: 0.44, twinkle: true,  delay: 3.1, dur: 5.8 },
    { id: 25, x: 94, y: 38, size: 1.0, opacity: 0.25, twinkle: false },
    { id: 26, x: 86, y: 46, size: 2.0, opacity: 0.50, twinkle: false },
    { id: 27, x: 92, y: 54, size: 1.0, opacity: 0.32, twinkle: true,  delay: 0.9, dur: 6.2 },
    { id: 28, x: 87, y: 62, size: 1.5, opacity: 0.36, twinkle: false },
    { id: 29, x: 96, y: 70, size: 1.0, opacity: 0.22, twinkle: false },
    { id: 30, x: 89, y: 78, size: 1.5, opacity: 0.40, twinkle: true,  delay: 2.4, dur: 5.0 },
    { id: 31, x: 94, y: 86, size: 1.0, opacity: 0.26, twinkle: false },

    // ── Deep Lower Flanks & Bottom Diamond-White Shining Stars ──
    { id: 33, x: 16, y: 86, size: 1.0, opacity: 0.22, twinkle: false },
    { id: 34, x: 82, y: 88, size: 1.0, opacity: 0.24, twinkle: false },
    { id: 105, x: 10, y: 92, size: 2.5, opacity: 0.90, diamond: true, delay: 0.7, dur: 4.8 },
    { id: 106, x: 24, y: 96, size: 2.2, opacity: 0.85, diamond: true, delay: 2.5, dur: 5.2 },
    { id: 107, x: 76, y: 96, size: 2.5, opacity: 0.90, diamond: true, delay: 3.7, dur: 4.9 },
    { id: 108, x: 90, y: 91, size: 2.6, opacity: 0.92, diamond: true, delay: 1.4, dur: 5.5 },
  ], []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3] overflow-hidden select-none"
      style={{ transform: 'translate3d(0, 0, 0)', contain: 'paint' }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes subtleTwinkle {
          0%, 100% {
            opacity: var(--base-opacity);
            transform: scale(1);
          }
          50% {
            opacity: calc(var(--base-opacity) * 1.65);
            transform: scale(1.15);
          }
        }
        @keyframes diamondGlint {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.85) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.35) rotate(45deg);
          }
        }
        .animate-twinkle {
          animation: subtleTwinkle var(--twinkle-dur) ease-in-out infinite var(--twinkle-delay);
          will-change: transform, opacity;
        }
        .animate-diamond {
          animation: diamondGlint var(--twinkle-dur) ease-in-out infinite var(--twinkle-delay);
          will-change: transform, opacity;
          box-shadow: 0 0 6px 1px rgba(255, 255, 255, 0.95), 0 0 14px 2px rgba(199, 210, 254, 0.7);
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-twinkle, .animate-diamond {
            animation: none !important;
          }
        }
      `}</style>

      {stars.map((star) => (
        <span
          key={star.id}
          className={`absolute rounded-full ${
            star.diamond
              ? 'bg-white animate-diamond'
              : `bg-indigo-100 ${star.twinkle ? 'animate-twinkle' : ''}`
          }`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            '--base-opacity': star.opacity,
            '--twinkle-dur': `${star.dur || 5}s`,
            '--twinkle-delay': `${star.delay || 0}s`,
            boxShadow: star.diamond
              ? '0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(224, 231, 255, 0.5)'
              : star.size >= 2
              ? '0 0 3px rgba(199, 210, 254, 0.7)'
              : 'none',
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(CinematicStarfield);
