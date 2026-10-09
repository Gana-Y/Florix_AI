import React from 'react';

/**
 * Universal SVG Flag Icon component for cross-platform visual flag rendering.
 * Resolves the issue where Windows OS fonts (Segoe UI Emoji) cannot render
 * country flag emojis and display two-letter ISO country codes instead.
 */
export default function FlagIcon({ code, className = 'w-5 h-3.5' }) {
  const c = (code || '').toLowerCase();

  switch (c) {
    case 'us':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <g fillRule="evenodd">
            <path fill="#bd3d44" d="M0 0h640v480H0z" />
            <path stroke="#fff" strokeWidth="37" d="M0 55.5h640M0 129h640M0 203h640M0 277h640M0 351h640M0 424.5h640" />
            <path fill="#192f5d" d="M0 0h256v258.5H0z" />
            {/* Stars representation */}
            <circle cx="40" cy="35" r="8" fill="#fff" />
            <circle cx="90" cy="35" r="8" fill="#fff" />
            <circle cx="140" cy="35" r="8" fill="#fff" />
            <circle cx="190" cy="35" r="8" fill="#fff" />
            <circle cx="65" cy="75" r="8" fill="#fff" />
            <circle cx="115" cy="75" r="8" fill="#fff" />
            <circle cx="165" cy="75" r="8" fill="#fff" />
            <circle cx="215" cy="75" r="8" fill="#fff" />
            <circle cx="40" cy="115" r="8" fill="#fff" />
            <circle cx="90" cy="115" r="8" fill="#fff" />
            <circle cx="140" cy="115" r="8" fill="#fff" />
            <circle cx="190" cy="115" r="8" fill="#fff" />
            <circle cx="65" cy="155" r="8" fill="#fff" />
            <circle cx="115" cy="155" r="8" fill="#fff" />
            <circle cx="165" cy="155" r="8" fill="#fff" />
            <circle cx="215" cy="155" r="8" fill="#fff" />
            <circle cx="40" cy="195" r="8" fill="#fff" />
            <circle cx="90" cy="195" r="8" fill="#fff" />
            <circle cx="140" cy="195" r="8" fill="#fff" />
            <circle cx="190" cy="195" r="8" fill="#fff" />
            <circle cx="65" cy="230" r="8" fill="#fff" />
            <circle cx="115" cy="230" r="8" fill="#fff" />
            <circle cx="165" cy="230" r="8" fill="#fff" />
            <circle cx="215" cy="230" r="8" fill="#fff" />
          </g>
        </svg>
      );

    case 'gb':
    case 'uk':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#012169" d="M0 0h640v480H0z" />
          <path fill="#fff" d="m75 0 245 180L565 0h75v50L395 240l245 190v50h-75L320 300 75 480H0v-50l245-190L0 50V0z" />
          <path fill="#c8102e" d="m425 290 215 160v30h-35L380 320zm-210-95L0 35V0h35l220 165zm390-195h35v35L425 190l-40-30zm-605 450v-30l215-160 40 30L40 480z" />
          <path fill="#fff" d="M260 0h120v480H260zM0 180h640v120H0z" />
          <path fill="#c8102e" d="M284 0h72v480h-72zM0 204h640v72H0z" />
        </svg>
      );

    case 'in':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#f93" d="M0 0h640v160H0z" />
          <path fill="#fff" d="M0 160h640v160H0z" />
          <path fill="#128807" d="M0 320h640v160H0z" />
          {/* Ashoka Chakra */}
          <g transform="translate(320, 240)">
            <circle r="46" fill="none" stroke="#000080" strokeWidth="6" />
            <circle r="10" fill="#000080" />
            {[...Array(24)].map((_, i) => (
              <line
                key={i}
                x1="0"
                y1="0"
                x2={44 * Math.cos((i * 15 * Math.PI) / 180)}
                y2={44 * Math.sin((i * 15 * Math.PI) / 180)}
                stroke="#000080"
                strokeWidth="2.5"
              />
            ))}
          </g>
        </svg>
      );

    case 'es':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#aa151b" d="M0 0h640v120H0zm0 360h640v120H0z" />
          <path fill="#f1bf00" d="M0 120h640v240H0z" />
          {/* Coat of arms simplification */}
          <rect x="130" y="190" width="60" height="80" rx="10" fill="#aa151b" opacity="0.85" />
          <rect x="140" y="200" width="40" height="60" rx="6" fill="#f1bf00" />
        </svg>
      );

    case 'fr':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#002395" d="M0 0h213.3v480H0z" />
          <path fill="#fff" d="M213.3 0h213.4v480H213.3z" />
          <path fill="#ed2939" d="M426.7 0H640v480H426.7z" />
        </svg>
      );

    case 'de':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#000" d="M0 0h640v160H0z" />
          <path fill="#dd0000" d="M0 160h640v160H0z" />
          <path fill="#ffce00" d="M0 320h640v160H0z" />
        </svg>
      );

    case 'ja':
    case 'jp':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#fff" d="M0 0h640v480H0z" />
          <circle cx="320" cy="240" r="130" fill="#bc002d" />
        </svg>
      );

    case 'zh':
    case 'cn':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#de2910" d="M0 0h640v480H0z" />
          {/* Main big star */}
          <polygon
            fill="#ffde00"
            points="100,50 112,85 149,85 119,106 130,141 100,120 70,141 81,106 51,85 88,85"
          />
          {/* 4 small stars */}
          <circle cx="180" cy="60" r="12" fill="#ffde00" />
          <circle cx="215" cy="95" r="12" fill="#ffde00" />
          <circle cx="215" cy="145" r="12" fill="#ffde00" />
          <circle cx="180" cy="180" r="12" fill="#ffde00" />
        </svg>
      );

    case 'sa':
    case 'ar':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#006c35" d="M0 0h640v480H0z" />
          {/* Sword and script motif */}
          <rect x="180" y="270" width="280" height="14" rx="7" fill="#fff" />
          <polygon points="180,265 150,277 180,289" fill="#fff" />
          <rect x="420" y="260" width="16" height="34" rx="4" fill="#fff" />
          {/* Stylized Shahada script band */}
          <path
            fill="#fff"
            d="M200 170h240v30H200z M220 215h200v20H220z"
            opacity="0.9"
          />
        </svg>
      );

    case 'ru':
      return (
        <svg viewBox="0 0 640 480" className={`inline-block rounded-xs overflow-hidden shadow-xs border border-black/10 shrink-0 ${className}`}>
          <path fill="#fff" d="M0 0h640v160H0z" />
          <path fill="#0039a6" d="M0 160h640v160H0z" />
          <path fill="#d52b1e" d="M0 320h640v160H0z" />
        </svg>
      );

    default:
      return (
        <span className={`inline-flex items-center justify-center font-bold text-[10px] bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xs ${className}`}>
          {code?.toUpperCase()?.slice(0, 2) || '🌐'}
        </span>
      );
  }
}
