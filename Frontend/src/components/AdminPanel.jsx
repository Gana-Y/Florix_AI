import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Shield, Loader2, User, Calendar, CreditCard, AlertCircle, Search, Globe, Users, Key, Hash, Mail, MessageSquare, Copy, Trash2, Bug, Sparkles, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

const AdminPanel = () => {
  const { addToast } = useToast();
  const { refreshUser } = useContext(AuthContext);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [activeView, setActiveView] = useState('payments'); // 'payments' | 'users' | 'feedback'
  const [selectedUserHash, setSelectedUserHash] = useState(null); // for displaying bcrypt password verification
  const [actioningId, setActioningId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('all');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all');

  useEffect(() => {
    fetchPayments();
    fetchUsers();
    fetchFeedbacks();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payments');
      setPayments(res.data);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to load user list', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    setFeedbackLoading(true);
    try {
      const res = await api.get('/admin/feedback');
      setFeedbacks(res.data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleUpdateFeedbackStatus = async (feedbackId, status) => {
    try {
      await api.patch(`/admin/feedback/${feedbackId}`, { status });
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, status } : f));
      addToast(`Feedback marked as ${status}`, 'success');
    } catch (err) {
      addToast('Failed to update feedback status', 'error');
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) return;
    try {
      await api.delete(`/admin/feedback/${feedbackId}`);
      setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
      addToast('Feedback deleted', 'success');
    } catch (err) {
      addToast('Failed to delete feedback', 'error');
    }
  };


  const handleAction = async (id, action) => {
    setActioningId(id);
    try {
      await api.post(`/admin/payments/${id}/${action}`);
      addToast(`Payment successfully ${action === 'approve' ? 'approved & upgraded!' : 'rejected'}`, 'success');
      await fetchPayments();
      if (action === 'approve' && refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      addToast(err.response?.data?.detail || 'Action failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  // Metrics for billing
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const approvedCount = payments.filter((p) => p.status === 'approved').length;
  const rejectedCount = payments.filter((p) => p.status === 'rejected').length;

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (p.user?.name || '').toLowerCase().includes(q) ||
      (p.user?.email || '').toLowerCase().includes(q) ||
      (p.transaction_id || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const role = (u.onboarding_info?.role || '').toLowerCase();
    const domain = (u.onboarding_info?.domain || '').toLowerCase();
    const source = (u.onboarding_info?.source || '').toLowerCase();
    return !q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.country || '').toLowerCase().includes(q) ||
      role.includes(q) ||
      domain.includes(q) ||
      source.includes(q);
  });

  // Count users by country
  const countryCounts = users.reduce((acc, curr) => {
    const country = curr.country || 'Unknown';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  // Filtered feedbacks
  const filteredFeedbacks = feedbacks.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (f.user_name || '').toLowerCase().includes(q) ||
      (f.user_email || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q);
    const matchesStatus = feedbackStatusFilter === 'all' || f.status === feedbackStatusFilter;
    const matchesType = feedbackTypeFilter === 'all' || f.feedback_type === feedbackTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-6 pb-20 px-2"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <Shield className="text-indigo-500" size={28} />
            {activeView === 'payments' 
              ? 'Admin Payment Verification' 
              : activeView === 'users' 
              ? 'Registered Users & Locations' 
              : 'User Feedback & Bug Reports'}
          </h2>
          <p className="text-slate-500 dark:text-zinc-400">
            {activeView === 'payments' 
              ? 'Verify manual mobile payments (UPI, GPay, PhonePe, Paytm UTR reference codes).'
              : activeView === 'users'
              ? 'View registered users, onboarding preferences, detected countries, and Bcrypt security status.'
              : 'Review feedback, bug reports, feature requests from students, and reply via their Gmail.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchPayments(); fetchUsers(); fetchFeedbacks(); }}
            disabled={loading || usersLoading || feedbackLoading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center gap-2 border border-zinc-700"
          >
            {loading || usersLoading || feedbackLoading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {/* View Switcher Tabs */}
      <motion.div variants={itemVariants} className="flex gap-2 border-b border-slate-200 dark:border-zinc-800/80 pb-1">
        <button
          onClick={() => { setActiveView('payments'); setSearchQuery(''); }}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all relative ${
            activeView === 'payments'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
          }`}
        >
          Payment Verification
          {pendingCount > 0 && (
            <span className="ml-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveView('users'); setSearchQuery(''); }}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeView === 'users'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
          }`}
        >
          Registered Users ({users.length})
        </button>
        <button
          onClick={() => { setActiveView('feedback'); setSearchQuery(''); }}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all relative ${
            activeView === 'feedback'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
          }`}
        >
          User Feedback ({feedbacks.length})
          {feedbacks.filter(f => f.status === 'new').length > 0 && (
            <span className="ml-2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
              {feedbacks.filter(f => f.status === 'new').length}
            </span>
          )}
        </button>
      </motion.div>

      {/* 💳 PAYMENTS VIEW */}
      {activeView === 'payments' && (
        <>
          {/* Metrics Row */}
          <motion.div variants={containerVariants} className="grid grid-cols-3 gap-4">
            {[
              { label: 'Pending Verification', count: pendingCount, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20' },
              { label: 'Approved Payments', count: approvedCount, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20' },
              { label: 'Rejected Entries', count: rejectedCount, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200/50 dark:border-red-500/20' },
            ].map((m, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className={`${m.bg} border rounded-2xl p-4 shadow-sm text-center flex flex-col items-center justify-center`}
              >
                <p className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase font-extrabold tracking-wider">{m.label}</p>
                <p className={`text-2xl md:text-3xl font-black mt-1 ${m.color}`}>{m.count}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Data Section */}
          <motion.div variants={itemVariants} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-xl">
            <h3 className="font-extrabold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-500" />
              Submitted Reference Codes
            </h3>

            {/* 🔍 Search + Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by name, email or UTR..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-800 dark:text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'approved', 'rejected'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                      statusFilter === f
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {f}
                    {f === 'pending' && pendingCount > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={36} className="animate-spin text-indigo-500 mb-3" />
                <p className="text-slate-400 dark:text-zinc-500 text-sm">Fetching manual billing logs...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-3">
                  <AlertCircle size={24} className="text-indigo-500" />
                </div>
                <p className="font-bold text-slate-700 dark:text-zinc-300">
                  {payments.length === 0 ? 'No payment logs submitted' : 'No results found'}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-xs">
                  {payments.length === 0
                    ? 'When users submit UPI transaction details for Pro or Premium plans, they will appear here.'
                    : 'Try a different search term or filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredPayments.map((p) => {
                    const isPending = p.status === 'pending';
                    const isApproved = p.status === 'approved';
                    const isRejected = p.status === 'rejected';

                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        className="border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-zinc-950/20 hover:border-slate-200 dark:hover:border-zinc-700 transition-colors"
                      >
                        {/* User and plan info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 text-sm md:text-base">
                              <User size={14} className="text-slate-400" />
                              {p.user?.name || 'Deleted User'}
                            </span>
                            <span className="text-slate-400 dark:text-zinc-500 text-xs truncate max-w-[150px] md:max-w-none">
                              ({p.user?.email || 'N/A'})
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                              p.plan === 'premium'
                                ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300/30 text-amber-600 dark:text-amber-400'
                                : 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300/30 text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {p.plan} — ₹{Number(p.amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-zinc-500">
                            <span className="font-semibold text-slate-600 dark:text-zinc-300">
                              App: <span className="font-bold text-indigo-500">{p.payment_method}</span>
                            </span>
                            <span>
                              UTR: <span className="font-mono font-bold text-slate-700 dark:text-zinc-200 select-all">{p.transaction_id}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(p.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action Panel */}
                        <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-0 border-slate-100 dark:border-zinc-800">
                          {isPending ? (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={actioningId !== null}
                                onClick={() => handleAction(p.id, 'reject')}
                                className="px-3.5 py-2 rounded-xl border border-red-200/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <X size={14} /> Reject
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={actioningId !== null}
                                onClick={() => handleAction(p.id, 'approve')}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/15 flex items-center gap-1.5"
                              >
                                <Check size={14} /> Approve
                              </motion.button>
                            </>
                          ) : (
                            <span className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-xl border select-none ${
                              isApproved
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-50 dark:bg-red-500/10 border-red-200/50 dark:border-red-500/20 text-red-500'
                            }`}>
                              {p.status}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* 👥 REGISTERED USERS VIEW */}
      {activeView === 'users' && (
        <>
          {/* User Metrics Row */}
          <motion.div variants={containerVariants} className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Registered Users', count: users.length, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200/50 dark:border-indigo-500/20', icon: Users },
              { label: 'Premium & Pro Users', count: users.filter(u => u.plan !== 'free').length, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20', icon: Shield },
              { label: 'Unique Active Countries', count: Object.keys(countryCounts).length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20', icon: Globe },
            ].map((m, i) => {
              const MetricIcon = m.icon;
              return (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className={`${m.bg} border rounded-2xl p-4 shadow-sm flex items-center gap-4`}
                >
                  <div className={`p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/80 shrink-0 ${m.color}`}>
                    <MetricIcon size={20} />
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-zinc-500 text-[10px] uppercase font-extrabold tracking-wider">{m.label}</p>
                    <p className={`text-2xl md:text-3xl font-black mt-0.5 ${m.color}`}>{m.count}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* User Countries Tag List */}
          <motion.div variants={itemVariants} className="bg-white/50 dark:bg-zinc-900/40 border border-slate-200/30 dark:border-zinc-800/30 rounded-3xl p-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mr-2 uppercase tracking-wide">Users by Country:</span>
            {Object.entries(countryCounts).map(([country, count]) => (
              <span key={country} className="bg-slate-100 dark:bg-zinc-800 border border-slate-200/40 dark:border-zinc-700/50 text-slate-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Globe size={12} className="text-indigo-400" />
                {country}: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{count}</span>
              </span>
            ))}
          </motion.div>

          {/* Data Section */}
          <motion.div variants={itemVariants} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-xl">
            <h3 className="font-extrabold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <Users size={18} className="text-indigo-500" />
              Registered Accounts
            </h3>

            {/* 🔍 Search Bar */}
            <div className="relative mb-5">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name, email, country, onboarding role or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-800 dark:text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {usersLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={36} className="animate-spin text-indigo-500 mb-3" />
                <p className="text-slate-400 dark:text-zinc-500 text-sm">Fetching user directories...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-3">
                  <AlertCircle size={24} className="text-indigo-500" />
                </div>
                <p className="font-bold text-slate-700 dark:text-zinc-300">
                  {users.length === 0 ? 'No users registered yet' : 'No matches found'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredUsers.map((u) => {
                    const onboarding = u.onboarding_info || {};
                    const hasOnboarding = onboarding.role || onboarding.domain || onboarding.source;

                    return (
                      <motion.div
                        key={u.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        className="border border-slate-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-zinc-950/20 hover:border-slate-200 dark:hover:border-zinc-700 transition-colors"
                      >
                        {/* Left: User Core Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 text-base">
                              <User size={16} className="text-indigo-500 shrink-0" />
                              {u.name}
                            </span>
                            <span className="text-slate-400 dark:text-zinc-500 text-xs truncate max-w-[180px] md:max-w-none">
                              ({u.email})
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                              u.plan === 'premium'
                                ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300/30 text-amber-600 dark:text-amber-400'
                                : u.plan === 'pro'
                                ? 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300/30 text-indigo-600 dark:text-indigo-400'
                                : 'bg-slate-100 dark:bg-zinc-800 border-slate-300/30 text-slate-500 dark:text-zinc-400'
                            }`}>
                              {u.plan}
                            </span>
                          </div>

                          {/* Country and Signup details */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400 dark:text-zinc-500 items-center">
                            <span className="bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <Globe size={11} /> {u.country || 'Unknown'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-zinc-500" />
                              Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                            </span>
                            {/* Cryptographic password status trigger */}
                            <button
                              onClick={() => setSelectedUserHash(u.password_hash || u.password_status || 'Protected / Redacted for Security')}
                              className="text-[10px] bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-lg hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 transition-all flex items-center gap-1"
                            >
                              🔐 Bcrypt Secure
                            </button>
                          </div>

                          {/* Onboarding Responses Details */}
                          <div className="bg-white/40 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-800/80 rounded-xl p-3 text-xs space-y-1.5">
                            <span className="font-extrabold text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Onboarding Preferences:</span>
                            {hasOnboarding ? (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                                <div>
                                  <span className="text-slate-400 dark:text-zinc-500">Role: </span>
                                  <span className="font-bold text-slate-600 dark:text-zinc-300">{onboarding.role || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 dark:text-zinc-500">Domain: </span>
                                  <span className="font-bold text-slate-600 dark:text-zinc-300">{onboarding.domain || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 dark:text-zinc-500">Source: </span>
                                  <span className="font-bold text-slate-600 dark:text-zinc-300">{onboarding.source || 'N/A'}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-400 dark:text-zinc-500 italic mt-0.5">Quick setup onboarding not completed yet.</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* 💬 FEEDBACK VIEW */}
      {activeView === 'feedback' && (
        <>
          {/* Metrics Row */}
          <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 p-5 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                Total Submissions
              </span>
              <span className="text-3xl font-black text-slate-800 dark:text-white">
                {feedbacks.length}
              </span>
            </div>
            <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 p-5 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Bug size={14} /> New Bug Reports
              </span>
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {feedbacks.filter(f => f.status === 'new' && f.feedback_type === 'Bug Report').length}
              </span>
            </div>
            <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/30 p-5 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-purple-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Sparkles size={14} /> Feature Requests
              </span>
              <span className="text-3xl font-black text-purple-600 dark:text-purple-400">
                {feedbacks.filter(f => f.feedback_type === 'Feature Request').length}
              </span>
            </div>
          </motion.div>

          {/* Filter Toolbar */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, Gmail, or text..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={feedbackTypeFilter}
                onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 focus:outline-none"
              >
                <option value="all">All Feedback Types</option>
                <option value="Bug Report">Bug Reports</option>
                <option value="Feature Request">Feature Requests</option>
                <option value="Auth and Billing">Auth & Billing</option>
                <option value="General Feedback">General Feedback</option>
              </select>
              <select
                value={feedbackStatusFilter}
                onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="new">New (Unread)</option>
                <option value="reviewed">In Review</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </motion.div>

          {/* Feedback Cards List */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm space-y-4">
            {feedbackLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={32} className="animate-spin text-indigo-500 mb-2" />
                <p className="text-sm">Loading user feedbacks...</p>
              </div>
            ) : filteredFeedbacks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-zinc-500">
                <MessageSquare size={36} className="mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                <p className="font-bold text-base text-slate-700 dark:text-zinc-300">No feedbacks found</p>
                <p className="text-xs text-slate-400 mt-1">Student submissions from the "Provide Feedback" modal will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredFeedbacks.map((fb) => {
                  const typeColors = {
                    'Bug Report': 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
                    'Feature Request': 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60 dark:border-purple-900/40',
                    'Auth and Billing': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
                    'General Feedback': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-900/40',
                  }[fb.feedback_type] || 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300';

                  return (
                    <motion.div
                      key={fb.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-slate-100 dark:border-zinc-800/80 rounded-2xl p-5 bg-slate-50/40 dark:bg-zinc-950/30 hover:border-slate-200 dark:hover:border-zinc-700 transition-all space-y-3"
                    >
                      {/* Top Row: User details, Type badge, Status dropdown */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-zinc-800/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-1.5">
                            <User size={15} className="text-indigo-500" />
                            {fb.user_name}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                            {fb.user_email}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${typeColors}`}>
                            {fb.feedback_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {new Date(fb.created_at).toLocaleDateString()} {new Date(fb.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <select
                            value={fb.status}
                            onChange={(e) => handleUpdateFeedbackStatus(fb.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl border focus:outline-none transition-colors ${
                              fb.status === 'new'
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300/60 text-rose-600 dark:text-rose-400'
                                : fb.status === 'reviewed'
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300/60 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            <option value="new">New</option>
                            <option value="reviewed">In Review</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>

                      {/* Description Body */}
                      <p className="text-xs md:text-sm text-slate-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200/50 dark:border-zinc-800/60 select-text">
                        {fb.description}
                      </p>

                      {/* Bottom Action Buttons: Mail User, Copy Gmail, Delete */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <a
                            href={`mailto:${fb.user_email}?subject=Regarding your Florix AI Feedback (${fb.feedback_type})`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <Mail size={12} />
                            <span>Reply to {fb.user_email}</span>
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(fb.user_email);
                              addToast(`Copied ${fb.user_email} to clipboard!`, 'success');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all"
                            title="Copy student Gmail"
                          >
                            <Copy size={12} />
                            <span>Copy Gmail</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="Delete Feedback"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* 🔐 Bcrypt Verification Modal */}
      <AnimatePresence>
        {selectedUserHash && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800"
            >
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-extrabold text-center text-slate-800 dark:text-white mb-2">🔐 Cryptographic Security Verification</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 text-center leading-relaxed">
                Florix AI protects all user credentials. Passwords are cryptographically salted and hashed using **Bcrypt** on the backend database level. They cannot be reversed or decrypted.
              </p>
              
              <div className="space-y-2 mb-6">
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/50 dark:border-zinc-800/80">
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase mb-1">
                    <span>Algorithm</span>
                    <span>Salt Rounds</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-200">
                    <span>Bcrypt (Blowfish)</span>
                    <span>12 (Work Factor)</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/50 dark:border-zinc-800/80">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase block mb-1">Database Column Value (Hashed Password)</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 break-all select-all select-none">
                    {selectedUserHash}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserHash(null)}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close Verification
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminPanel;
