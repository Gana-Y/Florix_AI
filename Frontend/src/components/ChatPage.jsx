import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  MessageSquare, Plus, Trash2, Search, Send, Mic, MicOff,
  Bot, Loader2, Sparkles, Zap, BookOpen, Brain,
  ChevronLeft, ChevronRight, PenLine, Check, X as XIcon, Pin, Folder,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { extractBestTranscript, combineSpokenWithBase, configureSpeechRecognition, AUDIO_CAPTURE_CONSTRAINTS } from '../utils/speechCorrection';
import { PreferencesContext } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDateGroup = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Older';
};

const groupByDate = (conversations) => {
  const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  const groups = {};
  conversations.forEach((c) => {
    const g = formatDateGroup(c.updated_at);
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });
  return order.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
};

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, text: 'Explain a complex topic simply', color: 'text-purple-500' },
  { icon: Brain,    text: 'Help me understand neural networks', color: 'text-blue-500' },
  { icon: BookOpen, text: 'Create a study plan for exams', color: 'text-green-500' },
  { icon: Zap,      text: 'What are the key concepts of RAG?', color: 'text-amber-500' },
];

import MermaidDiagram from './MermaidDiagram';
import ChatImage from './ChatImage';

// ── Memoized Message Bubble (Eliminates Markdown AST Re-parsing Jank) ───────────
const ChatMessageBubble = React.memo(({ msg }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {msg.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
          <Bot size={15} className="text-white" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[78%] rounded-3xl shadow-sm px-5 py-4 ${
        msg.role === 'user'
          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-md shadow-indigo-500/20'
          : 'bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 rounded-bl-md'
      }`}>
        <div className={`prose prose-sm dark:prose-invert max-w-none ${
          msg.role === 'user' ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-li:text-white' : ''
        }`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match && match[1] === 'mermaid') {
                  return <MermaidDiagram code={String(children).replace(/\n$/, '')} />;
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              img({ node, ...props }) {
                return <ChatImage {...props} />;
              }
            }}
          >
            {String(msg.content || '')}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.msg.id === next.msg.id &&
  prev.msg.content === next.msg.content &&
  prev.msg.role === next.msg.role
));

// ── Main Component ─────────────────────────────────────────────────────────────
const ChatPage = ({ initialConvId, activeSpaceId, onClearSpace }) => {
  const { prefs } = useContext(PreferencesContext);
  const [spaces, setSpaces] = useState([]);
  const { addToast } = useToast();
  const [moveMenuConvId, setMoveMenuConvId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [convsLoading, setConvsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [convSearch, setConvSearch] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
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

  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    fetchConversations();
    fetchSpaces();

    const handleRemoteDelete = (e) => {
      const deletedId = e.detail?.chatId;
      if (!deletedId) return;
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== deletedId);
        if (activeConvIdRef.current === deletedId) {
          if (remaining.length > 0) {
            setActiveConvId(remaining[0].id);
          } else {
            setActiveConvId(null);
            setMessages([]);
          }
        }
        return remaining;
      });
    };

    const handleRemoteUpdate = () => {
      fetchConversations();
    };

    window.addEventListener('florix:conversation-deleted', handleRemoteDelete);
    window.addEventListener('florix:conversation-updated', handleRemoteUpdate);
    return () => {
      window.removeEventListener('florix:conversation-deleted', handleRemoteDelete);
      window.removeEventListener('florix:conversation-updated', handleRemoteUpdate);
    };
  }, []);

  useEffect(() => {
    if (initialConvId) {
      setActiveConvId(initialConvId);
    }
  }, [initialConvId]);

  const fetchSpaces = async () => {
    try {
      const res = await api.get('/projects');
      setSpaces(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeConvId) fetchMessages(activeConvId);
    else setMessages([]);
  }, [activeConvId]);

  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // ── API calls ───────────────────────────────────────────────────────────────
  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      const data = res.data || [];
      setConversations(data);
      const currentActive = activeConvIdRef.current;
      if (initialConvId && data.some(c => c.id === initialConvId)) {
        setActiveConvId(initialConvId);
      } else if (currentActive && data.some(c => c.id === currentActive)) {
        // Current active chat still exists, retain it
      } else if (data.length > 0) {
        setActiveConvId(data[0].id);
      } else {
        // All chats deleted or empty: reset active chat and clear message view
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setConvsLoading(false);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const res = await api.get(`/conversations/${convId}/messages`);
      setMessages(res.data);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  };

  const createNewConversation = async () => {
    try {
      const res = await api.post('/conversations', {
        title: 'New Chat',
        project_id: activeSpaceId || null
      });
      setConversations((p) => [res.data, ...p]);
      setActiveConvId(res.data.id);
      setMessages([]);
      if (window.innerWidth < 768) setShowSidebar(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: res.data.id, title: res.data.title } }));
    } catch (e) { console.error(e); }
  };

  const handleTogglePin = async (e, convId, currentPinned) => {
    e.stopPropagation();
    try {
      await api.patch(`/conversations/${convId}/pin`, { is_pinned: !currentPinned });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: !currentPinned } : c));
      window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: convId, is_pinned: !currentPinned } }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToSpace = async (convId, spaceId) => {
    try {
      await api.patch(`/conversations/${convId}/project`, { project_id: spaceId });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, project_id: spaceId } : c));
      setMoveMenuConvId(null);
      window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: convId, project_id: spaceId } }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (textToSend) => {
    const userMsg = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!userMsg || isLoading) return;

    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      setIsListening(false);
    }

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await api.post('/conversations', { title: 'New Chat', project_id: activeSpaceId || null });
        convId = res.data.id;
        setConversations((p) => [res.data, ...p]);
        setActiveConvId(convId);
        window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: convId, title: 'New Chat' } }));
      } catch { return; }
    }

    setInput('');
    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await api.post(`/conversations/${convId}/message`, {
        message: userMsg,
        response_style: prefs?.responseStyle || 'balanced',
      });
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: 'assistant', content: res.data.reply }]);
      // Update title in sidebar and header with AI-generated conceptual topic title
      if (res.data.title) {
        setConversations((p) => p.map((c) =>
          c.id === convId ? { ...c, title: res.data.title, updated_at: new Date().toISOString() } : c
        ));
        window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: convId, title: res.data.title } }));
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "I'm sorry, I encountered an error. Please try again.";
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: 'assistant', content: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this conversation? All messages will be permanently removed.')) return;
    try {
      await api.delete(`/conversations/${convId}`);
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== convId);
        if (activeConvIdRef.current === convId) {
          if (remaining.length > 0) {
            setActiveConvId(remaining[0].id);
          } else {
            setActiveConvId(null);
            setMessages([]);
          }
        }
        return remaining;
      });
      window.dispatchEvent(new CustomEvent('florix:conversation-deleted', { detail: { chatId: convId } }));
      window.dispatchEvent(new CustomEvent('florix:conversation-updated'));
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const saveTitle = async (convId) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      await api.patch(`/conversations/${convId}`, { title: editTitle.trim() });
      setConversations((p) => p.map((c) => c.id === convId ? { ...c, title: editTitle.trim() } : c));
      window.dispatchEvent(new CustomEvent('florix:conversation-updated', { detail: { chatId: convId, title: editTitle.trim() } }));
    } catch (e) {
      console.error(e);
    }
    setEditingId(null);
  };

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
      addToast('Voice input is not supported in this browser. Try Chrome or Edge.', 'warning');
      return;
    }

    // Capture base text currently in the input bar before speaking starts
    baseInputRef.current = input ? input.trim() : '';

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CAPTURE_CONSTRAINTS);
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (permErr) {
      console.warn('Microphone permission check:', permErr);
      if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
        addToast('Microphone access denied. Please allow microphone permissions in your browser URL bar.', 'error');
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      configureSpeechRecognition(rec);

      rec.onstart = () => {
        setIsListening(true);
        addToast('Microphone active. Speak now...', 'info', 2000);
      };

      rec.onresult = (e) => {
        const cleanSpoken = extractBestTranscript(e.results);
        if (cleanSpoken) {
          const combined = combineSpokenWithBase(baseInputRef.current, cleanSpoken);
          setInput(combined);
        }
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          addToast('Microphone permission denied. Please allow microphone in browser settings.', 'error');
        } else if (e.error === 'network') {
          addToast('Speech recognition network error. Check your connection.', 'error');
        } else if (e.error !== 'no-speech') {
          addToast(`Voice error: ${e.error}`, 'warning');
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Speech recognition failed to start:', err);
      setIsListening(false);
      addToast('Could not start microphone. Please check browser permissions.', 'error');
    }
  };

  // ── Filtered + grouped conversations ───────────────────────────────────────
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(convSearch.toLowerCase())
  );
  const grouped = groupByDate(filtered);
  const activeConv = conversations.find((c) => c.id === activeConvId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── Conversation Sidebar ── */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <>
            {/* Mobile Backdrop */}
            <motion.div
              key="conv-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
            />
            <motion.aside
              key="conv-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed md:relative inset-y-0 left-0 z-30 md:z-10 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 md:bg-white/80 md:dark:bg-zinc-900/80 backdrop-blur-xl shrink-0 overflow-hidden shadow-2xl md:shadow-none"
            >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={createNewConversation}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all"
              >
                <Plus size={18} /> New Conversation
              </motion.button>

              {/* Search */}
              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search chats…"
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
              {convsLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-slate-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageSquare size={32} className="text-slate-200 dark:text-zinc-700 mb-3" />
                  <p className="text-sm text-slate-400 dark:text-zinc-600">
                    {convSearch ? 'No matches found' : 'No conversations yet'}
                  </p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <p className="px-4 py-1.5 text-xs font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest">
                      {group.label}
                    </p>
                    <AnimatePresence>
                      {group.items.map((conv) => (
                        <motion.div
                          key={conv.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          onClick={() => { setActiveConvId(conv.id); if (window.innerWidth < 768) setShowSidebar(false); }}
                          className={`mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer group flex items-center gap-2 transition-all ${
                            activeConvId === conv.id
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20'
                              : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <MessageSquare size={14} className={activeConvId === conv.id ? 'text-indigo-500 shrink-0' : 'text-slate-400 dark:text-zinc-600 shrink-0'} />

                          {editingId === conv.id ? (
                            <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(conv.id); if (e.key === 'Escape') setEditingId(null); }}
                                className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-indigo-300 rounded-lg px-2 py-1 outline-none text-slate-700 dark:text-zinc-200"
                              />
                              <button onClick={() => saveTitle(conv.id)} className="text-green-500 hover:text-green-600"><Check size={12} /></button>
                              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><XIcon size={12} /></button>
                            </div>
                          ) : (
                            <>
                              <span className={`flex-1 text-xs font-medium truncate ${activeConvId === conv.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-zinc-400'}`}>
                                {conv.title}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title); }}
                                  className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                  <PenLine size={11} />
                                </button>
                                <button
                                  onClick={(e) => deleteConversation(conv.id, e)}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>

      {/* ── Chat Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Chat Header */}
        <div className="shrink-0 h-14 px-4 border-b border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md flex items-center gap-3">
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? <ChevronLeft size={18} /> : <MessageSquare size={18} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">
                  {activeConv?.title || 'Florix AI Chat'}
                </p>
                {(() => {
                  const spaceId = activeConv?.project_id || activeSpaceId;
                  const sp = spaces.find(s => s.id === spaceId);
                  if (!sp) return null;
                  return (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      <span>{sp.icon || '📁'}</span>
                      <span>{sp.name}</span>
                      {onClearSpace && (
                        <button onClick={onClearSpace} className="ml-1 text-slate-400 hover:text-slate-600" title="Clear Space context">
                          <XIcon size={10} />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Powered by Gemini 2.5 Flash</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeConvId && (
              <button
                onClick={(e) => deleteConversation(activeConvId, e)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all text-xs font-semibold"
                title="Delete this conversation"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete Chat</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-800">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} data-lenis-prevent className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5 custom-scrollbar min-h-0">

          {/* Empty state / suggested prompts */}
          {messages.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-xl shadow-indigo-500/30">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">
                How can I help you?
              </h2>
              <p className="text-slate-400 dark:text-zinc-500 mb-8 text-sm">
                Ask anything, or pick a suggestion below to get started.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(p.text)}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-left hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg transition-all group"
                  >
                    <p.icon size={18} className={`${p.color} shrink-0`} />
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                      {p.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message bubbles */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl rounded-bl-md px-5 py-4 flex gap-1.5 items-center shadow-sm">
                {[0, 0.2, 0.4].map((d, i) => (
                  <motion.div key={i} animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: d }} className="w-2 h-2 bg-indigo-500 rounded-full" />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 md:p-5 border-t border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg focus-within:ring-4 focus-within:ring-indigo-500/15 focus-within:border-indigo-500 transition-all"
            >
              <motion.button
                type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={toggleListen}
                className={`absolute left-3 p-2.5 rounded-xl transition-all z-10 ${
                  isListening
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-500 animate-pulse'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                }`}
              >
                {isListening ? <Mic size={18} /> : <MicOff size={18} />}
              </motion.button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Listening…' : 'Message Florix AI…'}
                className="flex-1 pl-14 pr-14 py-4 bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-none text-sm font-medium placeholder:text-slate-400"
              />

              <motion.button
                type="submit" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-zinc-700 dark:disabled:to-zinc-700 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all disabled:shadow-none"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </motion.button>
            </form>
            <p className="text-center text-xs text-slate-400 dark:text-zinc-600 mt-2">
              Florix AI may make mistakes. Always verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
