import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Wand2
} from 'lucide-react';

const GENERATION_STAGES = [
  'Analyzing visual prompt & composition...',
  'Synthesizing latent diffusion grid & lighting...',
  'Refining 4K textures, depth & optical clarity...',
  'Calibrating photorealistic colors & resolution...'
];

const ChatImage = ({ src, alt, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(12);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const autoRetryCountRef = useRef(0);

  // Compute active image URL with seed rotation on retry
  const activeSrc = useMemo(() => {
    if (!src) return '';
    if (retryCount === 0) return src;
    const newSeed = Math.floor(10000 + Math.random() * 900000);
    if (src.includes('seed=')) {
      return src.replace(/seed=\d+/, `seed=${newSeed}`);
    }
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}seed=${newSeed}&_retry=${retryCount}`;
  }, [src, retryCount]);

  // Stage transition & progress animation during generation
  useEffect(() => {
    if (!loading) {
      setProgress(100);
      return;
    }

    setProgress(15);
    setStageIndex(0);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return 94; // Hold near finish until onload triggers
        const increment = Math.max(1, Math.floor((95 - prev) * 0.15));
        return Math.min(94, prev + increment);
      });
    }, 350);

    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % GENERATION_STAGES.length);
    }, 1800);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stageTimer);
    };
  }, [loading, retryCount]);

  // Image preloading logic
  useEffect(() => {
    if (!activeSrc) return;
    setLoading(true);
    setHasError(false);

    let isMounted = true;
    let autoRetryTimer = null;
    const preloader = new Image();
    preloader.src = activeSrc;
    preloader.decoding = 'async';

    preloader.onload = () => {
      if (isMounted) {
        setLoading(false);
        setHasError(false);
        autoRetryCountRef.current = 0;
      }
    };

    preloader.onerror = () => {
      if (!isMounted) return;
      if (autoRetryCountRef.current < 2) {
        autoRetryCountRef.current += 1;
        autoRetryTimer = setTimeout(() => {
          if (isMounted) {
            setRetryCount((prev) => prev + 1);
          }
        }, 1600);
      } else {
        setLoading(false);
        setHasError(true);
      }
    };

    return () => {
      isMounted = false;
      if (autoRetryTimer) clearTimeout(autoRetryTimer);
    };
  }, [activeSrc]);

  // Keyboard listener for modal ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleManualRetry = (e) => {
    e.stopPropagation();
    autoRetryCountRef.current = 0;
    setHasError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      // Attempt blob copy first
      const res = await fetch(activeSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: Copy link
      try {
        await navigator.clipboard.writeText(activeSrc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently ignore if browser denies clipboard
      }
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(activeSrc);
      const blob = await res.blob();
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
      // Fallback: direct window download
      const link = document.createElement('a');
      link.href = activeSrc;
      link.target = '_blank';
      link.download = 'florix_visual.jpg';
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  if (hasError) {
    return (
      <div className="my-4 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 truncate">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ImageIcon size={18} className="text-amber-500" />
          </div>
          <div className="truncate">
            <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{alt || 'Visual Illustration'}</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Image synthesis timed out</p>
          </div>
        </div>
        <button
          onClick={handleManualRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all active:scale-95 shadow-sm shadow-indigo-500/20 shrink-0 cursor-pointer text-xs"
        >
          <RefreshCw size={12} /> Retry Generation
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="my-4 max-w-2xl rounded-2xl overflow-hidden border border-slate-200/90 dark:border-zinc-800/90 bg-white/70 dark:bg-zinc-950/90 shadow-lg backdrop-blur-md transition-all hover:shadow-xl">
        <div
          className="relative group cursor-pointer overflow-hidden min-h-[260px] flex items-center justify-center bg-slate-950"
          onClick={() => !loading && setIsModalOpen(true)}
          title={loading ? 'Synthesizing visual representation...' : 'Click to expand visual in full-screen'}
        >
          {/* =========================================================
              HIGH-TECH GENERATIVE AI CANVAS ANIMATION (while loading)
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
                  Neural Diffusion Engine
                </div>

                <p className="font-medium text-xs text-zinc-200 h-5 transition-all duration-300 ease-out">
                  {GENERATION_STAGES[stageIndex]}
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
              RENDERED IMAGE (smooth fade-in once ready)
              ========================================================= */}
          <img
            src={activeSrc}
            alt={alt || 'Visual representation'}
            className={`w-full max-h-[520px] object-contain transition-all duration-700 ease-out ${
              loading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 group-hover:scale-[1.01]'
            }`}
            onLoad={() => setLoading(false)}
            fetchPriority="high"
            decoding="async"
            {...props}
          />

          {/* =========================================================
              GEMINI-STYLE TOP-RIGHT FLOATING ACTION TOOLBAR
              ========================================================= */}
          {!loading && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors relative"
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
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Download High-Res Image"
              >
                <Download size={14} className={downloading ? 'animate-bounce text-cyan-400' : ''} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
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
            <div className="flex items-center gap-2 truncate max-w-[78%]">
              <Layers size={13} className="text-indigo-500 shrink-0" />
              <span className="font-medium truncate" title={alt}>
                {alt}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">1080p HQ</span>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
                Verified Asset
              </span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          LIGHTBOX FULLSCREEN MODAL
          ========================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[94vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-300 font-semibold">
              <div className="flex items-center gap-2 truncate pr-4">
                <Sparkles size={14} className="text-indigo-400 shrink-0" />
                <span className="truncate">{alt || 'Visual Illustration'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Copy image"
                >
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Download Image"
                >
                  <Download size={15} />
                </button>
                <a
                  href={activeSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Open original in new tab"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Close (ESC)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="p-3 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[340px]">
              <img
                src={activeSrc}
                alt={alt}
                className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatImage;
