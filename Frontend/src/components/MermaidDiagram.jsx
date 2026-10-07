import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Layers, Copy, Check } from 'lucide-react';

let isMermaidInitialized = false;

const initMermaid = () => {
  if (isMermaidInitialized) return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      themeVariables: {
        fontSize: '13px',
        primaryColor: '#4f46e5',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#6366f1',
        lineColor: '#818cf8',
        secondaryColor: '#3b82f6',
        tertiaryColor: '#1e1b4b',
      },
    });
    isMermaidInitialized = true;
  } catch (e) {
    console.warn('Failed to initialize Mermaid:', e);
  }
};

const MermaidDiagram = ({ code }) => {
  const [svgContent, setSvgContent] = useState('');
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    initMermaid();
    let isCurrent = true;

    const renderChart = async () => {
      if (!code || !code.trim()) return;

      const cleanCode = code.trim();
      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 10)}`;

      try {
        const { svg } = await mermaid.render(uniqueId, cleanCode);
        if (isCurrent) {
          setSvgContent(svg);
          setHasError(false);
        }
      } catch (err) {
        console.warn('Mermaid rendering failed:', err);
        // Clean up temporary DOM element if created by mermaid
        const tempEl = document.getElementById(uniqueId);
        if (tempEl) tempEl.remove();

        if (isCurrent) {
          setHasError(true);
        }
      }
    };

    renderChart();
    return () => {
      isCurrent = false;
    };
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (hasError || !svgContent) {
    return (
      <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/90 shadow-md">
        <div className="px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5 font-semibold text-indigo-400">
            <Layers size={13} /> Process / Architecture Diagram
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] hover:text-white transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-3 text-xs text-slate-200 font-mono overflow-x-auto whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-3.5 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 shadow-sm backdrop-blur-sm">
      <div className="px-3.5 py-2 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800/70 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
        <span className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 tracking-wide text-[11px] uppercase">
          <Layers size={13} /> Interactive Architecture & Process Flow
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          title="Copy diagram code"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
      <div
        ref={containerRef}
        className="p-4 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:transition-all"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};

export default MermaidDiagram;
