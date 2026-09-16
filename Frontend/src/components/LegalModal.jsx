import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  Users, 
  Lock, 
  CheckCircle2, 
  ExternalLink, 
  Mail, 
  Github, 
  Linkedin, 
  Sparkles, 
  Database,
  Cpu
} from 'lucide-react';

export default function LegalModal({ isOpen, onClose, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Reset scroll position when switching tabs
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Close on Escape key & cleanly lock background scroll / pause Lenis
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Pause Lenis smooth scroll so wheel events do not bleed to the background
      window.__lenis?.stop();
      // Lock root document and body
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      // Resume Lenis smooth scroll
      window.__lenis?.start();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        data-lenis-prevent
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.div
          data-lenis-prevent
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="bg-[#0c101d] border border-white/10 rounded-3xl w-full max-w-3xl shadow-2xl shadow-indigo-950/40 relative overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Top ambient glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-indigo-500/15 blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                {activeTab === 'terms' && <FileText size={20} />}
                {activeTab === 'privacy' && <ShieldCheck size={20} />}
                {activeTab === 'community' && <Users size={20} />}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {activeTab === 'terms' && 'Terms of Service'}
                  {activeTab === 'privacy' && 'Privacy & Data Protection'}
                  {activeTab === 'community' && 'Community & Developer Connect'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Florix AI Academic Engine • Updated September 2026
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 md:px-8 pt-4 pb-2 border-b border-white/5 flex flex-wrap sm:flex-nowrap gap-2 bg-[#0a0d18]/60 shrink-0">
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <FileText size={14} /> Terms of Service
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <ShieldCheck size={14} /> Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'community'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Users size={14} /> Community & Author
            </button>
          </div>

          {/* Modal Body / Content */}
          <div 
            ref={scrollContainerRef}
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
            className="p-6 md:p-8 overflow-y-auto flex-1 text-sm text-zinc-300 space-y-6 leading-relaxed custom-scrollbar overscroll-contain"
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          >
            {/* ── Tab: Terms of Service ── */}
            {activeTab === 'terms' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3.5">
                  <Sparkles size={20} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-200">Academic Integrity First</h4>
                    <p className="text-xs text-indigo-300/80 mt-1">
                      Florix AI is crafted as an accelerated study companion. It is designed to foster deep conceptual understanding through diagnostic testing, interactive flashcards, and vector document retrieval.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    1. Acceptance of Terms
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    By accessing or using Florix AI (web client, APIs, or hosted academic workspaces), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please discontinue use of the platform.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    2. Acceptable Use & Content Ownership
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    Users retain 100% intellectual ownership over all study notes, lecture PDFs, research papers, and audio files uploaded. You warrant that you have the right to upload and process materials under fair-use educational doctrines. You may not upload harmful, abusive, or copyright-infringing content intended for non-educational distribution.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    3. AI Generation & Disclaimers
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    Automated quizzes, flashcards, concept maps, and summaries are synthesized using large language models. While our proprietary RAG (Retrieval-Augmented Generation) pipeline cross-checks source documents to maximize factual precision, users should cross-reference standard course textbooks for critical academic examinations.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    4. Account Limits & Subscriptions
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    Free accounts include 5 study documents and daily diagnostic quiz quotas. Pro and Premium tiers expand document capacities and dedicated GPU processing slots. Quotas are refreshed on standard billing cycles.
                  </p>
                </div>
              </div>
            )}

            {/* ── Tab: Privacy Policy ── */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-start gap-3.5">
                  <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-200">Zero Model Training on Your Private Notes</h4>
                    <p className="text-xs text-emerald-300/80 mt-1">
                      Your uploaded documents, exam prep materials, and notes are never used to train public or foundational AI models. Your academic data belongs strictly to you.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database size={16} className="text-indigo-400" /> 1. Vector Isolation & Storage Architecture
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    When you upload a PDF or document, it is converted in-memory into vector embeddings stored within an isolated, user-scoped ChromaDB collection. Search queries and AI chat prompts retrieve context solely from your private document collections.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Lock size={16} className="text-indigo-400" /> 2. Authentication & Data Security
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    All user passwords are encrypted using industry-standard bcrypt hashing with salt rounds. Communication is transmitted over TLS 1.3 encryption. We store only essential account information (email, name, tier, and session timestamps).
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" /> 3. Data Deletion Rights
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    You have permanent control over your data. When you delete a study session, the underlying document text, generated quizzes, and vector index embeddings are permanently purged from storage immediately.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Cpu size={16} className="text-purple-400" /> 4. Third-Party Service Providers
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-400">
                    Payments are securely handled via Razorpay without sensitive financial information touching Florix AI servers. LLM generation queries communicate via secure enterprise API channels (Google Gemini API) adhering to strict confidentiality SLAs.
                  </p>
                </div>
              </div>
            )}

            {/* ── Tab: Community & Author ── */}
            {activeTab === 'community' && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-900 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Creator & Lead Engineer
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">
                      Ganesh Yandigeri
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Full-Stack AI Developer & Architect behind Florix AI
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://github.com/Gana-Y"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                    >
                      <Github size={14} /> GitHub
                    </a>
                    <a
                      href="https://www.linkedin.com/in/ganesh-yandigeri-988821287"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[#0077b5]/20 hover:bg-[#0077b5]/30 border border-[#0077b5]/40 text-[#38bdf8] text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                    >
                      <Linkedin size={14} /> LinkedIn
                    </a>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white">Join the Community & Direct Contact</h4>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    Have questions about the technical architecture, want to report an edge case, or connect for placement opportunities? Reach out directly through any of our official channels:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <a
                      href="mailto:ganeshyandigeri1@gmail.com"
                      className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-3 text-zinc-200 hover:text-white transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Mail size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Direct Email</div>
                        <div className="text-xs text-zinc-400 truncate max-w-[200px]">ganeshyandigeri1@gmail.com</div>
                      </div>
                    </a>

                    <a
                      href="https://github.com/Gana-Y"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-3 text-zinc-200 hover:text-white transition-all group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ExternalLink size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Open Source & Code</div>
                        <div className="text-xs text-zinc-400">github.com/Gana-Y</div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 md:px-8 border-t border-white/10 bg-[#0a0d18]/80 flex items-center justify-between shrink-0">
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Verified Architecture • Production Active
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
