import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Lock, Save, LogOut, Loader2, Eye, EyeOff,
  Shield, Calendar, CheckCircle2, AlertTriangle, Key, Copy, Check,
  Bell, BookOpen, TrendingUp, Star, Bookmark, Flame, Zap, Clock, Globe, Brain,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

/* ─── helpers ─────────────────────────────────────────────── */
const formatJoined = (isoStr) => {
  if (!isoStr) return 'Member';
  const d = new Date(isoStr);
  if (isNaN(d)) return 'Member';
  return `Member since ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
};

const maskEmail = (email = '') => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
};

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

/* ─── Toggle Switch ───────────────────────────────────────── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 44,
      height: 24,
      borderRadius: 999,
      background: checked
        ? 'linear-gradient(90deg, #6366f1, #a855f7)'
        : undefined,
      transition: 'background 0.25s',
      position: 'relative',
      flexShrink: 0,
      border: 'none',
      cursor: 'pointer',
      padding: 0,
    }}
    className={`${!checked ? 'bg-slate-200 dark:bg-zinc-700' : ''}`}
  >
    <span
      style={{
        position: 'absolute',
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
      }}
    />
  </button>
);

/* ─── Skeleton ────────────────────────────────────────────── */
const Skeleton = ({ w = '100%', h = 20, radius = 8 }) => (
  <div
    className="animate-pulse bg-slate-200 dark:bg-zinc-700"
    style={{ width: w, height: h, borderRadius: radius }}
  />
);

/* ─── Main Component ──────────────────────────────────────── */
const ProfileTab = ({ onLogout }) => {
  const { user, setUser } = useContext(AuthContext);
  const { addToast } = useToast();

  /* name */
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  /* password */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  /* stats */
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* Developer API Key Generator (NEW AI ENGINEERING FEATURE) */
  const [apiKey, setApiKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  /* notification toggles */
  const [notifications, setNotifications] = useState({
    studyReminders: true,
    weeklyReport: false,
    newFeatures: true,
    aiTips: true,
  });

  /* ── fetch stats on mount ── */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/stats');
        setStats(res.data);
      } catch {
        setStats({ documents: 0, quizzes: 0, avg_score: 0, bookmarks: 0 });
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();

    // Check if key is stored in localStorage for user
    if (user?.id) {
      const existingKey = localStorage.getItem(`florix_api_key_${user.id}`);
      if (existingKey) setApiKey(existingKey);
    }
  }, [user?.id]);

  /* ── API Key Generator Handlers ── */
  const generateApiKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const newKey = `flx_live_${hex}`;
      setApiKey(newKey);
      if (user?.id) {
        localStorage.setItem(`florix_api_key_${user.id}`, newKey);
      }
      addToast('Developer API key generated successfully!', 'success');
      setIsGeneratingKey(false);
    }, 800);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    addToast('Copied API key to clipboard!', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  /* ── handlers ── */
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error'); return;
    }
    if (newPassword.length < 8) {
      addToast('Password must be at least 8 characters', 'warning'); return;
    }
    setSavingPw(true);
    try {
      await api.post('/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      addToast('Password changed successfully!', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to change password', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  /* Dynamic Level & XP System calculations */
  const calculateProgression = () => {
    if (statsLoading || !stats) return { level: 1, xp: 0, nextLevelXp: 1000, progressPercent: 0, title: 'Novice Scholar' };
    const docsXp = (stats.total_sessions || stats.documents || 0) * 200;
    const quizzesXp = (stats.total_quizzes || stats.quizzes || 0) * 450;
    const scoreXp = Math.round((stats.avg_quiz_score || stats.avg_score || 0) * 12);
    const bookmarksXp = (stats.bookmarks_count || stats.bookmarks || 0) * 60;
    const totalXp = docsXp + quizzesXp + scoreXp + bookmarksXp;

    const level = Math.floor(totalXp / 1000) + 1;
    const prevLevelXp = (level - 1) * 1000;
    const nextLevelXp = level * 1000;
    const levelProgress = totalXp - prevLevelXp;
    const progressPercent = Math.min(100, Math.max(0, (levelProgress / 1000) * 100));

    let title = 'Novice Scholar';
    if (level === 2) title = 'Avid Reader 📚';
    else if (level === 3) title = 'Knowledge Weaver 🧠';
    else if (level === 4) title = 'Quiz Vanguard 🏆';
    else if (level >= 5) title = 'AI Research Fellow 🔬';

    return { level, xp: totalXp, levelProgress, nextLevelXp, progressPercent, title };
  };

  const prog = calculateProgression();

  /* Dynamic Achievements Verification */
  const getAchievements = () => {
    const docCount = stats?.total_sessions || stats?.documents || 0;
    const quizCount = stats?.total_quizzes || stats?.quizzes || 0;
    const avgScore = stats?.avg_quiz_score || stats?.avg_score || 0;
    const bookmarkedCount = stats?.bookmarks_count || stats?.bookmarks || 0;

    return [
      {
        id: 'first_upload',
        name: 'First Upload 📂',
        desc: 'Upload your first study PDF.',
        unlocked: docCount > 0,
      },
      {
        id: 'quiz_conqueror',
        name: 'Quiz Conqueror 🏆',
        desc: 'Earn 80%+ average on any quiz.',
        unlocked: quizCount > 0 && avgScore >= 80,
      },
      {
        id: 'deep_diver',
        name: 'Deep Diver 🧠',
        desc: 'Maintain at least 3 uploaded documents.',
        unlocked: docCount >= 3,
      },
      {
        id: 'collector',
        name: 'Collector 🔖',
        desc: 'Create at least 3 active bookmarks.',
        unlocked: bookmarkedCount >= 3,
      },
      {
        id: 'ai_engineer',
        name: 'Developer 🛠️',
        desc: 'Generate a Florix Personal API Key.',
        unlocked: !!apiKey,
      },
    ];
  };

  const achievements = getAchievements();

  /* Dynamic Personalized Recommendation Engine */
  const getRecommendation = () => {
    const docCount = stats?.total_sessions || stats?.documents || 0;
    const quizCount = stats?.total_quizzes || stats?.quizzes || 0;
    const avgScore = stats?.avg_quiz_score || stats?.avg_score || 0;

    if (docCount === 0) {
      return {
        tip: 'Upload a study PDF in "My Library" to begin generating detailed summaries and tailored notes automatically.',
        badge: 'Get Started 📂',
      };
    }
    if (quizCount === 0) {
      return {
        tip: 'You have document resources ready! Head over to your study sessions and generate your first interactive quiz.',
        badge: 'Next Step ⚡',
      };
    }
    if (avgScore < 80) {
      return {
        tip: 'Your average quiz score is below 80%. Select study guides in your sessions to generate new memory cards and retake quizzes to master concepts.',
        badge: 'Boost Score 📈',
      };
    }
    return {
      tip: 'Fantastic performance! Explore advanced LLM parameters in the Personalization tab or upload additional study sheets.',
      badge: 'Looking Great 🌟',
    };
  };

  const recommendation = getRecommendation();

  /* ── animation variants ── */
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
  };

  const cardClass =
    'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-lg shadow-slate-200/20 dark:shadow-none';

  const plan = user?.plan || 'free';
  const planColors = {
    free: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
    pro: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30',
    premium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  };

  const statCardData = [
    { label: 'Documents', icon: BookOpen, key: 'documents', altKey: 'total_sessions', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Quizzes', icon: Zap, key: 'quizzes', altKey: 'total_quizzes', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: 'Avg Score', icon: TrendingUp, key: 'avg_score', altKey: 'avg_quiz_score', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', suffix: '%' },
    { label: 'Bookmarks', icon: Bookmark, key: 'bookmarks', altKey: 'bookmarks_count', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  ];

  const notifItems = [
    { key: 'studyReminders', label: 'Study Reminders', desc: 'Daily nudges to keep your learning on track' },
    { key: 'weeklyReport', label: 'Weekly Progress Report', desc: 'A summary of your activity every Monday' },
    { key: 'newFeatures', label: 'New Feature Announcements', desc: "Stay updated on what's new in Florix" },
    { key: 'aiTips', label: 'AI Tips & Suggestions', desc: 'Personalised study tips from your AI tutor' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto pb-20 space-y-6"
    >
      {/* ── Page Header ── */}
      <motion.div variants={itemVariants}>
        <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white">My Profile</h2>
        <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage your account settings, developer tools, and view achievements.</p>
      </motion.div>

      {/* ── Account Overview & Level Progress ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-500/30 shrink-0 select-none">
              {initials(user?.name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-xl font-bold text-slate-800 dark:text-white truncate">{user?.name || 'User'}</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${planColors[plan] || planColors.free}`}>
                  {plan}
                </span>
              </div>
              <p className="text-slate-500 dark:text-zinc-400 text-sm flex items-center gap-1.5 mb-2.5">
                <Mail size={13} /> {user?.email || '—'}
              </p>

              {/* Metadata row */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-400" />
                  {formatJoined(user?.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                </span>
                <span className="flex items-center gap-1">
                  <Flame size={12} className="text-orange-400" />
                  <span className="text-orange-500 dark:text-orange-400 font-medium">0 day streak</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic XP Gauge bar */}
        <div className="pt-6 space-y-2">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
              <Star size={16} /> Level {prog.level} — {prog.title}
            </span>
            <span className="text-slate-500 dark:text-zinc-400">{statsLoading ? 'Loading XP...' : `${prog.xp} / ${prog.nextLevelXp} XP`}</span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-zinc-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prog.progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
            />
          </div>
          <p className="text-xxs text-slate-400 dark:text-zinc-500 leading-normal">
            Gain XP by uploading files (+200 XP), taking quizzes (+450 XP), scoring high, and saving bookmarks.
          </p>
        </div>
      </motion.div>

      {/* ── Learning Stats ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-500" /> Learning Stats
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCardData.map(({ label, icon: Icon, key, altKey, color, bg, suffix = '' }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-700/50"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              {statsLoading ? (
                <Skeleton w={40} h={22} radius={6} />
              ) : (
                <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
                  {stats?.[altKey] ?? stats?.[key] ?? 0}{suffix}
                </p>
              )}
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 text-center">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Dynamic AI Recommendations (NEW PREMIUM FEATURE) ────────────── */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-500 to-pink-500 opacity-10 rounded-bl-full pointer-events-none" />
        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
          <Brain size={18} className="text-purple-500" /> AI Study Recommendations
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed max-w-[80%]">
            {statsLoading ? 'Analyzing statistics...' : recommendation.tip}
          </p>
          <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 shrink-0">
            {recommendation.badge}
          </span>
        </div>
      </motion.div>

      {/* ── Achievements & Badges Matrix (NEW PREMIUM FEATURE) ─────────── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Star size={18} className="text-indigo-500" /> Unlockable Achievements
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-300 ${
                ach.unlocked
                  ? 'bg-slate-50/80 dark:bg-zinc-800/40 border-slate-100 dark:border-zinc-800'
                  : 'bg-slate-100/30 dark:bg-zinc-950/20 border-slate-100/50 dark:border-zinc-900/60 opacity-60'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-md ${
                  ach.unlocked
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'
                }`}
              >
                {ach.unlocked ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{ach.name}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">{ach.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Florix Developer API Key Generator (NEW AI ENGINEERING FEATURE) ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <Key size={18} className="text-indigo-500" /> Florix Personal API Token
        </h3>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5 leading-relaxed">
          Generate a secure, persistent developer token to integrate Florix study resources programmatically into scripts or command-line apps.
        </p>

        {apiKey ? (
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-slate-700 dark:text-zinc-300 font-mono text-sm overflow-x-auto truncate flex items-center justify-between">
              <span>{apiKey}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={copyToClipboard}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-2xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
            >
              {copiedKey ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {copiedKey ? 'Copied' : 'Copy'}
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateApiKey}
            disabled={isGeneratingKey}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {isGeneratingKey ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
            Generate Developer API Token
          </motion.button>
        )}
      </motion.div>

      {/* ── Notification Preferences ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          <Bell size={18} className="text-indigo-500" /> Notification Preferences
        </h3>
        <div className="space-y-4">
          {notifItems.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{label}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{desc}</p>
              </div>
              <ToggleSwitch
                checked={notifications[key]}
                onChange={(val) => setNotifications((prev) => ({ ...prev, [key]: val }))}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Privacy & Security ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          <Shield size={18} className="text-indigo-500" /> Privacy & Security
        </h3>
        <div className="space-y-3">
          {/* Email masked */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
              <Mail size={15} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>Email address</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 font-mono">
              {maskEmail(user?.email || '')}
            </span>
          </div>

          {/* Last login */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
              <Clock size={15} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>Last login</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Just now</span>
          </div>

          {/* 2FA */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
              <Shield size={15} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>Security status</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={11} /> 2FA not enabled
            </span>
          </div>

          {/* Session timeout */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400">
              <Globe size={15} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>Session timeout</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">30 minutes</span>
          </div>
        </div>
      </motion.div>

      {/* ── Update Display Name ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          <User size={18} className="text-indigo-500" /> Update Display Name
        </h3>
        <form onSubmit={handleSaveName} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="flex-1 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={savingName || !name.trim() || name === user?.name}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/30 shrink-0"
          >
            {savingName ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save
          </motion.button>
        </form>
      </motion.div>

      {/* ── Change Password ── */}
      <motion.div variants={itemVariants} className={cardClass}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          <Lock size={18} className="text-indigo-500" /> Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Current Password
            </label>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
              className="absolute right-4 top-[2.6rem] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* New Password */}
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              New Password
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Min. 8 characters"
              className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-4 top-[2.6rem] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={`w-full bg-slate-50 dark:bg-zinc-800/60 border text-slate-800 dark:text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 transition-all ${
                confirmPassword && newPassword !== confirmPassword
                  ? 'border-red-400 focus:ring-red-500/15'
                  : 'border-slate-200 dark:border-zinc-700 focus:border-indigo-500 focus:ring-indigo-500/15'
              }`}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <AlertTriangle size={11} /> Passwords don't match
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={savingPw || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
          >
            {savingPw ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            Update Password
          </motion.button>
        </form>
      </motion.div>

      {/* ── Sign Out ── */}
      <motion.div variants={itemVariants} className="flex justify-start pt-2 pb-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onLogout}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-500/5 font-semibold transition-all text-sm"
        >
          <LogOut size={16} />
          Sign out
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default ProfileTab;
