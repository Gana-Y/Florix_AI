import React, { useRef, useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Upload, FileText, Link as LinkIcon,
  Mic, Loader2, X, CheckCircle2, ArrowLeft, Video,
  RefreshCw, Play, Pause, Sun, Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { correctSpeechPhonetics, combineSpokenWithBase, configureSpeechRecognition } from '../utils/speechCorrection';
import RichPreviewPanel from './RichPreviewPanel';
import { useToast } from '../context/ToastContext';
import PipelineVisualizer from './PipelineVisualizer';
import { AuthContext } from '../context/AuthContext';

// Plan-based workspace source limits
const PLAN_SOURCE_LIMITS = {
  free:    { max_upload_mb: 10,  max_video_mb: 25,  max_paste_chars: 3000,   max_speech_words: 150 },
  pro:     { max_upload_mb: 50,  max_video_mb: 100, max_paste_chars: 25000,  max_speech_words: 1000 },
  premium: { max_upload_mb: 100, max_video_mb: 250, max_paste_chars: 100000, max_speech_words: -1 },
};

const StudyInput = ({ onStartStudy, onBack, isDarkMode, toggleTheme, activeSpaceId, onClearSpace }) => {
  const [activeSpace, setActiveSpace] = useState(null);

  useEffect(() => {
    if (activeSpaceId) {
      api.get(`/projects/${activeSpaceId}`)
        .then(res => setActiveSpace(res.data))
        .catch(() => setActiveSpace(null));
    } else {
      setActiveSpace(null);
    }
  }, [activeSpaceId]);
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);
  const userPlan = user?.plan || 'free';
  const planLimits = PLAN_SOURCE_LIMITS[userPlan] || PLAN_SOURCE_LIMITS.free;
  const [topic, setTopic] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [linkUrl, setLinkUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [richPreview, setRichPreview] = useState(null);

  // ── RAG Pipeline Visualizer Coordination States ──────────────────────────────
  const [activeProgressId, setActiveProgressId] = useState(null);
  const [pendingSessionData, setPendingSessionData] = useState(null);
  const [pipelineFinished, setPipelineFinished] = useState(false);

  useEffect(() => {
    if (pendingSessionData) {
      onStartStudy({
        title: pendingSessionData.filename,
        summary: pendingSessionData.summary,
        id: pendingSessionData.id,
        project_id: pendingSessionData.project_id || activeSpaceId
      });
      window.dispatchEvent(new CustomEvent('florix:session-created'));
      // Reset tracker states
      setActiveProgressId(null);
      setPendingSessionData(null);
      setPipelineFinished(false);
    }
  }, [pendingSessionData, onStartStudy]);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // ── Web Speech API State & Logic ─────────────────────────────────────────────
  const [speakTranscript, setSpeakTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakError, setSpeakError] = useState('');
  const recognitionRef = useRef(null);

  const startSpeakRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeakError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    setSpeakError('');
    setIsSpeaking(true);

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      configureSpeechRecognition(rec);

      rec.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          const cleanFinal = correctSpeechPhonetics(final);
          setSpeakTranscript((prev) => combineSpokenWithBase(prev, cleanFinal) + ' ');
        }
        setInterimTranscript(correctSpeechPhonetics(interim));
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeakError('Microphone permission denied. Please allow microphone access in your browser settings.');
        } else if (event.error !== 'no-speech') {
          setSpeakError(`Error: ${event.error}`);
        }
        setIsSpeaking(false);
      };

      rec.onend = () => {
        setIsSpeaking(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      setSpeakError(`Failed to initialize: ${err.message}`);
      setIsSpeaking(false);
    }
  };

  const stopSpeakRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handleSpeechSubmit = async () => {
    const text = (speakTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (!text || text.length < 10) {
      addToast('Text is too short. Please speak or type at least 10 characters for meaningful analysis.', 'warning');
      return;
    }
    stopSpeakRecognition();
    setActiveModal(null);
    setSpeakTranscript('');
    setInterimTranscript('');

    const progressId = crypto.randomUUID();
    setActiveProgressId(progressId);
    setPipelineFinished(false);
    setPendingSessionData(null);
    setIsUploading(true);
    try {
      const response = await api.post(`/process-text?progress_id=${progressId}`, { text, project_id: activeSpaceId || null });
      setPendingSessionData(response.data);
    } catch (error) {
      addToast('Failed to process speech text: ' + (error.response?.data?.detail || 'Unknown error'), 'error');
      setActiveProgressId(null);
      setPipelineFinished(false);
      setPendingSessionData(null);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'speak') {
      setSpeakTranscript('');
      setInterimTranscript('');
      setSpeakError('');
      startSpeakRecognition();
    } else {
      stopSpeakRecognition();
    }
  }, [activeModal]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // ── Auto-stop speech when plan word limit is reached ──────────────────────
  useEffect(() => {
    if (!isSpeaking || planLimits.max_speech_words === -1) return;
    const wordCount = (speakTranscript + interimTranscript).trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= planLimits.max_speech_words) {
      stopSpeakRecognition();
      addToast(
        `Speech limit reached (${planLimits.max_speech_words} words for ${userPlan.toUpperCase()} plan). ${userPlan === 'free' ? 'Upgrade to Pro for 1,000 words.' : ''}`,
        'warning'
      );
    }
  }, [speakTranscript, interimTranscript, isSpeaking, planLimits.max_speech_words]);

  // ── File Upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE_MB = planLimits.max_upload_mb;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      addToast(
        `File too large! Your ${userPlan.toUpperCase()} plan allows up to ${MAX_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.${userPlan === 'free' ? ' Upgrade for larger uploads.' : ''}`,
        'error'
      );
      e.target.value = '';
      return;
    }

    const progressId = crypto.randomUUID();
    setActiveProgressId(progressId);
    setPipelineFinished(false);
    setPendingSessionData(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (activeSpaceId) {
      formData.append('project_id', activeSpaceId);
    }
    try {
      const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm'].some(ext => file.name.toLowerCase().endsWith(ext));
      const endpoint = isAudio ? `/upload-audio?progress_id=${progressId}` : `/upload?progress_id=${progressId}`;
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingSessionData(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        addToast('Your session has expired or you are not logged in. Please log in to upload.', 'error');
        window.dispatchEvent(new CustomEvent('florix:session-expired'));
      } else {
        addToast('Upload failed: ' + (error.response?.data?.detail || 'Unknown error'), 'error');
      }
      setActiveProgressId(null);
      setPipelineFinished(false);
      setPendingSessionData(null);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Video Upload ─────────────────────────────────────────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_VIDEO_MB = planLimits.max_video_mb;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      addToast(
        `Video too large! Your ${userPlan.toUpperCase()} plan allows up to ${MAX_VIDEO_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.${userPlan === 'free' ? ' Upgrade for lecture videos.' : ''}`,
        'error'
      );
      e.target.value = '';
      return;
    }

    const progressId = crypto.randomUUID();
    setActiveProgressId(progressId);
    setPipelineFinished(false);
    setPendingSessionData(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (activeSpaceId) {
      formData.append('project_id', activeSpaceId);
    }
    try {
      const response = await api.post(`/upload-video?progress_id=${progressId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingSessionData(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        addToast('Your session has expired or you are not logged in. Please log in to upload.', 'error');
        window.dispatchEvent(new CustomEvent('florix:session-expired'));
      } else {
        addToast('Video upload failed: ' + (error.response?.data?.detail || 'Unknown error'), 'error');
      }
      setActiveProgressId(null);
      setPipelineFinished(false);
      setPendingSessionData(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkOpen = async (e) => {
    e.preventDefault();
    let raw = linkUrl.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) {
      raw = 'https://' + raw;
    }
    const url = raw;
    setActiveModal(null);
    setLinkUrl('');

    const progressId = crypto.randomUUID();
    setActiveProgressId(progressId);
    setPipelineFinished(false);
    setPendingSessionData(null);
    setIsUploading(true);
    try {
      const response = await api.post(`/process-link?progress_id=${progressId}`, { url, project_id: activeSpaceId || null });
      setPendingSessionData(response.data);
    } catch (error) {
      addToast('Processing link failed: ' + (error.response?.data?.detail || 'Unknown error'), 'error');
      setActiveProgressId(null);
      setPipelineFinished(false);
      setPendingSessionData(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteOpen = async (e) => {
    e.preventDefault();
    if (!pasteText.trim() || pasteText.trim().length < 10) {
      addToast('Text is too short. Please paste at least 10 characters.', 'warning');
      return;
    }
    const text = pasteText.trim();
    setActiveModal(null);
    setPasteText('');

    const progressId = crypto.randomUUID();
    setActiveProgressId(progressId);
    setPipelineFinished(false);
    setPendingSessionData(null);
    setIsUploading(true);
    try {
      const response = await api.post(`/process-text?progress_id=${progressId}`, { text, project_id: activeSpaceId || null });
      setPendingSessionData(response.data);
    } catch (error) {
      addToast('Processing text failed: ' + (error.response?.data?.detail || 'Unknown error'), 'error');
      setActiveProgressId(null);
      setPipelineFinished(false);
      setPendingSessionData(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoClick = () => {
    const raw = topic.trim();
    if (!raw) return;
    const isYt = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/.test(raw);
    if (isYt) {
      setRichPreview({ type: 'youtube', content: raw });
    } else if (/^https?:\/\//i.test(raw) || /^www\./i.test(raw) || (raw.includes('.') && !raw.includes(' ') && raw.length > 5)) {
      const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      setRichPreview({ type: 'link', content: url });
    } else {
      setRichPreview({ type: 'query', content: raw });
    }
  };



  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const actionButtons = [
    {
      label: 'Upload', subLabel: `PDF, Image, Audio · max ${planLimits.max_upload_mb}MB`, icon: Upload,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30', iconText: 'text-blue-600 dark:text-blue-400',
      onClick: () => fileInputRef.current?.click(),
    },
    {
      label: 'Video', subLabel: `MP4, MOV, WEBM · max ${planLimits.max_video_mb}MB`, icon: Video,
      iconBg: 'bg-purple-50 dark:bg-purple-900/30', iconText: 'text-purple-600 dark:text-purple-400',
      onClick: () => videoInputRef.current?.click(),
    },
    {
      label: 'Link', subLabel: 'YouTube, Website', icon: LinkIcon,
      iconBg: 'bg-orange-50 dark:bg-orange-900/30', iconText: 'text-orange-600 dark:text-orange-400',
      onClick: () => setActiveModal('link'),
    },
    {
      label: 'Paste', subLabel: `Copied Text · max ${Math.floor(planLimits.max_paste_chars / 6).toLocaleString()} words`, icon: FileText,
      iconBg: 'bg-green-50 dark:bg-green-900/30', iconText: 'text-green-600 dark:text-green-400',
      onClick: () => setActiveModal('paste'),
    },

    {
      label: 'Speak', subLabel: planLimits.max_speech_words === -1 ? 'Unlimited dictation' : `Up to ${planLimits.max_speech_words} words`, icon: Mic,
      iconBg: 'bg-teal-50 dark:bg-teal-900/30', iconText: 'text-teal-600 dark:text-teal-400',
      onClick: () => setActiveModal('speak'),
    },
  ];

  const modalVariants = {
    hidden:  { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
    exit:    { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.18 } },
  };

  return (
    <div className="w-full flex flex-col gap-0">

            {/* ── Active Space Context Banner (YouLearn.ai style) ── */}
      {activeSpace && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 mx-auto max-w-2xl w-full p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{activeSpace.icon || '📁'}</span>
            <div className="min-w-0">
              <p className="text-xs font-black text-indigo-900 dark:text-indigo-200 truncate">
                Uploading to Space: <span className="underline">{activeSpace.name}</span>
              </p>
              <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400">
                This material will be automatically organized into this folder and grounded in its subchats.
              </p>
            </div>
          </div>
          {onClearSpace && (
            <button
              onClick={onClearSpace}
              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/80 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:text-zinc-300 shadow-sm transition-colors shrink-0 ml-3"
            >
              Upload as Standalone
            </button>
          )}
        </motion.div>
      )}

      {/* ── HEADER — 3-column layout: back | title | spacer ─────────────────── */}
      <div className="w-full flex items-center justify-between mb-6">
        {/* Left: Back button — fixed width so title stays centered */}
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shrink-0"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Back</span>
        </motion.button>

        {/* Center: Page title */}
        <div className="flex-1 text-center px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 leading-tight">
            Your AI Workspace
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Choose a source to get started
          </p>
        </div>

        {/* Right: Theme Toggle or Spacer */}
        <div className="shrink-0 w-[88px] flex justify-end">
          {toggleTheme && (
            <motion.button
              whileHover={{ scale: 1.08, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 shadow-md border border-slate-200/50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center shrink-0"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Action Grid ─────────────────────────────────────────────────────── */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.txt,.md,image/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm" />
      <input type="file" ref={videoInputRef} className="hidden" onChange={handleVideoUpload} accept=".mp4,.mov,.avi,.mkv,.webm" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
        {actionButtons.map((btn, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: 'easeOut' }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={btn.onClick}
            disabled={isUploading}
            className="flex flex-col items-center justify-center p-6 bg-white/85 dark:bg-zinc-900/85 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl hover:border-indigo-400/60 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group h-44 cursor-pointer"
          >
            {/* Icon container — fixed size to prevent layout shift */}
            <div
              className={`w-14 h-14 flex items-center justify-center rounded-2xl ${btn.iconBg} ${btn.iconText} mb-3 shadow-inner shrink-0`}
            >
              {isUploading && btn.label === 'Upload'
                ? <Loader2 size={26} className="animate-spin" />
                : <btn.icon size={26} strokeWidth={1.8} />
              }
            </div>
            <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm mb-0.5 leading-none">
              {isUploading && btn.label === 'Upload' ? 'Uploading…' : btn.label}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              {btn.subLabel}
            </span>
          </motion.button>
        ))}
      </div>

      {/* ── Search / Ask Anything ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-1.5 rounded-2xl shadow-lg border border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 transition-all"
      >
        <Search className="text-slate-400 ml-2 shrink-0" size={18} />
        <input
          type="text"
          value={topic}
          placeholder="Or just ask anything…"
          className="flex-1 bg-transparent border-none text-slate-700 dark:text-zinc-200 py-3 px-1 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-base"
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGoClick()}
        />
        <motion.button
          whileHover={{ scale: topic.trim() ? 1.04 : 1 }}
          whileTap={{ scale: topic.trim() ? 0.96 : 1 }}
          onClick={handleGoClick}
          disabled={!topic.trim()}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${
            !topic.trim()
              ? 'bg-slate-100 text-slate-400 cursor-default dark:bg-zinc-800 dark:text-zinc-600'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30'
          }`}
        >
          Go
        </motion.button>
      </motion.div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeModal && (
            <motion.div
              key="active-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  stopSpeakRecognition();
                  setActiveModal(null);
                }
              }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md"
            >
              <motion.div
                key={activeModal}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative"
              >
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    stopSpeakRecognition();
                    setActiveModal(null);
                  }}
                  className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 p-2 rounded-full transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </motion.button>

                {/* Link Modal */}
                {activeModal === 'link' && (
                  <form onSubmit={handleLinkOpen} className="flex flex-col gap-5">
                    <div>
                      <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center rounded-xl mb-4">
                        <LinkIcon size={22} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Paste a Link</h3>
                      <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">YouTube, Wikipedia, or any public article.</p>
                    </div>
                    <input
                      type="text"
                      inputMode="url"
                      required
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or https://en.wikipedia.org/..."
                      className="w-full p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 text-sm"
                    />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={!linkUrl.trim() || isUploading}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      {isUploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Process Link'}
                    </motion.button>
                  </form>
                )}

                {/* Paste Modal */}
                {activeModal === 'paste' && (
                  <form onSubmit={handlePasteOpen} className="flex flex-col gap-5">
                    <div>
                      <div className="w-11 h-11 bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center rounded-xl mb-4">
                        <FileText size={22} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Paste Text</h3>
                      <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Paste notes, essays, or code for AI analysis.</p>
                    </div>
                    <div className="relative">
                      <textarea
                        required value={pasteText}
                        onChange={(e) => {
                          if (e.target.value.length <= planLimits.max_paste_chars) {
                            setPasteText(e.target.value);
                          } else {
                            setPasteText(e.target.value.slice(0, planLimits.max_paste_chars));
                            addToast(`Character limit reached (${planLimits.max_paste_chars.toLocaleString()} chars for ${userPlan.toUpperCase()} plan)`, 'warning');
                          }
                        }}
                        placeholder="Paste your text or notes here…"
                        className="w-full p-4 pb-8 h-40 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200 resize-none text-sm custom-scrollbar"
                      />
                      <div className={`absolute bottom-2 right-3 text-[10px] font-semibold ${
                        pasteText.length > planLimits.max_paste_chars * 0.9 
                          ? 'text-red-500' 
                          : pasteText.length > planLimits.max_paste_chars * 0.7 
                            ? 'text-amber-500' 
                            : 'text-slate-400 dark:text-zinc-600'
                      }`}>
                        {pasteText.length.toLocaleString()} / {planLimits.max_paste_chars.toLocaleString()} chars
                      </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={pasteText.trim().length < 10 || isUploading}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl disabled:opacity-50 transition-colors text-sm cursor-pointer shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      {isUploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Process Text'}
                    </motion.button>
                  </form>
                )}

                {/* Speak Modal */}
                {activeModal === 'speak' && (
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div>
                      <div className="w-11 h-11 bg-teal-100 dark:bg-teal-900/30 text-teal-600 flex items-center justify-center rounded-xl mb-4 mx-auto">
                        <Mic size={22} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Speak & Study</h3>
                      <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
                        Speak naturally. AI will transcribe your words into a grounded session.
                      </p>
                    </div>

                    {/* Pulsing Mic Indicator */}
                    <div className="w-full flex items-center justify-center h-28 relative">
                      {isSpeaking ? (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <motion.div
                            animate={{ scale: [1, 2.2, 1], opacity: [0.4, 0, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                            className="w-12 h-12 bg-teal-500/20 dark:bg-teal-400/20 rounded-full absolute"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                            className="w-12 h-12 bg-teal-500/30 dark:bg-teal-400/30 rounded-full absolute"
                          />
                        </div>
                      ) : null}

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={isSpeaking ? stopSpeakRecognition : startSpeakRecognition}
                        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all z-10 cursor-pointer ${
                          isSpeaking
                            ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-teal-500/20'
                            : 'bg-slate-300 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-400 dark:hover:bg-zinc-700'
                        }`}
                        title={isSpeaking ? 'Pause Recording' : 'Start / Resume Recording'}
                      >
                        {isSpeaking ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                      </motion.button>
                    </div>

                    {speakError && (
                      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 w-full text-left">
                        {speakError}
                      </div>
                    )}

                    {/* Real-time word-by-word transcription with manual editing capability */}
                    <div className="w-full relative">
                      <textarea
                        value={speakTranscript + (interimTranscript ? (speakTranscript ? ' ' : '') + interimTranscript : '')}
                        onChange={(e) => {
                          setSpeakTranscript(e.target.value);
                          setInterimTranscript('');
                        }}
                        placeholder={isSpeaking ? 'Listening... start speaking now.' : 'Speech recognition paused. Click the mic button to resume, or type notes here.'}
                        className="w-full p-4 pb-8 h-36 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 dark:text-zinc-200 resize-none text-sm custom-scrollbar text-left"
                      />
                      {(() => {
                        const currentWords = (speakTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim().split(/\s+/).filter(Boolean).length;
                        const limit = planLimits.max_speech_words;
                        const isUnlimited = limit === -1;
                        const isNearLimit = !isUnlimited && currentWords > limit * 0.8;
                        const isOverLimit = !isUnlimited && currentWords >= limit;
                        return (
                          <div className={`absolute bottom-3 right-4 text-[10px] font-semibold pointer-events-none ${
                            isOverLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-600'
                          }`}>
                            {currentWords}{isUnlimited ? '' : ` / ${limit}`} words
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex w-full gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => {
                          setSpeakTranscript('');
                          setInterimTranscript('');
                        }}
                        disabled={!speakTranscript && !interimTranscript}
                        className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold rounded-2xl text-sm transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        Reset
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleSpeechSubmit}
                        disabled={isUploading || (!speakTranscript.trim() && !interimTranscript.trim())}
                        className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl disabled:opacity-50 flex justify-center items-center gap-2 text-sm transition-colors shadow-md shadow-teal-500/25 cursor-pointer"
                      >
                        {isUploading ? <><Loader2 className="animate-spin" size={16} /> Processing...</> : 'Finish & Process'}
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* RAG Pipeline Visualizer Modal */}
      <AnimatePresence>
        {activeProgressId && (
          <PipelineVisualizer
            progressId={activeProgressId}
            onComplete={() => setPipelineFinished(true)}
            onClose={() => {
              setActiveProgressId(null);
              setPendingSessionData(null);
              setPipelineFinished(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Rich Preview Panel */}
      <AnimatePresence>
        {richPreview && (
          <RichPreviewPanel
            type={richPreview.type}
            content={richPreview.content}
            onClose={() => setRichPreview(null)}
            onStartStudy={onStartStudy}
            activeSpaceId={activeSpaceId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudyInput;