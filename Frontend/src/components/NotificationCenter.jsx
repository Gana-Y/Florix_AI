import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Clock, Calendar, Check, CheckCircle2, X, ChevronDown,
  Settings, RefreshCw, Layers, BookOpen, Plus, Trash2, Moon,
  AlertCircle, ExternalLink, MoreVertical, Flame
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification
} from '../utils/browserNotifications';

export default function NotificationCenter({ onOpenSession, currentSessionId = null }) {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('due'); // 'due' | 'upcoming' | 'history'
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Data state
  const [dueReminders, setDueReminders] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, due: 0, total_active: 0 });
  const [quietHoursActive, setQuietHoursActive] = useState(false);
  const [preferences, setPreferences] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [snoozeMenuForId, setSnoozeMenuForId] = useState(null);

  // Form states for Create Reminder
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('18:00');
  const [formTargetType, setFormTargetType] = useState('flashcard');
  const [formRecurrence, setFormRecurrence] = useState('once');
  const [userSessions, setUserSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(currentSessionId || '');
  const [creatingReminder, setCreatingReminder] = useState(false);

  // Settings form states
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(true);
  const [sm2AutoSyncEnabled, setSm2AutoSyncEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [savingSettings, setSavingSettings] = useState(false);

  const containerRef = useRef(null);

  // Fetch notifications feed
  const fetchNotifications = useCallback(async (isSync = false) => {
    try {
      if (isSync) setSyncing(true);
      else setLoading(true);

      const res = await api.get('/notifications');
      setDueReminders(res.data.due_reminders || []);
      setUpcomingReminders(res.data.upcoming_reminders || []);
      setRecentHistory(res.data.recent_history || []);
      setCounts(res.data.counts || { unread: 0, due: 0, total_active: 0 });
      setQuietHoursActive(Boolean(res.data.quiet_hours_active));
      if (res.data.preferences) {
        setPreferences(res.data.preferences);
        setBrowserAlertsEnabled(res.data.preferences.browser_notifications_enabled);
        setSm2AutoSyncEnabled(res.data.preferences.sm2_auto_reminders);
        setQuietHoursEnabled(res.data.preferences.quiet_hours_enabled);
        setQuietStart(res.data.preferences.quiet_hours_start || '22:00');
        setQuietEnd(res.data.preferences.quiet_hours_end || '08:00');
      }
    } catch (err) {
      console.warn('[Notifications] Failed to load notifications feed:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  // Initial fetch and periodic polling (every 60s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSnoozeMenuForId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Load user sessions for reminder creation dropdown
  const loadUserSessions = async () => {
    try {
      const res = await api.get('/library');
      if (Array.isArray(res.data)) {
        setUserSessions(res.data);
      }
    } catch (_) {}
  };

  const handleOpenCreateModal = () => {
    loadUserSessions();
    const today = new Date();
    // Default to tomorrow 9 AM
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDate(tomorrow.toISOString().split('T')[0]);
    setFormTime('09:00');
    setFormTitle('');
    setFormMessage('');
    setFormTargetType('flashcard');
    setFormRecurrence('once');
    setSelectedSessionId(currentSessionId || '');
    setShowCreateModal(true);
  };

  // Quick preset dates
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === 'tonight') {
      setFormDate(now.toISOString().split('T')[0]);
      setFormTime('20:00');
    } else if (preset === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      setFormDate(d.toISOString().split('T')[0]);
      setFormTime('09:00');
    } else if (preset === '3days') {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      setFormDate(d.toISOString().split('T')[0]);
      setFormTime('10:00');
    } else if (preset === '1week') {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      setFormDate(d.toISOString().split('T')[0]);
      setFormTime('10:00');
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      addToast('Please enter a reminder title.', 'error');
      return;
    }
    if (!formDate || !formTime) {
      addToast('Please select a date and time.', 'error');
      return;
    }

    try {
      setCreatingReminder(true);
      const scheduledDateTime = new Date(`${formDate}T${formTime}:00`);
      
      await api.post('/reminders', {
        title: formTitle.trim(),
        message: formMessage.trim() || null,
        scheduled_at: scheduledDateTime.toISOString(),
        session_id: selectedSessionId ? parseInt(selectedSessionId, 10) : null,
        target_type: formTargetType,
        recurrence: formRecurrence,
      });

      addToast('Study reminder scheduled successfully! ⏰', 'success');
      setShowCreateModal(false);
      fetchNotifications();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create reminder.';
      addToast(msg, 'error');
    } finally {
      setCreatingReminder(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/notifications/sync-revisions');
      const count = res.data?.synced_count ?? 0;
      addToast(`Synchronized ${count} SM-2 revision reminder(s).`, 'success');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to sync revisions.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkAllRead = async () => {
    const itemsToDismiss = [...dueReminders];
    // Optimistic instant UI clear: remove due alerts from Due Now and archive into history
    setDueReminders([]);
    setUpcomingReminders(prev => prev.map(r => ({ ...r, is_read: true })));
    if (itemsToDismiss.length > 0) {
      setRecentHistory(prev => [
        ...itemsToDismiss.map(r => ({ ...r, status: 'dismissed', is_read: true })),
        ...prev
      ]);
    }
    setCounts(prev => ({
      ...prev,
      due: 0,
      unread: 0
    }));

    try {
      await api.post('/notifications/read-all');
      addToast('All notifications marked as read and cleared.', 'success');
      fetchNotifications();
    } catch (_) {
      fetchNotifications();
    }
  };

  const handleDismissAll = async () => {
    if (dueReminders.length === 0) return;
    const itemsToDismiss = [...dueReminders];
    // Optimistic instant UI clear
    setDueReminders([]);
    setRecentHistory(prev => [
      ...itemsToDismiss.map(r => ({ ...r, status: 'dismissed', is_read: true })),
      ...prev
    ]);
    setCounts(prev => ({
      ...prev,
      due: 0,
      unread: Math.max(0, prev.unread - itemsToDismiss.length)
    }));

    try {
      await api.post('/notifications/dismiss-all');
      addToast('All due reminders cleared and moved to history.', 'info');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to clear reminders.', 'error');
      fetchNotifications();
    }
  };

  const handleComplete = async (reminderId, e) => {
    e?.stopPropagation();
    // 1. Optimistic removal from UI for instant visual response
    const itemToMove = dueReminders.find(r => r.id === reminderId) || upcomingReminders.find(r => r.id === reminderId);
    setDueReminders(prev => prev.filter(r => r.id !== reminderId));
    setUpcomingReminders(prev => prev.filter(r => r.id !== reminderId));
    if (itemToMove) {
      setRecentHistory(prev => [{ ...itemToMove, status: 'completed', is_read: true }, ...prev]);
    }
    setCounts(prev => ({
      ...prev,
      due: Math.max(0, prev.due - 1),
      unread: Math.max(0, prev.unread - 1)
    }));

    try {
      await api.patch(`/reminders/${reminderId}/complete`);
      addToast('Reminder marked as completed! 🎯', 'success');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to complete reminder.', 'error');
      fetchNotifications();
    }
  };

  const handleDismiss = async (reminderId, e) => {
    e?.stopPropagation();
    // 1. Optimistic removal from UI so card disappears immediately
    const itemToMove = dueReminders.find(r => r.id === reminderId) || upcomingReminders.find(r => r.id === reminderId);
    setDueReminders(prev => prev.filter(r => r.id !== reminderId));
    setUpcomingReminders(prev => prev.filter(r => r.id !== reminderId));
    if (itemToMove) {
      setRecentHistory(prev => [{ ...itemToMove, status: 'dismissed', is_read: true }, ...prev]);
    }
    setCounts(prev => ({
      ...prev,
      due: Math.max(0, prev.due - 1),
      unread: Math.max(0, prev.unread - 1)
    }));

    try {
      await api.patch(`/reminders/${reminderId}/dismiss`);
      addToast('Reminder dismissed.', 'info');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to dismiss reminder.', 'error');
      fetchNotifications();
    }
  };

  const handleDelete = async (reminderId, e) => {
    e?.stopPropagation();
    setUpcomingReminders(prev => prev.filter(r => r.id !== reminderId));
    setDueReminders(prev => prev.filter(r => r.id !== reminderId));
    setRecentHistory(prev => prev.filter(r => r.id !== reminderId));
    setCounts(prev => ({
      ...prev,
      total_active: Math.max(0, prev.total_active - 1)
    }));

    try {
      await api.delete(`/reminders/${reminderId}`);
      addToast('Reminder deleted.', 'info');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to delete reminder.', 'error');
      fetchNotifications();
    }
  };

  const handleSnooze = async (reminderId, minutes, e) => {
    e?.stopPropagation();
    const itemToMove = dueReminders.find(r => r.id === reminderId);
    setSnoozeMenuForId(null);

    // Optimistic UI update
    if (itemToMove) {
      setDueReminders(prev => prev.filter(r => r.id !== reminderId));
      const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
      setUpcomingReminders(prev => [{ ...itemToMove, status: 'snoozed', snoozed_until: snoozedUntil }, ...prev]);
      setCounts(prev => ({
        ...prev,
        due: Math.max(0, prev.due - 1)
      }));
    }

    try {
      await api.patch(`/reminders/${reminderId}/snooze`, { minutes });
      addToast(`Reminder snoozed for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}. ⏰`, 'info');
      fetchNotifications();
    } catch (err) {
      addToast('Failed to snooze reminder.', 'error');
      fetchNotifications();
    }
  };

  const handleOpenItem = (reminder) => {
    if (reminder.session_id && typeof onOpenSession === 'function') {
      const targetView = reminder.target_type === 'flashcard'
        ? 'flashcards'
        : reminder.target_type === 'quiz'
          ? 'quiz'
          : reminder.target_type === 'visual'
            ? 'visual'
            : 'summary';

      onOpenSession({
        id: reminder.session_id,
        filename: reminder.session_title || reminder.title,
        summary: reminder.message || '',
        initialView: targetView
      });
      setIsOpen(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.patch('/user/notification-settings', {
        browser_notifications_enabled: browserAlertsEnabled,
        sm2_auto_reminders: sm2AutoSyncEnabled,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
      });

      if (browserAlertsEnabled && getNotificationPermission() === 'default') {
        await requestNotificationPermission();
      }

      addToast('Notification preferences saved.', 'success');
      setShowSettingsModal(false);
      fetchNotifications();
    } catch (err) {
      addToast('Failed to update preferences.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const requestBrowserAlerts = async () => {
    const res = await requestNotificationPermission();
    if (res === 'granted') {
      showBrowserNotification({
        title: 'Florix AI Notifications Enabled! 🚀',
        body: 'You will now receive timely alerts for your SM-2 revisions and study goals.'
      });
      addToast('Browser notifications enabled!', 'success');
    } else {
      addToast('Permission not granted. Please enable notifications in your browser settings.', 'warning');
    }
  };

  const formatDueTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  const getTargetIcon = (targetType) => {
    switch (targetType) {
      case 'flashcard':
        return <Layers size={14} className="text-purple-500" />;
      case 'quiz':
        return <CheckCircle2 size={14} className="text-emerald-500" />;
      case 'visual':
        return <Flame size={14} className="text-amber-500" />;
      default:
        return <BookOpen size={14} className="text-indigo-500" />;
    }
  };

  return (
    <div className="relative inline-block z-50" ref={containerRef}>
      {/* Bell Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 shadow-md border border-slate-200/50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        aria-label="Revision Reminders & Notifications"
        title="Revision Reminders & Notifications"
      >
        <Bell size={17} className={counts.due > 0 ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : ''} />
        {counts.due > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white dark:ring-zinc-900">
            {counts.due > 9 ? '9+' : counts.due}
          </span>
        )}
        {counts.due === 0 && counts.unread > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-900" />
        )}
      </motion.button>

      {/* Main Notification Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#121324] border border-slate-200/80 dark:border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] z-[200] overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Popover Header */}
            <div className="shrink-0 p-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-800 dark:text-white">
                  Revision Alerts
                </span>
                {counts.due > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                    {counts.due} due
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  title="Synchronize SM-2 Revisions"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin text-indigo-500' : ''} />
                </button>
                <button
                  onClick={handleOpenCreateModal}
                  title="Schedule New Study Reminder"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Plus size={15} />
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  title="Notification Settings"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Settings size={14} />
                </button>
              </div>
            </div>

            {/* Quiet Hours Banner */}
            {quietHoursActive && (
              <div className="shrink-0 px-4 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <Moon size={13} className="shrink-0 text-indigo-500" />
                <span>Quiet Hours active ({preferences?.quiet_hours_start} - {preferences?.quiet_hours_end})</span>
              </div>
            )}

            {/* Browser Permission Prompt */}
            {isNotificationSupported() && getNotificationPermission() === 'default' && (
              <div className="shrink-0 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs">
                <span className="text-amber-800 dark:text-amber-200 text-[11px]">Enable desktop alerts?</span>
                <button
                  onClick={requestBrowserAlerts}
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-bold transition-colors"
                >
                  Enable
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="shrink-0 flex items-center border-b border-slate-100 dark:border-zinc-800 px-3 bg-white dark:bg-zinc-900">
              {[
                { id: 'due', label: 'Due Now', count: dueReminders.length },
                { id: 'upcoming', label: 'Upcoming', count: upcomingReminders.length },
                { id: 'history', label: 'History', count: recentHistory.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === t.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      activeTab === t.id
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 min-h-[220px] max-h-[380px]">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw size={20} className="animate-spin text-indigo-500 mb-2" />
                  <span className="text-xs">Checking revision schedules...</span>
                </div>
              ) : (
                <>
                  {/* DUE NOW TAB */}
                  {activeTab === 'due' && (
                    dueReminders.length === 0 ? (
                      <div className="py-10 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mb-3">
                          <Check size={20} />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">You're all caught up!</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">No SM-2 cards or study goals are due right now.</p>
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-4 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                          + Set Reminder
                        </button>
                      </div>
                    ) : (
                      dueReminders.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleOpenItem(item)}
                          className={`group p-3 rounded-2xl border transition-all cursor-pointer relative ${
                            item.reminder_type === 'sm2_revision'
                              ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-900/40 hover:border-purple-300'
                              : 'bg-white dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700/60 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {getTargetIcon(item.target_type)}
                              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                item.reminder_type === 'sm2_revision'
                                  ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                                  : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                              }`}>
                                {item.reminder_type === 'sm2_revision' ? 'SM-2 Revision' : 'Reminder'}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                              <Clock size={10} /> Due Now
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
                            {item.title}
                          </h4>
                          {item.message && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                              {item.message}
                            </p>
                          )}

                          {/* Quick Action Footer */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-700/50 flex items-center justify-between">
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:underline">
                              Revise <ExternalLink size={9} />
                            </span>

                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              {/* Snooze Dropdown Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setSnoozeMenuForId(snoozeMenuForId === item.id ? null : item.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-[10px] font-bold border border-slate-200/80 dark:border-zinc-700/80 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                                  title="Snooze reminder"
                                >
                                  <Clock size={11} className="text-amber-500" />
                                  <span>Snooze</span>
                                </button>
                                {snoozeMenuForId === item.id && (
                                  <div className="absolute right-0 top-full mt-1.5 w-36 bg-white dark:bg-[#18192b] border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 py-1.5 animate-fadeIn">
                                    <div className="px-3 py-1 text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800 mb-1">
                                      Snooze For
                                    </div>
                                    {[
                                      { label: '30 mins', mins: 30 },
                                      { label: '1 hour', mins: 60 },
                                      { label: '3 hours', mins: 180 },
                                      { label: 'Tomorrow', mins: 1440 },
                                    ].map(opt => (
                                      <button
                                        key={opt.mins}
                                        type="button"
                                        onClick={(e) => handleSnooze(item.id, opt.mins, e)}
                                        className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                                      >
                                        <span>{opt.label}</span>
                                        <Clock size={10} className="text-slate-400" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Complete Button (Checkmark) */}
                              <button
                                type="button"
                                onClick={(e) => handleComplete(item.id, e)}
                                title="Mark as Completed"
                                aria-label="Mark as Completed"
                                className="p-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-xs"
                              >
                                <Check size={14} className="stroke-[2.5]" />
                              </button>

                              {/* Dismiss Button (X Mark) */}
                              <button
                                type="button"
                                onClick={(e) => handleDismiss(item.id, e)}
                                title="Dismiss Reminder"
                                aria-label="Dismiss Reminder"
                                className="p-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-xs"
                              >
                                <X size={14} className="stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  )}

                  {/* UPCOMING TAB */}
                  {activeTab === 'upcoming' && (
                    upcomingReminders.length === 0 ? (
                      <div className="py-10 text-center flex flex-col items-center">
                        <Clock size={24} className="text-slate-300 dark:text-zinc-600 mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">No scheduled upcoming reminders</p>
                        <p className="text-[11px] text-slate-400 mt-1">Schedule a revision goal to stay on track.</p>
                      </div>
                    ) : (
                      upcomingReminders.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleOpenItem(item)}
                          className="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-slate-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="flex items-center gap-1 font-bold text-slate-500 dark:text-zinc-400">
                              {getTargetIcon(item.target_type)}
                              {formatDueTime(item.status === 'snoozed' ? item.snoozed_until : item.scheduled_at)}
                            </span>
                            {item.status === 'snoozed' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-extrabold text-[9px]">
                                Snoozed
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
                            {item.title}
                          </h4>
                          {item.message && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                              {item.message}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleComplete(item.id, e)}
                              className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-zinc-300 hover:text-emerald-500 rounded-md font-bold transition-colors"
                            >
                              Done
                            </button>
                            <button
                              onClick={(e) => handleDelete(item.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )
                  )}

                  {/* HISTORY TAB */}
                  {activeTab === 'history' && (
                    recentHistory.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        No completed reminder history yet.
                      </div>
                    ) : (
                      recentHistory.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/30 opacity-75"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="line-through font-medium text-slate-600 dark:text-zinc-400">{item.title}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-400">{item.status}</span>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 p-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/40 text-xs">
              <div className="flex items-center gap-3">
                {dueReminders.length > 0 && activeTab === 'due' && (
                  <button
                    type="button"
                    onClick={handleDismissAll}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Dismiss all due alerts and move to history"
                  >
                    <X size={12} className="stroke-[2.5]" />
                    <span>Clear all due</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> New Reminder
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CREATE REMINDER MODAL ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-500" />
                  Schedule Revision Reminder
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'tonight', label: 'Tonight (8 PM)' },
                  { id: 'tomorrow', label: 'Tomorrow (9 AM)' },
                  { id: '3days', label: 'In 3 Days' },
                  { id: '1week', label: 'In 1 Week' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold shrink-0 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreateReminder} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                    Goal / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Revise Machine Learning Chapter 3 Flashcards"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
                </div>

                {userSessions.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                      Link to Study Session (Optional)
                    </label>
                    <select
                      value={selectedSessionId}
                      onChange={e => {
                        setSelectedSessionId(e.target.value);
                        if (!formTitle && e.target.value) {
                          const s = userSessions.find(x => String(x.id) === e.target.value);
                          if (s) setFormTitle(`Revise: ${s.ai_title || s.filename}`);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">General (No specific session)</option>
                      {userSessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.ai_title || s.filename}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formTime}
                      onChange={e => setFormTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                      Target Activity
                    </label>
                    <select
                      value={formTargetType}
                      onChange={e => setFormTargetType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="flashcard">Flashcards (SM-2)</option>
                      <option value="quiz">Practice Quiz</option>
                      <option value="visual">Concept Map</option>
                      <option value="session">Full Study Session</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                      Recurrence
                    </label>
                    <select
                      value={formRecurrence}
                      onChange={e => setFormRecurrence(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="once">Once only</option>
                      <option value="daily">Daily repeat</option>
                      <option value="weekly">Weekly repeat</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formMessage}
                    onChange={e => setFormMessage(e.target.value)}
                    placeholder="Key concepts to focus on or questions to review..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingReminder}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    {creatingReminder ? 'Scheduling...' : 'Set Reminder'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SETTINGS MODAL ── */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Settings size={18} className="text-indigo-500" />
                  Notification Preferences
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Browser Notifications Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">Desktop & Browser Alerts</p>
                    <p className="text-[11px] text-slate-400">Receive system popups when revision cards are due</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={browserAlertsEnabled}
                    onChange={e => setBrowserAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </div>

                {/* SM-2 Auto Sync Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">Automatic SM-2 Sync</p>
                    <p className="text-[11px] text-slate-400">Auto-create revision reminders from spaced repetition dates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={sm2AutoSyncEnabled}
                    onChange={e => setSm2AutoSyncEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Quiet Hours */}
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">Quiet Hours</p>
                      <p className="text-[11px] text-slate-400">Silence popups during sleep or deep focus</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={quietHoursEnabled}
                      onChange={e => setQuietHoursEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                    />
                  </div>

                  {quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-zinc-700/60">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
                          Starts (HH:MM)
                        </label>
                        <input
                          type="time"
                          value={quietStart}
                          onChange={e => setQuietStart(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
                          Ends (HH:MM)
                        </label>
                        <input
                          type="time"
                          value={quietEnd}
                          onChange={e => setQuietEnd(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
