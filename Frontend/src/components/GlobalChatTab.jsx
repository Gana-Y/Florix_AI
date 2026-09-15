import React, { useState, useEffect, useRef, useContext, Component } from 'react';
import {
  Send, Mic, MicOff, Bot, User, Loader2, AlertCircle, Sparkles,
  Zap, BookOpen, Lightbulb, Award, FileText, Cpu, HelpCircle, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { PreferencesContext } from '../context/PreferencesContext';

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
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> Error rendering message.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Memoized Message Item (Prevents ReactMarkdown AST Re-parse on input/stream) ──
const GlobalChatMessageBubble = React.memo(({ msg }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {msg.role === 'bot' && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center shrink-0 border border-white dark:border-zinc-800 shadow-sm">
          <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[75%] p-5 rounded-3xl shadow-sm backdrop-blur-sm ${
        msg.role === 'user'
          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-indigo-500/20'
          : 'bg-white/90 dark:bg-zinc-900/90 border border-slate-100 dark:border-zinc-800/50 text-slate-800 dark:text-zinc-200 rounded-bl-sm shadow-slate-200/20 dark:shadow-none'
      }`}>
        <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none ${
          msg.role === 'user' ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white' : ''
        }`}>
          <ChatErrorBoundary>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {String(msg.text || "")}
            </ReactMarkdown>
          </ChatErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => (
  (prev.msg.id ? prev.msg.id === next.msg.id : true) &&
  prev.msg.text === next.msg.text &&
  prev.msg.role === next.msg.role
));

const GlobalChatTab = ({ sessionId, documentTitle }) => {
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

  // Create SpeechRecognition instance once on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + ' ' + transcript);
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        // Graceful fallback — no browser alert
        setMessages(prev => [...prev, {
          role: 'bot',
          text: '⚠️ Voice input is not supported in your browser. Please type your message instead. (Try Chrome or Edge for voice support.)'
        }]);
      }
    }
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage = textToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const payload = {
        message: userMessage,
        response_style: prefs?.responseStyle || 'balanced',
      };
      if (sessionId) payload.session_id = sessionId;
      const response = await api.post('/chat', payload);
      setMessages(prev => [...prev, { role: 'bot', text: response.data.reply || "No reply" }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm sorry, I encountered an error connecting to my neural network. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

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
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center shrink-0 border border-white dark:border-zinc-800 shadow-sm">
              <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-100 dark:border-zinc-800/50 p-4 rounded-3xl rounded-bl-sm flex gap-1.5 items-center shadow-sm">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-indigo-500 rounded-full" />
            </div>
          </motion.div>
        )}
        <div className="h-2" />
      </div>

      {/* Premium Input Area */}
      <div className="p-3 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-t border-slate-100/60 dark:border-zinc-800/60 shrink-0">
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
            placeholder={isListening ? "Listening..." : "Message Florix AI..."}
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 dark:text-zinc-200 text-xs md:text-sm transition-all font-medium placeholder:text-slate-400"
          />

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-zinc-700 dark:disabled:to-zinc-700 text-white rounded-lg shadow-sm transition-all disabled:shadow-none flex items-center justify-center z-10"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </motion.button>
        </form>
        <p className="text-center text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 font-medium">
          Florix AI can make mistakes. Consider verifying important information.
        </p>
      </div>
    </motion.div>
  );
};

export default GlobalChatTab;