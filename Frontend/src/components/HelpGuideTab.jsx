import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, Video, Link as LinkIcon, FileText, Mic, 
  Sparkles, ChevronRight, BookOpen, MessageSquare, Edit3, 
  Bold, List, CheckCircle2, Search, Send, FileDown, ShieldAlert
} from 'lucide-react';

const HelpGuideTab = ({ onBack }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [demoTrigger, setDemoTrigger] = useState(0);

  // Auto-restart or trigger local animations when step changes
  useEffect(() => {
    setDemoTrigger(prev => prev + 1);
  }, [activeStep]);

  const steps = [
    {
      title: "Choose Source & Instant Upload",
      shortDesc: "Process materials in under 500ms.",
      icon: Upload,
      color: "from-blue-500 to-indigo-600",
      glowColor: "rgba(59, 130, 246, 0.2)"
    },
    {
      title: "Dual-Pane Layout Workspace",
      shortDesc: "Read documents & write notes side-by-side.",
      icon: BookOpen,
      color: "from-purple-500 to-indigo-600",
      glowColor: "rgba(168, 85, 247, 0.2)"
    },
    {
      title: "AI Chat & Knowledge Vault",
      shortDesc: "Retrieve vector-indexed details instantly.",
      icon: MessageSquare,
      color: "from-teal-500 to-emerald-600",
      glowColor: "rgba(20, 184, 166, 0.2)"
    },
    {
      title: "Smart Notes Editor & Markdown",
      shortDesc: "Rich formatting and fullscreen controls.",
      icon: Edit3,
      color: "from-amber-500 to-orange-600",
      glowColor: "rgba(245, 158, 11, 0.2)"
    }
  ];

  const renderDemoVisual = () => {
    switch (activeStep) {
      case 0:
        return <UploadDemo key={demoTrigger} />;
      case 1:
        return <DualPaneDemo key={demoTrigger} />;
      case 2:
        return <ChatDemo key={demoTrigger} />;
      case 3:
        return <NotesDemo key={demoTrigger} />;
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-6xl mx-auto px-4 md:px-6 py-6 text-left relative z-10"
    >
      {/* Glow effect backdrops */}
      <div className="absolute top-[-10%] right-[10%] w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-6 mb-8 relative z-20">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2 tracking-tight">
            <Sparkles className="text-indigo-500 animate-pulse" size={26} />
            Florix AI Interactive Tour
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Explore advanced workflows and learn how to supercharge your study sessions.
          </p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (typeof onBack === 'function') {
              onBack();
            } else {
              window.dispatchEvent(new CustomEvent('florix:go-home'));
            }
          }} 
          className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Home
        </motion.button>
      </div>

      {/* Main interactive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left side: Guide Steps list */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">
            Tour Milestones
          </h3>
          <div className="flex flex-col gap-3">
            {steps.map((step, idx) => {
              const isActive = activeStep === idx;
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    group relative p-5 rounded-2xl border text-left cursor-pointer transition-all duration-300 flex items-start gap-4 overflow-hidden
                    ${isActive 
                      ? 'bg-white dark:bg-zinc-900 border-indigo-500/50 shadow-xl dark:shadow-zinc-950/40' 
                      : 'bg-white/40 dark:bg-zinc-950/20 border-slate-200/50 dark:border-zinc-800/40 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white/60 dark:hover:bg-zinc-900/40'
                    }
                  `}
                >
                  {/* Decorative background glow for active step */}
                  {isActive && (
                    <div 
                      className="absolute inset-0 opacity-10 pointer-events-none transition-all"
                      style={{ background: `radial-gradient(circle at 100% 50%, ${step.glowColor.replace('0.2', '1')}, transparent 70%)` }}
                    />
                  )}

                  {/* Icon */}
                  <div className={`
                    w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner transition-colors
                    ${isActive 
                      ? `bg-gradient-to-br ${step.color} text-white` 
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-zinc-400'
                    }
                  `}>
                    <Icon size={18} />
                  </div>

                  {/* Texts */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                        Step 0{idx + 1}
                      </span>
                      {isActive && (
                        <motion.span 
                          layoutId="active-badge" 
                          className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full"
                        >
                          LIVE DEMO
                        </motion.span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mt-1">
                      {step.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {step.shortDesc}
                    </p>
                  </div>

                  <ChevronRight 
                    size={16} 
                    className={`shrink-0 self-center text-slate-300 dark:text-zinc-700 transition-transform duration-200 ${isActive ? 'translate-x-1 text-indigo-500' : 'group-hover:translate-x-0.5'}`} 
                  />
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3">
            <Sparkles className="text-indigo-400 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">
              <strong>Quick Tip:</strong> Click any milestone block to trigger its high-fidelity mock animation immediately. Explore how Florix AI uses RAG vector indexing under the hood.
            </p>
          </div>
        </div>

        {/* Right side: Interactive Mockup Canvas */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="w-full flex items-center justify-between px-4 py-2 border-t border-r border-l border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 rounded-t-2xl text-xs font-semibold text-slate-400 dark:text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
              <span className="ml-1 text-[10px] tracking-wide font-mono text-slate-400">workspace_demo.html</span>
            </div>
            <div className="font-mono text-[9px] bg-slate-200 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
              INTERACTIVE PREVIEW
            </div>
          </div>
          
          <div className="flex-1 min-h-[420px] bg-slate-100/50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-b-2xl p-6 relative flex flex-col justify-center overflow-hidden shadow-inner select-none">
            {/* Grid background for premium feel */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10 dark:opacity-20 pointer-events-none" />
            <AnimatePresence mode="wait">
              {renderDemoVisual()}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

// ── SUB-COMPONENT 1: UPLOAD DEMO ──────────────────────────────────────────────
const UploadDemo = () => {
  const [stage, setStage] = useState('idle'); // idle -> cursor -> click -> upload -> finished

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('cursor'), 1000);
    const timer2 = setTimeout(() => setStage('click'), 2200);
    const timer3 = setTimeout(() => setStage('upload'), 2550);
    const timer4 = setTimeout(() => setStage('finished'), 3550);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const sources = [
    { name: 'Upload', desc: 'PDF, Image, Audio', icon: Upload, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Video', desc: 'MP4, MOV, WEBM', icon: Video, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'Link', desc: 'YouTube, Web', icon: LinkIcon, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { name: 'Paste', desc: 'Copied Text', icon: FileText, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Speak', desc: 'Voice to Text', icon: Mic, color: 'text-teal-500', bg: 'bg-teal-500/10' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full flex flex-col gap-6"
    >
      <div className="text-center max-w-sm mx-auto mb-2">
        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Milestone 1</span>
        <h4 className="font-bold text-slate-800 dark:text-zinc-200 mt-1">Instant Source Uploading</h4>
        <p className="text-xs text-slate-500 mt-1">Upload materials instantly. Summary parsing offloads into the background.</p>
      </div>

      <div className="relative w-full border border-slate-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden">
        {/* Row of 5 options */}
        <div className="grid grid-cols-5 gap-2 relative">
          {sources.map((src, i) => {
            const isUpload = src.name === 'Upload';
            const isClicked = isUpload && (stage === 'click' || stage === 'upload' || stage === 'finished');
            return (
              <div 
                key={i} 
                className={`p-2 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center h-24
                  ${isClicked 
                    ? 'border-indigo-500 bg-indigo-500/5 scale-[0.98] shadow-inner' 
                    : 'border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950'
                  }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${src.bg} ${src.color}`}>
                  <src.icon size={15} />
                </div>
                <span className="font-extrabold text-[10px] text-slate-700 dark:text-zinc-300 leading-none">{src.name}</span>
                <span className="text-[8px] text-slate-400 scale-90 whitespace-nowrap">{src.desc.split(',')[0]}</span>
              </div>
            );
          })}

          {/* Virtual Mouse Cursor */}
          {stage === 'cursor' && (
            <motion.div 
              initial={{ x: 260, y: 120 }}
              animate={{ x: 30, y: 35 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
              className="absolute w-5 h-5 rounded-full border border-white bg-slate-900/70 shadow-lg pointer-events-none z-35 flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
            </motion.div>
          )}
        </div>

        {/* Uploading Progress Panel */}
        <AnimatePresence>
          {(stage === 'upload' || stage === 'finished') && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border-t border-slate-100 dark:border-zinc-800/80 pt-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                  <FileText size={13} className="text-indigo-500" /> Biology_Lecture_1.pdf
                </span>
                <span className="font-mono text-slate-400 dark:text-zinc-500">
                  {stage === 'upload' ? 'Uploading...' : 'Success'}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Finished Stage Overlay */}
      <AnimatePresence>
        {stage === 'finished' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold max-w-sm mx-auto shadow-sm"
          >
            <CheckCircle2 size={15} />
            Redirected instantly. Study guide generating in background!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── SUB-COMPONENT 2: DUAL-PANE WORKSPACE DEMO ────────────────────────────────
const DualPaneDemo = () => {
  const [activeTab, setActiveTab] = useState('doc'); // doc vs summary
  const [rightView, setRightView] = useState('chat'); // chat vs notes

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveTab('summary'), 1500);
    const timer2 = setTimeout(() => {
      setActiveTab('doc');
      setRightView('notes');
    }, 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center max-w-sm mx-auto mb-2">
        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Milestone 2</span>
        <h4 className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">Flexible Dual-Pane Splits</h4>
        <p className="text-xs text-slate-500 mt-1">Symmetrical side-by-side workspace optimized for reading, chat, and notes.</p>
      </div>

      <div className="w-full border border-slate-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 rounded-2xl flex flex-col overflow-hidden h-60">
        
        {/* Workspace Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-700" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">Dual-Pane Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded transition-all ${rightView === 'chat' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
              Chat Mode
            </span>
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded transition-all ${rightView === 'notes' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
              Notes Mode
            </span>
          </div>
        </div>

        {/* Dual Panels Split */}
        <div className="flex-1 flex min-w-0 divide-x divide-slate-200 dark:divide-zinc-800/80 bg-white dark:bg-zinc-950">
          
          {/* Left Panel - Source Document Reader / Summary */}
          <div className="flex-1 flex flex-col min-w-0 p-2.5">
            <div className="flex border-b border-slate-100 dark:border-zinc-900 pb-1.5 mb-2 gap-1 justify-start shrink-0">
              <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${activeTab === 'doc' ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200' : 'text-slate-400'}`}>
                Source Doc
              </span>
              <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${activeTab === 'summary' ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200' : 'text-slate-400'}`}>
                AI Study Guide
              </span>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col gap-1 text-[8px] text-slate-500 leading-relaxed font-serif text-left px-1">
              {activeTab === 'doc' ? (
                <>
                  <p className="font-bold text-slate-700 dark:text-zinc-300">Chapter 1. Photosynthetic Enzymes</p>
                  <p className="line-clamp-4">Photosynthesis is a chemical process that takes place in chloroplasts. Light energy is captured by chlorophyll molecules inside the leaves, initiating electron transfers...</p>
                  <div className="bg-yellow-500/10 border-l border-yellow-500 px-1 py-0.5 font-sans font-bold text-yellow-600 dark:text-yellow-400 shrink-0">
                    Highlighted: "chlorophyll molecules inside leaves"
                  </div>
                </>
              ) : (
                <>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">SUMMARY POINTS</p>
                  <ul className="list-disc pl-2 space-y-1">
                    <li>Chloroplasts: Site of photosynthesis reaction.</li>
                    <li>Chlorophyll: Absorbs violet-blue/red light.</li>
                    <li>Output: Stores energy in sugars.</li>
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Divider Line in Middle */}
          <div className="w-1.5 flex items-center justify-center bg-slate-50 dark:bg-zinc-900 cursor-col-resize shrink-0">
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-zinc-700 rounded" />
          </div>

          {/* Right Panel - Chat or Notes */}
          <div className="flex-1 flex flex-col min-w-0 p-2.5">
            <div className="flex border-b border-slate-100 dark:border-zinc-900 pb-1.5 mb-2 justify-start shrink-0">
              <span className="text-[8px] font-extrabold text-slate-700 dark:text-zinc-300">
                {rightView === 'chat' ? '🤖 AI Study Partner' : '📝 Study Notes'}
              </span>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col text-[8px] text-slate-400 text-left">
              {rightView === 'chat' ? (
                <div className="flex flex-col gap-1.5 flex-1 justify-end">
                  <div className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 p-1.5 rounded-lg max-w-[90%] self-end">
                    Explain Chapter 1?
                  </div>
                  <div className="bg-indigo-500 text-white p-1.5 rounded-lg max-w-[90%] self-start leading-normal">
                    Sure! Photosynthesis happens in chloroplasts...
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1 flex-1 font-mono">
                  <span className="text-slate-800 dark:text-zinc-200 font-bold"># Biology Lecture Notes</span>
                  <span className="text-slate-600">- Photosynthesis site: chloroplasts</span>
                  <span className="text-slate-600">- Chlorophyll extracts solar photon energy</span>
                  <span className="w-1.5 h-3 bg-purple-500 animate-pulse inline-block" />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

// ── SUB-COMPONENT 3: CHAT DEMO ───────────────────────────────────────────────
const ChatDemo = () => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const chatSequence = [
      { text: "Find notes about HNSW index.", type: "user", delay: 1000 },
      { text: "Scanning Vector DB...", type: "pulse", delay: 2000 },
      { text: "Found in chroma_vault: 'HNSW is used for approximate nearest neighbor search to achieve sub-millisecond retrieval latency.'", type: "bot", delay: 3500 }
    ];

    chatSequence.forEach((item, idx) => {
      setTimeout(() => {
        if (item.type === 'pulse') {
          setTyping(true);
        } else {
          setTyping(false);
          setMessages(prev => [...prev, item]);
        }
      }, item.delay);
    });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center max-w-sm mx-auto mb-2">
        <span className="text-[10px] font-bold text-teal-500 uppercase tracking-widest">Milestone 3</span>
        <h4 className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">RAG Chat & Knowledge Vault</h4>
        <p className="text-xs text-slate-500 mt-1">ChromaDB indexing serves relevant document chunks semantic-matches in milliseconds.</p>
      </div>

      <div className="w-full border border-slate-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 rounded-2xl flex flex-col overflow-hidden h-56">
        
        {/* Chat Header */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200">Global Knowledge Vault Chat</span>
          </div>
          <span className="text-[8px] text-slate-400 font-mono">ChromaDB Connected</span>
        </div>

        {/* Chat stream area */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 bg-slate-50/50 dark:bg-zinc-950/40 text-left">
          {messages.map((msg, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx}
              className={`max-w-[85%] p-2 rounded-xl text-[10px] leading-relaxed flex flex-col gap-1
                ${msg.type === 'user' 
                  ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 self-end rounded-tr-none' 
                  : 'bg-teal-600 text-white self-start rounded-tl-none'
                }`}
            >
              <span>{msg.text}</span>
              {msg.type === 'bot' && (
                <div className="text-[7px] text-teal-200 font-bold mt-0.5 border-t border-teal-500/50 pt-1 flex items-center gap-1 shrink-0">
                  <FileDown size={8} /> Cited source: index_page_3
                </div>
              )}
            </motion.div>
          ))}

          {typing && (
            <div className="self-start bg-slate-100 dark:bg-zinc-900 text-slate-400 text-[10px] px-3 py-1.5 rounded-xl flex items-center gap-1">
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="p-2 border-t border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex items-center gap-2 shrink-0">
          <input 
            type="text" 
            placeholder="Search knowledge vault..." 
            disabled 
            className="flex-1 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl px-2.5 py-1.5 text-[9px] outline-none" 
          />
          <button disabled className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center shrink-0">
            <Send size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── SUB-COMPONENT 4: NOTES DEMO ──────────────────────────────────────────────
const NotesDemo = () => {
  const [boldText, setBoldText] = useState(false);
  const [typedContent, setTypedContent] = useState('');
  const [bullets, setBullets] = useState(false);

  useEffect(() => {
    const sentence = "## Chapter 1 Lecture Note\n- Important topic details";
    let count = 0;
    const interval = setInterval(() => {
      setTypedContent(sentence.substring(0, count + 1));
      count++;
      if (count >= sentence.length) {
        clearInterval(interval);
        setTimeout(() => setBoldText(true), 500);
        setTimeout(() => setBullets(true), 1300);
      }
    }, 45);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full flex flex-col gap-4"
    >
      <div className="text-center max-w-sm mx-auto mb-2">
        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Milestone 4</span>
        <h4 className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">Smart Notes Formatting</h4>
        <p className="text-xs text-slate-500 mt-1">Full-height Notes editor with toolbar helper buttons to quickly format text.</p>
      </div>

      <div className="w-full border border-slate-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 rounded-2xl flex flex-col overflow-hidden h-52">
        
        {/* Formatting Toolbar */}
        <div className="px-3 py-1.5 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <button className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition-colors ${boldText ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20' : ''}`}>
              <Bold size={11} />
            </button>
            <button className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition-colors ${bullets ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' : ''}`}>
              <List size={11} />
            </button>
            <span className="w-px h-3.5 bg-slate-200 dark:bg-zinc-800 mx-1" />
            <span className="text-[8px] text-slate-400">100% Height Canvas</span>
          </div>
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Markdown Editor</span>
        </div>

        {/* Text Area Mock */}
        <div className="flex-1 p-3 bg-white dark:bg-zinc-950 font-mono text-[9px] text-slate-700 dark:text-zinc-300 text-left whitespace-pre-wrap leading-relaxed relative">
          <div className="flex flex-col gap-1">
            <span className={boldText ? "text-indigo-600 dark:text-indigo-400 font-bold" : ""}>
              {typedContent}
            </span>
            {bullets && (
              <motion.div 
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-1 text-slate-500"
              >
                <span>- Electron transfers create NADPH</span>
                <span>- Oxygen is released as byproduct</span>
              </motion.div>
            )}
            <span className="w-1.5 h-3 bg-indigo-500 animate-pulse inline-block" />
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default HelpGuideTab;
