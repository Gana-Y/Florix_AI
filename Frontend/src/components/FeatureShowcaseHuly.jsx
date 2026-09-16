import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, FileText, Search, Clock,
  ChevronDown, MessageSquare, Zap, Target, Layers,
  SlidersHorizontal, LayoutGrid, Volume2
} from 'lucide-react';

const IN_PROGRESS_ITEMS = [
  {
    id: 'DOC-01',
    title: 'Deep Residual Networks: Vanishing Gradient Dynamics & Skip Connections',
    comments: 23,
    insights: 4,
    tags: [
      { label: 'Neural Networks', bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40' },
      { label: '9 Sep 2026', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
    ],
    time: '2.4 hrs',
    date: '12 Mar',
    avatar: 'F',
    avatarColor: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'RAG-04',
    title: 'Multimodal Transformer Embeddings: Cross-Document Synthesis',
    comments: 12,
    insights: 2,
    tags: [
      { label: 'RAG Core', bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
      { label: '9 Sep 2026', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
    ],
    time: '1.8 hrs',
    date: '12 Mar',
    avatar: 'F',
    avatarColor: 'from-purple-500 to-pink-600',
  },
  {
    id: 'QZ-12',
    title: 'Biochemistry Diagnostic: Enzyme Kinetics & Active Transport',
    comments: 15,
    insights: 5,
    tags: [
      { label: 'Adaptive Quiz', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40' },
    ],
    time: '45 min',
    date: '11 Mar',
    avatar: 'F',
    avatarColor: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'CARD-08',
    title: 'Medical Pharmacology: Beta-Blockers & Receptor Kinetics',
    comments: 8,
    insights: 3,
    tags: [
      { label: 'Spaced Repetition', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
      { label: 'Exam Ready', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' },
    ],
    time: '30 min',
    date: '10 Mar',
    avatar: 'F',
    avatarColor: 'from-emerald-500 to-teal-600',
  },
];

const UNDER_REVIEW_ITEMS = [
  {
    id: 'LEC-03',
    title: 'Stanford CS229: Gradient Descent & Loss Surface Optimization',
    comments: 8,
    insights: 1,
    tags: [
      { label: 'Audio Synced', bg: 'bg-zinc-800/80', text: 'text-zinc-400', border: 'border-zinc-700/40' },
    ],
    time: '1.5 hrs',
    date: '08 Mar',
    avatar: 'F',
    avatarColor: 'from-zinc-600 to-zinc-800',
  },
  {
    id: 'BIO-09',
    title: 'Cellular Respiration & Krebs Cycle Step-by-Step Breakdown',
    comments: 4,
    insights: 2,
    tags: [
      { label: 'Verified', bg: 'bg-zinc-800/80', text: 'text-zinc-400', border: 'border-zinc-700/40' },
    ],
    time: '50 min',
    date: '07 Mar',
    avatar: 'F',
    avatarColor: 'from-zinc-600 to-zinc-800',
  },
];

// ── Clean 2-Beam Orbit (Cyan & Solar Amber) with Extended Trail ──
const TWO_BEAM_LASER_GRADIENT = `conic-gradient(
  from 0deg,
  rgba(255, 255, 255, 0.06) 0deg,
  rgba(255, 255, 255, 0.06) 92deg,
  /* ── Beam 1: Solar Amber / Orange Arc (88°) ── */
  rgba(154, 52, 18, 0.25) 96deg,
  #c2410c 108deg,
  #ea580c 120deg,
  #ff6a00 132deg,
  #ffffff 140deg,
  #ff6a00 148deg,
  #ea580c 158deg,
  #9a3412 170deg,
  rgba(154, 52, 18, 0.2) 184deg,
  rgba(255, 255, 255, 0.06) 190deg,
  rgba(255, 255, 255, 0.06) 272deg,
  /* ── Beam 2: Electric Cyan / Sky Blue Arc (88°) ── */
  rgba(30, 64, 175, 0.25) 276deg,
  #0284c7 288deg,
  #00f0ff 302deg,
  #38bdf8 312deg,
  #ffffff 320deg,
  #00f0ff 328deg,
  #38bdf8 338deg,
  #1d4ed8 350deg,
  rgba(30, 64, 175, 0.2) 364deg
)`;

const TWO_BEAM_AMBIENT_GRADIENT = `conic-gradient(
  from 0deg,
  transparent 0deg,
  transparent 92deg,
  /* ── Beam 1: Solar Amber Ambient Glow (88°) ── */
  rgba(154, 52, 18, 0.25) 96deg,
  #c2410c 108deg,
  #ea580c 120deg,
  #ff6a00 132deg,
  #ffffff 140deg,
  #ff6a00 148deg,
  #ea580c 158deg,
  #9a3412 170deg,
  rgba(154, 52, 18, 0.2) 184deg,
  transparent 190deg,
  transparent 272deg,
  /* ── Beam 2: Electric Cyan Ambient Glow (88°) ── */
  rgba(30, 64, 175, 0.25) 276deg,
  #0284c7 288deg,
  #00f0ff 302deg,
  #38bdf8 312deg,
  #ffffff 320deg,
  #00f0ff 328deg,
  #38bdf8 338deg,
  #1d4ed8 350deg,
  rgba(30, 64, 175, 0.2) 364deg
)`;

function FeatureShowcaseHuly() {
  const [activeNav, setActiveNav] = useState('docs');
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <section className="relative z-20 py-24 px-4 sm:px-6 md:px-12 max-w-6xl mx-auto overflow-visible select-none">
      {/* ── Section Header (100% Aligned with Florix Study Workspace) ── */}
      <div className="mb-14 text-left max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '250px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-4 leading-[1.08]"
        >
          Intelligent Study Workspace.
          <br />
          <span className="text-white">
            From Papers to Total Mastery.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '250px' }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl font-normal"
        >
          Manage research papers, lecture recordings, and active recall decks in one unified intelligent cockpit.
          Florix connects concepts across your documents, builds adaptive diagnostic quizzes, and monitors your retention in real time.
        </motion.p>
      </div>

      {/* ── The Floating Card Container with Clockwise Rotating Dual Laser Beams ── */}
      <div className="relative mx-auto w-full">
        {/* ── LAYER 1: LIGHT REFINED AMBIENT HALO (Clockwise) ── */}
        <div
          className="pointer-events-none absolute -inset-[10px] sm:-inset-[14px] rounded-[32px] md:rounded-[40px] overflow-hidden select-none -z-10"
          style={{ filter: 'blur(16px)', opacity: 0.60 }}
          aria-hidden="true"
        >
          <div
            className="absolute top-1/2 left-1/2 w-[2400px] h-[2400px] aspect-square animate-spin-clockwise pointer-events-none"
            style={{
              willChange: 'transform',
              background: TWO_BEAM_AMBIENT_GRADIENT,
            }}
          />
        </div>

        {/* ── LAYER 2: TIGHT SHINY RIM GLOW (Clockwise) ── */}
        <div
          className="pointer-events-none absolute -inset-[4px] rounded-[26px] md:rounded-[34px] overflow-hidden select-none -z-10"
          style={{ filter: 'blur(5px)', opacity: 0.75 }}
          aria-hidden="true"
        >
          <div
            className="absolute top-1/2 left-1/2 w-[2400px] h-[2400px] aspect-square animate-spin-clockwise pointer-events-none"
            style={{
              willChange: 'transform',
              background: TWO_BEAM_AMBIENT_GRADIENT,
            }}
          />
        </div>

        {/* ── 3.5PX SHINY LASER BORDER CONTAINER (Clockwise) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '250px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[24px] md:rounded-[32px] p-[3px] overflow-hidden shadow-[0_35px_100px_rgba(0,0,0,0.90)] z-10"
        >
          {/* Rotating Dual Laser Border Line */}
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 w-[2400px] h-[2400px] aspect-square animate-spin-clockwise z-0"
            style={{
              willChange: 'transform',
              background: TWO_BEAM_LASER_GRADIENT,
            }}
          />

          {/* ── Main Product Window (Solid Opaque Charcoal Titanium Obsidian #14161f) ── */}
          <div className="relative rounded-[20px] md:rounded-[28px] overflow-hidden bg-[#14161f] flex flex-col md:flex-row w-full h-full z-10">
            {/* ── Mini Left Sidebar Strip ── */}
            <div className="hidden md:flex flex-col items-center justify-between w-14 lg:w-16 py-4 border-r border-white/5 bg-[#10121a] z-20 shrink-0">
              <div className="flex flex-col items-center gap-4">
                {/* Logo / App Icon */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-md flex items-center justify-center cursor-pointer">
                  <div className="w-full h-full bg-[#14161f] rounded-[10px] flex items-center justify-center">
                    <Brain size={18} className="text-indigo-400" />
                  </div>
                </div>

                {/* Status Pill (98% / 10:00) */}
                <div className="px-1.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-bold text-indigo-400 flex flex-col items-center shadow-sm">
                  <span>98%</span>
                  <span className="text-[8px] text-zinc-500 font-normal">SYNC</span>
                </div>

                {/* Navigation Icons (Florix AI Features) */}
                <div className="flex flex-col items-center gap-2.5 mt-2">
                  <button
                    onClick={() => setActiveNav('docs')}
                    className={`p-2 rounded-xl transition-all ${
                      activeNav === 'docs'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title="Documents & Papers"
                  >
                    <FileText size={16} />
                  </button>

                  <button
                    onClick={() => setActiveNav('brain')}
                    className={`p-2 rounded-xl transition-all ${
                      activeNav === 'brain'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title="Knowledge Synthesis"
                  >
                    <Layers size={16} />
                  </button>

                  <button
                    onClick={() => setActiveNav('quiz')}
                    className={`p-2 rounded-xl transition-all ${
                      activeNav === 'quiz'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title="Diagnostic Quizzes"
                  >
                    <Target size={16} />
                  </button>

                  <button
                    onClick={() => setActiveNav('flashcards')}
                    className={`p-2 rounded-xl transition-all ${
                      activeNav === 'flashcards'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title="Spaced Flashcards"
                  >
                    <Zap size={16} />
                  </button>

                  <button
                    onClick={() => setActiveNav('audio')}
                    className={`p-2 rounded-xl transition-all ${
                      activeNav === 'audio'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title="Lecture Audio & Transcripts"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
              </div>

              {/* Bottom Settings Icon */}
              <div className="p-2 text-zinc-600 hover:text-zinc-400 cursor-pointer">
                <SlidersHorizontal size={15} />
              </div>
            </div>

            {/* ── Main Workspace Content ── */}
            <div className="flex-1 flex flex-col overflow-hidden z-20 bg-[#14161f]">
              {/* Window Top Bar / Search & Controls */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/5 bg-[#11131c] gap-3">
                {/* Search input mock */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#191c28] border border-white/8 text-zinc-400 text-xs w-full max-w-sm">
                  <Search size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-400 truncate">Search papers, quizzes, or flashcards...</span>
                  <span className="ml-auto text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-mono hidden sm:inline-block">
                    ⌘K
                  </span>
                </div>

                {/* Top Right Controls */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Sync Active</span>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#191c28] border border-white/8 rounded-lg text-zinc-400">
                    <button className="p-1 rounded bg-white/10 text-white" title="List View">
                      <SlidersHorizontal size={13} />
                    </button>
                    <button className="p-1 rounded hover:text-white" title="Grid View">
                      <LayoutGrid size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List Area */}
              <div className="p-3 sm:p-5 flex flex-col gap-5 overflow-x-auto relative bg-[#14161f]">
                {/* Sleek white cursor pointer hovering just like in Huly */}
                <div
                  className="hidden lg:block absolute z-40 pointer-events-none transition-all duration-500"
                  style={{
                    top: '175px',
                    right: '220px',
                  }}
                >
                  <svg
                    className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3l7 18 3-7 7-3L3 3z" fill="#ffffff" />
                  </svg>
                </div>

                {/* ── Section: IN PROGRESS ── */}
                <div>
                  <div className="flex items-center gap-2 px-2 mb-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
                    <ChevronDown size={14} className="text-zinc-500" />
                    <span>ACTIVE STUDY WORKSPACE</span>
                    <span className="text-zinc-500 text-[11px] font-normal">({IN_PROGRESS_ITEMS.length})</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {IN_PROGRESS_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        onMouseEnter={() => setHoveredRow(item.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                          hoveredRow === item.id
                            ? 'bg-white/[0.05] border-white/15 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Left: ID & Title */}
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 shrink-0 text-zinc-500 text-xs font-mono">
                            <FileText size={13} className="text-indigo-400" />
                            <span>{item.id}</span>
                          </div>

                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-zinc-200 truncate">
                              {item.title}
                            </span>

                            <div className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] text-zinc-500">
                              <span className="flex items-center gap-0.5">
                                <MessageSquare size={11} /> {item.comments}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Zap size={11} className="text-amber-400" /> {item.insights}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Badges, Time, Avatar */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {/* Tags */}
                          <div className="hidden md:flex items-center gap-1.5">
                            {item.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${tag.bg} ${tag.text} ${tag.border}`}
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>

                          {/* Estimated Time */}
                          <span className="hidden lg:flex items-center gap-1 text-xs text-zinc-500 font-mono">
                            <Clock size={11} /> {item.time}
                          </span>

                          {/* Date */}
                          <span className="hidden sm:inline-block text-xs text-zinc-500">
                            {item.date}
                          </span>

                          {/* Avatar */}
                          <div
                            className={`w-6 h-6 rounded-full bg-gradient-to-tr ${item.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
                          >
                            {item.avatar}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Section: UNDER REVIEW ── */}
                <div>
                  <div className="flex items-center gap-2 px-2 mb-2 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                    <ChevronDown size={14} className="text-zinc-600" />
                    <span>SYNTHESIZED & REVIEWED</span>
                    <span className="text-zinc-600 text-[11px] font-normal">({UNDER_REVIEW_ITEMS.length})</span>
                  </div>

                  <div className="flex flex-col gap-1 opacity-65">
                    {UNDER_REVIEW_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-transparent border border-transparent hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        {/* Left: ID & Title */}
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 shrink-0 text-zinc-600 text-xs font-mono">
                            <FileText size={13} className="text-zinc-500" />
                            <span>{item.id}</span>
                          </div>

                          <span className="text-xs sm:text-sm font-medium text-zinc-400 truncate">
                            {item.title}
                          </span>
                        </div>

                        {/* Right: Tag & Avatar */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {item.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${tag.bg} ${tag.text} ${tag.border}`}
                            >
                              {tag.label}
                            </span>
                          ))}
                          <div
                            className={`w-6 h-6 rounded-full bg-gradient-to-tr ${item.avatarColor} flex items-center justify-center text-[10px] font-bold text-white opacity-60`}
                          >
                            {item.avatar}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default React.memo(FeatureShowcaseHuly);
