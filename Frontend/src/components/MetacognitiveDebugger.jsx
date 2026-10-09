import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, AlertCircle, CheckCircle2, XCircle, RotateCcw,
  Sparkles, Calendar, Bell, HelpCircle, BookOpen, Filter,
  Layers, ArrowRight, X, ChevronDown, ChevronUp, Check,
  AlertTriangle, Lightbulb, ShieldAlert, Award, Trash2, Loader2,
  Database, RefreshCw
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export const CATEGORY_BADGES = {
  CONCEPTUAL_MISUNDERSTANDING: {
    label: 'Conceptual Misunderstanding',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    desc: 'Fundamental flaw in theoretical comprehension or core definitions.'
  },
  PARTIAL_UNDERSTANDING: {
    label: 'Partial Understanding',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    desc: 'Grasps primary idea but misses specific nuances, boundaries, or constraints.'
  },
  PROCEDURAL_ERROR: {
    label: 'Procedural Error',
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    desc: 'Erred in executing a sequence of steps, algorithm, or methodology.'
  },
  CALCULATION_ERROR: {
    label: 'Calculation Error',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    desc: 'Mathematical, numerical, or indexing arithmetic slip.'
  },
  CARELESS_ERROR: {
    label: 'Careless Error',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Hasty option selection or overlooked obvious contextual cues.'
  },
  MISREAD_QUESTION: {
    label: 'Misread Question',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    desc: 'Misinterpreted prompt wording (e.g., overlooked NOT, EXCEPT, or FALSE).'
  },
  MEMORY_RECALL_FAILURE: {
    label: 'Memory Recall Failure',
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    desc: 'Inability to retrieve memorized facts, terms, or standard nomenclature.'
  },
  PREREQUISITE_GAP: {
    label: 'Prerequisite Gap',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'Lacks necessary foundational knowledge required to understand this topic.'
  },
  CONFUSION_BETWEEN_CONCEPTS: {
    label: 'Confusion Between Concepts',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    desc: 'Conflated two distinct but related concepts.'
  },
  INCORRECT_APPLICATION: {
    label: 'Incorrect Application',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    desc: 'Understood theory correctly but applied it to an improper context.'
  },
  UNKNOWN: {
    label: 'Unclassified Error',
    color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    desc: 'General discrepancy requiring further diagnostic context.'
  },
  // Legacy aliases
  MISCONCEPTION: {
    label: 'Conceptual Misunderstanding',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    desc: 'Fundamental flaw in theoretical comprehension or core definitions.'
  },
  FORMULA_MISAPPLICATION: {
    label: 'Incorrect Application',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    desc: 'Understood theory correctly but applied it to an improper context.'
  },
  QUESTION_MISREAD: {
    label: 'Misread Question',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    desc: 'Misinterpreted prompt wording (e.g., overlooked NOT, EXCEPT, or FALSE).'
  },
  RETRIEVAL_FAILURE: {
    label: 'Memory Recall Failure',
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    desc: 'Inability to retrieve memorized facts, terms, or standard nomenclature.'
  }
};

export const PATTERN_BADGES = {
  ISOLATED: {
    label: 'Isolated Slip',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    desc: 'First recorded mistake on this topic.'
  },
  RECURRING: {
    label: 'Recurring (2x)',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Multiple slips recorded on this concept.'
  },
  PERSISTENT: {
    label: 'Persistent Blocker (3+)',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    desc: '3+ consecutive errors; targeted remediation needed.'
  },
  IMPROVING: {
    label: 'Improving Mastery',
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    desc: 'Scored well on recent targeted practice.'
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Misconception verified as cleared.'
  }
};

/**
 * Interactive Modal for Diagnosing a Specific Question's Mistake
 */
