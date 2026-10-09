import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * InteractiveBotAvatar
 * An expressive, physics-animated robot companion avatar for Florix AI.
 * - Tracks user mouse coordinates smoothly ("it can see me").
 * - Reacts excitedly when the user is texting/typing (looks down at input & tracks keystrokes).
 * - Scans horizontally with a neural pulse when AI is thinking/generating (isLoading).
 * - Naturally blinks every 3.5–5 seconds with soft eye spring damping.
 */
const InteractiveBotAvatar = ({
  size = 32,
  isTyping = false,
  isLoading = false,
  className = '',
  onClick = null
}) => {
  const avatarRef = useRef(null);
  const [mouseEyeOffset, setMouseEyeOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  // 1. Natural Blinking Loop (fires every 3.5 to 5 seconds)
  useEffect(() => {
    let blinkTimeout;
    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 2000;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 2. Interactive Cursor Tracking ("it can see me")
  useEffect(() => {
    // If AI is thinking, eyes do their own scanner animation; disable cursor tracking
    if (isLoading) return;

    let frameId;
    const handleMouseMove = (e) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!avatarRef.current) return;
        const rect = avatarRef.current.getBoundingClientRect();
        const avatarCenterX = rect.left + rect.width / 2;
        const avatarCenterY = rect.top + rect.height / 2;

        const deltaX = e.clientX - avatarCenterX;
        const deltaY = e.clientY - avatarCenterY;
        const distance = Math.hypot(deltaX, deltaY);

        // Normalize and clamp eye offset within [-2.2, 2.2] pixels
        const maxOffset = 2.2;
        if (distance > 0) {
          const clampedDistance = Math.min(distance / 200, 1);
          const angle = Math.atan2(deltaY, deltaX);
          setMouseEyeOffset({
            x: Math.cos(angle) * maxOffset * clampedDistance,
            y: Math.sin(angle) * maxOffset * clampedDistance
          });
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, [isLoading]);

  // Compute eye position based on priority:
  // Priority 1: AI Thinking (isLoading) -> Autonomous horizontal scanner sweep
  // Priority 2: User Typing (isTyping) -> Look down towards input with alert micro-glances
  // Priority 3: Idle -> Smooth mouse cursor tracking
  const getEyeMotion = () => {
    if (isLoading) {
      return {
        x: [-2.2, 2.2, -2.2],
        y: [0, 0, 0],
        transition: {
          x: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
          y: { duration: 0.2 }
        }
      };
    }

    if (isTyping) {
      return {
        x: mouseEyeOffset.x * 0.4,
        y: 1.8, // Looking attentively down at user's text input
        transition: { type: 'spring', stiffness: 350, damping: 20 }
      };
    }

    return {
      x: mouseEyeOffset.x,
      y: mouseEyeOffset.y,
      transition: { type: 'spring', stiffness: 220, damping: 18 }
    };
  };

  const eyeMotion = getEyeMotion();

  return (
    <div
      ref={avatarRef}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`relative select-none flex items-center justify-center shrink-0 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-md ${className}`}
      title={isLoading ? 'Florix AI is synthesizing...' : isTyping ? 'Florix AI is reading what you type...' : 'Florix AI Assistant'}
    >
      {/* Outer ambient glow ring when active */}
      {(isLoading || isTyping) && (
        <motion.div
          animate={{
            scale: isLoading ? [1, 1.15, 1] : [1, 1.08, 1],
            opacity: isLoading ? [0.4, 0.8, 0.4] : [0.3, 0.6, 0.3]
          }}
          transition={{ repeat: Infinity, duration: isLoading ? 1.4 : 1.8, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-cyan-400/30 blur-sm pointer-events-none"
        />
      )}

      {/* SVG Vector Robot Face */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%] relative z-10"
      >
        {/* Antenna Stem */}
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="6"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Antenna Beacon / Orb (Pulses when active) */}
        <motion.circle
          cx="12"
          cy="2.5"
          r="1.8"
          animate={{
            fill: isLoading ? '#38bdf8' : isTyping ? '#22d3ee' : '#ffffff',
            scale: isLoading ? [1, 1.35, 1] : isTyping ? [1, 1.25, 1] : 1
          }}
          transition={{
            repeat: isLoading || isTyping ? Infinity : 0,
            duration: isLoading ? 0.8 : 0.6
          }}
        />

        {/* Left Ear Sensor */}
        <rect x="2" y="11" width="2" height="4" rx="1" fill="white" fillOpacity="0.85" />

        {/* Right Ear Sensor */}
        <rect x="20" y="11" width="2" height="4" rx="1" fill="white" fillOpacity="0.85" />

        {/* Robot Head Body (Soft rounded visor) */}
        <rect
          x="4"
          y="6"
          width="16"
          height="14"
          rx="4.5"
          stroke="white"
          strokeWidth="1.8"
          fill="rgba(15, 23, 42, 0.45)"
        />

        {/* Dynamic Eyes Group with Blinking and Tracking */}
        <motion.g
          animate={{
            scaleY: isBlinking ? 0.1 : 1
          }}
          style={{ transformOrigin: '12px 12px' }}
          transition={{ duration: 0.1 }}
        >
          {/* Left Eye Socket Background */}
          <circle cx="8.5" cy="12" r="2.2" fill="#0f172a" fillOpacity="0.8" />

          {/* Left Eye Pupil (Animated) */}
          <motion.circle
            cx="8.5"
            cy="12"
            r={isTyping ? "1.6" : "1.4"}
            fill={isLoading ? "#38bdf8" : isTyping ? "#22d3ee" : "#38bdf8"}
            animate={eyeMotion}
            style={{
              filter: 'drop-shadow(0px 0px 2.5px rgba(56, 189, 248, 0.95))'
            }}
          />
          {/* Left Eye Glint Highlight */}
          <motion.circle
            cx="7.9"
            cy="11.4"
            r="0.5"
            fill="white"
            animate={eyeMotion}
          />

          {/* Right Eye Socket Background */}
          <circle cx="15.5" cy="12" r="2.2" fill="#0f172a" fillOpacity="0.8" />

          {/* Right Eye Pupil (Animated) */}
          <motion.circle
            cx="15.5"
            cy="12"
            r={isTyping ? "1.6" : "1.4"}
            fill={isLoading ? "#38bdf8" : isTyping ? "#22d3ee" : "#38bdf8"}
            animate={eyeMotion}
            style={{
              filter: 'drop-shadow(0px 0px 2.5px rgba(56, 189, 248, 0.95))'
            }}
          />
          {/* Right Eye Glint Highlight */}
          <motion.circle
            cx="14.9"
            cy="11.4"
            r="0.5"
            fill="white"
            animate={eyeMotion}
          />
        </motion.g>

        {/* Robot Mouth Grill / Smile */}
        <motion.path
          d={
            isTyping
              ? "M 9.5 16.5 Q 12 18.2 14.5 16.5" // Cute happy smile when user is typing!
              : isLoading
              ? "M 10 16.5 L 14 16.5" // Calm neutral line while calculating
              : "M 10 16.5 Q 12 17.5 14 16.5" // Gentle pleasant curve while idle
          }
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          transition={{ duration: 0.2 }}
        />
      </svg>
    </div>
  );
};

export default InteractiveBotAvatar;
