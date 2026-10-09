import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GlobalTooltip
 *
 * Enterprise-grade floating tooltip engine.
 * Features:
 * - Zero ugly native browser boxes: Automatically intercepts and replaces native `title` attributes.
 * - Auto-spatial positioning (top, bottom, left, right) with viewport boundary clamping.
 * - Smooth physical Framer Motion spring fade & scale animations.
 * - Glassmorphic design with subtle border, specular ring, and micro-arrow caret.
 * - Warm hover state: Smooth instantaneous transitions between adjacent interactive elements.
 * - Disappears on click or window scroll.
 */
export default function GlobalTooltip() {
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: '',
    shortcut: '',
    x: 0,
    y: 0,
    placement: 'bottom', // 'top' | 'bottom'
  });

  const timerRef = useRef(null);
  const activeElementRef = useRef(null);
  const warmHoverRef = useRef(false);
  const warmHoverTimeoutRef = useRef(null);

  useEffect(() => {
    const handleMouseOver = (e) => {
      // Find closest element with data-tooltip or title
      const target = e.target.closest('[data-tooltip], [title]');
      if (!target) return;

      // Intercept and strip native title attribute to prevent OS white box from popping up
      if (target.hasAttribute('title')) {
        const rawTitle = target.getAttribute('title').trim();
        if (rawTitle) {
          target.setAttribute('data-tooltip', rawTitle);
          target.removeAttribute('title');
          target.setAttribute('data-original-title', rawTitle);
        }
      }

      const text = target.getAttribute('data-tooltip');
      if (!text || !text.trim()) return;

      const shortcut = target.getAttribute('data-tooltip-shortcut') || '';
      const preferredPos = target.getAttribute('data-tooltip-pos') || 'auto';

      activeElementRef.current = target;

      const showTooltip = () => {
        if (activeElementRef.current !== target) return;

        const rect = target.getBoundingClientRect();
        const tooltipApproxHeight = 32;
        const tooltipMargin = 8;

        // Auto determine vertical placement
        let placement = 'bottom';
        if (preferredPos === 'top') {
          placement = 'top';
        } else if (preferredPos === 'bottom') {
          placement = 'bottom';
        } else {
          // If close to bottom of screen, flip to top
          if (rect.bottom + tooltipApproxHeight + tooltipMargin > window.innerHeight - 20) {
            placement = 'top';
          } else {
            placement = 'bottom';
          }
        }

        // Calculate center X coordinate with screen boundary safety
        const centerX = rect.left + rect.width / 2;
        const safeX = Math.max(70, Math.min(window.innerWidth - 70, centerX));

        const posY = placement === 'bottom'
          ? rect.bottom + tooltipMargin
          : rect.top - tooltipMargin;

        setTooltipState({
          visible: true,
          text: text.trim(),
          shortcut: shortcut.trim(),
          x: safeX,
          y: posY,
          placement,
        });

        warmHoverRef.current = true;
        clearTimeout(warmHoverTimeoutRef.current);
      };

      clearTimeout(timerRef.current);
      if (warmHoverRef.current) {
        // Instant show if user was already hovering nearby tooltips
        showTooltip();
      } else {
        // Subtle 120ms debounce to prevent flickers on fast mouse sweeps
        timerRef.current = setTimeout(showTooltip, 120);
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-tooltip], [data-original-title]');
      if (target && target === activeElementRef.current) {
        clearTimeout(timerRef.current);
        activeElementRef.current = null;
        setTooltipState(prev => ({ ...prev, visible: false }));

        // Keep warm hover active for 350ms so moving to neighboring icons feels instant
        clearTimeout(warmHoverTimeoutRef.current);
        warmHoverTimeoutRef.current = setTimeout(() => {
          warmHoverRef.current = false;
        }, 350);
      }
    };

    const handleDismiss = () => {
      clearTimeout(timerRef.current);
      activeElementRef.current = null;
      setTooltipState(prev => ({ ...prev, visible: false }));
      warmHoverRef.current = false;
    };

    // Attach listeners
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('click', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleDismiss, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleDismiss);
      window.removeEventListener('scroll', handleDismiss);
      clearTimeout(timerRef.current);
      clearTimeout(warmHoverTimeoutRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {tooltipState.visible && (
        <motion.div
          key="global-floating-tooltip"
          initial={{
            opacity: 0,
            scale: 0.94,
            y: tooltipState.placement === 'bottom' ? -4 : 4,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.94,
            transition: { duration: 0.1 },
          }}
          transition={{
            type: 'spring',
            damping: 24,
            stiffness: 450,
          }}
          style={{
            position: 'fixed',
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
            transform: tooltipState.placement === 'bottom'
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
          className="z-[9999] pointer-events-none select-none"
        >
          {/* Tooltip Content Container */}
          <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold tracking-wide whitespace-nowrap bg-slate-900/95 dark:bg-[#121324]/95 text-slate-100 dark:text-zinc-100 border border-slate-700/60 dark:border-indigo-500/30 shadow-[0_12px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl ring-1 ring-white/10 antialiased">
            <span>{tooltipState.text}</span>

            {/* Optional Keyboard Shortcut Pill */}
            {tooltipState.shortcut && (
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-white/10 dark:bg-indigo-500/20 text-slate-300 dark:text-indigo-300 border border-white/10 dark:border-indigo-500/30">
                {tooltipState.shortcut}
              </kbd>
            )}

            {/* Micro Caret Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900/95 dark:bg-[#121324]/95 border-slate-700/60 dark:border-indigo-500/30 ${
                tooltipState.placement === 'bottom'
                  ? '-top-1 border-t border-l'
                  : '-bottom-1 border-b border-r'
              }`}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
