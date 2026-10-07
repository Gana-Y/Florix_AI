import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Play, Pause, Square, CheckCircle2, XCircle, AlertCircle,
  Award, Clock, Sparkles, BookOpen, Calendar, Bell, ChevronRight,
  ArrowLeft, Plus, Trash2, HelpCircle, Send, Volume2, ShieldAlert,
  Brain, FileText, Check, AlertTriangle, RefreshCw, X
} from 'lucide-react';
import api from '../utils/api';
import { extractBestTranscript, combineSpokenWithBase, configureSpeechRecognition } from '../utils/speechCorrection';
import { useToast } from '../context/ToastContext';

const VIVA_MODES = {
  CONCEPTUAL_DEFENSE: {
    label: 'Conceptual Defense',
    desc: 'Defense of foundational theories and core architectural principles.',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  },
  CODE_ARCHITECTURE_DEFENSE: {
    label: 'System & Architecture Defense',
    desc: 'Oral defense of technical design decisions, trade-offs, and algorithms.',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  THESIS_DEFENSE_SIMULATION: {
    label: 'Thesis & Viva Voce Simulation',
    desc: 'Rigorous doctoral/academic viva simulation with examiners.',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  },
  INTERVIEW_TECHNICAL_DEEP_DIVE: {
    label: 'Technical Interview Deep-Dive',
    desc: 'Probing technical interview testing mechanism depth and clarity.',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  EXAM_PREPARATION_VIVA: {
    label: 'Oral Examination Practice',
    desc: 'Structured syllabus-grounded oral Q&A examination.',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
};

const TEACHING_MODES = ['INTERMEDIATE', 'BEGINNER', 'ADVANCED', 'EXPERT'];

export default function VivaWorkspace({ user, onOpenSession, initialSessionId = null }) {
  const { addToast } = useToast();

  // Navigation states: 'list' | 'create' | 'exam_room' | 'results'
  const [view, setView] = useState('list');
  const [sessions, setSessions] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Setup Form State
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId || '');
  const [customTopic, setCustomTopic] = useState('');
  const [vivaMode, setVivaMode] = useState('CONCEPTUAL_DEFENSE');
  const [teachingMode, setTeachingMode] = useState('INTERMEDIATE');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [creating, setCreating] = useState(false);

  // Active Viva Exam Room State
  const [activeViva, setActiveViva] = useState(null);
  const [currentTurnFeedback, setCurrentTurnFeedback] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [inputMode, setInputMode] = useState('typed'); // 'typed' | 'voice'
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseAnswerRef = useRef('');

  // Results State
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [schedulingPlan, setSchedulingPlan] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState(false);

  // Cancel Exam State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [bankFilter, setBankFilter] = useState(initialSessionId ? 'current' : 'all'); // 'all' | 'current'

  // Synchronize initialSessionId prop updates
  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
      setBankFilter('current');
    }
  }, [initialSessionId]);

  // Auto-populate topic name from studySessions if available
  useEffect(() => {
    if (selectedSessionId && studySessions.length > 0 && !customTopic) {
      const matched = studySessions.find(s => String(s.id) === String(selectedSessionId));
      if (matched) {
        setCustomTopic(matched.title || matched.filename || '');
      }
    }
  }, [selectedSessionId, studySessions, customTopic]);

  // Load Viva Bank List
  const fetchVivas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/viva');
      setSessions(res.data || []);
    } catch (err) {
      if (err.response?.status === 401) return;
      console.warn('Failed to load viva sessions:', err);
      addToast('Failed to load viva history', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Load Library Study Sessions for Configurator
  const fetchStudySessions = useCallback(async () => {
    try {
      const res = await api.get('/library');
      setStudySessions(res.data || []);
    } catch {
      // Ignore background library load failures
    }
  }, []);

  useEffect(() => {
    fetchVivas();
    fetchStudySessions();
  }, [fetchVivas, fetchStudySessions]);

  // Setup Web Speech API for voice answer dictation
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      configureSpeechRecognition(recognition);

      recognition.onresult = (event) => {
        const cleanSpoken = extractBestTranscript(event.results);
        if (cleanSpoken) {
          const combined = combineSpokenWithBase(baseAnswerRef.current, cleanSpoken);
          setUserAnswer(combined);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } catch {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const toggleSpeechRecording = () => {
    if (!speechSupported) {
      addToast('Speech recognition is not supported in this browser. Please use typed input.', 'warning');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
      setInputMode('voice');
      addToast('Microphone recording stopped.', 'info');
    } else {
      baseAnswerRef.current = userAnswer ? userAnswer.trim() : '';
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setInputMode('voice');
        addToast('Listening... Speak your viva explanation clearly.', 'info');
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
        setIsRecording(false);
      }
    }
  };

  // Timer countdown management
  useEffect(() => {
    if (view !== 'exam_room' || !activeViva || activeViva.status !== 'IN_PROGRESS') {
      clearInterval(timerRef.current);
      return;
    }

    if (activeViva.expires_at) {
      const updateTimer = () => {
        const expTime = new Date(activeViva.expires_at).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expTime - now) / 1000));
        setRemainingSeconds(diff);

        if (diff <= 0) {
          clearInterval(timerRef.current);
          handleTimeExpired();
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [view, activeViva]);

  const handleTimeExpired = async () => {
    addToast('Viva time limit expired! Evaluating completed turns...', 'warning');
    if (!activeViva) return;
    try {
      const res = await api.get(`/viva/${activeViva.id}/results`);
      setResultsData(res.data);
      setView('results');
    } catch (e) {
      console.warn('Failed to load expired viva results:', e);
    }
  };

  // Create new viva session
  const handleCreateViva = async (e) => {
    e.preventDefault();
    const topic = customTopic.trim() || (selectedSessionId ? studySessions.find(s => String(s.id) === String(selectedSessionId))?.title : 'General Academic Subject');
    if (!topic) {
      addToast('Please specify a topic or select a study session.', 'warning');
      return;
    }

    try {
      setCreating(true);
      const payload = {
        title: `${VIVA_MODES[vivaMode]?.label || 'Viva'}: ${topic}`,
        session_id: selectedSessionId ? parseInt(selectedSessionId, 10) : null,
        topic,
        viva_mode: vivaMode,
        teaching_mode: teachingMode,
        difficulty,
        total_questions: parseInt(totalQuestions, 10),
        time_limit_minutes: timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null
      };

      const res = await api.post('/viva', payload);
      addToast('Viva examination prepared! Initializing examiner room...', 'success');
      await handleStartViva(res.data.id);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to initialize viva session';
      addToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Start / Resume Viva
  const handleStartViva = async (vivaId) => {
    try {
      const res = await api.post(`/viva/${vivaId}/start`);
      setActiveViva(res.data);
      setCurrentTurnFeedback(null);
      setUserAnswer('');
      baseAnswerRef.current = '';
      setView('exam_room');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to start viva session';
      addToast(msg, 'error');
    }
  };

  // Pause Viva
  const handlePauseViva = async () => {
    if (!activeViva) return;
    try {
      const res = await api.post(`/viva/${activeViva.id}/pause`);
      setActiveViva(res.data);
      addToast('Viva paused.', 'info');
    } catch (err) {
      addToast('Failed to pause viva', 'error');
    }
  };

  // Resume Viva
  const handleResumeViva = async () => {
    if (!activeViva) return;
    try {
      const res = await api.post(`/viva/${activeViva.id}/resume`);
      setActiveViva(res.data);
      addToast('Viva resumed.', 'success');
    } catch (err) {
      addToast('Failed to resume viva', 'error');
    }
  };

  // End Viva Early (Finalize & Grade)
  const handleEndViva = async () => {
    if (!activeViva) return;
    if (!window.confirm('Are you sure you want to conclude the oral examination? All submitted answers will be graded.')) return;

    try {
      await api.post(`/viva/${activeViva.id}/end`);
      await handleViewResults(activeViva.id);
    } catch (err) {
      addToast('Failed to conclude viva', 'error');
    }
  };

  // Cancel active viva attempt (discard/delete without grading)
  const handleDiscardViva = async () => {
    if (!activeViva) return;
    try {
      setCancelling(true);
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.stop(); } catch {}
        setIsRecording(false);
      }
      clearInterval(timerRef.current);
      await api.delete(`/viva/${activeViva.id}`);
      addToast('Viva examination cancelled and attempt discarded.', 'info');
      setActiveViva(null);
      setShowCancelModal(false);
      setView('list');
      fetchVivas();
    } catch (err) {
      console.warn('Failed to discard viva:', err);
      setActiveViva(null);
      setShowCancelModal(false);
      setView('list');
      fetchVivas();
    } finally {
      setCancelling(false);
    }
  };

  // Pause and exit active viva attempt to resume later
  const handlePauseAndExit = async () => {
    if (!activeViva) return;
    try {
      setCancelling(true);
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.stop(); } catch {}
        setIsRecording(false);
      }
      clearInterval(timerRef.current);
      await api.post(`/viva/${activeViva.id}/pause`);
      addToast('Viva paused and saved. You can resume anytime from the Examination Bank.', 'info');
      setActiveViva(null);
      setShowCancelModal(false);
      setView('list');
      fetchVivas();
    } catch (err) {
      console.warn('Failed to pause viva:', err);
      setActiveViva(null);
      setShowCancelModal(false);
      setView('list');
      fetchVivas();
    } finally {
      setCancelling(false);
    }
  };

  // Submit Answer to current question
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      addToast('Please articulate your response before submitting.', 'warning');
      return;
    }

    if (isRecording && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsRecording(false);
    }

    const currentQ = activeViva.questions[activeViva.current_question_index];
    if (!currentQ) return;

    try {
      setSubmittingAnswer(true);
      const res = await api.post(`/viva/${activeViva.id}/answer`, {
        question_id: currentQ.id,
        user_answer: userAnswer.trim(),
        input_mode: inputMode
      });

      if (res.data.is_complete) {
        addToast('Viva examination complete! Synthesizing examiner evaluation...', 'success');
        await handleViewResults(activeViva.id);
      } else {
        // Show turn feedback card and update session state
        setCurrentTurnFeedback(res.data.turn);
        setActiveViva(res.data.session);
        setUserAnswer('');
        baseAnswerRef.current = '';
        addToast('Response evaluated by academic examiner.', 'info');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit viva answer';
      addToast(msg, 'error');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Move to next question after reviewing turn feedback
  const handleNextQuestion = () => {
    setCurrentTurnFeedback(null);
    setUserAnswer('');
    baseAnswerRef.current = '';
  };

  // View Scorecard Results
  const handleViewResults = async (vivaId) => {
    try {
      setLoadingResults(true);
      const res = await api.get(`/viva/${vivaId}/results`);
      setResultsData(res.data);
      setView('results');
      fetchVivas();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load viva results';
      addToast(msg, 'error');
    } finally {
      setLoadingResults(false);
    }
  };

  // Delete Viva Session
  const handleDeleteViva = async (vivaId) => {
    if (!window.confirm('Delete this viva examination record?')) return;
    try {
      await api.delete(`/viva/${vivaId}`);
      addToast('Viva record deleted', 'success');
      fetchVivas();
    } catch {
      addToast('Failed to delete viva session', 'error');
    }
  };

  // Schedule Adaptive Planner Task
  const handleSchedulePlannerTask = async () => {
    if (!resultsData) return;
    try {
      setSchedulingPlan(true);
      const res = await api.post(`/viva/${resultsData.id}/plan`);
      addToast(`Added practice task '${res.data.title}' to Adaptive Study Planner!`, 'success');
    } catch (err) {
      addToast('Failed to add task to Study Planner', 'error');
    } finally {
      setSchedulingPlan(false);
    }
  };

  // Schedule Notification Reminder
  const handleScheduleReminder = async () => {
    if (!resultsData) return;
    try {
      setSchedulingReminder(true);
      await api.post(`/viva/${resultsData.id}/remind`);
      addToast('Revision notification reminder scheduled in Notification Center!', 'success');
    } catch (err) {
      addToast('Failed to schedule revision reminder', 'error');
    } finally {
      setSchedulingReminder(false);
    }
  };

  // Calculate Metrics for Hub KPI header
  const completedVivas = sessions.filter(s => s.status === 'COMPLETED' || s.status === 'TIME_EXPIRED');
  const avgScore = completedVivas.length > 0
    ? Math.round(completedVivas.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / completedVivas.length)
    : 0;

  // Format countdown string
  const formatTimer = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentDocSessions = selectedSessionId
    ? sessions.filter(s => String(s.session_id) === String(selectedSessionId))
    : [];

  const displayedSessions = (bankFilter === 'current' && selectedSessionId)
    ? currentDocSessions
    : sessions;

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: LIST / HUB
  // ───────────────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-200">
        {/* Hub Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Mic size={22} />
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                AI Oral Examination & Viva Practice
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Interactive oral defense simulator with grounded examiner probing, voice dictation, and diagnostic scoring.
            </p>
          </div>

          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
          >
            <Plus size={16} /> New Viva Examination
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Vivas</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{sessions.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Average Score</span>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{avgScore}%</p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Completed</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedVivas.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Proficiency</span>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300 mt-2 truncate">
              {avgScore >= 80 ? 'Exceptional Mastery' : avgScore >= 60 ? 'Proficient' : 'Developing'}
            </p>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Award size={18} className="text-indigo-500" /> Examination Bank
            </h2>

            {selectedSessionId && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                <button
                  onClick={() => setBankFilter('current')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    bankFilter === 'current'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  This Document ({currentDocSessions.length})
                </button>
                <button
                  onClick={() => setBankFilter('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    bankFilter === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  All Vivas ({sessions.length})
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading viva sessions...</div>
          ) : displayedSessions.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
              <Mic size={36} className="mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-zinc-300 mb-1">
                {selectedSessionId && bankFilter === 'current'
                  ? 'No oral vivas for this document yet'
                  : 'No oral vivas on record'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto mb-4">
                Initialize your first AI Viva Examination to practice defending course concepts out loud.
              </p>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/20"
              >
                + Initialize Viva
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSessions.map((viva) => {
                const modeMeta = VIVA_MODES[viva.viva_mode] || VIVA_MODES.CONCEPTUAL_DEFENSE;
                const isFinished = viva.status === 'COMPLETED' || viva.status === 'TIME_EXPIRED';

                return (
                  <div
                    key={viva.id}
                    className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-indigo-400/50 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modeMeta.badge}`}>
                          {modeMeta.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          viva.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          viva.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          viva.status === 'PAUSED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {viva.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 mb-1">
                        {viva.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                        Topic: <span className="font-semibold text-slate-700 dark:text-zinc-200">{viva.topic}</span>
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-zinc-500 mb-4">
                        <span>{viva.total_questions} questions</span>
                        {viva.time_limit_minutes && <span>{viva.time_limit_minutes} mins</span>}
                        {isFinished && (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            Score: {Math.round(viva.overall_score || 0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        onClick={() => handleDeleteViva(viva.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>

                      {isFinished ? (
                        <button
                          onClick={() => handleViewResults(viva.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          View Results <ChevronRight size={13} />
                        </button>
                      ) : viva.status === 'IN_PROGRESS' || viva.status === 'PAUSED' ? (
                        <button
                          onClick={() => handleStartViva(viva.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          Resume Exam <Play size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartViva(viva.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          Start Exam <Play size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: CONFIGURATOR MODAL / FORM
  // ───────────────────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Viva Hub
        </button>

        <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-xl space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Mic size={20} />
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Configure Oral Viva Examination
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Select the examination mode, topic rigor, and question bounds. Questions will be strictly grounded in course materials.
            </p>
          </div>

          <form onSubmit={handleCreateViva} className="space-y-5">
            {/* Source Session or Custom Topic */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                Knowledge Source / Study Session
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSessionId(val);
                  if (val) {
                    const matched = studySessions.find(s => String(s.id) === String(val));
                    if (matched) setCustomTopic(matched.title || matched.filename || '');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">Custom Topic (No linked session)</option>
                {studySessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.filename || `Session #${s.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Topic Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                Target Topic / Subject
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. Distributed Consensus, Microservice Resilience, Organic Synthesis"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Viva Mode Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                Oral Defense Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(VIVA_MODES).map(([key, meta]) => (
                  <div
                    key={key}
                    onClick={() => setVivaMode(key)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      vivaMode === key
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{meta.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">{meta.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Teaching Rigor & Difficulty */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                  Academic Rigor
                </label>
                <select
                  value={teachingMode}
                  onChange={(e) => setTeachingMode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-800 dark:text-white"
                >
                  {TEACHING_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-800 dark:text-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Questions count and time limit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                  Total Questions (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                  Time Limit (Minutes, optional)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={timeLimitMinutes || ''}
                  placeholder="Unlimited"
                  onChange={(e) => setTimeLimitMinutes(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {creating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Grounding Viva Questions...
                </>
              ) : (
                <>
                  <Play size={16} /> Begin Viva Examination
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: ACTIVE VIVA EXAM ROOM
  // ───────────────────────────────────────────────────────────────────────────
  if (view === 'exam_room' && activeViva) {
    const currentQ = activeViva.questions[activeViva.current_question_index];
    const isPaused = activeViva.status === 'PAUSED';

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Top Header / Progress & Controls */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Mic size={18} />
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                {activeViva.title}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Question {activeViva.current_question_index + 1} of {activeViva.total_questions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {remainingSeconds !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                remainingSeconds < 120
                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                <Clock size={13} />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            )}

            {isPaused ? (
              <button
                onClick={handleResumeViva}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play size={13} /> Resume
              </button>
            ) : (
              <button
                onClick={handlePauseViva}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Pause size={13} /> Pause
              </button>
            )}

            <button
              onClick={handleEndViva}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Conclude exam and grade submitted answers"
            >
              <Square size={12} /> Grade & Conclude
            </button>

            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Cancel and exit oral exam"
            >
              <X size={13} /> Cancel Exam
            </button>
          </div>
        </div>

        {/* Examiner Question Card */}
        {currentQ && (
          <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">
                {currentQ.is_follow_up ? 'Adaptive Follow-Up Probe' : `Examiner Question #${currentQ.question_order}`}
              </span>

              {currentQ.citation_excerpt && (
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic max-w-xs truncate">
                  Grounded in course text
                </span>
              )}
            </div>

            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQ.question_text}
            </h3>

            {currentQ.citation_excerpt && (
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Verified Evidence: </span>
                {currentQ.citation_excerpt}
              </div>
            )}
          </div>
        )}

        {/* Turn Evaluation / Instant Feedback Card (Rendered if just submitted) */}
        {currentTurnFeedback ? (
          <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/50 rounded-3xl shadow-lg space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} /> Response Evaluated
              </span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {Math.round(currentTurnFeedback.overall_score)}%
              </span>
            </div>

            {/* Sub-Score Breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">Correctness</span>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-200 mt-0.5">{Math.round(currentTurnFeedback.correctness_score)}</p>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">Completeness</span>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-200 mt-0.5">{Math.round(currentTurnFeedback.completeness_score)}</p>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">Reasoning</span>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-200 mt-0.5">{Math.round(currentTurnFeedback.reasoning_score)}</p>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">Clarity</span>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-200 mt-0.5">{Math.round(currentTurnFeedback.clarity_score)}</p>
              </div>
            </div>

            {/* Strengths & Improvement */}
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">Examiner Observations:</p>
                <p className="text-emerald-700 dark:text-emerald-400">{currentTurnFeedback.strengths}</p>
              </div>
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                <p className="font-bold text-amber-800 dark:text-amber-300 mb-0.5">Recommendations for Depth:</p>
                <p className="text-amber-700 dark:text-amber-400">{currentTurnFeedback.improvement_feedback}</p>
              </div>
            </div>

            {currentTurnFeedback.needs_follow_up && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <Sparkles size={14} className="shrink-0" />
                <span>The examiner has formulated a follow-up probing question to explore this concept further.</span>
              </div>
            )}

            <button
              onClick={handleNextQuestion}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Advance to Next Question <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          /* Student Answer Input Area */
          <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('typed')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    inputMode === 'typed'
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Type Response
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('voice')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    inputMode === 'voice'
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Voice Dictation
                </button>
              </div>

              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleSpeechRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                }`}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                {isRecording ? 'Stop Recording' : 'Start Mic'}
              </button>
            </div>

            {/* Answer Text Area (Dictated or Typed) */}
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="State your oral response clearly. Explain the mechanism, trade-offs, and conceptual foundation..."
              rows={6}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 text-sm text-slate-800 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none font-medium"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Word count: {userAnswer.trim() ? userAnswer.trim().split(/\s+/).length : 0} words
              </span>

              <button
                onClick={handleSubmitAnswer}
                disabled={submittingAnswer || !userAnswer.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {submittingAnswer ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Evaluating...
                  </>
                ) : (
                  <>
                    <Send size={13} /> Submit Response to Examiner
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cancel / Exit Oral Exam Confirmation Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <AlertTriangle size={24} />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Cancel Oral Viva Examination?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    You can pause and save your progress to resume later, or discard this session entirely.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handlePauseAndExit}
                    disabled={cancelling}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Pause size={14} /> Pause & Save Progress (Resume Later)
                  </button>

                  <button
                    onClick={handleDiscardViva}
                    disabled={cancelling}
                    className="w-full py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 size={14} /> Discard & Delete Attempt
                  </button>

                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelling}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Resume Oral Defense
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: SCORECARD RESULTS
  // ───────────────────────────────────────────────────────────────────────────
  if (view === 'results' && resultsData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Viva Hub
        </button>

        {/* Scorecard Hero */}
        <div className="p-6 md:p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
              resultsData.passed
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
            }`}>
              {resultsData.passed ? 'PASSED — ORAL PROFICIENCY' : 'NEEDS FOUNDATIONAL REVIEW'}
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {resultsData.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Proficiency Level: <span className="font-bold text-slate-800 dark:text-zinc-200">{resultsData.proficiency_level}</span>
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-zinc-800/80 rounded-3xl border border-slate-100 dark:border-zinc-800 min-w-[140px]">
            <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
              {Math.round(resultsData.overall_score || 0)}%
            </span>
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mt-1 uppercase tracking-wider">
              Overall Score
            </span>
          </div>
        </div>

        {/* Closed-Loop Action Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleSchedulePlannerTask}
            disabled={schedulingPlan}
            className="p-4 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm"
          >
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-500" /> Add Remediation to Study Plan
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Schedule targeted practice on weak areas in Adaptive Study Planner.
              </p>
            </div>
            <ChevronRight size={16} className="text-indigo-500 shrink-0" />
          </button>

          <button
            onClick={handleScheduleReminder}
            disabled={schedulingReminder}
            className="p-4 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm"
          >
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bell size={14} className="text-indigo-500" /> Schedule Revision Reminder
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Set spaced recall notification in Notification Center.
              </p>
            </div>
            <ChevronRight size={16} className="text-indigo-500 shrink-0" />
          </button>
        </div>

        {/* Examiner Overall Feedback */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award size={16} className="text-indigo-500" /> Academic Examiner Synthesis
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            {resultsData.overall_feedback}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-2">Demonstrated Strengths:</span>
              <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1 list-disc list-inside">
                {resultsData.strong_areas?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-2">Areas for Reinforcement:</span>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                {resultsData.weak_areas?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Turn-by-Turn Detailed Transcript */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" /> Complete Examination Transcript
          </h3>

          <div className="space-y-4">
            {resultsData.turns?.map((turn, idx) => (
              <div
                key={turn.id || idx}
                className="p-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    Question #{turn.question_order || idx + 1}
                  </span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    Score: {Math.round(turn.overall_score)}%
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  {turn.question_text}
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
                  <span className="font-bold text-slate-500 dark:text-zinc-400 block mb-1">Student Answer ({turn.input_mode}):</span>
                  {turn.user_answer}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">Examiner Feedback: </span>
                  {turn.feedback_text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
