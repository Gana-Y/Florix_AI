import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, FileText, Code2, Download } from 'lucide-react';

/**
 * ChatSnippetModal
 * 
 * Elegant modal viewer for pasted text/code snippets, preventing long text from
 * cluttering the chat view. Includes line numbers, 1-click copy, and file download.
 */
export default function ChatSnippetModal({ snippet, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !snippet) return null;

  const content = snippet.content || '';
  const lines = content.split('\n');
  const filename = snippet.name || 'snippet.txt';
  const sizeKb = ((snippet.size || new Blob([content]).size) / 1024).toFixed(1);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/90 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                {filename.endsWith('.py') || filename.endsWith('.js') || filename.endsWith('.cpp') || filename.endsWith('.java') ? (
                  <Code2 size={18} />
                ) : (
                  <FileText size={18} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
                  {filename}
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-2">
                  <span>{lines.length} lines</span>
                  <span>•</span>
                  <span>{content.length.toLocaleString()} characters</span>
                  <span>•</span>
                  <span>{sizeKb} KB</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-sm"
                title="Copy entire content"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800"
                title="Download as file"
              >
                <Download size={16} />
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content Area with Line Numbers */}
          <div className="flex-1 overflow-auto p-4 font-mono text-[13px] bg-slate-950 text-slate-100 selection:bg-indigo-600 selection:text-white">
            <div className="flex">
              {/* Line numbers gutter */}
              <div className="select-none pr-4 text-right text-slate-600 font-mono shrink-0 border-r border-slate-800">
                {lines.map((_, i) => (
                  <div key={i} className="leading-6 text-[12px] opacity-60">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code lines */}
              <pre className="pl-4 font-mono leading-6 overflow-x-auto flex-1 whitespace-pre">
                <code>{content}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
