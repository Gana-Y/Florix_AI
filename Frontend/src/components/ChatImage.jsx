import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Maximize2, X, Image as ImageIcon, ExternalLink, RefreshCw } from 'lucide-react';

const ChatImage = ({ src, alt, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
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
      // Auto-retry up to 2 times with a slight delay before showing failure
      if (autoRetryCountRef.current < 2) {
        autoRetryCountRef.current += 1;
        autoRetryTimer = setTimeout(() => {
          if (isMounted) {
            setRetryCount((prev) => prev + 1);
          }
        }, 1800);
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

  const handleManualRetry = (e) => {
    e.stopPropagation();
    autoRetryCountRef.current = 0;
    setHasError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  if (hasError) {
    return (
      <div className="my-3.5 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 truncate">
          <ImageIcon size={18} className="text-amber-500 shrink-0" />
          <div className="truncate">
            <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{alt || 'Visual Illustration'}</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Diffusion rendering timed out</p>
          </div>
        </div>
        <button
          onClick={handleManualRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all active:scale-95 shadow-sm shadow-indigo-500/20 shrink-0 cursor-pointer"
        >
          <RefreshCw size={12} /> Retry Generation
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="my-3.5 max-w-xl rounded-2xl overflow-hidden border border-slate-200/90 dark:border-zinc-800/90 bg-white/60 dark:bg-zinc-950/80 shadow-md">
        <div
          className="relative group cursor-pointer overflow-hidden min-h-[220px] flex items-center justify-center bg-slate-100/70 dark:bg-zinc-900/70"
          onClick={() => !loading && setIsModalOpen(true)}
          title={loading ? 'Rendering visual...' : 'Click to expand visual in full-screen'}
        >
          {/* Active rendering skeleton with shimmer animation */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-50/90 dark:bg-zinc-900/90 backdrop-blur-sm">
              <div className="relative mb-3">
                <Loader2 size={26} className="animate-spin text-indigo-500 dark:text-indigo-400" />
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              </div>
              <span className="font-semibold text-xs text-slate-700 dark:text-zinc-200 mb-1">
                Synthesizing Visual Illustration...
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs">
                Generating high-definition artwork via neural engine (~2-4 seconds)
              </span>
            </div>
          )}

          {/* Image */}
          <img
            src={activeSrc}
            alt={alt || 'Visual representation'}
            className={`w-full max-h-[500px] object-contain rounded-t-2xl transition-opacity duration-500 ease-out ${
              loading ? 'opacity-0' : 'opacity-100 group-hover:scale-[1.01]'
            }`}
            onLoad={() => setLoading(false)}
            onError={() => {
              // Handled by preloader logic
            }}
            fetchPriority="high"
            decoding="async"
            {...props}
          />

          {!loading && (
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <span className="px-3.5 py-1.5 rounded-full bg-slate-950/85 text-white text-xs font-semibold backdrop-blur-md shadow-xl flex items-center gap-1.5 border border-white/15">
                <Maximize2 size={12} /> Expand Visual
              </span>
            </div>
          )}
        </div>

        {alt && (
          <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
            <span className="font-medium truncate max-w-[80%]" title={alt}>{alt}</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider shrink-0 ml-2 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
              AI Illustration
            </span>
          </div>
        )}
      </div>

      {/* Lightbox Fullscreen Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[94vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-300 font-semibold">
              <span className="truncate pr-4">{alt || 'Visual Illustration'}</span>
              <div className="flex items-center gap-2 shrink-0">
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
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-3 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[300px]">
              <img
                src={activeSrc}
                alt={alt}
                className="max-w-full max-h-[82vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatImage;
