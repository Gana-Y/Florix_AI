import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, CheckCircle2, Circle, Clock, Flame, AlertCircle,
  Plus, RefreshCw, Trash2, ChevronDown, ChevronRight, Sparkles,
  BookOpen, Layers, Target, Check, Bell, SkipForward, ArrowRight,
  Filter, CalendarCheck, HelpCircle, AlertTriangle, ShieldAlert,
  Edit3, ExternalLink
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

// Priority styling helper
const PRIORITY_THEMES = {
  critical: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  high: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  medium: {
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    bar: 'bg-indigo-500',
    dot: 'bg-indigo-500',
  },
  low: {
    badge: 'bg-slate-500/10 text-slate-600 dark:text-zinc-400 border border-slate-500/20',
    bar: 'bg-slate-400 dark:bg-zinc-600',
    dot: 'bg-slate-400 dark:bg-zinc-600',
  },
};

// Task type visual metadata
const TASK_TYPE_META = {
  study_topic: {
    label: 'Deep Study',
    icon: BookOpen,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  review_flashcards: {
    label: 'SM-2 Revision',
    icon: Layers,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  practice_quiz: {
    label: 'Quiz Practice',
    icon: CheckCircle2,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  explore_visual: {
    label: 'Visual Map',
    icon: Sparkles,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  custom: {
    label: 'Custom Task',
    icon: Target,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
};

const MODE_LABELS = {
  daily: { title: 'Daily Focus', desc: 'Prioritized schedule for today' },
  weekly: { title: 'Weekly Roadmap', desc: 'Balanced 7-day learning trajectory' },
  exam: { title: 'Exam Preparation', desc: 'Spaced coverage with final review' },
  goal: { title: 'Goal-Oriented', desc: 'Focused study on specific topics' },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdaptiveStudyPlanner({ onOpenSession, user }) {
  const { addToast } = useToast();

  // State
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adapting, setAdapting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, completed
  const [expandedReasons, setExpandedReasons] = useState(new Set());
  const [sessions, setSessions] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Create Plan Form State
  const [createMode, setCreateMode] = useState('weekly');
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createMinutes, setCreateMinutes] = useState(60);
  const [createTargetDate, setCreateTargetDate] = useState('');
  const [createPreferredDays, setCreatePreferredDays] = useState([0, 1, 2, 3, 4]); // Mon-Fri
  const [createFocusTopics, setCreateFocusTopics] = useState('');
  const [createAutoReminders, setCreateAutoReminders] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // Add Custom Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState('study_topic');
  const [taskMinutes, setTaskMinutes] = useState(25);
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDate, setTaskDate] = useState('');
  const [taskSessionId, setTaskSessionId] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Fetch plans
  const fetchPlans = useCallback(async (selectId = null) => {
    try {
      setLoading(true);
      const res = await api.get('/study-plans');
      const list = res.data || [];
      setPlans(list);
      if (selectId) {
        setActivePlanId(selectId);
      } else if (list.length > 0 && !activePlanId) {
        setActivePlanId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load study plans:', err);
      addToast('Failed to load study plans', 'error');
    } finally {
      setLoading(false);
    }
  }, [activePlanId, addToast]);

  // Fetch library sessions for session linkage
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/library');
      setSessions(res.data?.files || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchSessions();
  }, [fetchPlans, fetchSessions]);

  // Active plan object
  const activePlan = useMemo(() => {
    return plans.find((p) => p.id === activePlanId) || null;
  }, [plans, activePlanId]);

  // Filtered and grouped tasks
  const filteredTasks = useMemo(() => {
    if (!activePlan || !activePlan.tasks) return [];
    let list = [...activePlan.tasks];

    if (statusFilter === 'pending') {
      list = list.filter((t) => t.status === 'pending' || t.status === 'rescheduled');
    } else if (statusFilter === 'completed') {
      list = list.filter((t) => t.status === 'completed');
    }

    return list;
  }, [activePlan, statusFilter]);

  // Group tasks by scheduled date
  const groupedTasks = useMemo(() => {
    const groups = {};
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    filteredTasks.forEach((t) => {
      let key = 'Unscheduled';
      if (t.scheduled_date) {
        const dStr = t.scheduled_date.slice(0, 10);
        if (dStr === todayStr) key = 'Today';
        else if (dStr === tomorrowStr) key = 'Tomorrow';
        else if (dStr < todayStr && t.status !== 'completed') key = 'Overdue / Rescheduled';
        else key = new Date(t.scheduled_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    return groups;
  }, [filteredTasks]);

  // Toggle reason accordion
  const toggleReason = (taskId) => {
    setExpandedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Actions
  const handleCompleteTask = async (taskId) => {
    try {
      await api.post(`/study-plans/tasks/${taskId}/complete`);
      addToast('Task marked as completed! 🎯', 'success');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to complete task', 'error');
    }
  };

  const handleSkipTask = async (taskId) => {
    try {
      await api.post(`/study-plans/tasks/${taskId}/skip`);
      addToast('Task skipped and rescheduled to tomorrow 📅', 'info');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to skip task', 'error');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task from your plan?')) return;
    try {
      await api.delete(`/study-plans/tasks/${taskId}`);
      addToast('Task removed', 'info');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast('Failed to delete task', 'error');
    }
  };

  const handleRemindTask = async (taskId) => {
    try {
      await api.post(`/study-plans/tasks/${taskId}/remind`);
      addToast('Reminder scheduled for this study task 🔔', 'success');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to schedule reminder', 'error');
    }
  };

  const handleAdaptPlan = async () => {
    if (!activePlanId) return;
    try {
      setAdapting(true);
      const res = await api.post(`/study-plans/${activePlanId}/adapt`);
      const msg = res.data?.message || 'Plan successfully adapted!';
      addToast(msg, 'success');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to adapt plan', 'error');
    } finally {
      setAdapting(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this study plan? All tasks will be removed.')) return;
    try {
      await api.delete(`/study-plans/${planId}`);
      addToast('Study plan deleted', 'info');
      setActivePlanId(null);
      await fetchPlans();
    } catch (err) {
      addToast('Failed to delete study plan', 'error');
    }
  };

  // Create Plan Submit
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setSubmittingPlan(true);
    try {
      const payload = {
        mode: createMode,
        title: createTitle.trim() || undefined,
        description: createDesc.trim() || undefined,
        daily_available_minutes: Number(createMinutes),
        target_date: createTargetDate ? new Date(createTargetDate).toISOString() : undefined,
        preferred_days: createPreferredDays,
        focus_topics: createFocusTopics
          ? createFocusTopics.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        auto_reminders: createAutoReminders,
      };

      const res = await api.post('/study-plans', payload);
      addToast('Study Plan generated with smart recommendations! 🚀', 'success');
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateFocusTopics('');
      await fetchPlans(res.data.id);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to generate plan';
      addToast(detail, 'error');
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Add Custom Task Submit
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activePlanId) return;
    setSubmittingTask(true);
    try {
      const payload = {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        task_type: taskType,
        estimated_minutes: Number(taskMinutes),
        priority: taskPriority,
        scheduled_date: taskDate ? new Date(taskDate).toISOString() : undefined,
        session_id: taskSessionId ? Number(taskSessionId) : undefined,
      };

      await api.post(`/study-plans/${activePlanId}/tasks`, payload);
      addToast('Custom task added to your plan! ✍️', 'success');
      setShowAddTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDate('');
      setTaskSessionId('');
      await fetchPlans(activePlanId);
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Failed to add task', 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Toggle preferred day helper
  const toggleDay = (idx) => {
    setCreatePreferredDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  };

  // Quick launch session helper
  const handleQuickStudy = (sessionId) => {
    if (onOpenSession && sessionId) {
      onOpenSession(sessionId);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <RefreshCw className="animate-spin text-indigo-500" size={32} />
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Loading your Adaptive Study Plans...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <CalendarCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                Adaptive Study Planner
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400">
                Personalized study trajectories powered by your SM-2 flashcard due dates & quiz mastery
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          {activePlan && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAdaptPlan}
              disabled={adapting}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 text-xs md:text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm transition-all disabled:opacity-50"
              title="Re-evaluates mastery scores, SM-2 cards, and shifts overdue tasks"
            >
              <RefreshCw size={14} className={adapting ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
              <span>{adapting ? 'Adapting...' : 'Adapt Plan'}</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all"
          >
            <Plus size={16} />
            <span>Create Plan</span>
          </motion.button>
        </div>
      </div>

      {/* ── No Plans Empty State ───────────────────────────────────── */}
      {plans.length === 0 ? (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-8 md:p-12 text-center max-w-2xl mx-auto shadow-sm my-6">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5">
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-2">
            No Active Study Plan Yet
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">
            Florix analyzes your uploaded documents, SM-2 flashcard due dates, quiz accuracy, and mastery scores to generate an intelligent, prioritized learning plan tailored to your available time.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 inline-flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Generate Your First Plan</span>
          </motion.button>
        </div>
      ) : (
        <>
          {/* ── Active Plan Card & Selector ──────────────────────────── */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            {/* Top row: Plan Selector & Plan Mode Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                {plans.length > 1 ? (
                  <select
                    value={activePlanId || ''}
                    onChange={(e) => setActivePlanId(Number(e.target.value))}
                    className="text-base font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-white rounded-xl px-3 py-1.5 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.mode})
                      </option>
                    ))}
                  </select>
                ) : (
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {activePlan?.title}
                  </h2>
                )}

                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {activePlan?.mode}
                </span>

                {activePlan?.status === 'completed' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Completed
                  </span>
                )}
              </div>

              {/* Plan controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Add Task
                </button>
                <button
                  onClick={() => handleDeletePlan(activePlan?.id)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                  title="Delete Study Plan"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Plan metrics & progress bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-3 border border-slate-100 dark:border-zinc-800">
                <div className="text-xs text-slate-400 font-medium">Daily Budget</div>
                <div className="text-base font-bold text-slate-800 dark:text-zinc-100 mt-0.5 flex items-center gap-1">
                  <Clock size={14} className="text-indigo-500" />
                  <span>{activePlan?.daily_available_minutes || 60} mins</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-3 border border-slate-100 dark:border-zinc-800">
                <div className="text-xs text-slate-400 font-medium">Tasks Progress</div>
                <div className="text-base font-bold text-slate-800 dark:text-zinc-100 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>
                    {activePlan?.completed_tasks || 0} / {activePlan?.total_tasks || 0}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-3 border border-slate-100 dark:border-zinc-800">
                <div className="text-xs text-slate-400 font-medium">Study Days</div>
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200 mt-1 flex items-center gap-1">
                  {(activePlan?.preferred_days || [0, 1, 2, 3, 4]).map((d) => DAY_NAMES[d]).join(', ')}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-3 border border-slate-100 dark:border-zinc-800">
                <div className="text-xs text-slate-400 font-medium">Target Date</div>
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200 mt-1 flex items-center gap-1">
                  <Calendar size={13} className="text-purple-500" />
                  <span>
                    {activePlan?.target_date
                      ? new Date(activePlan.target_date).toLocaleDateString()
                      : 'Self-paced'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                <span>Completion</span>
                <span>
                  {activePlan?.total_tasks
                    ? Math.round(((activePlan.completed_tasks || 0) / activePlan.total_tasks) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${
                      activePlan?.total_tasks
                        ? Math.min(100, Math.round(((activePlan.completed_tasks || 0) / activePlan.total_tasks) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Tasks Controls & Filters ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Filter size={12} /> Filter:
              </span>
              {['all', 'pending', 'completed'].map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setStatusFilter(filterKey)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                    statusFilter === filterKey
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* ── Grouped Tasks Timeline ───────────────────────────────── */}
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="text-center py-12 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-slate-400 text-sm">
              No tasks match the selected filter.
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupTitle, tasksInGroup]) => (
              <div key={groupTitle} className="space-y-3">
                <div className="flex items-center gap-2 pt-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    {groupTitle}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">({tasksInGroup.length})</span>
                </div>

                <div className="space-y-3">
                  {tasksInGroup.map((task) => {
                    const typeMeta = TASK_TYPE_META[task.task_type] || TASK_TYPE_META.custom;
                    const priorityTheme = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
                    const isExpanded = expandedReasons.has(task.id);
                    const isDone = task.status === 'completed';
                    const TypeIcon = typeMeta.icon;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`group relative bg-white dark:bg-zinc-900 border rounded-2xl p-4 transition-all shadow-sm ${
                          isDone
                            ? 'border-slate-200/60 dark:border-zinc-800/60 opacity-60 bg-slate-50/50 dark:bg-zinc-900/40'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-indigo-500/40 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Complete Checkbox + Title + Metadata */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <button
                              onClick={() => !isDone && handleCompleteTask(task.id)}
                              disabled={isDone}
                              className={`mt-1 flex-shrink-0 transition-colors ${
                                isDone
                                  ? 'text-emerald-500 cursor-default'
                                  : 'text-slate-300 hover:text-indigo-500 cursor-pointer'
                              }`}
                              title={isDone ? 'Completed' : 'Click to complete'}
                            >
                              {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {/* Task Type Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${typeMeta.color}`}
                                >
                                  <TypeIcon size={12} />
                                  <span>{typeMeta.label}</span>
                                </span>

                                {/* Priority Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider ${priorityTheme.badge}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityTheme.dot}`} />
                                  <span>{task.priority}</span>
                                  {task.priority_score && (
                                    <span className="opacity-70 font-normal">({Math.round(task.priority_score)})</span>
                                  )}
                                </span>

                                {/* Minutes Badge */}
                                <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                                  <Clock size={11} /> {task.estimated_minutes}m
                                </span>

                                {task.status === 'rescheduled' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    Rescheduled
                                  </span>
                                )}
                              </div>

                              <h4
                                className={`text-sm md:text-base font-bold ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-zinc-500'
                                    : 'text-slate-800 dark:text-white'
                                }`}
                              >
                                {task.title}
                              </h4>

                              {task.description && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Transparent Recommendation Reason Accordion */}
                              {task.recommendation_reason && (
                                <div className="mt-2.5">
                                  <button
                                    onClick={() => toggleReason(task.id)}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                  >
                                    <HelpCircle size={12} />
                                    <span>Why recommended?</span>
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  </button>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-300 space-y-1.5"
                                      >
                                        <p className="font-medium text-slate-700 dark:text-zinc-200">
                                          {task.recommendation_reason}
                                        </p>
                                        {task.reason_factors && (
                                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50 dark:border-zinc-700/50 text-[11px] text-slate-500 dark:text-zinc-400">
                                            {task.reason_factors.mastery !== undefined && (
                                              <div>
                                                Mastery:{' '}
                                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                                  {Math.round(task.reason_factors.mastery * 100)}%
                                                </span>
                                              </div>
                                            )}
                                            {task.reason_factors.sm2_due_count !== undefined && (
                                              <div>
                                                Cards Due:{' '}
                                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                                  {task.reason_factors.sm2_due_count}
                                                </span>
                                              </div>
                                            )}
                                            {task.reason_factors.recent_quiz_accuracy !== undefined && (
                                              <div>
                                                Quiz Acc:{' '}
                                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                                  {Math.round(task.reason_factors.recent_quiz_accuracy * 100)}%
                                                </span>
                                              </div>
                                            )}
                                            {task.reason_factors.days_since_last_studied !== undefined && (
                                              <div>
                                                Last Studied:{' '}
                                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                                  {task.reason_factors.days_since_last_studied}d ago
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {/* Quick Study Session Jump */}
                            {task.session_id && (
                              <button
                                onClick={() => handleQuickStudy(task.session_id)}
                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Open connected Study Session"
                              >
                                <span>Study</span>
                                <ArrowRight size={12} />
                              </button>
                            )}

                            {!isDone && (
                              <>
                                {/* Skip Button */}
                                <button
                                  onClick={() => handleSkipTask(task.id)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                  title="Skip & Reschedule to tomorrow"
                                >
                                  <SkipForward size={16} />
                                </button>

                                {/* Remind Button */}
                                <button
                                  onClick={() => handleRemindTask(task.id)}
                                  className={`p-1.5 rounded-xl transition-colors ${
                                    task.reminder_id
                                      ? 'text-indigo-500 bg-indigo-500/10'
                                      : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10'
                                  }`}
                                  title={task.reminder_id ? 'Reminder Active' : 'Set Notification Reminder'}
                                >
                                  <Bell size={16} />
                                </button>
                              </>
                            )}

                            {/* Delete Task */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── CREATE STUDY PLAN MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <CalendarCheck size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    Create Adaptive Study Plan
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4 pt-4">
                {/* Plan Mode Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                    Planning Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(MODE_LABELS).map(([mKey, mInfo]) => {
                      const isExam = mKey === 'exam';
                      const isFree = user?.plan === 'free';
                      const isDisabled = isExam && isFree;

                      return (
                        <button
                          key={mKey}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setCreateMode(mKey)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            createMode === mKey
                              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                              {mInfo.title}
                            </span>
                            {isDisabled && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                                Pro
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{mInfo.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Plan Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Plan Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Biology Final Exam Prep or Weekly Mastery"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Daily Minutes Budget */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Daily Study Budget
                    </label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {createMinutes} minutes/day
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={createMinutes}
                    onChange={(e) => setCreateMinutes(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>15 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                    <span>180 min</span>
                  </div>
                </div>

                {/* Target Date (Required if Exam Mode) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Target Exam / Completion Date {createMode === 'exam' && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="date"
                    required={createMode === 'exam'}
                    value={createTargetDate}
                    onChange={(e) => setCreateTargetDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Preferred Study Days */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Preferred Study Days
                  </label>
                  <div className="flex gap-1.5">
                    {DAY_NAMES.map((name, idx) => {
                      const isSelected = createPreferredDays.includes(idx);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Focus Topics */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Specific Focus Topics (Optional, comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Photosynthesis, Cell Division, Genetics"
                    value={createFocusTopics}
                    onChange={(e) => setCreateFocusTopics(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Auto Reminders Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-indigo-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">Auto-schedule Reminders</div>
                      <div className="text-[11px] text-slate-400">
                        Automatically create revision alerts for planned tasks
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={createAutoReminders}
                    onChange={(e) => setCreateAutoReminders(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-400 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPlan}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {submittingPlan ? 'Generating Schedule...' : 'Generate Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ADD CUSTOM TASK MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Plus size={18} className="text-indigo-500" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Add Custom Task
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-3.5 pt-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Read Chapter 4 & write key notes"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Task Type
                    </label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="study_topic">Deep Study</option>
                      <option value="review_flashcards">Review Flashcards</option>
                      <option value="practice_quiz">Practice Quiz</option>
                      <option value="explore_visual">Explore Visual</option>
                      <option value="custom">Custom Task</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Est. Minutes
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={taskMinutes}
                      onChange={(e) => setTaskMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {sessions.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                      Connect to Study Session (Optional)
                    </label>
                    <select
                      value={taskSessionId}
                      onChange={(e) => setTaskSessionId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">None (Standalone Task)</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.filename}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-400 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {submittingTask ? 'Adding...' : 'Add Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
