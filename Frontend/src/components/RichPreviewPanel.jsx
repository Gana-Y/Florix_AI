import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Loader2, Youtube, Globe, FileText, MessageSquare,
  ExternalLink, Sparkles, Bot, User
} from 'lucide-react';
import api from '../utils/api';
import { PreferencesContext } from '../context/PreferencesContext';

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
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

// ─── Chat Panel ──────────────────────────────────────────────────────────────
const ChatPanel = ({ context, contextType, sessionId }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        contextType === 'youtube'
          ? '🎬 I\'ve loaded this video\'s context. Ask me anything — summary, key points, quiz questions, or anything about the content!'
          : contextType === 'text'
          ? '📝 I\'ve read your pasted text. Ask me to summarise, explain, quiz you, or generate flashcards!'
          : contextType === 'link'
          ? '🔗 I\'ve analysed this page. Ask me anything about its content!'
          : '💬 What would you like to know? Ask me anything!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatScrollRef = useRef(null);
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
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let res;
      if (sessionId) {
        // Document-based chat
        res = await api.post('/chat', {
          message: trimmed,
          session_id: sessionId,
        });
      } else {
        // General / text-based chat with rich preview context
        res = await api.post('/chat', {
          message: trimmed,
          context_text: context || undefined,
        });
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply || res.data.message || 'Here\'s what I found!' }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? `${userBubbleBg} text-white rounded-br-sm`
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                  <User size={14} className="text-slate-600 dark:text-zinc-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-end gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-zinc-800 flex gap-1.5 items-center">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                  className="w-2 h-2 bg-indigo-400 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
        <div className="h-2" />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap">
        {['Summarize this', 'Key points', 'Quiz me', 'Explain simply'].map((prompt) => (
          <motion.button
            key={prompt}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { setInput(prompt); }}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors font-medium"
          >
            {prompt}
          </motion.button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex gap-2 items-end bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask anything about this content…"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none min-h-[36px] max-h-[120px] py-2 px-2 custom-scrollbar"
            style={{ fieldSizing: 'content' }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
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
      <div className="rounded-2xl overflow-hidden shadow-lg bg-black aspect-video">
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

// ─── Query Preview ────────────────────────────────────────────────────────────
const QueryPreview = ({ query }) => (
  <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
    <div className="flex items-center gap-3 shrink-0">
      <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
        <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <p className="font-bold text-slate-700 dark:text-white text-sm">Direct Query</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500">Open chat to get answers</p>
      </div>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
        <MessageSquare size={28} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-800 dark:text-white leading-snug max-w-[200px]">
          "{query}"
        </p>
        <p className="text-slate-400 dark:text-zinc-500 text-sm mt-2">Chat is ready →</p>
      </div>
    </div>
  </div>
);

// ─── Main RichPreviewPanel ───────────────────────────────────────────────────
const RichPreviewPanel = ({ type, content, onClose }) => {
  // type: 'youtube' | 'link' | 'text' | 'query'
  // content: the url / text / query string

  const panelVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 26 } },
    exit: { opacity: 0, y: 20, scale: 0.96, transition: { duration: 0.2 } },
  };

  const typeLabel = {
    youtube: 'YouTube Video',
    link: 'Web Link',
    text: 'Pasted Text',
    query: 'Ask Anything',
  }[type] || 'Preview';

  const typeIcon = {
    youtube: <Youtube size={16} className="text-red-500" />,
    link: <Globe size={16} className="text-blue-500" />,
    text: <FileText size={16} className="text-green-500" />,
    query: <Sparkles size={16} className="text-indigo-500" />,
  }[type];

  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        data-lenis-prevent
        onWheel={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[90vh] max-h-[800px] bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden overscroll-contain"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {typeIcon}
            <span className="font-bold text-slate-700 dark:text-zinc-200 text-sm">{typeLabel}</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </motion.button>
        </div>

         {/* Split layout */}
         <div className="flex flex-1 min-h-0 overflow-hidden lg:flex-row">
           {/* Left — Media/Preview */}
           <div className="w-[42%] min-w-[300px] border-r border-slate-100 dark:border-zinc-800 flex flex-col min-h-0 overflow-hidden">
             {type === 'youtube' && <YouTubePreview url={content} />}
             {type === 'link' && <LinkPreview url={content} />}
             {type === 'text' && <TextPreview text={content} />}
             {type === 'query' && <QueryPreview query={content} />}
           </div>

           {/* Right — Chat */}
           <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
             <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
               <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">AI Chat</p>
             </div>
             <ChatPanel
               context={type === 'text' ? content : type === 'query' ? `User wants to ask: ${content}` : `URL: ${content}`}
               contextType={type}
               sessionId={null}
             />
           </div>
         </div>
      </div>
    </motion.div>
  );
};

export default RichPreviewPanel;
