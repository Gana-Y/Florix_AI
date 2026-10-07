import React, { useState, useEffect } from 'react';
import { Loader2, Maximize2, X, Image as ImageIcon, ExternalLink, RefreshCw } from 'lucide-react';

const ChatImage = ({ src, alt, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadStartTime] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);

  // Proactive JavaScript image preloader to bypass CSS rendering/lazy-load delays
  useEffect(() => {
    if (!src) return;
    setLoading(true);
    setHasError(false);

    let isMounted = true;
    const preloader = new Image();
    preloader.src = src;
    preloader.decoding = 'async';

    preloader.onload = () => {
      if (isMounted) {
        setLoading(false);
        setHasError(false);
      }
    };

    preloader.onerror = () => {
      if (isMounted) {
        setLoading(false);
        setHasError(true);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src, retryCount]);

  const handleRetry = (e) => {
    e.stopPropagation();
    setHasError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  if (hasError) {
    return (
      <div className="my-3 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 text-xs text-slate-600 dark:text-zinc-300 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 truncate">
          <ImageIcon size={16} className="text-amber-500 shrink-0" />
          <span className="truncate font-medium">{alt || 'Visual diagram generation timed out'}</span>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shrink-0"
        >
          <RefreshCw size={12} /> Retry
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-50 dark:bg-zinc-900/90 backdrop-blur-sm">
              <div className="relative mb-3">
                <Loader2 size={26} className="animate-spin text-indigo-500 dark:text-indigo-400" />
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              </div>
              <span className="font-semibold text-xs text-slate-700 dark:text-zinc-200 mb-1">
                Synthesizing Concept Visual...
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs">
                Rendering diagram via neural engine (~2-4 seconds)
              </span>
            </div>
          )}

          {/* Image is always present in DOM to ensure immediate browser HTTP fetch */}
          <img
            src={src}
            alt={alt || 'Visual representation'}
            className={`w-full max-h-[460px] object-contain rounded-t-2xl transition-opacity duration-500 ease-out ${
              loading ? 'opacity-0' : 'opacity-100 group-hover:scale-[1.01]'
            }`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
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
              AI Diagram
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
              <span className="truncate pr-4">{alt || 'Visual Diagram'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Open original in new tab"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-3 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[300px]">
              <img
                src={src}
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
