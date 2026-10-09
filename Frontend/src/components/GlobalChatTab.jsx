import React, { useState, useEffect, useRef, useContext, Component } from 'react';
import {
  Send, Mic, MicOff, Bot, User, Loader2, AlertCircle, Sparkles,
  Zap, BookOpen, Lightbulb, Award, FileText, Cpu, HelpCircle, ArrowRight,
  Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import api from '../utils/api';
import { preprocessLatex } from '../utils/latexHelper';
import { extractBestTranscript, combineSpokenWithBase, configureSpeechRecognition, AUDIO_CAPTURE_CONSTRAINTS } from '../utils/speechCorrection';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { PreferencesContext } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';
import MermaidDiagram from './MermaidDiagram';
import ChatImage from './ChatImage';
import CodeBlock from './CodeBlock';

class ChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.toString() };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} /> Error rendering message content.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Markdown Normalizer for Academic Tutor Output ──
const formatTutorMarkdown = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';
  
  const parts = rawText.split(/(```[\s\S]*?```)/g);
  const formatted = parts.map((part, index) => {
    if (index % 2 === 1) return part; // code block, preserve untouched
    
    // Ensure any heading that follows text or single newline has a double newline before it
    return part
      .replace(/([^#\n])[ \t]*(#{1,6}\s+[^\n]+)/g, '$1\n\n$2')
      .replace(/([^#\n])\n(#{1,6}\s+[^\n]+)/g, '$1\n\n$2');
  }).join('');
  return preprocessLatex(formatted);
};

// ── Custom Academic Components for ReactMarkdown ──
/* eslint-disable no-unused-vars */
const tutorMarkdownComponents = {
  h1: ({ node, ...props }) => (
    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-6 mb-3 pb-1 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-1.5" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h4 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 mt-5 mb-2.5 flex items-center gap-1.5" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h5 className="text-base md:text-lg font-semibold text-slate-900 dark:text-zinc-100 mt-4 mb-2" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="text-[15px] md:text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200 mb-3.5 last:mb-0" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="space-y-2 my-3 pl-6 list-disc text-[15px] md:text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200 marker:text-slate-400 dark:marker:text-zinc-500" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="space-y-2 my-3 pl-6 list-decimal text-[15px] md:text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200 marker:text-slate-500 dark:marker:text-zinc-400 marker:font-medium" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="leading-[1.75] pl-0.5" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-slate-900 dark:text-zinc-100" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-3 bg-indigo-50/40 dark:bg-zinc-800/40 rounded-r-lg text-[14.5px] md:text-[15px] italic text-slate-700 dark:text-zinc-300" {...props} />
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match && match[1] === 'mermaid') {
      return <MermaidDiagram code={String(children).replace(/\n$/, '')} />;
    }
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-[13.5px] font-mono border border-slate-200/60 dark:border-zinc-700/60 font-medium" {...props}>
          {children}
        </code>
      );
    }
    const lang = match ? match[1] : 'text';
    return (
      <CodeBlock
        code={String(children)}
        language={lang}
      />
    );
  },
  img: ({ node, ...props }) => (
    <ChatImage {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <table className="w-full text-[14px] text-left border-collapse" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-800 dark:text-zinc-200 border-b border-slate-200 dark:border-zinc-700 text-xs uppercase tracking-wider" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-3.5 py-2.5 border-b border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300" {...props} />
  ),
};
/* eslint-enable no-unused-vars */

// ── Copy Button ──
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      title={copied ? "Copied to clipboard" : "Copy answer"}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 bg-slate-100/70 hover:bg-slate-200/80 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
    >
      {copied ? (
        <>
          <Check size={12} className="text-emerald-500" />
          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

// ── Interactive Grounded Citation Pill ──
const CitationPill = ({ citation, index }) => {
  const [isOpen, setIsOpen] = useState(false);
  const page = citation.page_number;
  const timeStr = citation.media_timestamp_str;
  const heading = citation.section_heading;
  const snippet = citation.snippet;

  return (
    <div className="relative inline-block text-[11px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
          isOpen
            ? 'bg-indigo-100/80 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 shadow-sm'
            : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
        }`}
      >
        <FileText size={11} className="text-indigo-500 shrink-0" />
        <span>
          Source [{citation.source_index || index}]
          {timeStr ? ` · ⏱ ${timeStr}` : (page ? ` · p. ${page}` : '')}
        </span>
        {isOpen ? <ChevronUp size={10} className="text-indigo-500" /> : <ChevronDown size={10} className="text-slate-400" />}
      </button>

      {isOpen && snippet && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute bottom-full left-0 mb-1.5 z-30 w-72 md:w-80 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/70 shadow-xl text-left"
        >
          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100 dark:border-zinc-800">
            <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[200px]">
              {heading || citation.document_title || `Source ${citation.source_index || index}`}
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
              {timeStr ? `Timestamp [${timeStr}]` : (page ? `Page ${page}` : '')}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 italic leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
            "{snippet}"
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ── Memoized Message Item (User Bubble vs Academic Tutor Card) ──
const GlobalChatMessageBubble = React.memo(({ msg }) => {
  if (msg.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex justify-end w-full"
      >
        <div className="max-w-[85%] px-5 py-3 rounded-2xl rounded-tr-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[15px] sm:text-[15.5px] font-medium shadow-sm shadow-indigo-500/20 leading-[1.65] break-words">
          {msg.text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="w-full"
    >
      <div className="w-full rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 p-4 md:p-5 shadow-sm shadow-slate-200/30 dark:shadow-none space-y-3">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/30 shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">Florix AI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200/40 dark:border-indigo-800/40">
                {msg.teachingMode ? `${msg.teachingMode.charAt(0).toUpperCase() + msg.teachingMode.slice(1)} Tutor` : 'Academic Tutor'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {msg.isGrounded && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                <Check size={10} className="stroke-[3]" /> Grounded
              </span>
            )}
            <CopyButton text={msg.text} />
          </div>
        </div>

        {/* Formatted Content */}
        <div className="text-slate-800 dark:text-zinc-200">
          <ChatErrorBoundary>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={tutorMarkdownComponents}
            >
              {formatTutorMarkdown(String(msg.text || ""))}
            </ReactMarkdown>
          </ChatErrorBoundary>
        </div>

        {/* Grounded Sources & Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-2">
              <BookOpen size={12} className="text-indigo-500 shrink-0" />
              <span>Verified Sources ({msg.citations.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.citations.map((citation, cIdx) => (
                <CitationPill key={cIdx} citation={citation} index={cIdx + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) => (
  (prev.msg.id ? prev.msg.id === next.msg.id : true) &&
  prev.msg.text === next.msg.text &&
  prev.msg.role === next.msg.role &&
  (prev.msg.citations?.length === next.msg.citations?.length)
));

const GlobalChatTab = ({ sessionId, documentTitle, externalPrompt, onPromptHandled }) => {
  const { addToast } = useToast();
  const { prefs } = useContext(PreferencesContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length <= 1) {
        const titleToUse = documentTitle && documentTitle !== 'Document' ? documentTitle : null;
        return [
          {
            role: 'bot',
            text: titleToUse
              ? `Hi! I'm ready to answer questions about **${titleToUse}**.`
              : "Hello! I am Florix AI, your personal study assistant. What would you like to learn today?"
          }
        ];
      }
      return prev;
    });
  }, [documentTitle]);

  const scrollToBottom = (smooth = true) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const recognitionRef = useRef(null);
  const baseInputRef = useRef('');

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  const toggleListen = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { console.warn(e); }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('Voice input is not supported in this browser. Please use Chrome or Edge.', 'warning');
      return;
    }

    // Capture base text currently in the input bar before speaking starts
    baseInputRef.current = input ? input.trim() : '';

    // Explicitly prompt or verify microphone access permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CAPTURE_CONSTRAINTS);
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (permErr) {
      console.warn('Microphone permission check:', permErr);
      if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
        addToast('Microphone access denied. Please click the lock icon in your browser URL bar and allow microphone.', 'error');
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      configureSpeechRecognition(recognition);

      recognition.onstart = () => {
        setIsListening(true);
        addToast('Microphone active. Speak now...', 'info', 2000);
      };

      recognition.onresult = (event) => {
        const cleanSpoken = extractBestTranscript(event.results);
        if (cleanSpoken) {
          const combined = combineSpokenWithBase(baseInputRef.current, cleanSpoken);
          setInput(combined);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          addToast('Microphone permission was denied. Please allow microphone in browser site settings.', 'error');
        } else if (event.error === 'network') {
          addToast('Speech recognition network error. Please check your internet connection.', 'error');
        } else if (event.error !== 'no-speech') {
          addToast(`Speech error: ${event.error}`, 'warning');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      addToast('Could not start microphone. Please check browser permissions.', 'error');
    }
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || isLoading) return;

    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      setIsListening(false);
    }

    const userMessage = textToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const payload = {
        message: userMessage,
        response_style: prefs?.responseStyle || 'balanced',
        history: messages.slice(-10).map((m) => ({
          role: m.role === 'bot' ? 'assistant' : m.role,
          content: m.text || ''
        })),
      };
      if (sessionId) payload.session_id = sessionId;
      const response = await api.post('/chat', payload);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          role: 'bot',
          text: response.data.reply || "No reply",
          citations: response.data.citations || [],
          isGrounded: response.data.is_grounded,
          sourcesUsed: response.data.sources_used,
          intent: response.data.intent,
          teachingMode: response.data.teaching_mode
        }
      ]);
    } catch (error) {
      const errDetail = error.response?.data?.detail || error.message || "Error connecting to neural network";
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          role: 'bot',
          text: `⚠️ I encountered an error connecting to my neural network: ${errDetail}. Please try again.`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle external prompts triggered by floating toolbar or other UI triggers ──
  useEffect(() => {
    if (externalPrompt && typeof externalPrompt === 'string' && externalPrompt.trim() && !isLoading) {
      const promptText = externalPrompt.trim();
      handleSend(promptText);
      if (onPromptHandled) {
        onPromptHandled();
      }
    }
  }, [externalPrompt, isLoading]);

  const quickStudyTools = [
    {
      icon: Lightbulb,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      title: 'Explain Simply',
      description: 'Break down complex concepts with an intuitive analogy.',
      prompt: 'Explain the core concepts of this material in simple terms with an intuitive real-world analogy.'
    },
    {
      icon: Award,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      title: 'Quiz My Understanding',
      description: '3 high-yield questions to test active recall.',
      prompt: 'Quiz me with 3 challenging multiple-choice questions based on this document to test my understanding.'
    },
    {
      icon: FileText,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      title: 'Key Takeaways & Formulas',
      description: 'Core findings, definitions, and takeaways.',
      prompt: 'Extract the top 5 core takeaways and key definitions from this document in a bulleted list.'
    },
    {
      icon: Cpu,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      title: 'Architecture Breakdown',
      description: 'Step-by-step workflow of systems or concepts.',
      prompt: 'Break down the architecture, workflow, or sequence of steps presented in this text.'
    },
    {
      icon: HelpCircle,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      title: 'Critique & Limitations',
      description: 'Unpack weaknesses, trade-offs, and open issues.',
      prompt: 'What are the main limitations, trade-offs, or open challenges associated with the methods described?'
    },
    {
      icon: Zap,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
      title: 'Exam Cheat Sheet',
      description: 'High-density revision summary for exams.',
      prompt: 'Create a high-density exam revision cheat sheet covering the crucial topics of this document.'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full flex flex-col bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5 dark:shadow-none border-0 overflow-hidden relative min-h-0"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-50/50 via-white/0 to-white/0 dark:from-indigo-900/10 dark:via-zinc-950/0 dark:to-zinc-950/0 pointer-events-none -z-10" />

      {/* Messages Area */}
      <div ref={chatScrollRef} data-lenis-prevent className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 custom-scrollbar relative min-h-0">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <GlobalChatMessageBubble key={msg.id || idx} msg={msg} />
          ))}
        </AnimatePresence>

        {/* Rich Quick Study Tools & Prompts (Eliminates Blank Space) */}
        {messages.length === 1 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3.5 my-3"
          >
            {/* Knowledge base status pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles size={13} className="text-indigo-500 animate-pulse shrink-0" />
              <span className="truncate">Knowledge Base: {documentTitle && documentTitle !== 'Document' ? documentTitle : 'Active Study Material'}</span>
            </div>

            {/* Quick study tools grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickStudyTools.map((tool, i) => {
                const IconComp = tool.icon;
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSend(tool.prompt)}
                    className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800/80 hover:border-indigo-400 dark:hover:border-indigo-600/60 shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between gap-2 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${tool.color}`}>
                        <IconComp size={14} />
                      </div>
                      <ArrowRight size={12} className="text-slate-300 dark:text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {tool.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-0.5">
                        {tool.description}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl bg-white dark:bg-zinc-900/90 border border-indigo-100 dark:border-indigo-900/40 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0 animate-pulse">
                <Sparkles size={14} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Florix AI is analyzing your study material...
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div className="h-2" />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-zinc-800/60 shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center">
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={toggleListen}
            className={`absolute left-2 p-1.5 rounded-full transition-all z-10 ${isListening ? 'bg-red-100 dark:bg-red-900/40 text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
          >
            {isListening ? <Mic size={16} /> : <MicOff size={16} />}
          </motion.button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? "Listening..." : isLoading ? "Florix AI is synthesizing..." : "Ask your academic tutor a question..."}
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 dark:text-zinc-200 text-xs md:text-sm transition-all font-medium placeholder:text-slate-400"
          />

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-zinc-700 dark:disabled:to-zinc-700 text-white rounded-lg shadow-sm transition-all disabled:shadow-none flex items-center justify-center z-10 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </motion.button>
        </form>
        <p className="text-center text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 font-medium">
          Florix AI academic tutor · Grounded answers with source citations
        </p>
      </div>
    </motion.div>
  );
};

export default GlobalChatTab;