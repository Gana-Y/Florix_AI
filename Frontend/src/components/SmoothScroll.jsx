import React, { useEffect, useRef, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const SmoothScrollContext = createContext(null);

export const useLenis = () => useContext(SmoothScrollContext);

/**
 * SmoothScroll — Root-level Lenis smooth scrolling orchestrator.
 * 
 * Features:
 * 1. Mounted ONCE at the application root.
 * 2. Drives a single master requestAnimationFrame loop (lenis.raf(time)).
 * 3. Keeps window.scrollY and native scroll listeners in lockstep with Lenis.
 * 4. Resets scroll position immediately on route changes.
 * 5. Respects [data-lenis-prevent] attributes on nested scrollable containers.
 */
export default function SmoothScroll({ children }) {
  const location = useLocation();
  const lenisRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Lenis instance with optimal physics
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential deceleration
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      infinite: false,
    });

    lenisRef.current = lenis;
    window.__lenis = lenis;

    // 2. Single Global RequestAnimationFrame loop
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // 3. Keep Lenis synchronized with Framer Motion and native listeners
    const onScroll = () => {
      // Dispatches a lightweight window scroll update so Framer Motion useScroll stays frame-accurate
      window.dispatchEvent(new Event('scroll'));
    };
    lenis.on('scroll', onScroll);

    // 4. Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
      window.__lenis = null;
    };
  }, []);

  // 5. Scroll to top immediately on route transitions
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
  }, [location.pathname]);

  return (
    <SmoothScrollContext.Provider value={lenisRef.current}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
