import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  MessageSquare, Plus, Trash2, Search, Send, Mic, MicOff,
  Bot, Loader2, Sparkles, Zap, BookOpen, Brain,
  ChevronLeft, ChevronRight, PenLine, Check, X as XIcon, Pin, Folder,
  Volume2, VolumeX, Copy, Paperclip, FileText, Code2, Headphones, Video, Eye, Download, UploadCloud
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { preprocessLatex } from '../utils/latexHelper';
import { extractBestTranscript, combineSpokenWithBase, configureSpeechRecognition, AUDIO_CAPTURE_CONSTRAINTS } from '../utils/speechCorrection';
import { PreferencesContext, BUBBLE_COLOR_MAP } from '../context/PreferencesContext';
import { speakText, stopSpeaking, LANGUAGE_LOCALE_MAP } from '../utils/tts';
import { useToast } from '../context/ToastContext';
import CodeBlock from './CodeBlock';
import ChatSnippetModal from './ChatSnippetModal';
import ChatAttachmentDock from './ChatAttachmentDock';

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
import InteractiveBotAvatar from './InteractiveBotAvatar';

// ── Memoized Message Bubble (Eliminates Markdown AST Re-parsing Jank) ───────────
const ChatMessageBubble = React.memo(({ msg, isSpeaking, onToggleSpeak, onPreviewSnippet, onPreviewImage }) => {
  const { prefs } = useContext(PreferencesContext);
  const bubbleTheme = BUBBLE_COLOR_MAP[prefs?.bubbleColor] || BUBBLE_COLOR_MAP.default;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {msg.role === 'assistant' && (
        <InteractiveBotAvatar size={32} />
      )}

      <div className={`max-w-[85%] md:max-w-[78%] rounded-3xl shadow-sm px-5 py-4 ${
        msg.role === 'user'
          ? `bg-gradient-to-br ${bubbleTheme.bg} text-white rounded-br-md ${bubbleTheme.shadow} text-[15px] sm:text-[15.5px] leading-[1.65]`
          : 'bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 rounded-bl-md text-[15px] sm:text-[15.5px] leading-[1.75]'
      }`}>
        {/* ── Render Attached Files / Text Snippets / Media (Claude & ChatGPT Style) ── */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {msg.attachments.map((att, idx) => {
              const isImage = att.type === 'image' || (att.mime_type && att.mime_type.startsWith('image/'));
              const isTextSnippet = att.type === 'text' || att.type === 'snippet' || Boolean(att.content);
              const isAudio = att.type === 'audio' || (att.mime_type && att.mime_type.startsWith('audio/'));
              const isVideo = att.type === 'video' || (att.mime_type && att.mime_type.startsWith('video/'));

              if (isTextSnippet) {
                return (
                  <div
                    key={att.id || idx}
                    onClick={() => onPreviewSnippet?.(att)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      msg.role === 'user'
                        ? 'bg-white/15 border-white/25 hover:bg-white/25 text-white'
                        : 'bg-slate-50 dark:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${
                      msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {att.name?.endsWith('.py') || att.name?.endsWith('.js') || att.name?.endsWith('.cpp') ? (
                        <Code2 size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{att.name || 'Pasted text'}</p>
                      <p className={`text-[11px] truncate ${msg.role === 'user' ? 'text-white/80' : 'text-slate-400 dark:text-zinc-500'}`}>
                        {att.lines ? `${att.lines} lines • ` : ''}
                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Text file'}
                        {' • Click to view'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(att.content || '');
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        msg.role === 'user' ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400'
                      }`}
                      title="Copy snippet"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                );
              }

              if (isImage) {
                return (
                  <div
                    key={att.id || idx}
                    className="rounded-xl overflow-hidden my-2 max-w-sm border border-black/10 dark:border-white/10 shadow-sm cursor-pointer"
                    onClick={() => onPreviewImage?.(att.data_url || att.url)}
                  >
                    <img
                      src={att.data_url || att.url}
                      alt={att.name || 'Image'}
                      className="w-full max-h-64 object-contain bg-black/5 dark:bg-black/40 rounded-xl"
                    />
                  </div>
                );
              }

              if (isAudio) {
                return (
                  <div key={att.id || idx} className={`p-2.5 rounded-xl border my-2 ${
                    msg.role === 'user' ? 'bg-white/15 border-white/25 text-white' : 'bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5 text-xs font-medium truncate">
                      <Headphones size={14} />
                      <span>{att.name || 'Audio clip'}</span>
                    </div>
                    <audio controls src={att.url || att.data_url} className="w-full h-8" />
                  </div>
                );
              }

              if (isVideo) {
                return (
                  <div key={att.id || idx} className="rounded-xl overflow-hidden my-2 border border-black/10 dark:border-white/10 shadow-sm">
                    <video controls src={att.url} className="w-full max-h-64 rounded-xl" />
                  </div>
                );
              }

              return (
                <div key={att.id || idx} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
                  msg.role === 'user' ? 'bg-white/15 border-white/25 text-white' : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                }`}>
                  <Paperclip size={14} />
                  <span className="truncate">{att.name || 'Attachment'}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="w-full">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p({ node, ...props }) {
                return (
                  <p
                    className={`mb-3.5 last:mb-0 leading-[1.75] ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-800 dark:text-zinc-200'
                    }`}
                    {...props}
                  />
                );
              },
              ul({ node, ...props }) {
                return (
                  <ul
                    className={`my-3 pl-6 space-y-2 list-disc leading-[1.75] ${
                      msg.role === 'user'
                        ? 'text-white marker:text-white/80'
                        : 'text-slate-800 dark:text-zinc-200 marker:text-slate-400 dark:marker:text-zinc-500'
                    }`}
                    {...props}
                  />
                );
              },
              ol({ node, ...props }) {
                return (
                  <ol
                    className={`my-3 pl-6 space-y-2 list-decimal leading-[1.75] ${
                      msg.role === 'user'
                        ? 'text-white marker:text-white/80'
                        : 'text-slate-800 dark:text-zinc-200 marker:text-slate-500 dark:marker:text-zinc-400 marker:font-medium'
                    }`}
                    {...props}
                  />
                );
              },
              li({ node, ...props }) {
                return <li className="leading-[1.75] pl-0.5" {...props} />;
              },
              strong({ node, ...props }) {
                return (
                  <strong
                    className={`font-semibold ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-900 dark:text-zinc-100'
                    }`}
                    {...props}
                  />
                );
              },
              h1({ node, ...props }) {
                return (
                  <h1
                    className={`text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-3 pb-1 border-b ${
                      msg.role === 'user'
                        ? 'text-white border-white/20'
                        : 'text-slate-900 dark:text-zinc-100 border-slate-200/60 dark:border-zinc-800'
                    }`}
                    {...props}
                  />
                );
              },
              h2({ node, ...props }) {
                return (
                  <h2
                    className={`text-lg sm:text-xl font-bold tracking-tight mt-5 mb-2.5 ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-900 dark:text-zinc-100'
                    }`}
                    {...props}
                  />
                );
              },
              h3({ node, ...props }) {
                return (
                  <h3
                    className={`text-base sm:text-lg font-semibold mt-4 mb-2 ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-900 dark:text-zinc-100'
                    }`}
                    {...props}
                  />
                );
              },
              blockquote({ node, ...props }) {
                return (
                  <blockquote
                    className={`border-l-4 pl-4 py-2 my-3 rounded-r-lg italic text-[14.5px] sm:text-[15px] ${
                      msg.role === 'user'
                        ? 'border-white/70 bg-white/10 text-white'
                        : 'border-indigo-500 bg-indigo-50/40 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                    }`}
                    {...props}
                  />
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match && match[1] === 'mermaid') {
                  return <MermaidDiagram code={String(children).replace(/\n$/, '')} />;
                }
                if (inline) {
                  return (
                    <code
                      className={`px-1.5 py-0.5 rounded-md text-[13.5px] font-mono border font-medium ${
                        msg.role === 'user'
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-200/60 dark:border-zinc-700/60'
                      }`}
                      {...props}
                    >
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
              img({ node, ...props }) {
                return <ChatImage {...props} />;
              },
              table({ node, ...props }) {
                return (
                  <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <table className="w-full text-sm text-left border-collapse" {...props} />
                  </div>
                );
              },
              th({ node, ...props }) {
                return (
                  <th
                    className="px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-800 dark:text-zinc-200 border-b border-slate-200 dark:border-zinc-700 text-xs uppercase tracking-wider"
                    {...props}
                  />
                );
              },
              td({ node, ...props }) {
                return (
                  <td
                    className="px-3.5 py-2.5 border-b border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                    {...props}
                  />
                );
              }
            }}
          >
            {preprocessLatex(String(msg.content || ''))}
          </ReactMarkdown>
        </div>

        {msg.role === 'user' && (
          <div className="flex items-center justify-end gap-2 mt-2 pt-1 text-xs text-white/70">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium hover:bg-white/20 text-white/90 transition-all"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 text-xs text-slate-400 dark:text-zinc-500">
            <button
              onClick={() => onToggleSpeak?.(msg)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isSpeaking
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400'
              }`}
              title={isSpeaking ? 'Stop speaking' : 'Listen to response'}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-all"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) => (
  prev.msg.id === next.msg.id &&
  prev.msg.content === next.msg.content &&
  prev.msg.role === next.msg.role &&
  prev.isSpeaking === next.isSpeaking &&
  JSON.stringify(prev.msg.attachments) === JSON.stringify(next.msg.attachments)
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

  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // 📎 Attachments & Clipboard Snippet States (Claude / ChatGPT style)
  const [attachments, setAttachments] = useState([]);
  const [selectedSnippet, setSelectedSnippet] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleRemoveAttachment = (attId) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const processIncomingFile = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      addToast(`File "${file.name}" exceeds maximum allowed size (50MB)`, 'error');
      return;
    }

    const fn = file.name.toLowerCase();
    const isImage = file.type?.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(fn);
    const isAudio = file.type?.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(fn);
    const isVideo = file.type?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(fn);
    const isText = file.type?.startsWith('text/') || /\.(txt|md|py|js|jsx|ts|tsx|json|csv|html|css|sql|c|cpp|java|rs|go|xml|yml|yaml)$/i.test(fn);

    const attType = isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : isText ? 'text' : 'file';

    if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result || '';
        const lines = content.split('\n').length;
        setAttachments((prev) => [
          ...prev,
          {
            id: `att-f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'text',
            name: file.name,
            size: file.size,
            mime_type: file.type || 'text/plain',
            content,
            lines,
            file,
          }
        ]);
        addToast(`Attached text file: ${file.name}`, 'info', 2000);
      };
      reader.readAsText(file);
    } else if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachments((prev) => [
          ...prev,
          {
            id: `att-f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            name: file.name,
            size: file.size,
            mime_type: file.type || 'image/png',
            data_url: e.target?.result,
            url: URL.createObjectURL(file),
            file,
          }
        ]);
      };
      reader.readAsDataURL(file);
    } else {
      const localUrl = URL.createObjectURL(file);
      setAttachments((prev) => [
        ...prev,
        {
          id: `att-f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: attType,
          name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          url: localUrl,
          file,
        }
      ]);
      addToast(`Attached ${attType}: ${file.name}`, 'info', 2000);
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(processIncomingFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e) => {
    // 1. Check for images in clipboard (e.g. copied screenshots)
    const items = e.clipboardData?.items;
    if (items) {
      const imageItems = Array.from(items).filter((item) => item.type && item.type.indexOf('image') !== -1);
      if (imageItems.length > 0) {
        e.preventDefault();
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) {
            processIncomingFile(file);
            addToast('Pasted image screenshot attached', 'info', 2000);
          }
        }
        return;
      }
    }

    // 2. Intercept large text / multi-line code (Claude & ChatGPT behavior)
    const pastedText = e.clipboardData?.getData('text');
    if (!pastedText) return;

    const lines = pastedText.split('\n');
    // Threshold: more than 350 characters OR 5+ lines
    if (pastedText.length > 350 || lines.length >= 5) {
      e.preventDefault();
      const isCode = /^(import|export|function|const|let|var|class|def|from|#include|<html|SELECT|INSERT|package|public|private)\b/im.test(pastedText.trim());
      const name = isCode ? 'code_snippet.txt' : 'pasted_text.txt';
      const newSnippet = {
        id: `att-txt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        name,
        content: pastedText,
        lines: lines.length,
        size: new Blob([pastedText]).size,
        mime_type: 'text/plain',
      };
      setAttachments((prev) => [...prev, newSnippet]);
      addToast(`Pasted ${lines.length} lines as attached text snippet`, 'info', 2500);
    }
    // Otherwise: allows default small text pasting directly into the input bar!
  };

  // Clean up recognition and speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }
      stopSpeaking();
    };
  }, []);

  const handleToggleSpeak = (msg) => {
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      stopSpeaking();
      setSpeakingMsgId(msg.id);
      speakText(msg.content, {
        voiceProfile: prefs?.voiceAssistant || 'female-us',
        language: prefs?.language || 'en-US',
        speechRate: prefs?.speechRate || 1.0,
        onEnd: () => setSpeakingMsgId(null),
        onError: () => setSpeakingMsgId(null),
      });
    }
  };

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
    if ((!userMsg && attachments.length === 0) || isLoading) return;

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

    const sendingAttachments = [...attachments];
    setInput('');
    setAttachments([]);

    setMessages((p) => [
      ...p,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: userMsg || (sendingAttachments.length > 0 ? '' : 'Hello'),
        attachments: sendingAttachments
      }
    ]);
    setIsLoading(true);

    try {
      // Upload any binary files that don't have a backend url yet
      const processedAttachments = await Promise.all(
        sendingAttachments.map(async (att) => {
          if (att.file && !att.data_url && att.type !== 'text') {
            const formData = new FormData();
            formData.append('file', att.file);
            try {
              const upRes = await api.post('/conversations/upload-attachment', formData);
              return {
                id: att.id,
                name: att.name,
                size: att.size,
                mime_type: upRes.data.mime_type,
                type: att.type,
                url: upRes.data.url,
              };
            } catch (upErr) {
              console.warn('Attachment upload fallback:', upErr);
              return {
                id: att.id,
                name: att.name,
                size: att.size,
                mime_type: att.mime_type,
                type: att.type,
                url: att.url,
              };
            }
          }
          return {
            id: att.id,
            name: att.name,
            size: att.size,
            mime_type: att.mime_type,
            type: att.type,
            data_url: att.data_url,
            url: att.url,
            content: att.content,
            lines: att.lines,
          };
        })
      );

      const res = await api.post(`/conversations/${convId}/message`, {
        message: userMsg || 'Please analyze the attached content.',
        attachments: processedAttachments,
        response_style: prefs?.responseStyle || 'balanced',
        language: prefs?.language || 'en-US',
        model: prefs?.model,
        temperature: prefs?.temperature,
        learning_goal: prefs?.learningGoal,
      });
      const assistantId = `a-${Date.now()}`;
      setMessages((p) => [...p, { id: assistantId, role: 'assistant', content: res.data.reply }]);

      if (prefs?.autoReadAnswers && res.data?.reply) {
        setSpeakingMsgId(assistantId);
        speakText(res.data.reply, {
          voiceProfile: prefs?.voiceAssistant || 'female-us',
          language: prefs?.language || 'en-US',
          speechRate: prefs?.speechRate || 1.0,
          onEnd: () => setSpeakingMsgId(null),
          onError: () => setSpeakingMsgId(null),
        });
      }

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
      configureSpeechRecognition(rec, LANGUAGE_LOCALE_MAP[prefs?.language] || prefs?.language || null);

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
            <InteractiveBotAvatar
              size={34}
              isTyping={Boolean(input?.trim())}
              isLoading={isLoading}
              className="rounded-xl"
            />
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
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Powered by Gemini 3 Flash</p>
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
              <div className="mb-5 shadow-xl shadow-indigo-500/30 rounded-2xl overflow-hidden">
                <InteractiveBotAvatar
                  size={64}
                  isTyping={Boolean(input?.trim())}
                  isLoading={isLoading}
                />
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
              <ChatMessageBubble
                key={msg.id}
                msg={msg}
                isSpeaking={speakingMsgId === msg.id}
                onToggleSpeak={handleToggleSpeak}
                onPreviewSnippet={(snippet) => setSelectedSnippet(snippet)}
                onPreviewImage={(img) => setPreviewImageModal(img)}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
              <InteractiveBotAvatar size={32} isLoading={true} />
              <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl rounded-bl-md px-5 py-4 flex gap-1.5 items-center shadow-sm">
                {[0, 0.2, 0.4].map((d, i) => (
                  <motion.div key={i} animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: d }} className="w-2 h-2 bg-indigo-500 rounded-full" />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area with Drag-and-Drop support */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const droppedFiles = Array.from(e.dataTransfer.files || []);
            droppedFiles.forEach(processIncomingFile);
          }}
          className={`relative shrink-0 p-4 md:p-5 border-t border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl transition-all ${
            isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : ''
          }`}
        >
          {/* Drag Overlay Feedback */}
          {isDragging && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-indigo-600/10 backdrop-blur-sm border-2 border-dashed border-indigo-500 rounded-xl m-2 pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-semibold shadow-lg">
                <UploadCloud size={16} />
                <span>Drop images, audio, video or text files here</span>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            {/* Live Interactive Typing Companion Pill */}
            <AnimatePresence>
              {Boolean(input?.trim()) && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 mb-2 px-3 py-1 w-fit rounded-full bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm"
                >
                  <InteractiveBotAvatar size={18} isTyping={true} />
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    Florix is watching & ready to assist...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Compact Claude & ChatGPT Style Attachment Tray ── */}
            <ChatAttachmentDock
              attachments={attachments}
              onRemoveAttachment={handleRemoveAttachment}
              onPreviewSnippet={(s) => setSelectedSnippet(s)}
              onPreviewImage={(img) => setPreviewImageModal(img)}
            />

            {/* Hidden File Picker */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
              accept="image/*,audio/*,video/*,.pdf,.docx,.doc,.txt,.md,.json,.csv,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.c,.cpp,.java,.rs,.go"
            />

            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-end bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg focus-within:ring-4 focus-within:ring-indigo-500/15 focus-within:border-indigo-500 transition-all p-1.5"
            >
              <div className="flex items-center gap-1 pl-1.5 pb-1 shrink-0">
                {/* File Attachment Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                  title="Attach images, audio, video, or files"
                >
                  <Paperclip size={18} />
                </motion.button>

                {/* Voice Input Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleListen}
                  className={`p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-500 animate-pulse'
                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                </motion.button>
              </div>

              {/* Dynamic Auto-growing Textarea with Keyboard & Paste Handler */}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onPaste={handlePaste}
                placeholder={
                  isListening
                    ? 'Listening…'
                    : attachments.length > 0
                    ? 'Ask a question about the attachment or press Enter to send...'
                    : 'Message Florix AI… (or paste code/images)'
                }
                className="flex-1 px-3 py-2.5 bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-none text-sm font-medium placeholder:text-slate-400 resize-none max-h-40 min-h-[44px] leading-relaxed"
              />

              <div className="pb-1 pr-1 shrink-0">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-zinc-700 dark:disabled:to-zinc-700 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all disabled:shadow-none"
                  title="Send message"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </motion.button>
              </div>
            </form>
            <p className="text-center text-xs text-slate-400 dark:text-zinc-600 mt-2">
              Florix AI may make mistakes. Always verify important information.
            </p>
          </div>
        </div>

        {/* ── Snippet Viewer Modal (Claude & ChatGPT Style) ── */}
        <ChatSnippetModal
          snippet={selectedSnippet}
          isOpen={Boolean(selectedSnippet)}
          onClose={() => setSelectedSnippet(null)}
        />

        {/* ── Lightbox Image Modal ── */}
        {previewImageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setPreviewImageModal(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={previewImageModal}
                alt="Preview"
                className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
              <div className="flex items-center gap-3 mt-4">
                <a
                  href={previewImageModal}
                  download="image.png"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-medium backdrop-blur-md transition-colors"
                >
                  <Download size={14} />
                  <span>Download Image</span>
                </a>
                <button
                  onClick={() => setPreviewImageModal(null)}
                  className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-medium backdrop-blur-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
