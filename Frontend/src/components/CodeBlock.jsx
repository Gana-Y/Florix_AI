import React, { useState, useMemo } from 'react';
import { Copy, Check, Terminal, FileCode, Code2 } from 'lucide-react';
import Prism from 'prismjs';

// Import core languages
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';

// Language icon/label helper
const getLangMetadata = (lang) => {
  const normalized = (lang || '').toLowerCase().trim();
  switch (normalized) {
    case 'py':
    case 'python':
      return { label: 'Python', icon: FileCode, prismLang: 'python' };
    case 'js':
    case 'javascript':
      return { label: 'JavaScript', icon: FileCode, prismLang: 'javascript' };
    case 'ts':
    case 'typescript':
      return { label: 'TypeScript', icon: FileCode, prismLang: 'typescript' };
    case 'jsx':
      return { label: 'React JSX', icon: FileCode, prismLang: 'jsx' };
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return { label: 'Terminal', icon: Terminal, prismLang: 'bash' };
    case 'sql':
      return { label: 'SQL', icon: FileCode, prismLang: 'sql' };
    case 'json':
      return { label: 'JSON', icon: FileCode, prismLang: 'json' };
    case 'cpp':
    case 'c++':
      return { label: 'C++', icon: FileCode, prismLang: 'cpp' };
    case 'c':
      return { label: 'C', icon: FileCode, prismLang: 'c' };
    case 'java':
      return { label: 'Java', icon: FileCode, prismLang: 'java' };
    case 'html':
      return { label: 'HTML', icon: FileCode, prismLang: 'markup' };
    case 'css':
      return { label: 'CSS', icon: FileCode, prismLang: 'css' };
    default:
      return { label: normalized || 'Code', icon: Code2, prismLang: normalized || 'text' };
  }
};

const CodeBlock = ({ code = '', language = 'python', filename = '' }) => {
  const [copied, setCopied] = useState(false);
  const rawCode = String(code || '').replace(/\n$/, '');

  const meta = useMemo(() => getLangMetadata(language), [language]);
  const Icon = meta.icon;

  const highlightedHtml = useMemo(() => {
    try {
      const grammar = Prism.languages[meta.prismLang] || Prism.languages.text;
      if (grammar) {
        return Prism.highlight(rawCode, grammar, meta.prismLang);
      }
    } catch (e) {
      console.warn('Prism highlighting fallback:', e);
    }
    // Fallback: safe HTML escape
    return rawCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, [rawCode, meta.prismLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code to clipboard:', err);
    }
  };

  const lineCount = rawCode.split('\n').length;

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-zinc-800 bg-[#0d1117] shadow-xl text-left select-text group/code">
      {/* Code Header Bar (ChatGPT / Claude style) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800/80 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-indigo-400" />
          <span className="font-semibold text-zinc-200 tracking-wide">{filename || meta.label}</span>
          {lineCount > 1 && (
            <span className="text-[10px] text-zinc-500 font-mono">({lineCount} lines)</span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 transition-all active:scale-95 cursor-pointer shadow-sm"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400 animate-in zoom-in-75 duration-200" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} className="text-zinc-400 group-hover/code:text-zinc-200 transition-colors" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content Area with Vibrant Syntax Colors */}
      <div className="p-4 overflow-x-auto custom-scrollbar font-mono text-[12.5px] leading-relaxed text-[#e6edf3]">
        <pre className="!bg-transparent !p-0 !m-0 !border-0 whitespace-pre">
          <code
            className={`language-${meta.prismLang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
