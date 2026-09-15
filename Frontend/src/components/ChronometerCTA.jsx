import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Github, Twitter, Linkedin } from 'lucide-react';

function ChronometerCTA() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);

  // Track scroll progression specifically for this bottom section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end end'],
  });

  // Butter-smooth spring interpolation for the scroll-driven rotation
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 22,
    restDelta: 0.001,
  });

  // Subtle 3D tilt of the physical watch case on scroll
  const caseTilt = useTransform(smoothProgress, [0, 1], [-3, 3]);

  // Rotations for internal energy beam and chronometer instruments
  const energyRotation = useTransform(smoothProgress, [0, 1], [-45, 65]);
  const hourHandRotation = useTransform(smoothProgress, [0, 1], [15, 105]);
  const minuteHandRotation = useTransform(smoothProgress, [0, 1], [40, 310]);

  return (
    <section ref={sectionRef} className="relative z-20 pt-24 pb-12 px-6 md:px-12 max-w-6xl mx-auto select-none overflow-visible">
      
      {/* ── CINEMATIC BACKGROUND LIGHT WEDGES (MATCHING REFERENCE) ── */}
      {/* Top-Left Sharp Orange Laser Wedge */}
      <div 
        className="pointer-events-none absolute -left-20 top-12 w-[650px] h-[200px] -rotate-[24deg] blur-[36px] -z-10 opacity-90"
        style={{
          background: 'linear-gradient(90deg, rgba(245, 100, 20, 0.48) 0%, rgba(210, 70, 10, 0.28) 45%, rgba(160, 45, 5, 0.08) 80%, transparent 100%)',
          willChange: 'transform',
        }}
      />
      {/* Bottom-Right Deep Blue Laser Wedge */}
      <div 
        className="pointer-events-none absolute left-48 bottom-28 w-[680px] h-[210px] rotate-[24deg] blur-[40px] -z-10 opacity-90"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(25, 75, 200, 0.12) 20%, rgba(30, 100, 250, 0.32) 65%, rgba(14, 165, 233, 0.48) 100%)',
          willChange: 'transform',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

        {/* ══════════════════════════════════════════════════════════
             LEFT COLUMN: THE 3D CHRONOMETER SMARTWATCH
             ══════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 flex justify-center relative">
          
          {/* Main 3D Watch Housing with Tactile Bevel and Drop Shadows */}
          <motion.div
            style={{ rotate: caseTilt, willChange: 'transform' }}
            className="relative w-[340px] sm:w-[410px] md:w-[440px] h-[340px] sm:h-[410px] md:h-[440px] rounded-full p-3 flex items-center justify-center"
          >
            {/* Inner bezel wrapper with realistic 3D depth and shadows */}
            <div 
              className="w-full h-full rounded-full p-2.5 flex items-center justify-center relative"
              style={{
                background: 'radial-gradient(circle at 35% 25%, #2a2e3a 0%, #161822 50%, #0c0d13 100%)',
                boxShadow: '0 45px 120px -15px rgba(0, 0, 0, 0.98), 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 90px rgba(245, 100, 20, 0.15), 0 0 90px rgba(14, 165, 233, 0.15), inset 0 2px 3px rgba(255, 255, 255, 0.4), inset 0 -4px 10px rgba(0, 0, 0, 0.95)'
              }}
            >
              {/* Watch Crown Button (at 3 o'clock) */}
              <div 
                className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-4 h-11 rounded-r-md z-20"
                style={{
                  background: 'linear-gradient(to bottom, #545a6c 0%, #222530 25%, #494f60 50%, #191b23 75%, #424756 100%)',
                  boxShadow: '4px 4px 12px rgba(0, 0, 0, 0.85), inset 0 1px 1.5px rgba(255, 255, 255, 0.35), inset 0 -1px 1.5px rgba(0, 0, 0, 0.85)'
                }}
              />

              {/* Outer Metallic Bezel Ring with Conic Brushed Finish */}
              <div 
                className="w-full h-full rounded-full p-2 relative flex items-center justify-center"
                style={{
                  background: 'conic-gradient(from 215deg, #1c1e27 0deg, #363b4b 40deg, #1a1c25 115deg, #313647 195deg, #13151c 285deg, #3a4053 335deg, #1c1e27 360deg)',
                  boxShadow: 'inset 0 1.5px 3px rgba(255, 255, 255, 0.32), inset 0 -3px 7px rgba(0, 0, 0, 0.9), 0 6px 16px rgba(0, 0, 0, 0.75)'
                }}
              >
                {/* Recessed Smoked Sapphire Dial Well */}
                <div 
                  className="w-full h-full rounded-full relative overflow-hidden flex items-center justify-center"
                  style={{
                    background: '#08090f',
                    boxShadow: 'inset 0 12px 35px rgba(0, 0, 0, 0.98), inset 0 0 25px rgba(0, 0, 0, 0.95), inset 0 1px 3px rgba(0, 0, 0, 1), 0 0 0 1px rgba(255, 255, 255, 0.08)'
                  }}
                >
                  
                  {/* ── Volumetric Atmosphere & Internal Nebulae (Rotates with the energy arc!) ── */}
                  <motion.div 
                    style={{ rotate: energyRotation, willChange: 'transform' }}
                    className="absolute inset-0 pointer-events-none z-0"
                  >
                    {/* Deep Indigo / Electric Blue Fog on lower-left */}
                    <div 
                      className="absolute left-[4%] bottom-[10%] w-[65%] h-[65%] rounded-full blur-[28px]"
                      style={{
                        background: 'radial-gradient(circle, rgba(50, 120, 255, 0.48) 0%, rgba(25, 75, 210, 0.22) 45%, transparent 75%)'
                      }}
                    />
                    {/* Fiery Orange Flare on upper-right */}
                    <div 
                      className="absolute right-[6%] top-[6%] w-[68%] h-[68%] rounded-full blur-[30px]"
                      style={{
                        background: 'radial-gradient(circle, rgba(255, 95, 20, 0.6) 0%, rgba(220, 65, 10, 0.28) 45%, transparent 75%)'
                      }}
                    />
                  </motion.div>

                  {/* 3D Convex Smoked Glass Lens Specular Sheen */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-25 rounded-full"
                    style={{
                      background: 'radial-gradient(ellipse 130% 75% at 28% 18%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 42%, transparent 70%)'
                    }}
                  />

                  {/* Embossed Florix Brand Emblem in Center */}
                  <div className="absolute z-5 flex items-center justify-center pointer-events-none opacity-50">
                    <div className="grid grid-cols-2 gap-3 w-24 h-24">
                      <div 
                        className="w-10 h-10 rounded-2xl"
                        style={{
                          background: 'linear-gradient(145deg, #181c28, #0c0d14)',
                          boxShadow: 'inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.14), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.75), 0 5px 14px rgba(0, 0, 0, 0.65)'
                        }}
                      />
                      <div 
                        className="w-10 h-10 rounded-2xl"
                        style={{
                          background: 'linear-gradient(145deg, #181c28, #0c0d14)',
                          boxShadow: 'inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.14), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.75), 0 5px 14px rgba(0, 0, 0, 0.65)'
                        }}
                      />
                      <div 
                        className="w-10 h-10 rounded-2xl"
                        style={{
                          background: 'linear-gradient(145deg, #181c28, #0c0d14)',
                          boxShadow: 'inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.14), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.75), 0 5px 14px rgba(0, 0, 0, 0.65)'
                        }}
                      />
                      <div 
                        className="w-10 h-10 rounded-2xl"
                        style={{
                          background: 'linear-gradient(145deg, #181c28, #0c0d14)',
                          boxShadow: 'inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.14), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.75), 0 5px 14px rgba(0, 0, 0, 0.65)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Minimalist Clock Numerals & Markers */}
                  <div className="absolute inset-3 rounded-full pointer-events-none opacity-40 text-[11px] font-semibold text-slate-300 z-10 font-sans">
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2">12</span>
                    <span className="absolute top-7 right-[26%] translate-x-1/2">1</span>
                    <span className="absolute top-1/2 right-2 -translate-y-1/2">3</span>
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2">6</span>
                    <span className="absolute top-1/2 left-2 -translate-y-1/2">9</span>
                  </div>

                  {/* ── HIGH-ENERGY LASER & CHRONOMETER INSTRUMENTS (SVG) ── */}
                  <svg 
                    className="absolute inset-0 w-full h-full pointer-events-none z-15" 
                    viewBox="0 0 400 400"
                  >
                    <defs>
                      {/* Deep Volumetric Atmosphere Filter */}
                      <filter id="hyperLaserGlow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="8" result="blurDeep" />
                        <feGaussianBlur stdDeviation="3.5" result="blurMid" />
                        <feGaussianBlur stdDeviation="1" result="blurSharp" />
                        <feMerge>
                          <feMergeNode in="blurDeep" />
                          <feMergeNode in="blurMid" />
                          <feMergeNode in="blurSharp" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>

                      {/* Comet Plasma Flare */}
                      <filter id="cometFlare" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="12" result="flareWide" />
                        <feGaussianBlur stdDeviation="3.5" result="flareMid" />
                        <feMerge>
                          <feMergeNode in="flareWide" />
                          <feMergeNode in="flareMid" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>

                      {/* Continuous High-Energy Plasma Gradient: Blue -> White -> Flame Orange */}
                      <linearGradient id="photonArcGrad" x1="12%" y1="88%" x2="84%" y2="18%">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.2" />
                        <stop offset="8%" stopColor="#00d8ff" stopOpacity="0.95" />
                        <stop offset="25%" stopColor="#38bdf8" stopOpacity="1" />
                        <stop offset="48%" stopColor="#bae6fd" stopOpacity="1" />
                        <stop offset="60%" stopColor="#ffffff" stopOpacity="1" />
                        <stop offset="78%" stopColor="#fb923c" stopOpacity="1" />
                        <stop offset="92%" stopColor="#f97316" stopOpacity="1" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity="1" />
                      </linearGradient>

                      {/* Super Bright White Core Beam Gradient */}
                      <linearGradient id="coreBeamGrad" x1="12%" y1="88%" x2="84%" y2="18%">
                        <stop offset="0%" stopColor="#00d8ff" stopOpacity="0.3" />
                        <stop offset="20%" stopColor="#e0f2fe" stopOpacity="0.95" />
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                        <stop offset="75%" stopColor="#ffffff" stopOpacity="1" />
                        <stop offset="100%" stopColor="#fff7ed" stopOpacity="1" />
                      </linearGradient>

                      {/* Outer Electric Blue Guideline Arc Gradient */}
                      <linearGradient id="outerGuideGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00d8ff" stopOpacity="0.9" />
                        <stop offset="45%" stopColor="#2563eb" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.05" />
                      </linearGradient>

                      {/* Inner Red Trajectory Guideline */}
                      <linearGradient id="innerRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
                        <stop offset="50%" stopColor="#b91c1c" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>

                    {/* 1. Outer Electric Blue Guideline Circle (R=158) */}
                    <circle 
                      cx="200" cy="200" r="158" 
                      fill="none" 
                      stroke="url(#outerGuideGrad)" 
                      strokeWidth="1.8" 
                      strokeLinecap="round"
                      strokeDasharray="210 280"
                      transform="rotate(65 200 200)"
                      opacity="0.85"
                    />

                    {/* 2. Inner Red/Crimson Trajectory Ring (R=136) */}
                    <circle 
                      cx="200" cy="200" r="136" 
                      fill="none" 
                      stroke="url(#innerRedGrad)" 
                      strokeWidth="1.4" 
                      strokeLinecap="round"
                      strokeDasharray="350 200"
                      transform="rotate(110 200 200)"
                      opacity="0.65"
                    />

                    {/* 
                      3. MAIN ROTATING HIGH-ENERGY PHOTON BEAM & COMET HEAD
                      Center is 200, 200 — Rotates directly with scroll!
                    */}
                    <motion.g 
                      style={{ 
                        rotate: energyRotation,
                        transformOrigin: "200px 200px",
                        willChange: 'transform'
                      }}
                    >
                      {/* Layer 1: Volumetric Atmospheric Plasma Glow */}
                      <path 
                        d="M 83.7 281.4 A 142 142 0 0 1 325.4 133.3" 
                        fill="none" 
                        stroke="url(#photonArcGrad)" 
                        strokeWidth="12" 
                        strokeLinecap="round"
                        filter="url(#hyperLaserGlow)"
                        opacity="0.85"
                      />

                      {/* Layer 2: Vivid Neon Core Ribbon */}
                      <path 
                        d="M 83.7 281.4 A 142 142 0 0 1 325.4 133.3" 
                        fill="none" 
                        stroke="url(#photonArcGrad)" 
                        strokeWidth="5.5" 
                        strokeLinecap="round"
                        filter="url(#hyperLaserGlow)"
                        opacity="0.95"
                      />

                      {/* Layer 3: Ultra-Intense Pure White Hot Filament */}
                      <path 
                        d="M 83.7 281.4 A 142 142 0 0 1 325.4 133.3" 
                        fill="none" 
                        stroke="url(#coreBeamGrad)" 
                        strokeWidth="2.6" 
                        strokeLinecap="round"
                      />

                      {/* 4. BRILLIANT COMET PLASMA HEAD (at tip x=325.4, y=133.3) */}
                      {/* Ambient amber light spill */}
                      <circle cx="325.4" cy="133.3" r="28" fill="#ea580c" opacity="0.45" filter="url(#hyperLaserGlow)" />
                      {/* Concentrated plasma burst */}
                      <circle cx="325.4" cy="133.3" r="12" fill="#ff6a00" filter="url(#cometFlare)" />
                      {/* Hot yellow center */}
                      <circle cx="325.4" cy="133.3" r="6" fill="#fef08a" />
                      {/* Pure white blinding nucleus */}
                      <circle cx="325.4" cy="133.3" r="3" fill="#ffffff" />
                    </motion.g>

                    {/* 5. Minimalist 3D Watch Hands (Pivot at 200, 200) */}
                    <motion.g 
                      style={{ 
                        rotate: hourHandRotation,
                        transformOrigin: "200px 200px",
                        willChange: 'transform'
                      }}
                    >
                      <line x1="200" y1="200" x2="152" y2="168" stroke="#71717a" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
                    </motion.g>

                    <motion.g 
                      style={{ 
                        rotate: minuteHandRotation,
                        transformOrigin: "200px 200px",
                        willChange: 'transform'
                      }}
                    >
                      <line x1="200" y1="200" x2="232" y2="295" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
                    </motion.g>

                    {/* Center Spindle Ring (Static) */}
                    <circle cx="200" cy="200" r="5" fill="#090a10" stroke="#71717a" strokeWidth="2" />
                    <circle cx="200" cy="200" r="1.8" fill="#f4f4f5" />

                  </svg>

                </div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* ══════════════════════════════════════════════════════════
             RIGHT COLUMN: CALL TO ACTION CONTENT
             ══════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          
          {/* Massive Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-6 leading-[1.04]"
          >
            Join the
            <br />
            Movement
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed mb-8 max-w-lg"
          >
            Unlock the future of learning with Florix.
            <br />
            Remember, this journey is just getting started.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap items-center gap-4"
          >
            {/* Glowing Pill Button (Start Now) */}
            <button
              onClick={() => navigate('/signup')}
              className="relative px-8 py-3.5 rounded-full font-bold text-sm text-slate-950 bg-gradient-to-r from-white via-amber-50 to-orange-100 shadow-[0_0_35px_rgba(249,115,22,0.85),0_10px_25px_rgba(234,88,12,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              START NOW
            </button>

            {/* Secondary Glass Button (Join Community) */}
            <button
              onClick={() => navigate('/login')}
              className="px-7 py-3.5 rounded-full font-semibold text-sm text-white bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              JOIN OUR COMMUNITY
            </button>
          </motion.div>

        </div>

      </div>

      {/* ── Footer Navigation ── */}
      <div className="mt-24 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
        <div>
          Copyright © 2026 Florix AI Labs. All rights reserved.
        </div>

        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
        </div>

        <div className="flex items-center gap-5 text-zinc-400">
          <span className="hover:text-white cursor-pointer transition-colors"><Twitter size={15} /></span>
          <span className="hover:text-white cursor-pointer transition-colors"><Linkedin size={15} /></span>
          <span className="hover:text-white cursor-pointer transition-colors"><Github size={15} /></span>
          <span className="hover:text-white cursor-pointer transition-colors"><MessageCircle size={15} /></span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="text-orange-400">🧡</span> Made with passion for students
        </div>
      </div>

    </section>
  );
}

export default React.memo(ChronometerCTA);
