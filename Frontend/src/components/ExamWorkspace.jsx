import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Clock, CheckCircle2, XCircle, AlertCircle, Bookmark,
  RotateCcw, ArrowRight, ArrowLeft, Plus, Trash2, Calendar,
  Sparkles, Check, HelpCircle, FileText, BarChart3, BookOpen,
  Filter, Play, Timer, ShieldAlert, ChevronRight, Bell, AlertTriangle,
  Brain, LogOut, X
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { MetacognitiveDebuggerModal } from './MetacognitiveDebugger';

const MODE_METADATA = {
  practice: {
    label: 'Practice Exam',
    desc: 'Self-paced examination for concept verification.',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  mock: {
    label: 'Mock Exam',
    desc: 'Strict server-timed simulation of a standard exam.',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  },
  topic: {
    label: 'Topic Exam',
    desc: 'Targeted assessment focused on specific topics.',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  full_syllabus: {
    label: 'Full Syllabus',
    desc: 'Comprehensive multi-topic academic evaluation.',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  },
};

const DIFFICULTY_METADATA = {
  beginner: 'bg-slate-500/10 text-slate-600 dark:text-zinc-400 border border-slate-500/20',
  intermediate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  advanced: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ExamWorkspace({ user, onOpenSession }) {
  const { addToast } = useToast();

  // Navigation states: 'list' | 'create' | 'active' | 'review'
  const [view, setView] = useState('list');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Setup form states
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examMode, setExamMode] = useState('practice');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingPercentage, setPassingPercentage] = useState(70);
  const [numQuestions, setNumQuestions] = useState(10);
  const [creating, setCreating] = useState(false);

  // Active attempt state
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // questionId -> { user_answer, is_marked_for_review }
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const autoSaveTimerRef = useRef(null);

  // Review state
  const [reviewData, setReviewData] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'mistakes' | 'marked'

  // Metacognitive Debugger state
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [selectedMistakeQuestion, setSelectedMistakeQuestion] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Fetch all user exams
  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get('/exams');
      setExams(res.data || []);
    } catch (err) {
      if (err.response?.status === 401) return;
      console.warn('Failed to load exams:', err);
      const errorMsg = !err.response
        ? 'Could not connect to backend server. Please verify your connection.'
        : (err.response?.data?.detail || 'Failed to load exams');
      setLoadError(errorMsg);
      addToast(errorMsg.length < 60 ? errorMsg : 'Failed to load exams', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Fetch available library sessions for exam creation
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/library');
      setSessions(res.data || []);
      if (res.data?.length > 0) {
        setSelectedSessionId((prev) => prev || res.data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    fetchExams();
    fetchSessions();
  }, [fetchExams, fetchSessions]);

  // Active attempt timer countdown
  useEffect(() => {
    if (view !== 'active' || remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      handleAutoSubmitTimeout();
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmitTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, remainingSeconds]);

  // Auto-save debounce effect
  const persistAnswersToServer = useCallback(async (answersMap) => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') return;
    try {
      const answersPayload = Object.entries(answersMap).map(([qId, val]) => ({
        question_id: parseInt(qId, 10),
        user_answer: val.user_answer ?? null,
        is_marked_for_review: Boolean(val.is_marked_for_review),
        time_spent_seconds: 0,
      }));
      await api.put(`/exams/attempts/${activeAttempt.id}/answers`, {
        answers: answersPayload,
      });
    } catch (err) {
      console.warn('Auto-save answers failed:', err);
    }
  }, [activeAttempt]);

  const queueAutoSave = useCallback((updatedMap) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      persistAnswersToServer(updatedMap);
    }, 800);
  }, [persistAnswersToServer]);

  // Create new exam
  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examTitle.trim()) {
      addToast('Please enter an exam title', 'error');
      return;
    }
    if (!selectedSessionId) {
      addToast('Please select a study document', 'error');
      return;
    }

    try {
      setCreating(true);
      const payload = {
        session_id: parseInt(selectedSessionId, 10),
        title: examTitle.trim(),
        exam_mode: examMode,
        difficulty,
        duration_minutes: parseInt(durationMinutes, 10),
        passing_percentage: parseInt(passingPercentage, 10),
        num_questions: parseInt(numQuestions, 10),
      };

      const res = await api.post('/exams', payload);
      addToast('Exam created successfully!', 'success');
      setExamTitle('');
      await fetchExams();
      // Directly start attempt for the newly created exam
      handleStartExam(res.data.id);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create exam';
      addToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Start or resume an exam
  const handleStartExam = async (examId) => {
    try {
      setLoading(true);
      const res = await api.post(`/exams/${examId}/start`);
      const attempt = res.data;
      setActiveAttempt(attempt);
      setRemainingSeconds(attempt.remaining_seconds);

      // Hydrate saved answers
      const initialAnswers = {};
      attempt.questions.forEach((q) => {
        const saved = attempt.saved_answers?.[String(q.id)] || {};
        initialAnswers[q.id] = {
          user_answer: saved.user_answer ?? null,
          is_marked_for_review: Boolean(saved.is_marked_for_review),
        };
      });
      setUserAnswers(initialAnswers);
      setCurrentQIndex(0);
      setView('active');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to start exam';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Select an option for current question
  const handleSelectOption = (qId, optionIndex) => {
    setUserAnswers((prev) => {
      const existing = prev[qId] || {};
      const newAnswer = existing.user_answer === optionIndex ? null : optionIndex;
      const updated = {
        ...prev,
        [qId]: { ...existing, user_answer: newAnswer },
      };
      queueAutoSave(updated);
      return updated;
    });
  };

  // Toggle mark for review
  const handleToggleMarkReview = (qId) => {
    setUserAnswers((prev) => {
      const existing = prev[qId] || {};
      const updated = {
        ...prev,
        [qId]: { ...existing, is_marked_for_review: !existing.is_marked_for_review },
      };
      queueAutoSave(updated);
      return updated;
    });
  };

  // Clear answer for current question
  const handleClearAnswer = (qId) => {
    setUserAnswers((prev) => {
      const existing = prev[qId] || {};
      const updated = {
        ...prev,
        [qId]: { ...existing, user_answer: null },
      };
      queueAutoSave(updated);
      return updated;
    });
  };

  // Auto-submit when server/client timer reaches zero
  const handleAutoSubmitTimeout = async () => {
    if (submitting || !activeAttempt) return;
    addToast('Exam time expired! Submitting answers automatically...', 'info');
    await submitActiveAttempt();
  };

  // Final submission of active attempt
  const submitActiveAttempt = async () => {
    if (!activeAttempt) return;
    try {
      setSubmitting(true);
      setShowSubmitModal(false);

      const answersPayload = Object.entries(userAnswers).map(([qId, val]) => ({
        question_id: parseInt(qId, 10),
        user_answer: val.user_answer ?? null,
        is_marked_for_review: Boolean(val.is_marked_for_review),
        time_spent_seconds: 0,
      }));

      const res = await api.post(`/exams/attempts/${activeAttempt.id}/submit`, {
        answers: answersPayload,
      });

      setReviewData(res.data);
      setView('review');
      addToast(
        res.data.passed
          ? `Congratulations! You passed with ${res.data.percentage}%!`
          : `Exam finished. Scored ${res.data.percentage}%. Keep practicing!`,
        res.data.passed ? 'success' : 'info'
      );
      fetchExams();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit exam';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel and exit active exam attempt
  const handleCancelExam = async () => {
    if (!activeAttempt) return;
    try {
      setCancelling(true);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      await api.delete(`/exams/attempts/${activeAttempt.id}`);
      addToast('Examination attempt cancelled. Progress discarded.', 'info');
    } catch (err) {
      console.warn('Backend attempt cancel notice:', err);
      addToast('Exited examination.', 'info');
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
      setActiveAttempt(null);
      setUserAnswers({});
      setRemainingSeconds(null);
      setCurrentQIndex(0);
      setView('list');
      fetchExams();
    }
  };

  // View past review
  const handleViewPastReview = async (exam) => {
    try {
      setLoading(true);
      // Fetch user's latest completed attempt for this exam
      const examDetail = await api.get(`/exams/${exam.id}`);
      if (examDetail.data.attempts_count === 0) {
        addToast('No completed attempts for this exam yet.', 'info');
        return;
      }
      // Re-fetch start to find existing attempt or latest completed
      const startRes = await api.post(`/exams/${exam.id}/start`);
      if (['submitted', 'timed_out', 'graded'].includes(startRes.data.status)) {
        const rev = await api.get(`/exams/attempts/${startRes.data.id}/review`);
        setReviewData(rev.data);
        setView('review');
      } else {
        // Active attempt in progress, resume it
        setActiveAttempt(startRes.data);
        setRemainingSeconds(startRes.data.remaining_seconds);
        setView('active');
      }
    } catch (err) {
      addToast('Could not load exam review', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete an exam
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam? All attempt history will be permanently removed.')) return;
    try {
      await api.delete(`/exams/${examId}`);
      addToast('Exam deleted', 'success');
      fetchExams();
    } catch (err) {
      addToast('Failed to delete exam', 'error');
    }
  };

  // Schedule revision reminder
  const handleScheduleReminder = async (exam) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 2);
    defaultDate.setHours(10, 0, 0, 0);

    try {
      await api.post(`/exams/${exam.id}/remind?scheduled_at=${defaultDate.toISOString()}`);
      addToast(`Revision reminder scheduled for ${defaultDate.toLocaleDateString()}`, 'success');
    } catch (err) {
      addToast('Failed to schedule reminder', 'error');
    }
  };

  // Active question helpers
  const currentQuestion = useMemo(() => {
    if (!activeAttempt?.questions) return null;
    return activeAttempt.questions[currentQIndex] || null;
  }, [activeAttempt, currentQIndex]);

  const activeStats = useMemo(() => {
    if (!activeAttempt?.questions) return { answered: 0, marked: 0, unanswered: 0, total: 0 };
    const total = activeAttempt.questions.length;
    let answered = 0;
    let marked = 0;

    activeAttempt.questions.forEach((q) => {
      const state = userAnswers[q.id];
      if (state?.user_answer !== null && state?.user_answer !== undefined) answered++;
      if (state?.is_marked_for_review) marked++;
    });

    return { answered, marked, unanswered: total - answered, total };
  }, [activeAttempt, userAnswers]);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Review filtered questions
  const filteredReviewQuestions = useMemo(() => {
    if (!reviewData?.questions) return [];
    if (reviewFilter === 'mistakes') return reviewData.mistakes || [];
    if (reviewFilter === 'marked') return reviewData.questions.filter((q) => q.is_marked_for_review);
    return reviewData.questions;
  }, [reviewData, reviewFilter]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: EXAM LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                <Award size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Exams & Mock Assessments
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Evidence-grounded examinations to test true academic mastery and syllabus readiness.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 transition-all self-start sm:self-auto"
          >
            <Plus size={16} /> Create New Exam
          </button>
        </div>

        {/* Exam Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 dark:text-zinc-500">
            <Clock className="animate-spin mr-3" size={24} /> Loading exam bank...
          </div>
        ) : loadError && exams.length === 0 ? (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-rose-200/60 dark:border-rose-900/40 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              Unable to Load Exams
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              {loadError}
            </p>
            <button
              onClick={fetchExams}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <RotateCcw size={15} /> Retry Connection
            </button>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-dashed border-slate-300 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              No exams created yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              Generate your first source-grounded exam based on your uploaded notes, research papers, or syllabus documents.
            </p>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all"
            >
              <Plus size={16} /> Create First Exam
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {exams.map((exam) => {
              const modeMeta = MODE_METADATA[exam.exam_mode] || MODE_METADATA.practice;
              const diffClass = DIFFICULTY_METADATA[exam.difficulty] || DIFFICULTY_METADATA.intermediate;
              return (
                <motion.div
                  key={exam.id}
                  whileHover={{ y: -3 }}
                  className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${modeMeta.badge}`}>
                        {modeMeta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${diffClass}`}>
                        {exam.difficulty}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-800 dark:text-white line-clamp-1">
                        {exam.title}
                      </h3>
                      {exam.session_title && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          Source: {exam.session_title}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} className="text-indigo-500" />
                        <span>{exam.total_questions} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-amber-500" />
                        <span>{exam.duration_minutes} Mins</span>
                      </div>
                    </div>

                    {exam.best_score !== null && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-xs">
                        <span className="text-slate-500 dark:text-zinc-400 font-medium">Best Score:</span>
                        <span className={`font-black ${exam.best_score >= exam.passing_percentage ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {exam.best_score}% ({exam.best_score >= exam.passing_percentage ? 'Passed' : 'Needs Review'})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800/60">
                    <button
                      onClick={() => handleStartExam(exam.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
                    >
                      <Play size={13} /> {exam.attempts_count > 0 ? 'Retake Exam' : 'Start Exam'}
                    </button>
                    {exam.attempts_count > 0 && (
                      <button
                        onClick={() => handleViewPastReview(exam)}
                        title="View Last Results"
                        className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
                      >
                        <BarChart3 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleScheduleReminder(exam)}
                      title="Schedule Revision Reminder"
                      className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
                    >
                      <Bell size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      title="Delete Exam"
                      className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: EXAM SETUP VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Exam Bank
        </button>

        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Configure Source-Grounded Exam
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Select your study document and specify examination parameters. All questions are strictly grounded in your materials.
            </p>
          </div>

          <form onSubmit={handleCreateExam} className="space-y-5">
            {/* Source Document */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                1. Study Document Source *
              </label>
              {sessions.length === 0 ? (
                <p className="text-xs text-rose-500">No documents found. Please upload a document first in Study Space.</p>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value);
                    const s = sessions.find((item) => item.id === parseInt(e.target.value, 10));
                    if (s && !examTitle) {
                      setExamTitle(`${s.ai_title || s.filename} Examination`);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ai_title || s.filename} ({s.source_type?.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Exam Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                2. Exam Title *
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g., Midterm Mock: Relational DBMS & Normalization"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Exam Mode Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                3. Examination Mode *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(MODE_METADATA).map(([key, meta]) => {
                  const isSelected = examMode === key;
                  const isProLocked = (key === 'mock' || key === 'full_syllabus') && user?.plan === 'free' && !user?.is_admin;
                  return (
                    <div
                      key={key}
                      onClick={() => !isProLocked && setExamMode(key)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                      } ${isProLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-800 dark:text-white">
                          {meta.label}
                        </span>
                        {isProLocked ? (
                          <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            PRO
                          </span>
                        ) : isSelected ? (
                          <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {meta.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm focus:outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Questions ({numQuestions})
                </label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm focus:outline-none"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions (PRO)</option>
                  <option value={20}>20 Questions (PRO)</option>
                  <option value={30}>30 Questions (PREMIUM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Timer Limit
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-sm focus:outline-none"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={90}>90 Minutes</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all"
              >
                {creating ? (
                  <>
                    <Clock size={14} className="animate-spin" /> Grounding & Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Generate & Start Exam
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: ACTIVE EXAMINATION WORKSPACE
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'active' && activeAttempt && currentQuestion) {
    const qState = userAnswers[currentQuestion.id] || {};
    const selectedOptionIndex = qState.user_answer;
    const isMarked = qState.is_marked_for_review;

    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Top Control Bar */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-indigo-600 text-white">
              {activeAttempt.exam_mode}
            </span>
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-1">
                {activeAttempt.exam_title}
              </h2>
              <p className="text-[11px] text-slate-400">
                Question {currentQIndex + 1} of {activeAttempt.total_questions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-end">
            {/* Countdown Timer */}
            {remainingSeconds !== null && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                  remainingSeconds < 180
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                }`}
              >
                <Timer size={14} />
                <span>{formatTime(remainingSeconds)}</span>
              </div>
            )}

            {/* Cancel / Exit Exam Button */}
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200/90 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-bold text-xs transition-colors shadow-xs"
              title="Cancel and exit this examination"
            >
              <LogOut size={13} />
              <span>Exit Exam</span>
            </button>

            {/* Finish & Submit Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              Finish & Submit
            </button>
          </div>
        </div>

        {/* Main Workspace Grid: Question Card + Navigator Palette */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Card (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Question {currentQIndex + 1}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                    {currentQuestion.topic}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleMarkReview(currentQuestion.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    isMarked
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-transparent'
                  }`}
                >
                  <Bookmark size={14} className={isMarked ? 'fill-amber-500 text-amber-500' : ''} />
                  <span>{isMarked ? 'Marked for Review' : 'Mark for Review'}</span>
                </button>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-zinc-100 leading-relaxed">
                {currentQuestion.question_text}
              </div>

              {/* Options Radio List */}
              <div className="space-y-3 pt-2" role="radiogroup" aria-label="Question options">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOptionIndex === idx;
                  const label = OPTION_LABELS[idx] || String(idx + 1);

                  return (
                    <div
                      key={idx}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => handleSelectOption(currentQuestion.id, idx)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          handleSelectOption(currentQuestion.id, idx);
                        }
                      }}
                      className={`flex items-center gap-3.5 p-4 rounded-2xl border text-sm cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/20 text-slate-900 dark:text-white shadow-sm ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-200'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {label}
                      </div>
                      <span className="flex-1 font-normal leading-relaxed">{opt}</span>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-zinc-800">
                <button
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400 disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft size={14} /> Previous
                </button>

                {selectedOptionIndex !== null && selectedOptionIndex !== undefined && (
                  <button
                    onClick={() => handleClearAnswer(currentQuestion.id)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    Clear Selection
                  </button>
                )}

                <button
                  onClick={() =>
                    setCurrentQIndex((prev) =>
                      Math.min(activeAttempt.total_questions - 1, prev + 1)
                    )
                  }
                  disabled={currentQIndex === activeAttempt.total_questions - 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-black text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-30 transition-colors"
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Question Palette (1 col) */}
          <div className="space-y-4">
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Question Navigator
              </h3>

              {/* Status Counters */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
                <div className="px-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex flex-col items-center justify-center min-w-0">
                  <span className="text-sm font-black leading-none mb-1">{activeStats.answered}</span>
                  <span className="text-[10px] font-semibold leading-tight tracking-tight truncate max-w-full">Answered</span>
                </div>
                <div className="px-1 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex flex-col items-center justify-center min-w-0">
                  <span className="text-sm font-black leading-none mb-1">{activeStats.marked}</span>
                  <span className="text-[10px] font-semibold leading-tight tracking-tight truncate max-w-full">Marked</span>
                </div>
                <div className="px-1 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-transparent flex flex-col items-center justify-center min-w-0">
                  <span className="text-sm font-black leading-none mb-1">{activeStats.unanswered}</span>
                  <span className="text-[10px] font-semibold leading-tight tracking-tight truncate max-w-full">Left</span>
                </div>
              </div>

              {/* Palette Buttons Grid */}
              <div className="grid grid-cols-5 gap-2 pt-2">
                {activeAttempt.questions.map((q, idx) => {
                  const state = userAnswers[q.id] || {};
                  const isAns = state.user_answer !== null && state.user_answer !== undefined;
                  const isMrk = state.is_marked_for_review;
                  const isCur = idx === currentQIndex;

                  let style = 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-transparent';
                  if (isCur) {
                    style = 'ring-2 ring-indigo-500 border-indigo-500 font-black';
                  }
                  if (isMrk) {
                    style += ' bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40';
                  } else if (isAns) {
                    style += ' bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${style}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Marked for review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                  <span>Unanswered</span>
                </div>
              </div>

              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all mt-2"
              >
                Submit Examination
              </button>

              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full py-2 rounded-xl text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut size={13} />
                <span>Cancel & Exit Exam</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pre-Submit Confirmation Modal */}
        <AnimatePresence>
          {showSubmitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Submit Exam Confirmation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Once submitted, your responses will be locked and graded deterministically.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Answered Questions:</span>
                    <span className="font-bold text-emerald-600">{activeStats.answered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Marked for Review:</span>
                    <span className="font-bold text-amber-500">{activeStats.marked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unanswered Questions:</span>
                    <span className="font-bold text-rose-500">{activeStats.unanswered}</span>
                  </div>
                </div>

                {activeStats.unanswered > 0 && (
                  <p className="text-xs text-rose-500 font-medium">
                    ⚠️ You have {activeStats.unanswered} unanswered question(s). Unanswered questions count as zero.
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400"
                  >
                    Continue Exam
                  </button>
                  <button
                    onClick={submitActiveAttempt}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Grading...' : 'Yes, Submit Final'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Cancel / Exit Exam Confirmation Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <ShieldAlert size={24} />
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Cancel & Exit Examination?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Are you sure you want to exit? Your responses will not be graded, and this examination attempt will be discarded.
                  </p>
                </div>

                <div className="bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl p-4 text-xs space-y-1.5 text-rose-700 dark:text-rose-300">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                    Progress will be discarded
                  </p>
                  <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90">
                    You have answered {activeStats.answered} of {activeAttempt.total_questions} question{activeAttempt.total_questions !== 1 ? 's' : ''}. You can restart this exam fresh anytime from your exam bank.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelling}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Resume Exam
                  </button>
                  <button
                    onClick={handleCancelExam}
                    disabled={cancelling}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {cancelling ? 'Exiting...' : 'Discard & Exit'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: RESULTS & IN-DEPTH REVIEW VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'review' && reviewData) {
    const isPass = reviewData.passed;

    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Review Header Banner */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Exam Bank
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartExam(reviewData.exam_id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <RotateCcw size={13} /> Retake Exam
            </button>
          </div>
        </div>

        {/* Scorecard Hero */}
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                  isPass
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPass ? 'Examination Passed' : 'Needs Review'}
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {reviewData.exam_title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Completed on {new Date(reviewData.completed_at || Date.now()).toLocaleString()}
              </p>
            </div>

            {/* Score Ring / Badge */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div
                  className={`text-4xl sm:text-5xl font-black ${
                    isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {reviewData.percentage}%
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {reviewData.score} of {reviewData.total_questions} Correct
                </span>
              </div>
            </div>
          </div>

          {/* Topic Performance Bars */}
          {reviewData.topic_scores && Object.keys(reviewData.topic_scores).length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Topic Mastery Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(reviewData.topic_scores).map(([topic, stats]) => (
                  <div key={topic} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                      <span>{topic}</span>
                      <span>
                        {stats.correct}/{stats.total} ({stats.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stats.percentage >= 70 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Next Actions */}
          {reviewData.recommended_actions?.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles size={14} /> Evidence-Based Next Steps
              </h4>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-zinc-300">
                {reviewData.recommended_actions.map((act, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Question Review Section with Filter Pills */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Question-by-Question Audit
            </h3>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  reviewFilter === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                All ({reviewData.questions.length})
              </button>
              <button
                onClick={() => setReviewFilter('mistakes')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  reviewFilter === 'mistakes'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                Mistakes ({reviewData.mistakes.length})
              </button>
              <button
                onClick={() => setReviewFilter('marked')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  reviewFilter === 'marked'
                    ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                Marked
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredReviewQuestions.map((q) => {
              const isCorrect = q.is_correct;
              const hasAnswered = q.user_answer !== null && q.user_answer !== undefined;

              return (
                <div
                  key={q.id}
                  className={`bg-white/90 dark:bg-zinc-900/90 border rounded-2xl p-6 shadow-xs space-y-4 ${
                    isCorrect
                      ? 'border-emerald-500/20'
                      : 'border-rose-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">
                        #{q.question_order}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {q.topic}
                      </span>
                    </div>

                    <span
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black ${
                        isCorrect
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 size={13} /> Correct (+1)
                        </>
                      ) : (
                        <>
                          <XCircle size={13} /> {hasAnswered ? 'Incorrect (0)' : 'Unanswered (0)'}
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-base font-semibold text-slate-800 dark:text-zinc-100">
                    {q.question_text}
                  </p>

                  {/* Options with Answer Highlights */}
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const isOptionCorrect = q.correct_answer === optIdx;
                      const isOptionSelected = q.user_answer === optIdx;

                      let optClass = 'border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300';
                      if (isOptionCorrect) {
                        optClass = 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-medium';
                      } else if (isOptionSelected && !isOptionCorrect) {
                        optClass = 'border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 line-through';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs ${optClass}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold bg-black/5 dark:bg-white/5">
                              {OPTION_LABELS[optIdx]}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isOptionCorrect && (
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Correct Answer</span>
                          )}
                          {isOptionSelected && !isOptionCorrect && (
                            <span className="text-[10px] font-bold text-rose-600 uppercase">Your Answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & Source Provenance */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                      <HelpCircle size={13} />
                      <span>Explanation & Grounding</span>
                      {q.page_number !== null && q.page_number !== undefined && (
                        <span className="ml-auto text-[10px] text-slate-400">
                          [Page {q.page_number}]
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>

                  {!isCorrect && (
                    <button
                      onClick={() => {
                        setSelectedMistakeQuestion({
                          question_text: q.question_text,
                          options: q.options || [],
                          user_answer: q.user_answer !== null && q.user_answer !== undefined && q.options ? q.options[q.user_answer] : 'Unanswered',
                          correct_answer: q.options && q.options[q.correct_answer] !== undefined ? q.options[q.correct_answer] : String(q.correct_answer),
                          topic: q.topic || reviewData?.exam_title || 'General',
                          session_id: reviewData?.session_id,
                          difficulty: 'intermediate',
                          page_number: q.page_number,
                          source_type: 'exam',
                          source_id: reviewData?.attempt_id
                        });
                        setShowMistakeModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-500/20 transition-all cursor-pointer w-fit"
                    >
                      <Brain size={13} />
                      <span>Debug Mistake (Metacognitive Debugger)</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metacognitive Debugger Modal */}
        <MetacognitiveDebuggerModal
          isOpen={showMistakeModal}
          onClose={() => {
            setShowMistakeModal(false);
            setSelectedMistakeQuestion(null);
          }}
          questionData={selectedMistakeQuestion}
        />
      </div>
    );
  }

  return null;
}
