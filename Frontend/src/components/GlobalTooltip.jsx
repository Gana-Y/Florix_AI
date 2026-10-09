import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * GlobalTooltip
 *
 * Enterprise-grade floating tooltip engine.
 * Solves:
 * 1. Screen clipping: Mathematically clamped within [12px, window.innerWidth - width - 12px].
 *    Never cut off at screen boundaries, even at the extreme right corner (e.g. moon toggle).
 * 2. Exact pointer alignment: Dynamic caret arrow offset tracks the exact center of the target element.
 * 3. Typography & contrast: High-contrast ultra-dark backdrop, crisp 12px semi-bold white text, anti-aliased.
 * 4. Universal title interception: Captures and suppresses native OS/browser tooltips everywhere.
 * 5. Warm-hover physics: Instant transitions between adjacent interactive controls with 0ms lag.
 */
export default function GlobalTooltip() {
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: '',
    shortcut: '',
    isMultiline: false,
    coords: { left: 0, top: 0 },
    arrowLeft: 0,
    placement: 'bottom', // 'bottom' | 'top'
  });

  const timerRef = useRef(null);
  const activeElementRef = useRef(null);
  const tooltipRef = useRef(null);
  const arrowRef = useRef(null);
  const warmHoverRef = useRef(false);
  const warmHoverTimeoutRef = useRef(null);

  // Fast synchronous layout calculation using canvas font metrics
  const calculateLayout = (targetEl, text, shortcut, preferredPos) => {
    if (!targetEl) return null;
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    let textWidth = 60;
    try {
      const canvas = calculateLayout.canvas || (calculateLayout.canvas = document.createElement('canvas'));
      const ctx = canvas.getContext('2d');
      ctx.font = '600 12px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      textWidth = ctx.measureText(text).width;
    } catch {
      textWidth = text.length * 7.5;
    }

    const paddingX = 28; // px-3.5 on both sides
    const shortcutWidth = shortcut ? 40 : 0;
    let totalWidth = Math.ceil(textWidth + paddingX + shortcutWidth);
    let isMultiline = false;
    let totalHeight = 32;

    const MAX_WIDTH = Math.min(280, window.innerWidth - 24);
    if (totalWidth > MAX_WIDTH && text.length > 35) {
      isMultiline = true;
      totalWidth = MAX_WIDTH;
      totalHeight = Math.min(70, Math.ceil(text.length / 28) * 18 + 16);
    } else {
      totalWidth = Math.max(48, Math.min(totalWidth, window.innerWidth - 24));
    }

    const margin = 12; // boundary margin from window edge
    const gap = 8;     // vertical gap from target element

    // Target element horizontal center
    const targetCenterX = rect.left + rect.width / 2;

    // Tooltip left coordinate, centered over target
    let left = targetCenterX - totalWidth / 2;
    // Strictly clamp left inside window boundaries
    left = Math.max(margin, Math.min(window.innerWidth - totalWidth - margin, left));

    // Exact arrow position inside the tooltip pill:
    // targetCenterX = left + arrowLeft => arrowLeft = targetCenterX - left
    let arrowLeft = targetCenterX - left;
    const minArrow = 14;
    const maxArrow = Math.max(minArrow, totalWidth - 14);
    arrowLeft = Math.max(minArrow, Math.min(maxArrow, arrowLeft));

    // Vertical placement (auto-flip between bottom and top)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement = preferredPos;
    if (placement === 'bottom') {
      if (spaceBelow < totalHeight + gap + margin && spaceAbove >= totalHeight + gap + margin) {
        placement = 'top';
      }
    } else if (placement === 'top') {
      if (spaceAbove < totalHeight + gap + margin && spaceBelow >= totalHeight + gap + margin) {
        placement = 'bottom';
      }
    } else {
      placement = spaceBelow >= totalHeight + gap + margin ? 'bottom' : 'top';
    }

    const top = placement === 'bottom'
      ? rect.bottom + gap
      : rect.top - totalHeight - gap;

    return {
      coords: { left: Math.round(left), top: Math.round(top) },
      arrowLeft: Math.round(arrowLeft),
      placement,
      isMultiline,
    };
  };

  useEffect(() => {
    const handleMouseOver = (e) => {
      // Find closest element with data-tooltip, title, or data-original-title
      const target = e.target.closest('[data-tooltip], [title], [data-original-title]');
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

      const text = target.getAttribute('data-tooltip') || target.getAttribute('data-original-title');
      if (!text || !text.trim()) return;

      const shortcut = target.getAttribute('data-tooltip-shortcut') || '';
      const preferredPos = target.getAttribute('data-tooltip-pos') || 'auto';

      activeElementRef.current = target;

      const showTooltip = () => {
        if (activeElementRef.current !== target) return;

        const layout = calculateLayout(target, text.trim(), shortcut.trim(), preferredPos);
        if (!layout) return;

        setTooltipState({
          visible: true,
          text: text.trim(),
          shortcut: shortcut.trim(),
          isMultiline: layout.isMultiline,
          coords: layout.coords,
          arrowLeft: layout.arrowLeft,
          placement: layout.placement,
        });

        warmHoverRef.current = true;
        clearTimeout(warmHoverTimeoutRef.current);
      };

      clearTimeout(timerRef.current);
      if (warmHoverRef.current) {
        // Instant 0ms show when user sweeps across adjacent icons
        showTooltip();
      } else {
        // 120ms debounce on initial hover
        timerRef.current = setTimeout(showTooltip, 120);
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-tooltip], [data-original-title]');
      if (target && target === activeElementRef.current) {
        clearTimeout(timerRef.current);
        activeElementRef.current = null;
        setTooltipState(prev => ({ ...prev, visible: false }));

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

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('click', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleDismiss, { passive: true });
    window.addEventListener('resize', handleDismiss, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleDismiss);
      window.removeEventListener('scroll', handleDismiss);
      window.removeEventListener('resize', handleDismiss);
      clearTimeout(timerRef.current);
      clearTimeout(warmHoverTimeoutRef.current);
    };
  }, []);

  // Frame-perfect layout refinement once mounted in the DOM
  useLayoutEffect(() => {
    if (!tooltipState.visible || !tooltipRef.current || !activeElementRef.current) return;

    const tooltipEl = tooltipRef.current;
    const realWidth = tooltipEl.offsetWidth;
    const realHeight = tooltipEl.offsetHeight;
    const rect = activeElementRef.current.getBoundingClientRect();
    const targetCenterX = rect.left + rect.width / 2;

    const margin = 12;
    const gap = 8;

    let left = targetCenterX - realWidth / 2;
    left = Math.max(margin, Math.min(window.innerWidth - realWidth - margin, left));

    let arrowLeft = targetCenterX - left;
    const minArrow = 14;
    const maxArrow = Math.max(minArrow, realWidth - 14);
    arrowLeft = Math.max(minArrow, Math.min(maxArrow, arrowLeft));

    const top = tooltipState.placement === 'bottom'
      ? rect.bottom + gap
      : rect.top - realHeight - gap;

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
    if (arrowRef.current) {
      arrowRef.current.style.left = `${Math.round(arrowLeft)}px`;
    }
  }, [tooltipState.visible, tooltipState.text, tooltipState.placement]);

  return (
    <AnimatePresence>
      {tooltipState.visible && (
        <motion.div
          ref={tooltipRef}
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
            left: `${tooltipState.coords.left}px`,
            top: `${tooltipState.coords.top}px`,
            zIndex: 99999,
          }}
          className="pointer-events-none select-none"
        >
          {/* Tooltip Content Container */}
          <div
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold tracking-normal text-white bg-slate-950/98 dark:bg-black/95 border border-slate-700/80 dark:border-zinc-700/80 shadow-[0_12px_28px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-xl antialiased ${
              tooltipState.isMultiline ? 'max-w-[280px] text-center leading-snug whitespace-normal' : 'whitespace-nowrap'
            }`}
          >
            {/* Tooltip Text */}
            <span className="drop-shadow-sm">{tooltipState.text}</span>

            {/* Optional Keyboard Shortcut */}
            {tooltipState.shortcut && (
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-white/15 text-zinc-200 border border-white/10 shadow-inner">
                {tooltipState.shortcut}
              </kbd>
            )}

            {/* Micro Caret Arrow: Points directly and precisely at target element center */}
            <div
              ref={arrowRef}
              style={{ left: `${tooltipState.arrowLeft}px` }}
              className={`absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-slate-950 dark:bg-black ${
                tooltipState.placement === 'bottom'
                  ? '-top-[5px] border-t border-l border-slate-700/80 dark:border-zinc-700/80'
                  : '-bottom-[5px] border-b border-r border-slate-700/80 dark:border-zinc-700/80'
              }`}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