export function MetacognitiveDebuggerModal({
  isOpen,
  onClose,
  questionData, // { question_text, user_answer, correct_answer, options, topic, subtopic, session_id, difficulty, page_number }
  existingMistake,
  onMistakeUpdated
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(existingMistake || null);

  // Practice state
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceData, setPracticeData] = useState(null);
  const [userPracticeAnswers, setUserPracticeAnswers] = useState({});
  const [submittingPractice, setSubmittingPractice] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

  // Planner & Reminder actions
  const [actionLoading, setActionLoading] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAnalysis(null);
      setPracticeData(null);
      setPracticeResult(null);
      setUserPracticeAnswers({});
      setShowReminderPicker(false);
      return;
    }

    if (existingMistake) {
      setAnalysis(existingMistake);
      return;
    }

    if (questionData && !analysis) {
      handleAnalyzeFresh();
    }
  }, [isOpen, existingMistake, questionData]);

  const handleAnalyzeFresh = async () => {
    setLoading(true);
    try {
      const res = await api.post('/mistakes/analyze', {
        question_text: questionData.question_text || questionData.question,
        options: questionData.options || [],
        user_answer: questionData.user_answer,
        correct_answer: questionData.correct_answer,
        topic: questionData.topic || 'General',
        subtopic: questionData.subtopic || questionData.section_heading,
        difficulty: questionData.difficulty || 'intermediate',
        session_id: questionData.session_id,
        page_number: questionData.page_number,
        source_type: questionData.source_type || 'quiz',
        source_id: questionData.source_id,
        persist: true
      });
      setAnalysis(res.data);
      if (onMistakeUpdated) onMistakeUpdated(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to analyze mistake';
      addToast(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPractice = async () => {
    if (!analysis?.id) return;
    setPracticeLoading(true);
    setPracticeResult(null);
    setUserPracticeAnswers({});
    try {
      const res = await api.post(`/mistakes/${analysis.id}/practice`, {
        num_questions: 3
      });
      setPracticeData(res.data);
      addToast('Generated targeted practice questions', 'success');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not generate practice questions';
      addToast(detail, 'error');
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleSelectPracticeOption = (questionOrder, optionIndex) => {
    setUserPracticeAnswers(prev => ({
      ...prev,
      [questionOrder]: optionIndex
    }));
  };

  const handleSubmitPractice = async () => {
    if (!practiceData || !analysis?.id) return;
    const answersPayload = practiceData.questions.map(q => ({
      question_order: q.question_order,
      user_answer: userPracticeAnswers[q.question_order] !== undefined ? userPracticeAnswers[q.question_order] : -1
    }));

    setSubmittingPractice(true);
    try {
      const res = await api.post(`/mistakes/${analysis.id}/practice/submit`, {
        answers: answersPayload
      });
      setPracticeResult(res.data);
      setAnalysis(prev => prev ? {
        ...prev,
        pattern_state: res.data.pattern_state,
        is_resolved: res.data.is_resolved
      } : prev);
      if (onMistakeUpdated) {
        onMistakeUpdated({
          ...analysis,
          pattern_state: res.data.pattern_state,
          is_resolved: res.data.is_resolved
        });
      }
      addToast(res.data.feedback, res.data.passed ? 'success' : 'info');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to submit practice', 'error');
    } finally {
      setSubmittingPractice(false);
    }
  };

  const handleAddToPlan = async () => {
    if (!analysis?.id) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/mistakes/${analysis.id}/plan`);
      addToast('Scheduled targeted review task in your Study Plan!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to schedule planner task', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleReminder = async () => {
    if (!analysis?.id || !reminderDate) {
      addToast('Please select a reminder date and time', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const isoStr = new Date(reminderDate).toISOString();
      await api.post(`/mistakes/${analysis.id}/remind?scheduled_at=${encodeURIComponent(isoStr)}`);
      addToast('Revision reminder scheduled successfully!', 'success');
      setShowReminderPicker(false);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to schedule reminder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveManual = async () => {
    if (!analysis?.id) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/mistakes/${analysis.id}/resolve`);
      setAnalysis(res.data);
      if (onMistakeUpdated) onMistakeUpdated(res.data);
      addToast('Mistake marked as resolved!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to mark as resolved', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const catMeta = analysis ? (CATEGORY_BADGES[analysis.error_category] || CATEGORY_BADGES.UNKNOWN) : CATEGORY_BADGES.UNKNOWN;
  const patMeta = analysis ? (PATTERN_BADGES[analysis.pattern_state] || PATTERN_BADGES.ISOLATED) : PATTERN_BADGES.ISOLATED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl my-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Brain size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Metacognitive Debugger
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                  Intelligence
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Grounded cognitive diagnostics & misconception remediation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Analyzing cognitive failure mode and retrieving verified citations...
              </p>
              <p className="text-xs text-slate-400">
                Classifying against the 10-tier misconception taxonomy
              </p>
            </div>
          ) : analysis ? (
            <>
              {/* Question & Context Header */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-800/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Topic:</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                      {analysis.topic}
                    </span>
                    {analysis.subtopic && (
                      <span className="text-xs text-slate-400 font-medium">
                        / {analysis.subtopic}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${catMeta.color}`}>
                      {catMeta.label}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${patMeta.color}`}>
                      Pattern: {patMeta.label}
                    </span>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                  {analysis.question_text}
                </p>

                <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                    <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5">Your Submission</div>
                    <div className="font-semibold line-through">{analysis.user_answer}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5">Verified Correct</div>
                    <div className="font-semibold">{analysis.correct_answer}</div>
                  </div>
                </div>
              </div>

              {/* Diagnosis Grid */}
              <div className="grid gap-4">
                {/* Misconception Card */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} />
                    <span>Diagnosed Mental Model Flaw</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed font-medium">
                    {analysis.misconception || 'Misapplication of foundational rule under these conditions.'}
                  </p>
                </div>

                {/* Why Incorrect & Correct Reasoning */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-800 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      <XCircle size={14} />
                      <span>Why Your Answer Was Incorrect</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                      {analysis.why_incorrect}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-800 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} />
                      <span>Correct Step-by-Step Reasoning</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                      {analysis.correct_reasoning}
                    </p>
                  </div>
                </div>

                {/* Prerequisite Concept Alert if detected */}
                {analysis.prerequisite_concept && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-indigo-900 dark:text-indigo-300">
                        Prerequisite Gap Detected:
                      </span>
                      <p className="text-indigo-800 dark:text-indigo-200 leading-relaxed">
                        To master this concept reliably, strengthen foundational grasp of <strong className="font-black text-indigo-600 dark:text-indigo-400">{analysis.prerequisite_concept}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grounded Citations & Sources */}
                {analysis.citations && analysis.citations.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-400">
                      <BookOpen size={14} />
                      <span>Grounded Citations from Source Material ({analysis.citations.length})</span>
                    </div>
                    <div className="space-y-2 pt-1">
                      {analysis.citations.map((c, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            <span>{c.section_heading || 'Section Concept'}</span>
                            {c.page_number && <span>Page {c.page_number}</span>}
                          </div>
                          {c.snippet && <p className="italic text-slate-500 dark:text-zinc-400 font-serif">"{c.snippet}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Targeted Practice Section */}
              {practiceData ? (
                <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-600" />
                        Targeted Remediation Practice
                      </h3>
                      <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                        Solve these focused questions to clear the identified misconception.
                      </p>
                    </div>
                    <button
                      onClick={() => setPracticeData(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Close Practice
                    </button>
                  </div>

                  {practiceResult ? (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-black ${practiceResult.passed ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {practiceResult.percentage}%
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {practiceResult.passed ? 'Misconception Overcome!' : 'Needs More Practice'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {practiceResult.score} of {practiceResult.total_questions} questions correct
                            </div>
                          </div>
                        </div>

                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${practiceResult.passed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                          Status: {practiceResult.pattern_state}
                        </span>
                      </div>

                      <div className="space-y-3 pt-2">
                        {practiceResult.graded_questions.map((gq, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                              gq.is_correct
                                ? 'bg-emerald-50/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                                : 'bg-rose-50/30 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>Q{gq.question_order}: {gq.question_text}</span>
                              <span>{gq.is_correct ? '✓ Correct' : '✗ Incorrect'}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-zinc-300">
                              {gq.explanation}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleStartPractice}
                        disabled={practiceLoading}
                        className="w-full py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-black transition-all"
                      >
                        Try New Practice Set
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {practiceData.questions.map((q) => (
                        <div key={q.question_order} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            <span className="text-indigo-600 mr-1.5">Q{q.question_order}.</span>
                            {q.question_text}
                          </p>

                          <div className="grid gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = userPracticeAnswers[q.question_order] === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectPracticeOption(q.question_order, optIdx)}
                                  className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-semibold'
                                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-700 dark:text-zinc-300'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleSubmitPractice}
                        disabled={submittingPractice}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingPractice ? 'Grading & Updating Mastery...' : 'Submit Practice & Check Progress'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Action Buttons Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  {!practiceData && (
                    <button
                      onClick={handleStartPractice}
                      disabled={practiceLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
                    >
                      <Sparkles size={14} />
                      {practiceLoading ? 'Generating Practice...' : 'Targeted Practice'}
                    </button>
                  )}

                  <button
                    onClick={handleAddToPlan}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                  >
                    <Calendar size={13} />
                    Add to Study Plan
                  </button>

                  <button
                    onClick={() => setShowReminderPicker(prev => !prev)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                  >
                    <Bell size={13} />
                    Remind Me
                  </button>
                </div>

                {!analysis.is_resolved && (
                  <button
                    onClick={handleResolveManual}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-all"
                  >
                    <CheckCircle2 size={14} />
                    Mark Resolved
                  </button>
                )}
              </div>

              {/* Inline Reminder Date Picker */}
              {showReminderPicker && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                  <input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-800 dark:text-zinc-200"
                  />
                  <button
                    onClick={handleScheduleReminder}
                    disabled={actionLoading || !reminderDate}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 text-xs font-bold disabled:opacity-50"
                  >
                    Set Revision Reminder
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No diagnostic data available.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Dedicated Mistake Intelligence & Metacognitive Debugger Tab Workspace
 */
export default function MetacognitiveDebugger({ user }) {
  const { addToast } = useToast();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'resolved'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');

  // Modal inspection state
  const [activeModalMistake, setActiveModalMistake] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMistakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/mistakes');
      setMistakes(res.data);
    } catch (err) {
      if (err.response?.status === 401) return;
      addToast('Failed to load tracked mistakes', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

  // Derived filter options
  const topics = useMemo(() => {
    const set = new Set();
    mistakes.forEach(m => { if (m.topic) set.add(m.topic); });
    return Array.from(set);
  }, [mistakes]);

  const filteredMistakes = useMemo(() => {
    return mistakes.filter(m => {
      if (statusFilter === 'active' && m.is_resolved) return false;
      if (statusFilter === 'resolved' && !m.is_resolved) return false;
      if (categoryFilter !== 'all' && m.error_category !== categoryFilter) return false;
      if (selectedTopic !== 'all' && m.topic !== selectedTopic) return false;
      return true;
    });
  }, [mistakes, statusFilter, categoryFilter, selectedTopic]);

  // Metrics
  const stats = useMemo(() => {
    const total = mistakes.length;
    const resolved = mistakes.filter(m => m.is_resolved).length;
    const recurring = mistakes.filter(m => !m.is_resolved && (m.pattern_state === 'RECURRING' || m.pattern_state === 'PERSISTENT')).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, recurring, resolutionRate };
  }, [mistakes]);

  const handleSyncMistakes = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/mistakes/sync-from-history');
      addToast(res.data.message || `Synced ${res.data.synced_count} mistake(s)!`, 'success');
      await fetchMistakes();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to sync past mistakes', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      const res = await api.post('/mistakes/seed-sample');
      addToast('Sample diagnostic seeded! Opening Metacognitive Debugger...', 'success');
      await fetchMistakes();
      setActiveModalMistake(res.data);
      setIsModalOpen(true);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to seed sample mistake', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickResolve = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/mistakes/${id}/resolve`);
      setMistakes(prev => prev.map(m => m.id === id ? res.data : m));
      addToast('Mistake marked as resolved!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to mark as resolved', 'error');
    }
  };

  const handleDeleteMistake = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this mistake record?')) return;
    try {
      await api.delete(`/mistakes/${id}`);
      setMistakes(prev => prev.filter(m => m.id !== id));
      addToast('Mistake record deleted', 'success');
    } catch {
      addToast('Failed to delete mistake record', 'error');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Mistake Intelligence Bank
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Metacognitive Debugger
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Track underlying misconceptions, eliminate recurring cognitive blockers, and verify mastery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncMistakes}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            title="Import errors from past quizzes and exams"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
            <span>Sync Past Quizzes</span>
          </button>

          <button
            onClick={fetchMistakes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tracked Errors</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</div>
        </div>

        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Resolved</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.resolved}</div>
        </div>

        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Active Blockers</div>
          <div className="text-2xl font-black text-amber-500 mt-1">{stats.recurring}</div>
        </div>

        <div className="bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Recovery Rate</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{stats.resolutionRate}%</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 dark:bg-zinc-900/80 p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
            }`}
          >
            All Errors
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'active'
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
            }`}
          >
            Needs Practice ({stats.total - stats.resolved})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'resolved'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
            }`}
          >
            Resolved ({stats.resolved})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {topics.length > 0 && (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-medium"
            >
              <option value="all">All Topics</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-medium"
          >
            <option value="all">All Taxonomies</option>
            {Object.entries(CATEGORY_BADGES)
              .filter(([k]) => !['MISCONCEPTION', 'FORMULA_MISAPPLICATION', 'QUESTION_MISREAD', 'RETRIEVAL_FAILURE'].includes(k))
              .map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Mistake Cards List */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading mistake intelligence records...</p>
        </div>
      ) : filteredMistakes.length === 0 ? (
        <div className="p-10 md:p-14 text-center rounded-3xl bg-white/70 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 space-y-5 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Brain size={28} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">
              {statusFilter === 'active' ? 'No active cognitive blockers!' : 'No mistakes recorded yet.'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every quiz and exam mistake is automatically tracked, classified against 11 pedagogical failure modes, and turned into targeted practice.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleSyncMistakes}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              <span>Sync from Past Quizzes & Exams</span>
            </button>

            <button
              onClick={handleSeedSample}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs border border-slate-200 dark:border-zinc-700 shadow-xs transition-all disabled:opacity-50"
            >
              {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-500" />}
              <span>Try Diagnostic Sample Demo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMistakes.map(m => {
            const catMeta = CATEGORY_BADGES[m.error_category] || CATEGORY_BADGES.UNKNOWN;
            const patMeta = PATTERN_BADGES[m.pattern_state] || PATTERN_BADGES.ISOLATED;

            return (
              <div
                key={m.id}
                onClick={() => {
                  setActiveModalMistake(m);
                  setIsModalOpen(true);
                }}
                className="p-5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer shadow-xs transition-all space-y-3 group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                      {m.topic}
                    </span>
                    {m.subtopic && (
                      <span className="text-xs text-slate-400">/ {m.subtopic}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${catMeta.color}`}>
                      {catMeta.label}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${patMeta.color}`}>
                      {patMeta.label}
                    </span>
                    {m.is_resolved ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                        ✓ Resolved
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleQuickResolve(m.id, e)}
                        title="Mark as Resolved"
                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2 py-0.5 rounded-md transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteMistake(m.id, e)}
                      title="Delete Mistake Record"
                      className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {m.question_text}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-4">
                    <span>
                      Submitted: <strong className="text-rose-600 line-through">{m.user_answer}</strong>
                    </span>
                    <span>
                      Correct: <strong className="text-emerald-600">{m.correct_answer}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {m.citations && m.citations.length > 0 && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <BookOpen size={12} /> {m.citations.length} cited
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Debug & Practice</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspector / Remediation Modal */}
      <MetacognitiveDebuggerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveModalMistake(null);
        }}
        existingMistake={activeModalMistake}
        onMistakeUpdated={(updated) => {
          setMistakes(prev => prev.map(m => m.id === updated.id ? updated : m));
          setActiveModalMistake(updated);
        }}
      />
    </div>
  );
}
