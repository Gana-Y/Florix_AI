import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, Award, BookOpen, MessageSquare, Loader2, Target, Flame,
} from 'lucide-react';
import api from '../utils/api';

// ── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1">{label}</p>
      <p className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{payload[0].value}%</p>
    </div>
  );
};

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-5 flex items-center gap-4 hover:shadow-xl hover:shadow-slate-200/30 dark:hover:shadow-none transition-all"
  >
    <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center shadow-lg shrink-0`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{value}</p>
      <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

// ── GitHub-style Activity Heatmap ────────────────────────────────────────────
const ActivityHeatmap = ({ activities }) => {
  // Build a map of date → count for the past 52 weeks (364 days)
  const today = new Date();
  const days = 364;
  const dateMap = {};

  activities?.forEach((a) => {
    const d = new Date(a.timestamp || a.created_at);
    const key = d.toISOString().split('T')[0];
    dateMap[key] = (dateMap[key] || 0) + 1;
  });

  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    cells.push({ date: key, count: dateMap[key] || 0, day: d.getDay() });
  }

  const getColor = (count) => {
    if (count === 0) return 'bg-slate-100 dark:bg-zinc-800';
    if (count === 1) return 'bg-indigo-200 dark:bg-indigo-900/70';
    if (count === 2) return 'bg-indigo-400 dark:bg-indigo-700';
    if (count === 3) return 'bg-indigo-500 dark:bg-indigo-500';
    return 'bg-indigo-600 dark:bg-indigo-400';
  };

  // Group into weeks (columns)
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const firstDay = new Date(week[0].date);
    if (firstDay.getDate() <= 7) {
      monthLabels.push({ index: wi, label: firstDay.toLocaleString('default', { month: 'short' }) });
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[640px]">
        {/* Month labels */}
        <div className="flex mb-1 ml-0 relative h-4">
          {monthLabels.map(({ index, label }) => (
            <div
              key={`${index}-${label}`}
              className="absolute text-[10px] text-slate-400 dark:text-zinc-500"
              style={{ left: `${(index / weeks.length) * 100}%` }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} activit${cell.count === 1 ? 'y' : 'ies'}`}
                  className={`w-[11px] h-[11px] rounded-sm transition-all hover:scale-125 cursor-default ${getColor(cell.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">Less</span>
          {['bg-slate-100 dark:bg-zinc-800', 'bg-indigo-200 dark:bg-indigo-900/70', 'bg-indigo-400 dark:bg-indigo-700', 'bg-indigo-500 dark:bg-indigo-500', 'bg-indigo-600 dark:bg-indigo-400'].map((c, i) => (
            <div key={i} className={`w-[11px] h-[11px] rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">More</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const ProgressStats = () => {
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState({ streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, streakRes] = await Promise.all([
          api.get('/stats'),
          api.get('/me/streak').catch(() => ({ data: { streak: 0 } })),
        ]);
        setStats(statsRes.data);
        setStreak(streakRes.data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!stats) return null;

  const quizTrend = stats.quiz_trend || [];
  const hasChartData = quizTrend.length > 1;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center">
            <TrendingUp size={20} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">Progress & Analytics</h2>
            <p className="text-slate-500 dark:text-zinc-400 text-sm">Track your learning journey</p>
          </div>
          {/* Streak badge */}
          {streak.streak > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-2xl">
              <Flame size={18} className="text-amber-500 animate-pulse" />
              <span className="font-extrabold text-amber-600 dark:text-amber-400 text-lg">{streak.streak}</span>
              <span className="text-amber-600/70 dark:text-amber-400/70 text-xs font-semibold">day streak</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen}      label="Documents"       value={stats.total_sessions}    gradient="from-indigo-500 to-purple-600" delay={0}    />
        <StatCard icon={Target}        label="Quizzes Taken"   value={stats.total_quizzes}     gradient="from-emerald-500 to-teal-600"  delay={0.05} />
        <StatCard icon={Award}         label="Avg Quiz Score"  value={`${stats.avg_quiz_score}%`} gradient="from-amber-500 to-orange-600" delay={0.1} sub={stats.total_quizzes > 0 ? `across ${stats.total_quizzes} quizzes` : 'No quizzes yet'} />
        <StatCard icon={MessageSquare} label="Conversations"   value={stats.conversations_count || 0} gradient="from-pink-500 to-rose-600" delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quiz Score Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6"
        >
          <h3 className="font-bold text-slate-800 dark:text-white mb-1">Quiz Score Trend</h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">Your last {quizTrend.length} quiz results</p>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={quizTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} fill="url(#scoreGradient)"
                  dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-3">
                <Target size={24} className="text-indigo-400" />
              </div>
              <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Complete at least 2 quizzes to see your trend</p>
            </div>
          )}
        </motion.div>

        {/* Score Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6 flex flex-col items-center justify-center"
        >
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 self-start">Overall Score</h3>
          <div className="relative w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="80%" innerRadius="55%" outerRadius="80%" barSize={12} startAngle={180} endAngle={0}
                data={[{ value: stats.avg_quiz_score || 0, fill: '#6366f1' }, { value: 100, fill: '#f1f5f9' }]}>
                <RadialBar dataKey="value" cornerRadius={6} background={false} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute bottom-4 text-center">
              <p className="text-3xl font-black text-slate-800 dark:text-white">{stats.avg_quiz_score || 0}%</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">avg score</p>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
              {stats.avg_quiz_score >= 80 ? '🏆 Excellent!' : stats.avg_quiz_score >= 60 ? '📈 Good Progress' : stats.total_quizzes === 0 ? '🎯 Take your first quiz!' : '💪 Keep Practicing'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* 📊 Activity Heatmap */}
      {stats.recent_activities?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">Study Activity</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                {stats.recent_activities.length} activities in the past year
              </p>
            </div>
            {streak.streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/60 dark:border-amber-500/20">
                <Flame size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{streak.streak} day streak 🔥</span>
              </div>
            )}
          </div>
          <ActivityHeatmap activities={stats.recent_activities} />
        </motion.div>
      )}

      {/* Recent Activity List */}
      {stats.recent_activities?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6"
        >
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats.recent_activities.slice(0, 10).map((activity, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{activity.action}</p>
                  {activity.details && <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{activity.details}</p>}
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 shrink-0">
                  {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default React.memo(ProgressStats);
