import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Sparkles, BookOpen, Zap, Target,
  Users, Layers, ArrowRight, CheckCircle2, MessageSquare
} from 'lucide-react';

function KnowledgeStudioShowcase() {
  const [activeTool, setActiveTool] = useState('explain');

  return (
    <section className="relative z-20 py-14 sm:py-20 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto select-none overflow-visible">
      {/* ── Soft Ambient Glow behind the Canvas ── */}
      <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-r from-indigo-600/15 via-purple-600/10 to-cyan-500/15 rounded-[56px] blur-3xl -z-10 opacity-70 pointer-events-none" />

      {/* ── THE $1M FLOATING STUDIO CANVAS (Sleek Vertical Proportion) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '250px' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full rounded-[30px] sm:rounded-[38px] md:rounded-[44px] bg-gradient-to-b from-[#fcfcff] via-[#f8fafc] to-[#f1f5f9] p-5 sm:p-7 md:p-9 lg:p-10 shadow-[0_35px_120px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.8)] border border-white/80 overflow-hidden text-slate-900"
      >
        {/* Subtle Architectural Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start relative z-10">

          {/* ══════════════════════════════════════════════════════════
               LEFT COLUMN: FLOATING COLLABORATIVE CARD
               ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 flex flex-col items-center relative pt-1">
            
            {/* Suspended Vertical Alignment Guide Line */}
            <div className="w-[1.5px] h-6 sm:h-8 bg-gradient-to-b from-transparent via-indigo-400/40 to-indigo-500/60 mb-2" />

            {/* The Floating Frosted Glass Card */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full max-w-xs bg-white/95 border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-[0_18px_45px_rgba(15,23,42,0.10)] relative hover:shadow-[0_24px_60px_rgba(99,102,241,0.18)] transition-all duration-300"
            >
              {/* Inner Soft Gradient Aura Box */}
              <div className="relative bg-gradient-to-tr from-purple-100/75 via-pink-50/50 to-indigo-100/75 rounded-2xl p-4 sm:p-5 mb-3.5 flex items-center justify-center min-h-[110px] border border-white/90 overflow-visible shadow-inner">
                
                {/* Collaborative Selection Box */}
                <div className="relative border-2 border-indigo-500 rounded-xl px-4 py-2 bg-white/90 shadow-md">
                  
                  {/* 4 Corner Resize Handles */}
                  <span className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded-[2px]" />
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded-[2px]" />
                  <span className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded-[2px]" />
                  <span className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-indigo-600 rounded-[2px]" />

                  {/* Word inside the box */}
                  <span className="text-lg sm:text-xl font-black tracking-tight text-slate-800">
                    Synthesis
                  </span>

                  {/* Cursor 1: Ganesh (Top-Left) */}
                  <div className="absolute -top-6 -left-9 flex items-center gap-1 pointer-events-none select-none">
                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md tracking-wide">
                      Ganesh
                    </span>
                    <svg className="w-3.5 h-3.5 text-indigo-600 -rotate-45 drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3l7 18 3-7 7-3L3 3z"/>
                    </svg>
                  </div>

                  {/* Cursor 2: Alex K. (Bottom-Right) */}
                  <div className="absolute -bottom-5 -right-10 flex items-center gap-1 pointer-events-none select-none">
                    <svg className="w-3.5 h-3.5 text-orange-500 rotate-135 drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3l7 18 3-7 7-3L3 3z"/>
                    </svg>
                    <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md tracking-wide">
                      Alex K.
                    </span>
                  </div>

                </div>
              </div>

              {/* Card Caption */}
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Collaborate
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-normal">
                  Enhance teamwork with real-time document synthesis, shared active recall decks, and live peer study.
                </p>
              </div>
            </motion.div>

          </div>

          {/* ══════════════════════════════════════════════════════════
               RIGHT COLUMN: HEADLINE, HIGHLIGHTED TEXT, & BILLBOARD
               ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 flex flex-col">
            
            {/* Top Editorial Headline + Presence Avatar Pin */}
            <div className="relative mb-3 sm:mb-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.06]">
                Knowledge at
                <br />
                Your Command
              </h2>

              {/* Presence Avatar Pin */}
              <div className="absolute top-0 right-2 sm:right-6 md:right-12 flex flex-col items-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-[11px] font-bold text-white uppercase tracking-wider">
                    NS
                  </div>
                </div>
                {/* Pin Line */}
                <div className="w-[1.5px] h-5 bg-indigo-500 mt-0.5" />
                {/* Pin Droplet Dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 ring-4 ring-indigo-200" />
              </div>
            </div>

            {/* Body Paragraph */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal mb-5 max-w-2xl">
              Florix offers an intelligent suite of tools to create, annotate, and synthesize your academic research.
              Our collaborative AI cockpit connects concepts across your study materials, boosting retention and eliminating exam stress.
            </p>

            {/* ── Interactive Rich Text Editor with Live Selection ── */}
            <div className="relative mb-6">
              
              {/* Floating Obsidian Pill Toolbar */}
              <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 bg-[#11131a] rounded-xl shadow-xl border border-white/10 text-white text-xs mb-2">
                <button
                  onClick={() => setActiveTool('explain')}
                  className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeTool === 'explain' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Sparkles size={11} className="text-indigo-200" /> Explain
                </button>

                <div className="hidden sm:flex items-center gap-1 border-l border-r border-white/10 px-1 mx-0.5">
                  <span className="px-1 py-0.5 hover:bg-white/10 rounded font-bold cursor-pointer text-[10px]">B</span>
                  <span className="px-1 py-0.5 hover:bg-white/10 rounded italic cursor-pointer text-[10px]">I</span>
                  <span className="px-1 py-0.5 hover:bg-white/10 rounded underline cursor-pointer text-[10px]">U</span>
                  <span className="px-1 py-0.5 hover:bg-white/10 rounded line-through cursor-pointer text-[10px]">S</span>
                </div>

                <button
                  onClick={() => setActiveTool('deck')}
                  className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all flex items-center gap-1 ${
                    activeTool === 'deck' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BookOpen size={11} className="text-indigo-300" /> Flashcard
                </button>

                <button
                  onClick={() => setActiveTool('quiz')}
                  className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-all flex items-center gap-1 ${
                    activeTool === 'quiz' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Target size={11} className="text-amber-300" /> Quiz
                </button>
              </div>

              {/* Highlighted Text Block */}
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                <span className="bg-[#fef08a] text-slate-900 px-2 py-0.5 rounded font-medium border-b-2 border-amber-400/60 shadow-sm inline">
                  Documents in Florix can be used for sharing reference materials among study partners, generating diagnostic practice quizzes, and mastering complex formulas.
                </span>
                <span className="inline-block w-[1.5px] h-4 bg-indigo-600 animate-pulse translate-y-0.5 ml-0.5" />
              </p>
            </div>

            {/* ── Bottom Billboard Architecture Display (Florix Showcase - Sleek & Compact) ── */}
            <div className="w-full relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-300/80 bg-slate-900">
              
              {/* Modern Architecture Background Simulation (Compact Height) */}
              <div className="relative w-full h-[180px] sm:h-[210px] md:h-[230px] bg-gradient-to-b from-[#0e121e] via-[#090b14] to-[#04060b] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
                
                {/* Architectural Grid Lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem]" />

                {/* Top Lighting Gradient Facade */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                {/* ── THE PHYSICAL BILLBOARD DISPLAY SIGN ── */}
                <div className="relative w-full max-w-2xl bg-[#090b13] rounded-xl sm:rounded-2xl border border-white/15 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.92)] overflow-hidden">
                  
                  {/* Neon Mesh Glows inside billboard */}
                  <div className="absolute -top-10 -left-10 w-36 h-36 bg-indigo-500/30 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-purple-500/30 rounded-full blur-2xl pointer-events-none" />

                  {/* Billboard Top Bar */}
                  <div className="flex items-center justify-between mb-2 sm:mb-3 relative z-10 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                        <Brain size={12} />
                      </div>
                      <span className="text-[11px] font-black tracking-widest uppercase text-white/90">Florix AI</span>
                    </div>
                    <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      Intelligent Workspace
                    </span>
                  </div>

                  {/* Billboard Centerpiece: FLORIX */}
                  <div className="flex flex-col items-center justify-center py-2 sm:py-3 relative z-10 text-center">
                    <div className="flex flex-wrap items-baseline justify-center gap-1.5 sm:gap-2.5">
                      <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                        The engine for
                      </span>
                      <h3 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_4px_20px_rgba(255,255,255,0.35)]">
                        Florix
                      </h3>
                      <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                        And nothing less.
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 font-medium max-w-md">
                      Next-generation active recall, RAG synthesis & adaptive diagnostic examination engine.
                    </p>
                  </div>

                  {/* Glass Reflection Highlight */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none" />
                </div>

              </div>
            </div>

          </div>

        </div>

      </motion.div>
    </section>
  );
}

export default React.memo(KnowledgeStudioShowcase);
