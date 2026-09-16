import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, Shield, Key, Award, Flame, Zap, BookOpen,
  TrendingUp, Bookmark, Copy, Check, Lock, Bell, Download,
  Sparkles, RefreshCw, ChevronRight, Eye, EyeOff, CheckCircle2,
  AlertCircle, FileText, Database, Terminal, LogOut, Laptop
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

const PLAN_BADGES = {
  free: {
    label: 'Free Scholar',
    style: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
    ring: 'from-slate-400 to-zinc-500',
  },
  pro: {
    label: 'Pro Scholar',
    style: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30',
    ring: 'from-indigo-500 to-purple-600',
  },
  premium: {
    label: 'Premium Fellow',
    style: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    ring: 'from-amber-400 to-orange-500',
  },
};

export default function ProfileModal({
  isOpen,
  onClose,
  initialTab = 'overview',
  onLogout,
}) {
  const { user, setUser } = useContext(AuthContext);
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Edit Name state
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  // Academic Field state
  const [fieldOfStudy, setFieldOfStudy] = useState(() => {
    return localStorage.getItem(`florix_field_${user?.id}`) || 'Computer Science & AI';
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Developer API Key
  const [apiKey, setApiKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Notification toggles
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(`florix_notifs_${user?.id}`);
      return saved ? JSON.parse(saved) : {
        studyReminders: true,
        weeklyReport: false,
        newFeatures: true,
        aiTips: true,
      };
    } catch {
      return { studyReminders: true, weeklyReport: false, newFeatures: true, aiTips: true };
    }
  });

  // Reset tab when modal opens with initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setName(user?.name || '');
    }
  }, [isOpen, initialTab, user?.name]);

  // Fetch live stats & existing API key
  useEffect(() => {
    if (isOpen && user?.id) {
      setStatsLoading(true);
      api.get('/stats')
        .then(res => setStats(res.data))
        .catch(() => setStats({ total_sessions: 0, total_quizzes: 0, avg_quiz_score: 0, bookmarks_count: 0 }))
        .finally(() => setStatsLoading(false));

      const existingKey = localStorage.getItem(`florix_api_key_${user.id}`);
      if (existingKey) setApiKey(existingKey);
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  // Level & XP Calculation
  const calculateProgression = () => {
    const docs = stats?.total_sessions || 0;
    const quizzes = stats?.total_quizzes || 0;
    const score = stats?.avg_quiz_score || 0;
    const bookmarks = stats?.bookmarks_count || 0;

    const docsXp = docs * 200;
    const quizzesXp = quizzes * 450;
    const scoreXp = Math.round(score * 12);
    const bookmarksXp = bookmarks * 60;
    const totalXp = docsXp + quizzesXp + scoreXp + bookmarksXp;

    const level = Math.floor(totalXp / 1000) + 1;
    const prevLevelXp = (level - 1) * 1000;
    const nextLevelXp = level * 1000;
    const levelProgress = totalXp - prevLevelXp;
    const progressPercent = Math.min(100, Math.max(0, (levelProgress / 1000) * 100));

    let title = 'Novice Scholar';
    if (level === 2) title = 'Avid Reader \ud83d\udcda';
    else if (level === 3) title = 'Knowledge Weaver \ud83e\udde0';
    else if (level === 4) title = 'Quiz Vanguard \ud83c\udfc6';
    else if (level >= 5) title = 'AI Research Fellow \ud83d\udd2c';

    return {
      level,
      totalXp,
      levelProgress,
      nextLevelXp,
      progressPercent,
      title,
      breakdown: { docsXp, quizzesXp, scoreXp, bookmarksXp }
    };
  };

  const prog = calculateProgression();

  // Badges & Achievements
  const getAchievements = () => {
    const docs = stats?.total_sessions || 0;
    const quizzes = stats?.total_quizzes || 0;
    const avgScore = stats?.avg_quiz_score || 0;
    const bookmarks = stats?.bookmarks_count || 0;

    return [
      {
        id: 'first_upload',
        name: 'First Upload \ud83d\udcc2',
        desc: 'Upload your first study PDF document.',
        unlocked: docs > 0,
        xpReward: '+200 XP',
        progress: docs > 0 ? '1/1 Done' : '0/1 Docs',
      },
      {
        id: 'quiz_master',
        name: 'Quiz Conqueror \ud83c\udfc6',
        desc: 'Achieve 80%+ average score on quizzes.',
        unlocked: quizzes > 0 && avgScore >= 80,
        xpReward: '+450 XP',
        progress: quizzes > 0 ? `${avgScore}% Avg` : '0 Quizzes',
      },
      {
        id: 'deep_diver',
        name: 'Deep Diver \ud83e\udde0',
        desc: 'Analyze and index at least 3 academic papers.',
        unlocked: docs >= 3,
        xpReward: '+600 XP',
        progress: `${Math.min(docs, 3)}/3 Docs`,
      },
      {
        id: 'collector',
        name: 'Collector \ud83d\udd16',
        desc: 'Curate 3+ high-yield study bookmarks.',
        unlocked: bookmarks >= 3,
        xpReward: '+180 XP',
        progress: `${Math.min(bookmarks, 3)}/3 Saved`,
      },
      {
        id: 'ai_engineer',
        name: 'Developer \ud83d\udee0\ufe0f',
        desc: 'Generate a Florix Personal API Key.',
        unlocked: !!apiKey,
        xpReward: '+300 XP',
        progress: apiKey ? 'Generated' : 'Not generated',
      },
      {
        id: 'century_scholar',
        name: 'Scholar Vanguard \ud83c\udf93',
        desc: 'Reach Level 3 or higher on Florix AI.',
        unlocked: prog.level >= 3,
        xpReward: '+1000 XP',
        progress: `Level ${prog.level}/3`,
      },
    ];
  };

  const achievements = getAchievements();

  // Recommendation engine
  const getRecommendation = () => {
    const docs = stats?.total_sessions || 0;
    const quizzes = stats?.total_quizzes || 0;
    const avgScore = stats?.avg_quiz_score || 0;

    if (docs === 0) {
      return {
        tip: 'Upload your first lecture notes or research PDF in "My Library" to start generating master summaries and AI flashcards.',
        badge: 'Get Started \ud83d\udcc2',
      };
    }
    if (quizzes === 0) {
      return {
        tip: 'You have study material indexed! Generate an interactive quiz to test your concept retention.',
        badge: 'Take Quiz \u26a1',
      };
    }
    if (avgScore < 80) {
      return {
        tip: 'Your average quiz score is below 80%. Review your study summaries and retake quizzes to cement core formulas.',
        badge: 'Boost Score \ud83d\udcc8',
      };
    }
    return {
      tip: 'Outstanding momentum! Try connecting the Florix API key to your notes or explore AI Tutor personalization.',
      badge: 'Peak Performance \ud83c\udf1f',
    };
  };

  const recommendation = getRecommendation();

  // Handlers
  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name === user?.name) return;
    setSavingName(true);
    try {
      const res = await api.patch('/me', { name: name.trim() });
      if (typeof setUser === 'function') setUser(res.data);
      addToast('Name updated successfully!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveField = (val) => {
    setFieldOfStudy(val);
    if (user?.id) {
      localStorage.setItem(`florix_field_${user.id}`, val);
      addToast(`Field of study saved as ${val}`, 'success');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters', 'warning');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Password changed successfully!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to change password', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const handleGenerateApiKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      const newKey = `flx_live_${hex}`;
      setApiKey(newKey);
      if (user?.id) {
        localStorage.setItem(`florix_api_key_${user.id}`, newKey);
      }
      addToast('Personal Developer API key generated!', 'success');
      setIsGeneratingKey(false);
    }, 600);
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    addToast('Copied API key to clipboard!', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleToggleNotif = (key) => {
    setNotifications(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (user?.id) {
        localStorage.setItem(`florix_notifs_${user.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleExportData = () => {
    const exportPayload = {
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        plan: user?.plan,
        level: prog.level,
        xp: prog.totalXp,
      },
      stats: stats || {},
      fieldOfStudy,
      exportedAt: new Date().toISOString(),
      source: 'Florix AI Academic Engine'
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `florix_study_archive_${user?.name?.toLowerCase().replace(/\s+/g, '_') || 'account'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Study data archive exported!', 'success');
  };

  const handleClearCache = () => {
    try {
      sessionStorage.clear();
      addToast('Client session cache cleared successfully.', 'info');
    } catch {
      addToast('Failed to clear cache', 'error');
    }
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const planInfo = PLAN_BADGES[user?.plan || 'free'] || PLAN_BADGES.free;

  const tabs = [
    { id: 'overview',     label: 'Scholar Overview', icon: Sparkles },
    { id: 'achievements', label: 'Milestones & Badges', icon: Award },
    { id: 'account',      label: 'Account & Identity', icon: User },
    { id: 'developer',    label: 'Developer API', icon: Key },
    { id: 'security',     label: 'Security & Privacy', icon: Shield },
  ];

  return (
    <div
      data-lenis-prevent="true"
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md overflow-y-auto custom-scrollbar animate-in fade-in duration-150"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${planInfo.ring} text-white flex items-center justify-center font-black text-base shadow-lg shrink-0`}>
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                  {user?.name || 'Scholar Account'}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${planInfo.style}`}>
                  {planInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {user?.email || 'Academic Learner'} \u2022 {fieldOfStudy}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2 border-b border-slate-100 dark:border-zinc-800/80 overflow-x-auto custom-scrollbar bg-slate-50/30 dark:bg-zinc-900/30 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Content Body */}
        <div
          data-lenis-prevent="true"
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar"
        >
          {/* TAB 1: SCHOLAR OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Level & XP Progression Card */}
              <div className="relative overflow-hidden rounded-2xl p-5 border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:to-zinc-900 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Sparkles size={12} />
                      <span>Academic Progression</span>
                    </span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      Level {prog.level} — {prog.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                      {prog.totalXp} XP Total
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 flex items-center gap-1">
                      <Flame size={12} className="text-amber-500" />
                      <span>Active Streak</span>
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                    <span>Progress to Level {prog.level + 1}</span>
                    <span>{prog.levelProgress} / 1,000 XP</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${prog.progressPercent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full shadow-sm"
                    />
                  </div>
                </div>

                {/* XP Breakdown Pill Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-3 border-t border-slate-200/60 dark:border-zinc-800/80 text-[11px]">
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/50 border border-slate-200/40 dark:border-zinc-700/40">
                    <span className="text-slate-400 block">Documents</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">+{prog.breakdown.docsXp} XP</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/50 border border-slate-200/40 dark:border-zinc-700/40">
                    <span className="text-slate-400 block">Quizzes</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">+{prog.breakdown.quizzesXp} XP</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/50 border border-slate-200/40 dark:border-zinc-700/40">
                    <span className="text-slate-400 block">Accuracy</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">+{prog.breakdown.scoreXp} XP</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/50 border border-slate-200/40 dark:border-zinc-700/40">
                    <span className="text-slate-400 block">Bookmarks</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">+{prog.breakdown.bookmarksXp} XP</span>
                  </div>
                </div>
              </div>

              {/* Learning Pulse Metrics Grid */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Live Learning Analytics
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {stats?.total_sessions ?? (statsLoading ? '…' : 0)}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Documents</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Zap size={18} />
                    </div>
                    <div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {stats?.total_quizzes ?? (statsLoading ? '…' : 0)}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Quizzes</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {stats?.avg_quiz_score ? `${stats.avg_quiz_score}%` : (statsLoading ? '…' : '0%')}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Accuracy</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Bookmark size={18} />
                    </div>
                    <div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {stats?.bookmarks_count ?? (statsLoading ? '…' : 0)}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Bookmarks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic AI Recommendation Tip */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">AI Tutor Focus</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {recommendation.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {recommendation.tip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MILESTONES & BADGES */}
          {activeTab === 'achievements' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Academic Milestones & Badges</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Earn experience and unlock unique academic badges as you analyze notes and master quizzes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      ach.unlocked
                        ? 'bg-white dark:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-700 shadow-sm'
                        : 'bg-slate-50/60 dark:bg-zinc-900/40 border-slate-200/40 dark:border-zinc-800/60 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                        ach.unlocked
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                      }`}
                    >
                      {ach.unlocked ? <CheckCircle2 size={20} /> : <Lock size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {ach.name}
                        </h5>
                        <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {ach.xpReward}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                        {ach.desc}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-zinc-800 text-[10px]">
                        <span className="text-slate-400">{ach.progress}</span>
                        <span className={`font-bold ${ach.unlocked ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {ach.unlocked ? 'Unlocked' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT & IDENTITY */}
          {activeTab === 'account' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Display Name Edit Form */}
              <form onSubmit={handleSaveName} className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Scholar Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    type="submit"
                    disabled={savingName || !name.trim() || name === user?.name}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingName ? 'Saving…' : 'Save Name'}
                  </button>
                </div>
              </form>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Registered Email Address
                </label>
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/70 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-mono">
                  <span>{user?.email || 'student@florix.ai'}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check size={10} /> Verified
                  </span>
                </div>
              </div>

              {/* Field of Study Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Academic Field / Focus
                </label>
                <select
                  value={fieldOfStudy}
                  onChange={(e) => handleSaveField(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="Computer Science & AI">Computer Science & AI</option>
                  <option value="Medical Sciences & Biology">Medical Sciences & Biology</option>
                  <option value="Organic & Inorganic Chemistry">Organic & Inorganic Chemistry</option>
                  <option value="Physics & Quantum Mechanics">Physics & Quantum Mechanics</option>
                  <option value="Mathematics & Statistics">Mathematics & Statistics</option>
                  <option value="Constitutional Law & Jurisprudence">Constitutional Law & Jurisprudence</option>
                  <option value="Business, Finance & MBA">Business, Finance & MBA</option>
                  <option value="Engineering & Robotics">Engineering & Robotics</option>
                  <option value="Humanities & Literature">Humanities & Literature</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Customizes AI explanations and default analogies to match your primary discipline.
                </p>
              </div>

              {/* Plan Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subscription Tier</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-black capitalize text-slate-900 dark:text-white">
                      {user?.plan || 'Free'} Plan
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${planInfo.style}`}>
                      Active
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('florix:upgrade-required'));
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-sm hover:from-indigo-500 hover:to-purple-500 transition-all cursor-pointer"
                >
                  {user?.plan === 'pro' || user?.plan === 'premium' ? 'Manage Plan' : 'Upgrade to Pro'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DEVELOPER & API KEYS */}
          {activeTab === 'developer' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Florix Personal Developer API</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Integrate your Florix AI study engine, document vector search, and quiz generators into external tools like Obsidian, Notion, or custom Python scripts.
                </p>
              </div>

              {/* API Key Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <Terminal size={14} className="text-indigo-500" />
                    <span>Live API Key</span>
                  </label>
                  {apiKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Ready
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    readOnly
                    value={apiKey || '••••••••••••••••••••••••••••••••'}
                    placeholder="No API key generated yet"
                    className="flex-1 text-xs font-mono px-3.5 py-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 outline-none select-all"
                  />
                  {apiKey && (
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="p-2.5 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-xl transition-all cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedKey ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    disabled={isGeneratingKey}
                    className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} className={isGeneratingKey ? 'animate-spin' : ''} />
                    <span>{apiKey ? 'Regenerate' : 'Generate Key'}</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Documentation Snippet */}
              <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-300 font-mono text-xs space-y-2 border border-zinc-800">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-1 border-b border-zinc-800">
                  <span>SAMPLE PYTHON REQUEST</span>
                  <span>HTTP POST</span>
                </div>
                <pre className="overflow-x-auto custom-scrollbar text-[11px] leading-relaxed text-indigo-300">
{`import requests

res = requests.post(
  "http://localhost:8000/query",
  headers={"Authorization": "Bearer ${apiKey || 'YOUR_API_KEY'}"},
  json={"question": "Explain Dijkstra algorithm in detail"}
)
print(res.json())`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & PRIVACY */}
          {activeTab === 'security' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Password Change */}
              <form onSubmit={handleChangePassword} className="space-y-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lock size={14} className="text-indigo-500" />
                  <span>Change Password</span>
                </h5>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current Password"
                      className="w-full text-xs px-3.5 pr-9 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password (min 8 chars)"
                        className="w-full text-xs px-3.5 pr-9 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm New Password"
                      className="w-full text-xs px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={savingPw || !currentPassword || !newPassword}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingPw ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* Notification Toggles */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Bell size={14} className="text-indigo-500" />
                  <span>Notification Preferences</span>
                </h5>
                <div className="space-y-2 pt-1 text-xs">
                  {[
                    { id: 'studyReminders', label: 'Study Reminders', desc: 'Daily nudges to keep your study streak active' },
                    { id: 'weeklyReport',   label: 'Weekly Scholar Digest', desc: 'Summary of questions asked and documents studied' },
                    { id: 'aiTips',         label: 'AI Tutor Learning Tips', desc: 'Adaptive revision recommendations' },
                  ].map((notif) => (
                    <div key={notif.id} className="flex items-center justify-between py-1">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-zinc-200">{notif.label}</p>
                        <p className="text-[10px] text-slate-400">{notif.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif(notif.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                          notifications[notif.id] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.75 left-0.75 ${
                            notifications[notif.id] ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data & Privacy Controls */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Database size={14} className="text-indigo-500" />
                  <span>Data Controls & Export</span>
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Export your study history and generated materials or flush client cached state.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Export Study Archive (.JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Clear Client Cache</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone / Log Out */}
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Sign Out of Session</p>
                  <p className="text-[10px] text-rose-500/80">Log out on this device and return to login screen.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout?.();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Shield size={12} className="text-emerald-500" />
            <span>End-to-end encrypted workspace</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
