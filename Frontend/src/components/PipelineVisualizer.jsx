import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Play, Circle, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

const PipelineVisualizer = ({ progressId, onComplete, onClose }) => {
  const [steps, setSteps] = useState([
    { step: 1, total: 6, label: "File received", detail: "Waiting for server to verify file...", status: "pending" },
    { step: 2, total: 6, label: "Content parsing", detail: "Waiting...", status: "pending" },
    { step: 3, total: 6, label: "Text chunking", detail: "Waiting...", status: "pending" },
    { step: 4, total: 6, label: "Generating vector embeddings", detail: "Waiting...", status: "pending" },
    { step: 5, total: 6, label: "Indexing in ChromaDB", detail: "Waiting...", status: "pending" },
    { step: 6, total: 6, label: "AI summary generation", detail: "Waiting...", status: "pending" }
  ]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!progressId) return;

    const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000';
    const eventSource = new EventSource(`${baseUrl}/upload/stream/${progressId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          return;
        }

        if (Array.isArray(data)) {
          setSteps(data);

          // Check if all steps are completed (status === 'done')
          const allDone = data.every(s => s.status === 'done');
          if (allDone) {
            eventSource.close();
            // Trigger completion after a short delay so the user can see step 6 finish
            setTimeout(() => {
              if (onComplete) onComplete();
            }, 1000);
          }
        }
      } catch (err) {
        console.error("Error parsing pipeline SSE stream data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [progressId, onComplete]);

  // Calculate overall percentage
  const completedStepsCount = steps.filter(s => s.status === 'done').length;
  const percentage = Math.round((completedStepsCount / steps.length) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        className="w-full max-w-lg bg-zinc-950/90 text-zinc-100 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Terminal Header */}
        <div className="w-full h-11 bg-zinc-900 border-b border-zinc-800/60 px-5 flex items-center justify-between">
          <div className="flex gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-600 transition-colors cursor-pointer" onClick={onClose} />
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
            <div className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-mono font-semibold tracking-wider text-zinc-500 select-none">
            RAG PIPELINE STATUS
          </span>
          <div className="w-[50px]" aria-hidden />
        </div>

        {/* Inner Terminal Body */}
        <div className="p-6 md:p-8 font-mono flex flex-col gap-6">
          <div className="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
            {steps.map((stepItem, idx) => {
              const isActive = stepItem.status === 'active';
              const isDone = stepItem.status === 'done';

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-start gap-4 p-3.5 rounded-2xl transition-all border ${
                    isActive
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                      : isDone
                      ? 'bg-zinc-900/40 border-zinc-800/30'
                      : 'bg-transparent border-transparent opacity-40'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="flex items-center justify-center shrink-0 w-6 h-6 mt-0.5">
                    {isDone ? (
                      <CheckCircle2 className="text-green-500 fill-green-500/15" size={20} />
                    ) : isActive ? (
                      <Loader2 className="text-indigo-400 animate-spin" size={20} />
                    ) : (
                      <Circle className="text-zinc-600" size={18} />
                    )}
                  </div>

                  {/* Step Description */}
                  <div className="flex-1 flex flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs font-bold font-mono">
                        [{stepItem.step}/{stepItem.total}]
                      </span>
                      <span className={`text-sm font-bold tracking-wide ${
                        isActive ? 'text-indigo-300' : isDone ? 'text-zinc-200' : 'text-zinc-500'
                      }`}>
                        {stepItem.label}
                      </span>
                    </div>
                    <span className={`text-xs leading-relaxed font-mono ${
                      isActive ? 'text-zinc-300' : isDone ? 'text-zinc-400 font-medium' : 'text-zinc-600'
                    }`}>
                      {stepItem.detail}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Terminal Console Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/30 p-4 rounded-2xl text-red-400 text-xs text-left">
              <AlertTriangle className="shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <span className="font-bold">Pipeline Error:</span> {error}
              </div>
            </div>
          )}

          {/* Overall Progress and Stats */}
          <div className="mt-2 border-t border-zinc-900 pt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold select-none">
              <span className="text-zinc-500 font-bold tracking-wide">COMPILING ENGINE</span>
              <span className="text-indigo-400 font-bold font-mono">{percentage}%</span>
            </div>
            
            {/* Real Progress Bar */}
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default PipelineVisualizer;
