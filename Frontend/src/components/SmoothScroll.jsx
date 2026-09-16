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
    // 1. Initialize Lenis instance with optimal 60fps/120fps inertia interpolation
    const lenis = new Lenis({
      lerp: 0.085, // Snappy mouse response with silky, zero-lag deceleration
      wheelMultiplier: 0.95, // Natural scroll distance per wheel click
      smoothWheel: true,
      syncTouch: false, // Don't hijack native mobile/touchpad momentum
      autoResize: true,
    });

    lenisRef.current = lenis;
    window.__lenis = lenis;

    // 2. Master RequestAnimationFrame loop
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // 3. Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
      window.__lenis = null;
    };
  }, []);

  // 4. Intelligently activate Lenis ONLY where needed (Landing Page)
  // On Dashboard and Auth pages with internal panels, stop Lenis so it never fights nested scroll
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    const isDashboard = location.pathname.startsWith('/dashboard');
    const isAuth = ['/login', '/signup', '/forgot-password', '/onboarding', '/welcome'].includes(location.pathname);

    if (isDashboard || isAuth) {
      lenis.stop();
    } else {
      lenis.start();
      lenis.scrollTo(0, { immediate: true });
    }
  }, [location.pathname]);

  return (
    <SmoothScrollContext.Provider value={lenisRef.current}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
