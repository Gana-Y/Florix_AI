import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { preprocessLatex } from '../utils/latexHelper';
import {
  X, Send, Loader2, Youtube, Globe, FileText,
  ExternalLink, Sparkles, Bot, User, BookOpen
} from 'lucide-react';
import api from '../utils/api';
import { PreferencesContext } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
const isYouTube = (url) =>
  /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/.test(url);

const extractVideoId = (url) => {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url?.match(p);
    if (m) return m[1];
  }
  return null;
};

// ─── Chat Panel ──────────────────────────────────────────────────────────────
const ChatPanel = ({ context, contextType, sessionId, initialQuery }) => {
  const [messages, setMessages] = useState(() => {
    if (contextType === 'query' && initialQuery) {
      return [
        { role: 'user', content: initialQuery }
      ];
    }
    return [
      {
        role: 'assistant',
        content:
          contextType === 'youtube'
            ? "🎬 I've loaded this video's context. Ask me anything — summary, key points, quiz questions, or anything about the content!"
            : contextType === 'text'
            ? "📝 I've read your pasted text. Ask me to summarise, explain, quiz you, or generate flashcards!"
            : contextType === 'link'
            ? "🔗 I've analysed this page. Ask me anything about its content!"
            : "💬 What would you like to know? Ask me anything!",
      },
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(contextType === 'query' && Boolean(initialQuery));
  const chatScrollRef = useRef(null);
  const queryExecutedRef = useRef(false);
  const { prefs } = useContext(PreferencesContext);

  const BUBBLE_COLOR_MAP = {
    indigo:  'bg-indigo-600',
    purple:  'bg-purple-600',
    emerald: 'bg-emerald-600',
    rose:    'bg-rose-600',
    amber:   'bg-amber-500',
  };
  const userBubbleBg = BUBBLE_COLOR_MAP[prefs.bubbleColor] || 'bg-indigo-600';

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, loading]);

  // Execute initial direct query on mount
  useEffect(() => {
    if (contextType === 'query' && initialQuery && !queryExecutedRef.current) {
      queryExecutedRef.current = true;
      setLoading(true);
      api.post('/chat', {
        message: initialQuery,
        context_text: `User asks: "${initialQuery}". Answer directly, comprehensively, and educationally. Structure with clear Markdown headings, bullet points, and high-yield insights.`,
      })
      .then((res) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.data.reply || res.data.message || 'Here is what I found for you!' }
        ]);
      })
      .catch((err) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ Could not complete request: ${err.response?.data?.detail || err.message || 'Network error'}. Please try asking below.` }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
    }
  }, [contextType, initialQuery]);

  const handleSend = async (customText) => {
    const textToSend = (customText !== undefined ? customText : input).trim();
    if (!textToSend || loading) return;

    const userMsg = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res;
      if (sessionId) {
        // Document-based chat
        res = await api.post('/chat', {
          message: textToSend,
          session_id: sessionId,
        });
      } else {
        // General / text-based chat with rich preview context
        res = await api.post('/chat', {
          message: textToSend,
          context_text: context || undefined,
        });
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply || res.data.message || 'Here is what I found!' }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Something went wrong. Please try asking again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      {/* Messages */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-5 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-500/20">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? `${userBubbleBg} text-white rounded-tr-sm whitespace-pre-wrap`
                    : 'bg-slate-100/90 dark:bg-zinc-800/90 text-slate-800 dark:text-zinc-100 rounded-tl-sm border border-slate-200/60 dark:border-zinc-700/60'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-base dark:prose-invert max-w-none text-[15px] sm:text-[15.5px] text-slate-800 dark:text-zinc-200 leading-[1.75] break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {preprocessLatex(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-slate-600 dark:text-zinc-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-500/20">
              <Bot size={16} className="text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-100/90 dark:bg-zinc-800/90 border border-slate-200/60 dark:border-zinc-700/60 flex items-center gap-2">
              <div className="flex gap-1.5 items-center">
                {[0, 0.2, 0.4].map((d, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                    className="w-2 h-2 bg-indigo-500 rounded-full"
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium ml-1">
                Florix AI is synthesizing response…
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-4 sm:px-6 pb-2 flex gap-2 flex-wrap">
        {[
          'Tell me more',
          'Key points & summary',
          'Quiz me on this',
          'Explain in simple terms'
        ].map((prompt) => (
          <motion.button
            key={prompt}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors font-medium disabled:opacity-50"
          >
            {prompt}
          </motion.button>
        ))}
      </div>

      {/* Input bar */}
      <div className="px-4 sm:px-6 pb-4 pt-1">
        <div className="flex gap-2 items-end bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={contextType === 'query' ? "Ask a follow-up question…" : "Ask anything about this content…"}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none min-h-[38px] max-h-[120px] py-2 px-2 custom-scrollbar"
            style={{ fieldSizing: 'content' }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm shadow-indigo-500/20"
            aria-label="Send message"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

// ─── YouTube Preview ─────────────────────────────────────────────────────────
const YouTubePreview = ({ url }) => {
  const videoId = extractVideoId(url);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!videoId) return;
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then((r) => r.json())
      .then((d) => setMeta(d))
      .catch(() => {});
  }, [videoId]);

  if (!videoId) return <div className="text-red-400 p-4">Could not parse video ID.</div>;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto custom-scrollbar">
      <div className="rounded-2xl overflow-hidden shadow-lg bg-black aspect-video shrink-0">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={meta?.title || 'YouTube Video'}
        />
      </div>
      {meta && (
        <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Youtube size={14} /> YouTube
          </p>
          <h3 className="font-bold text-slate-800 dark:text-white text-base line-clamp-2 leading-snug">
            {meta.title}
          </h3>
          {meta.author_name && (
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">by {meta.author_name}</p>
          )}
        </div>
      )}
      <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
        <ExternalLink size={12} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 truncate">{url}</a>
      </div>
    </div>
  );
};

// ─── Link Preview ─────────────────────────────────────────────────────────────
const LinkPreview = ({ url }) => {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto custom-scrollbar">
      <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-700 rounded-2xl p-6 flex flex-col items-center text-center gap-3 border border-slate-200 dark:border-zinc-700 min-h-[180px] justify-center">
        <img src={faviconUrl} alt={hostname} className="w-12 h-12 rounded-xl" onError={e => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <p className="font-bold text-slate-700 dark:text-zinc-200 text-lg">{hostname}</p>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">Web Page</p>
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700">
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
          <Globe size={14} /> Website
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 break-all">{url}</p>
      </div>
      <div className="flex">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5 font-medium"
        >
          <ExternalLink size={14} /> Open page
        </a>
      </div>
    </div>
  );
};

// ─── Text Preview ─────────────────────────────────────────────────────────────
const TextPreview = ({ text }) => {
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
          <FileText size={20} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-bold text-slate-700 dark:text-white text-sm">Pasted Text</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">{wordCount} words · {charCount} chars</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4">
        <pre className="text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">{text}</pre>
      </div>
    </div>
  );
};

// ─── Main RichPreviewPanel ───────────────────────────────────────────────────
const RichPreviewPanel = ({ type, content, onClose, onStartStudy, activeSpaceId }) => {
  const [isConverting, setIsConverting] = useState(false);
  const { addToast } = useToast();

  const handleCreateStudySession = async () => {
    if (isConverting) return;
    setIsConverting(true);
    try {
      let res;
      if (type === 'query') {
        res = await api.post('/process-topic', { topic: content, project_id: activeSpaceId || null });
      } else if (type === 'text') {
        res = await api.post('/process-text', { text: content, project_id: activeSpaceId || null });
      } else {
        res = await api.post('/process-link', { url: content, project_id: activeSpaceId || null });
      }

      addToast(`Initiated study session for "${(type === 'query' ? content : res.data.filename).slice(0, 32)}" 📚`, 'success');
      onClose();
      if (onStartStudy) {
        onStartStudy(res.data);
      }
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to create study session', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const panelVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } },
    exit: { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16 } },
  };

  const typeLabel = {
    youtube: 'YouTube Video',
    link: 'Web Article',
    text: 'Pasted Material',
    query: 'Direct AI Answer',
  }[type] || 'Preview';

  const typeIcon = {
    youtube: <Youtube size={17} className="text-red-500" />,
    link: <Globe size={17} className="text-blue-500" />,
    text: <FileText size={17} className="text-green-500" />,
    query: <Sparkles size={17} className="text-indigo-500" />,
  }[type];

  // Render directly on document.body using React Portal for bulletproof viewport alignment
  return createPortal(
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        data-lenis-prevent
        onWheel={(e) => e.stopPropagation()}
        className={`w-full ${type === 'query' ? 'max-w-4xl' : 'max-w-5xl lg:max-w-6xl'} h-[88vh] max-h-[850px] bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-zinc-800/90 flex flex-col overflow-hidden overscroll-contain`}
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
              {typeIcon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{typeLabel}</span>
                {type === 'query' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 truncate max-w-[220px] sm:max-w-[340px]">
                    "{content}"
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">
                {type === 'query' ? 'Direct AI Tutor Discussion & Interactive Answers' : 'Interactive Context & AI Discussion'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onStartStudy && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateStudySession}
                disabled={isConverting}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-60 transition-all cursor-pointer"
                title="Convert into full Study Session with flashcards, quiz and concept map"
              >
                {isConverting ? (
                  <><Loader2 size={14} className="animate-spin" /> Synthesizing Session…</>
                ) : (
                  <><BookOpen size={14} /> Turn into Study Session</>
                )}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.08, rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        {/* Content Body */}
        {type === 'query' ? (
          /* Direct Query: Beautiful, Focused, Full-Width Workspace */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/50 dark:bg-zinc-900/30">
            <ChatPanel
              context={`User inquiry: "${content}"`}
              contextType={type}
              sessionId={null}
              initialQuery={content}
            />
          </div>
        ) : (
          /* Split layout for media, links, pasted text */
          <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
            {/* Left — Media/Preview */}
            <div className="lg:w-[45%] border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-zinc-800 flex flex-col min-h-0 overflow-hidden bg-slate-50/40 dark:bg-zinc-900/20">
              {type === 'youtube' && <YouTubePreview url={content} />}
              {type === 'link' && <LinkPreview url={content} />}
              {type === 'text' && <TextPreview text={content} />}
            </div>

            {/* Right — Chat */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-zinc-950">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
                <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  AI Tutor Discussion
                </p>
              </div>
              <ChatPanel
                context={type === 'text' ? content : `URL: ${content}`}
                contextType={type}
                sessionId={null}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
};

export default RichPreviewPanel;
