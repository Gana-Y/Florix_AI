import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Maximize2,
  X,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  Wand2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const GENERATION_STAGES = [
  'Analyzing visual prompt & composition...',
  'Synthesizing latent diffusion grid & lighting...',
  'Refining 4K textures, depth & optical clarity...',
  'Calibrating photorealistic colors & resolution...'
];

const getProxyUrl = (targetUrl) => {
  if (!targetUrl) return '';
  return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(targetUrl)}`;
};

const ChatImage = ({ src, alt, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Zoom & Pan state for interactive fullscreen inspection
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Generate multi-tier fallback cascade of image candidate URLs
  const candidates = useMemo(() => {
    if (!src) return [];
    const newSeed = Math.floor(10000 + Math.random() * 900000);
    let seeded = src;
    if (seeded.includes('seed=')) {
      seeded = seeded.replace(/seed=\d+/, `seed=${newSeed}`);
    } else {
      const sep = seeded.includes('?') ? '&' : '?';
      seeded = `${seeded}${sep}seed=${newSeed}`;
    }

    const list = [];
    // Tier 1: Direct primary neural render
    list.push(seeded);

    // Tier 2: Instant SDXL Turbo direct render (0.7s lightning fast generation)
    if (seeded.includes('model=flux')) {
      list.push(seeded.replace('model=flux', 'model=turbo'));
    }

    // Tier 3: Resilient backend proxy (bypasses browser CORS & Cloudflare 403 blocks)
    list.push(getProxyUrl(seeded));

    // Tier 4: Backend proxy with SDXL Turbo
    if (seeded.includes('model=flux')) {
      list.push(getProxyUrl(seeded.replace('model=flux', 'model=turbo')));
    }

    // Tier 5: Default engine fallback
    const defaultUrl = seeded.replace(/([?&])model=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
    list.push(defaultUrl);
    list.push(getProxyUrl(defaultUrl));

    return list;
  }, [src, retryCount]);

  const activeSrc = candidates[candidateIndex] || src || '';
  const isTurboActive = activeSrc.includes('model=turbo');

  // Stage transition & progress animation during generation
  useEffect(() => {
    if (!loading) {
      setProgress(100);
      return;
    }

    setProgress(20);
    setStageIndex(0);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return 94; // Hold near finish until onload triggers
        const increment = Math.max(1, Math.floor((95 - prev) * 0.15));
        return Math.min(94, prev + increment);
      });
    }, 300);

    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % GENERATION_STAGES.length);
    }, 1600);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stageTimer);
    };
  }, [loading, candidateIndex, retryCount]);

  // Image preloading logic with automatic candidate fallback cascade
  useEffect(() => {
    if (!activeSrc) return;
    setLoading(true);
    setHasError(false);

    let isMounted = true;
    let watchdogTimer = null;
    const preloader = new Image();
    preloader.referrerPolicy = 'no-referrer';
    preloader.src = activeSrc;
    preloader.decoding = 'async';

    preloader.onload = () => {
      if (isMounted) {
        setLoading(false);
        setHasError(false);
      }
    };

    const handleFailure = () => {
      if (!isMounted) return;
      if (candidateIndex < candidates.length - 1) {
        // Automatically cascade to next candidate engine (e.g. Turbo or Backend Proxy)
        setCandidateIndex((prev) => prev + 1);
      } else {
        setLoading(false);
        setHasError(true);
      }
    };

    preloader.onerror = handleFailure;

    // Watchdog timer: If current candidate takes too long, seamlessly advance to next candidate
    const timeoutDuration = candidateIndex === 0 ? 8000 : 7000;
    watchdogTimer = setTimeout(() => {
      if (isMounted && loading) {
        handleFailure();
      }
    }, timeoutDuration);

    return () => {
      isMounted = false;
      if (watchdogTimer) clearTimeout(watchdogTimer);
    };
  }, [activeSrc, candidateIndex, candidates.length]);

  // Lock body scroll when fullscreen modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isModalOpen]);

  // Reset zoom & pan when modal opens/closes
  useEffect(() => {
    if (!isModalOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isModalOpen]);

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isModalOpen) return;
      if (e.key === 'Escape') {
        if (zoom > 1) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else {
          setIsModalOpen(false);
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoom((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((prev) => {
          const next = Math.max(1, +(prev - 0.25).toFixed(2));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, zoom]);

  const handleZoomIn = (e) => {
    if (e) e.stopPropagation();
    setZoom((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = (e) => {
    if (e) e.stopPropagation();
    setZoom((prev) => {
      const next = Math.max(1, +(prev - 0.25).toFixed(2));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e) => {
    if (e) e.stopPropagation();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleZoom = (e) => {
    e.stopPropagation();
    if (zoom > 1) {
      handleResetZoom();
    } else {
      setZoom(1.75);
    }
  };

  const handleWheel = (e) => {
    if (!isModalOpen) return;
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(3, +(prev + 0.15).toFixed(2)));
    } else {
      setZoom((prev) => {
        const next = Math.max(1, +(prev - 0.15).toFixed(2));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleManualRetry = (e) => {
    e.stopPropagation();
    setCandidateIndex(0);
    setHasError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  const handleForceTurbo = (e) => {
    e.stopPropagation();
    setCandidateIndex(1); // Jump straight to Turbo
    setHasError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  // Safe fetch helper with automatic proxy fallback for CORS & 403 immunity
  const fetchImageBlob = async (targetUrl) => {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) return await res.blob();
    } catch {}
    // Fallback via backend proxy
    const proxyRes = await fetch(getProxyUrl(targetUrl));
    return await proxyRes.blob();
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      const blob = await fetchImageBlob(activeSrc);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/jpeg']: blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(activeSrc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await fetchImageBlob(activeSrc);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = (alt || 'florix_visual')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
      link.download = `${cleanName || 'visual'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement('a');
      link.href = getProxyUrl(activeSrc);
      link.target = '_blank';
      link.download = 'florix_visual.jpg';
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  if (hasError) {
    return (
      <div className="my-4 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-slate-700 dark:text-zinc-300 flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 truncate max-w-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ImageIcon size={18} className="text-amber-500" />
          </div>
          <div className="truncate">
            <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{alt || 'Visual Illustration'}</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Diffusion queue busy. Ready to synthesize.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleForceTurbo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all active:scale-95 shadow-sm shadow-indigo-500/20 shrink-0 cursor-pointer text-xs"
          >
            <Zap size={12} className="text-amber-300" /> Fast Turbo Render
          </button>
          <button
            onClick={handleManualRetry}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 transition-all text-xs cursor-pointer"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inline Chat Image Card */}
      <div className="my-4 max-w-2xl rounded-2xl overflow-hidden border border-slate-200/90 dark:border-zinc-800/90 bg-white/70 dark:bg-zinc-950/90 shadow-lg backdrop-blur-md transition-all hover:shadow-xl">
        <div
          className="relative group cursor-pointer overflow-hidden min-h-[260px] flex items-center justify-center bg-slate-950"
          onClick={() => !loading && setIsModalOpen(true)}
          title={loading ? 'Synthesizing visual representation...' : 'Click to expand visual in full-screen'}
        >
          {/* =========================================================
              GENERATIVE AI CANVAS ANIMATION (while loading)
              ========================================================= */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-950 overflow-hidden select-none">
              {/* Radiant Ambient Aurora Background */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-pink-500/20 blur-3xl animate-pulse-aurora" />
                <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
              </div>

              {/* Animated Laser Scanning Beam */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_18px_rgba(34,211,238,0.9)] animate-laser-sweep pointer-events-none" />

              {/* Pulsing Neural Core Icon */}
              <div className="relative mb-4 flex items-center justify-center">
                <div className="absolute -inset-3 rounded-2xl bg-indigo-500/20 blur-md animate-pulse" />
                <div className="relative w-14 h-14 rounded-2xl bg-zinc-900/90 border border-indigo-500/40 flex items-center justify-center shadow-inner">
                  <Wand2 size={24} className="text-indigo-400 animate-pulse" />
                  <Loader2 size={38} className="absolute text-cyan-400/50 animate-spin" strokeWidth={1.5} />
                </div>
              </div>

              {/* Progressive Synthesis Status */}
              <div className="relative z-10 max-w-sm flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold tracking-wider uppercase mb-2">
                  <Sparkles size={11} className="text-cyan-400" />
                  {isTurboActive ? 'SDXL Turbo Engine' : 'FLUX.1 Neural Diffusion'}
                </div>

                <p className="font-medium text-xs text-zinc-200 h-5 transition-all duration-300 ease-out">
                  {candidateIndex > 0 ? 'Accelerating neural diffusion render...' : GENERATION_STAGES[stageIndex]}
                </p>

                {/* Progress Bar with Shimmer Fill */}
                <div className="w-56 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-3 p-0.5 border border-zinc-700/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 animate-shimmer-glow transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <span className="text-[10px] text-zinc-500 mt-2 font-mono">
                  Synthesizing Ultra HD render • {progress}%
                </span>
              </div>
            </div>
          )}

          {/* =========================================================
              RENDERED INLINE IMAGE
              ========================================================= */}
          <img
            src={activeSrc}
            alt={alt || 'Visual representation'}
            referrerPolicy="no-referrer"
            className={`w-full max-h-[520px] object-contain transition-all duration-700 ease-out ${
              loading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 group-hover:scale-[1.01]'
            }`}
            onLoad={() => setLoading(false)}
            fetchPriority="high"
            decoding="async"
            {...props}
          />

          {/* Floating Action Toolbar */}
          {!loading && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors relative cursor-pointer"
                title={copied ? 'Copied to clipboard!' : 'Copy image'}
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied && (
                  <span className="absolute -bottom-7 right-0 text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                    Copied!
                  </span>
                )}
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Download High-Res Image"
              >
                <Download size={14} className={downloading ? 'animate-bounce text-cyan-400' : ''} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Fullscreen expand"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {alt && (
          <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
            <div className="flex items-center gap-2 truncate max-w-[75%]">
              <Sparkles size={13} className="text-cyan-400 shrink-0" />
              <span className="font-medium truncate" title={alt}>
                {alt}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">4K Ultra HD</span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider bg-cyan-950/70 px-2 py-0.5 rounded-md border border-cyan-800/50 flex items-center gap-1">
                <Sparkles size={10} className="text-cyan-400" />
                {isTurboActive ? 'SDXL Turbo Render' : 'FLUX.1 Neural Render'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          PORTALED FULLSCREEN LIGHTBOX MODAL
          Directly attached to document.body:
          - Bypasses parent transforms, framer-motion, and overflows
          - Covers 100vw x 100vh of the true viewport
          - Features interactive Zoom (+/-), Reset (0), Pan, and Copy/Download
          - Unmistakable [✕ Close] button always visible
          ========================================================= */}
      {typeof document !== 'undefined' && isModalOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Fullscreen visual viewer'}
          className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between select-none animate-fadeIn transition-opacity duration-200"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: 0 }}
          onClick={() => {
            if (zoom > 1) {
              handleResetZoom();
            } else {
              setIsModalOpen(false);
            }
          }}
        >
          {/* Top Floating Glass Header */}
          <div
            className="w-full max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title / Badge */}
            <div className="flex items-center gap-2 sm:gap-3 text-zinc-200 text-xs sm:text-sm font-semibold truncate pr-2 sm:pr-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Sparkles size={15} className="text-cyan-400" />
              </div>
              <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-[10px] text-cyan-300 font-mono">
                {isTurboActive ? 'SDXL Turbo 4K Neural Render' : 'FLUX.1 4K Neural Render'}
              </span>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 bg-zinc-900/95 border border-zinc-800 rounded-2xl p-1 sm:p-1.5 shadow-2xl backdrop-blur-xl">
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                title="Zoom out (-)"
              >
                <ZoomOut size={16} />
              </button>

              {/* Zoom Reset / Level Indicator */}
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 text-xs font-mono font-medium transition-all cursor-pointer"
                title="Reset zoom (0)"
              >
                {Math.round(zoom * 100)}%
              </button>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                title="Zoom in (+)"
              >
                <ZoomIn size={16} />
              </button>

              <div className="w-px h-5 bg-zinc-800 mx-0.5" />

              {/* Copy Image */}
              <button
                onClick={handleCopy}
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer relative"
                title={copied ? 'Copied to clipboard!' : 'Copy image'}
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                {copied && (
                  <span className="absolute -bottom-8 right-0 text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-40">
                    Copied!
                  </span>
                )}
              </button>

              {/* Download Image */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Download High-Res Image"
              >
                <Download size={16} className={downloading ? 'animate-bounce text-cyan-400' : ''} />
              </button>

              {/* External Link */}
              <a
                href={activeSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Open original in new tab"
              >
                <ExternalLink size={16} />
              </a>

              <div className="w-px h-5 bg-zinc-800 mx-0.5" />

              {/* Prominent, Unmissable Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 hover:text-white font-medium text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
                title="Close (ESC)"
              >
                <X size={16} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Central Full-View Canvas Viewport */}
          <div
            className={`relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-6 overflow-hidden ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleToggleZoom}
          >
            <img
              src={activeSrc}
              alt={alt || 'Visual representation'}
              referrerPolicy="no-referrer"
              draggable={false}
              className="max-w-[94vw] max-h-[84vh] object-contain rounded-xl shadow-2xl transition-transform duration-150 ease-out select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                willChange: 'transform'
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </div>

          {/* Bottom Floating Hint Pill */}
          <div
            className="w-full max-w-md mx-auto pb-4 px-4 flex items-center justify-center z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-md text-[11px] text-zinc-400 font-medium">
              <span className="inline-flex items-center gap-1 text-zinc-300">
                <Layers size={12} className="text-indigo-400" />
                True Fullscreen
              </span>
              <span className="text-zinc-600">•</span>
              <span>Double-click or scroll to zoom</span>
              <span className="text-zinc-600">•</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ChatImage;
