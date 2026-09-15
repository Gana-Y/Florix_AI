import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const InteractiveBackground = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 50, stiffness: 120, mass: 1.5 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Deep parallax layers
  const x1 = useTransform(springX, (v) => `${v * 110}px`);
  const y1 = useTransform(springY, (v) => `${v * 110}px`);
  const x2 = useTransform(springX, (v) => `${v * -85}px`);
  const y2 = useTransform(springY, (v) => `${v * -85}px`);
  const x3 = useTransform(springX, (v) => `${v * 55}px`);
  const y3 = useTransform(springY, (v) => `${v * -55}px`);
  const x4 = useTransform(springX, (v) => `${v * -40}px`);
  const y4 = useTransform(springY, (v) => `${v * 65}px`);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-[#09090b]">
      {/* Orb 1 — Indigo (top-left, strong) */}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-20%] left-[-20%] w-[900px] h-[900px] rounded-full"
        style={{
          x: x1, y: y1,
          background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 60%)',
          mixBlendMode: 'screen',
          willChange: 'transform'
        }}
      />

      {/* Orb 2 — Purple (bottom-right, strong) */}
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-[-20%] right-[-20%] w-[900px] h-[900px] rounded-full"
        style={{
          x: x2, y: y2,
          background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 60%)',
          mixBlendMode: 'screen',
          willChange: 'transform'
        }}
      />

      {/* Orb 3 — Pink (center-right floating) */}
      <motion.div
        animate={{ y: ['-10px', '10px', '-10px'] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[30%] right-[10%] w-[600px] h-[600px] rounded-full"
        style={{
          x: x3, y: y3,
          background: 'radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 60%)',
          mixBlendMode: 'screen',
          willChange: 'transform'
        }}
      />

      {/* Orb 4 — Blue (center-left accent) */}
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute top-[10%] right-[30%] w-[500px] h-[500px] rounded-full"
        style={{
          x: x4, y: y4,
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 60%)',
          mixBlendMode: 'screen',
          willChange: 'transform'
        }}
      />

      {/* Subtle bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-70" />

      {/* Top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/40 via-transparent to-transparent" />
    </div>
  );
};

export default InteractiveBackground;
