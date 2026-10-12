import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Layers, Copy, Check, Maximize2, Download, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

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

/**
 * Pre-sanitizes common LLM Mermaid syntax hiccups before passing to engine
 */
const sanitizeMermaidSyntax = (raw) => {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip wrapping markdown if present inside code block
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Ensure default diagram type if raw string doesn't start with known diagram declaration
  const validHeaders = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|quadrantChart|requirementDiagram|c4Context)/i;
  if (!validHeaders.test(cleaned)) {
    cleaned = `flowchart TD\n${cleaned}`;
  }

  return cleaned;
};

const MermaidDiagram = ({ code }) => {
  const [svgContent, setSvgContent] = useState('');
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    initMermaid();
    let isCurrent = true;

    const renderChart = async () => {
      if (!code || !code.trim()) return;

      const cleanCode = sanitizeMermaidSyntax(code);
      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 10)}`;

      try {
        const { svg } = await mermaid.render(uniqueId, cleanCode);
        if (isCurrent) {
          setSvgContent(svg);
          setHasError(false);
        }
      } catch (err) {
        console.warn('Mermaid rendering failed with primary syntax; trying fallback:', err);
        const tempEl = document.getElementById(uniqueId);
        if (tempEl) tempEl.remove();

        // Attempt fallback by wrapping lines in a safe flowchart TD
        try {
          const fallbackCode = `flowchart TD\n${cleanCode.replace(/^(graph|flowchart)\s+[A-Z]{2}\s*/i, '')}`;
          const fallbackId = `mermaid-fb-${Math.random().toString(36).substring(2, 10)}`;
          const { svg: fbSvg } = await mermaid.render(fallbackId, fallbackCode);
          if (isCurrent) {
            setSvgContent(fbSvg);
            setHasError(false);
          }
        } catch {
          if (isCurrent) {
            setHasError(true);
          }
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

  const handleDownloadSVG = () => {
    if (!svgContent) return;
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `architecture_diagram_${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export SVG:', e);
    }
  };

  const handleDownloadPNG = () => {
    if (!svgContent) return;
    try {
      const img = new Image();
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1200, img.naturalWidth * 2 || 1200);
        canvas.height = Math.max(800, img.naturalHeight * 2 || 800);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `architecture_diagram_${Date.now()}.png`;
        a.click();
      };
      img.src = url;
    } catch (e) {
      console.error('Failed to export PNG:', e);
    }
  };

  if (hasError || !svgContent) {
    return (
      <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/90 shadow-md">
        <div className="px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5 font-semibold text-indigo-400">
            <Layers size={13} /> Architecture / Structural Flow
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
    <>
      <div className="my-3.5 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 shadow-sm backdrop-blur-sm">
        {/* Top Diagram Toolbar */}
        <div className="px-3.5 py-2 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800/70 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 tracking-wide text-[11px] uppercase">
            <Layers size={13} /> Architecture & System Flow
          </span>
          <div className="flex items-center gap-2">
            {/* Download PNG */}
            <button
              onClick={handleDownloadPNG}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              title="Download High-Res PNG"
            >
              <Download size={12} />
              <span className="hidden sm:inline">PNG</span>
            </button>
            {/* Download SVG */}
            <button
              onClick={handleDownloadSVG}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              title="Download Vector SVG"
            >
              <Download size={12} />
              <span className="hidden sm:inline">SVG</span>
            </button>
            {/* Copy Code */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              title="Copy diagram code"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            {/* Expand Fullscreen */}
            <button
              onClick={() => {
                setModalZoom(1);
                setIsFullscreen(true);
              }}
              className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold transition-colors ml-1"
              title="Inspect Fullscreen"
            >
              <Maximize2 size={12} />
              <span>Expand</span>
            </button>
          </div>
        </div>

        {/* Inline Diagram View */}
        <div
          ref={containerRef}
          className="p-5 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:transition-all bg-radial-pattern dark:bg-radial-pattern-dark"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Fullscreen Interactive Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fadeIn">
          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Interactive Architecture Inspector
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalZoom((z) => Math.min(3.0, z * 1.2))}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => setModalZoom((z) => Math.max(0.4, z / 1.2))}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  onClick={() => setModalZoom(1)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  title="Reset Zoom"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={handleDownloadPNG}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  title="Close Inspector"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Canvas View with Zoom */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-slate-100/50 dark:bg-zinc-900/50 select-none">
              <div
                style={{ transform: `scale(${modalZoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}
                className="[&_svg]:max-w-none [&_svg]:h-auto flex justify-center items-center shadow-lg rounded-2xl bg-white dark:bg-zinc-950 p-6 border border-slate-200 dark:border-zinc-800"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MermaidDiagram;
