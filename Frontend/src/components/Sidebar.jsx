import React, { useState, useEffect, useRef } from 'react';
import {
  Home, Search, PlusCircle, BookOpen, Clock, HelpCircle,
  Brain, ChevronLeft, ChevronRight, ChevronDown, Sparkles,
  MessageSquare, X, UserCircle, Bookmark, TrendingUp, CreditCard, Shield, Activity,
  Pin, Trash2, Edit3, Flame, Folder, FolderPlus, Tag, Check, MoreVertical,
  MessageSquarePlus, ArrowUpDown, CornerDownRight, Plus, Zap, Crown, Award, LogOut,
  CalendarCheck, Mic, FileText, Globe, Video, Headphones, FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import CreateFolderModal from './CreateFolderModal';
import ProfileModal from './ProfileModal';
import { renderFolderIcon, getFolderColorConfig } from '../utils/folderIcons';

const renderMaterialFileIcon = (filename = '') => {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) {
    return <FileText size={11} className="text-rose-500 shrink-0" />;
  }
  if (lower.includes('youtube') || lower.endsWith('.mp4') || lower.endsWith('.mkv')) {
    return <Video size={11} className="text-amber-500 shrink-0" />;
  }
  if (lower.includes('wikipedia') || lower.startsWith('http://') || lower.startsWith('https://')) {
    return <Globe size={11} className="text-sky-500 shrink-0" />;
  }
  if (lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.java') || lower.endsWith('.cpp')) {
    return <FileCode size={11} className="text-indigo-500 shrink-0" />;
  }
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
    return <Headphones size={11} className="text-purple-500 shrink-0" />;
  }
  return <FileText size={11} className="text-indigo-500 shrink-0" />;
};

const PLAN_COLORS = {
  free:    'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400',
  pro:     'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  premium: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
};

const CATEGORY_COLORS = {
  Study: "bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Coding: "bg-purple-100/70 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Research: "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Business: "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Personal: "bg-pink-100/70 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Career: "bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Interview: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const EMOJI_OPTIONS = ['📁', '💲', '💻', '📚', '⚡', '🎯', '🔬', '🧠', '📝', '💡', '🎓', '🔥'];

const Sidebar = ({
  activeTab, setActiveTab, onNewSessionClick, onLogout, user,
  isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose,
  onStartStudy, onOpenFeedback, activeSpaceId, onSelectSpace, onOpenChat
}) => {
  const { addToast } = useToast();
  const [pendingPayments, setPendingPayments] = useState(0);
  const [dailyChats, setDailyChats] = useState(0);
  
  // Sessions & Conversations
  const [sessions, setSessions] = useState([]);
  const [standaloneChats, setStandaloneChats] = useState([]);
  const [pinnedChats, setPinnedChats] = useState([]);

  // Folders & Workspaces
  const [spaces, setSpaces] = useState([]);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState(new Set());
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [spacesSortBy, setSpacesSortBy] = useState('newest'); // 'newest' | 'alphabetical' | 'count'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [spacesShowAll, setSpacesShowAll] = useState(false);

  // Chats Section (ChatGPT Style)
  const [isChatsCollapsed, setIsChatsCollapsed] = useState(false);
  const [chatsShowAll, setChatsShowAll] = useState(false);

  // Session Context Menu
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, sessionId: null });
  const [showCategorySubmenu, setShowCategorySubmenu] = useState(false);
  const [showSpaceSubmenu, setShowSpaceSubmenu] = useState(false);

  // Space Context Menu / Inline Rename
  const [editingSpaceId, setEditingSpaceId] = useState(null);
  const [editSpaceName, setEditSpaceName] = useState('');
  
  const contextMenuRef = useRef(null);

  // Profile Popover & Modal State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('overview');
  const [userStats, setUserStats] = useState(null);
  const profileMenuRef = useRef(null);

  // Fetch user stats for profile popover
  useEffect(() => {
    if (user?.id) {
      api.get('/stats')
        .then(res => setUserStats(res.data))
        .catch(() => {});
    }
  }, [user?.id, isProfileModalOpen]);

  // Click outside to close profile popover
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showProfileMenu]);

  // Global event listener to open profile modal from anywhere
  useEffect(() => {
    const handleOpenProfileEvent = (e) => {
      if (e?.detail?.tab) setProfileModalTab(e.detail.tab);
      setIsProfileModalOpen(true);
    };
    window.addEventListener('florix:open-profile', handleOpenProfileEvent);
    return () => window.removeEventListener('florix:open-profile', handleOpenProfileEvent);
  }, []);

  // Fetch study sessions
  const fetchSessions = async () => {
    try {
      const res = await api.get('/library');
      setSessions(res.data);
    } catch (_) {}
  };

  // Fetch spaces (projects)
  const fetchSpaces = async () => {
    try {
      const res = await api.get('/projects');
      setSpaces(res.data);
    } catch (_) {}
  };

  // Fetch conversations (both standalone and pinned)
  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      const allConvs = res.data;
      setPinnedChats(allConvs.filter(c => c.is_pinned));
      setStandaloneChats(allConvs.filter(c => !c.project_id && !c.is_pinned));
    } catch (_) {}
  };

  useEffect(() => {
    if (!user) return;
    fetchSessions();
    fetchSpaces();
    fetchConversations();

    const onRefresh = (e) => {
      if (e?.detail?.chatId && e?.detail?.title) {
        const { chatId, title } = e.detail;
        setStandaloneChats((prev) => {
          const exists = prev.some((c) => c.id === chatId);
          if (exists) {
            return prev.map((c) => (c.id === chatId ? { ...c, title, updated_at: new Date().toISOString() } : c));
          }
          return [{ id: chatId, title, is_pinned: false, updated_at: new Date().toISOString() }, ...prev];
        });
        setPinnedChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, title, updated_at: new Date().toISOString() } : c))
        );
        setSpaces((prev) =>
          prev.map((sp) => ({
            ...sp,
            subchats: (sp.subchats || []).map((sc) =>
              sc.id === chatId ? { ...sc, title, updated_at: new Date().toISOString() } : sc
            ),
          }))
        );
      }
      fetchSessions();
      fetchSpaces();
      fetchConversations();
    };

    const onDeleted = (e) => {
      const deletedId = e?.detail?.chatId;
      if (deletedId) {
        setStandaloneChats((prev) => prev.filter((c) => c.id !== deletedId));
        setPinnedChats((prev) => prev.filter((c) => c.id !== deletedId));
        setSpaces((prev) =>
          prev.map((sp) => ({
            ...sp,
            subchats: (sp.subchats || []).filter((sc) => sc.id !== deletedId),
          }))
        );
      }
      fetchConversations();
      fetchSpaces();
    };

    window.addEventListener('florix:session-created', onRefresh);
    window.addEventListener('florix:session-updated', onRefresh);
    window.addEventListener('florix:conversation-updated', onRefresh);
    window.addEventListener('florix:conversation-deleted', onDeleted);
    return () => {
      window.removeEventListener('florix:session-created', onRefresh);
      window.removeEventListener('florix:session-updated', onRefresh);
      window.removeEventListener('florix:conversation-updated', onRefresh);
      window.removeEventListener('florix:conversation-deleted', onDeleted);
    };
  }, [user]);

  // Fetch pending payments for admin badge
  useEffect(() => {
    if (!user?.is_admin) return;
    api.get('/admin/payments')
      .then(res => setPendingPayments(res.data.filter(p => p.status === 'pending').length))
      .catch(() => {});
  }, [user]);

  // Daily chat count for free users
  useEffect(() => {
    if (!user || user.plan !== 'free') return;
    api.get('/user/chat-count')
      .then(res => setDailyChats(res.data.count || 0))
      .catch(() => {});
  }, [user]);

  // Folder Actions
  const handleToggleExpandSpace = (e, spaceId) => {
    e.stopPropagation();
    setExpandedSpaceIds(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const handleDeleteSpace = async (e, spaceId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this folder? Subchats and notes will be kept in your library.')) return;
    try {
      await api.delete(`/projects/${spaceId}`);
      setSpaces(prev => prev.filter(s => s.id !== spaceId));
      fetchSessions();
      fetchConversations();
      if (activeSpaceId === spaceId) onSelectSpace?.(null);
      addToast('Folder deleted', 'success');
    } catch {
      addToast('Failed to delete folder', 'error');
    }
  };

  const handleTogglePinSpace = async (e, spaceId, currentPinned) => {
    e.stopPropagation();
    try {
      await api.patch(`/projects/${spaceId}`, { is_pinned: !currentPinned });
      setSpaces(prev => prev.map(s => s.id === spaceId ? { ...s, is_pinned: !currentPinned } : s));
      addToast(!currentPinned ? 'Space pinned to top' : 'Space unpinned', 'success');
    } catch {
      addToast('Failed to pin space', 'error');
    }
  };

  const handleStartSubchatInSpace = async (e, spaceId) => {
    e.stopPropagation();
    try {
      const res = await api.post('/conversations', { title: 'New Subchat', project_id: spaceId });
      fetchSpaces();
      fetchConversations();
      window.dispatchEvent(new CustomEvent('florix:conversation-updated'));
      onOpenChat?.(res.data.id, spaceId);
      setActiveTab?.('AI Chat');
    } catch {
      addToast('Failed to start subchat', 'error');
    }
  };

  // Chat Actions
  const handleTogglePinChat = async (e, chatId, currentPinned) => {
    e.stopPropagation();
    try {
      await api.patch(`/conversations/${chatId}/pin`, { is_pinned: !currentPinned });
      fetchConversations();
      window.dispatchEvent(new CustomEvent('florix:conversation-updated'));
      addToast(!currentPinned ? 'Chat pinned to top' : 'Chat unpinned', 'success');
    } catch {
      addToast('Failed to pin chat', 'error');
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? All messages will be permanently removed.')) return;
    try {
      await api.delete(`/conversations/${chatId}`);
      fetchConversations();
      fetchSpaces();
      window.dispatchEvent(new CustomEvent('florix:conversation-deleted', { detail: { chatId } }));
      window.dispatchEvent(new CustomEvent('florix:conversation-updated'));
      addToast('Chat deleted', 'success');
    } catch {
      addToast('Failed to delete chat', 'error');
    }
  };

  // Session Context Menu Handlers
  const handleContextMenu = (e, sessionId) => {
    e.preventDefault();
    setContextMenu({ show: true, x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 260), sessionId });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, sessionId: null });
    setShowCategorySubmenu(false);
    setShowSpaceSubmenu(false);
  };

  const handleMoveToSpace = async (sessionId, spaceId) => {
    try {
      await api.patch(`/library/${sessionId}/project`, { project_id: spaceId });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, project_id: spaceId } : s));
      closeContextMenu();
      fetchSpaces();
      addToast(spaceId ? 'Session moved to Space!' : 'Session removed from Space', 'success');
    } catch {
      addToast('Failed to move session', 'error');
    }
  };

  const handleTogglePinSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    try {
      await api.patch(`/library/${sessionId}/pin`, { is_pinned: !session.is_pinned });
      fetchSessions();
      addToast(session.is_pinned ? 'Unpinned session' : 'Pinned session to top', 'success');
    } catch {
      addToast('Failed to update pin', 'error');
    }
    closeContextMenu();
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this study session?')) return;
    try {
      await api.delete(`/library/${sessionId}`);
      fetchSessions();
      fetchSpaces();
      addToast('Session deleted', 'success');
      window.dispatchEvent(new CustomEvent('florix:session-updated', { detail: { sessionId, action: 'delete' } }));
      window.dispatchEvent(new CustomEvent('florix:stats-updated', { detail: { sessionId, action: 'delete_session' } }));
    } catch {
      addToast('Failed to delete session', 'error');
    }
    closeContextMenu();
  };

  // Navigation Items
  const menuItems = [
    { id: 'Home',              icon: Home,          label: 'Home' },
    { id: 'AI Chat',           icon: MessageSquare, label: 'AI Chat' },
    { id: 'Search content',    icon: Search,        label: 'Search' },
    { id: 'New Study Session', icon: PlusCircle,    label: 'New Session' },
    { id: 'Study Planner',     icon: CalendarCheck, label: 'Study Planner' },
    { id: 'Exams',             icon: Award,         label: 'Exams & Mocks' },
    { id: 'Mistakes',          icon: Brain,         label: 'Mistake Bank' },
    { id: 'Viva',              icon: Mic,           label: 'Viva & Oral Exam' },
    { id: 'My Library',        icon: BookOpen,      label: 'My Library' },
    { id: 'Bookmarks',         icon: Bookmark,      label: 'Bookmarks' },
    { id: 'Progress',          icon: TrendingUp,    label: 'Progress' },
    { id: 'History',           icon: Clock,         label: 'History' },
    { id: 'Personalization',   icon: Sparkles,      label: 'Personalization' },
    { id: 'Pricing',           icon: Zap,           label: 'Upgrade Plan' },
    ...(user?.is_admin ? [
      { id: 'Admin Panel',    icon: Shield,   label: 'Admin Panel' },
      { id: 'System Monitor', icon: Activity, label: 'System Monitor' },
    ] : []),
  ];

  // Sorted Spaces
  const sortedSpaces = [...spaces].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
    if (spacesSortBy === 'alphabetical') return a.name.localeCompare(b.name);
    if (spacesSortBy === 'count') return ((b.chat_count || 0) + (b.session_count || 0)) - ((a.chat_count || 0) + (a.session_count || 0));
    return new Date(b.created_at) - new Date(a.created_at); // newest
  });

  const displayedSpaces = spacesShowAll ? sortedSpaces : sortedSpaces.slice(0, 5);
  const displayedChats = chatsShowAll ? standaloneChats : standaloneChats.slice(0, 5);
  const pinnedSessions = sessions.filter(s => s.is_pinned);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const sidebarWidth = isCollapsed ? 76 : 260;

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        data-lenis-prevent="true"
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed md:sticky top-0 left-0 h-screen z-50 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-zinc-800/80 shadow-xl select-none overscroll-contain ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100/80 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Brain size={20} />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  FLORIX AI
                </span>
                <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest -mt-0.5">
                  Academic Tutor
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Nav Area */}
        <nav
          data-lenis-prevent="true"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-3 space-y-1 custom-scrollbar"
        >
          {/* Main Navigation Items */}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && !activeSpaceId;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onSelectSpace?.(null);
                  if (item.id === 'New Study Session') onNewSessionClick?.();
                  else setActiveTab(item.id);
                  if (window.innerWidth < 768) onMobileClose?.();
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'} py-2 rounded-xl text-xs font-semibold transition-all relative ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400 shrink-0'} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {item.id === 'Admin Panel' && pendingPayments > 0 && (
                  <span className="ml-auto w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" />
                )}
              </motion.button>
            );
          })}

          {/* ── 📌 PINNED SECTION (ChatGPT Style) ── */}
          {!isCollapsed && (pinnedChats.length > 0 || pinnedSessions.length > 0) && (
            <div className="pt-4 pb-1 border-t border-slate-100/60 dark:border-zinc-800/60 mt-2">
              <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-wider uppercase px-3 mb-1.5 flex items-center gap-1.5">
                <Pin size={10} className="fill-current text-indigo-500 rotate-45" />
                <span>Pinned</span>
              </p>
              <div className="space-y-0.5 px-1">
                {/* Pinned Chats */}
                {pinnedChats.map((chat) => (
                  <div
                    key={`chat-${chat.id}`}
                    onClick={() => { onOpenChat?.(chat.id); setActiveTab('AI Chat'); if (window.innerWidth < 768) onMobileClose?.(); }}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100/60 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare size={12} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{chat.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleTogglePinChat(e, chat.id, true)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600"
                      title="Unpin chat"
                    >
                      <Pin size={10} className="fill-current text-indigo-500 rotate-45" />
                    </button>
                  </div>
                ))}

                {/* Pinned Study Sessions */}
                {pinnedSessions.map((session) => (
                  <div
                    key={`session-${session.id}`}
                    onClick={() => onStartStudy?.(session)}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100/60 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookOpen size={12} className="text-purple-500 shrink-0" />
                      <span className="truncate">{session.filename}</span>
                    </div>
                    <button
                      onClick={() => handleTogglePinSession(session.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-purple-600"
                      title="Unpin session"
                    >
                      <Pin size={10} className="fill-current text-purple-500 rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 📂 FOLDERS & WORKSPACES (ChatGPT + Claude Superior Organization) ── */}
          {!isCollapsed && (
            <div className="pt-3 pb-1 border-t border-slate-100/60 dark:border-zinc-800/60 mt-2">
              <div className="flex items-center justify-between px-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <Folder size={12} className="text-indigo-500" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-wider uppercase">
                    Folders
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full font-mono font-bold">
                    {spaces.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Sorting dropdown toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSortMenu(prev => !prev)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                      title="Sort Folders"
                    >
                      <ArrowUpDown size={11} />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-xl text-[11px] font-semibold flex flex-col gap-0.5">
                        <button
                          onClick={() => { setSpacesSortBy('newest'); setShowSortMenu(false); }}
                          className={`px-2.5 py-1 text-left rounded-lg ${spacesSortBy === 'newest' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'text-slate-600 dark:text-zinc-400'}`}
                        >
                          Date (Newest)
                        </button>
                        <button
                          onClick={() => { setSpacesSortBy('alphabetical'); setShowSortMenu(false); }}
                          className={`px-2.5 py-1 text-left rounded-lg ${spacesSortBy === 'alphabetical' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'text-slate-600 dark:text-zinc-400'}`}
                        >
                          Name (A-Z)
                        </button>
                        <button
                          onClick={() => { setSpacesSortBy('count'); setShowSortMenu(false); }}
                          className={`px-2.5 py-1 text-left rounded-lg ${spacesSortBy === 'count' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'text-slate-600 dark:text-zinc-400'}`}
                        >
                          Most Items
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Create New Folder + button */}
                  <button
                    onClick={() => { setFolderToEdit(null); setIsFolderModalOpen(true); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Create New Folder"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Dedicated High-Visibility "+ New Folder" Action Button (Unlocked for Free, Pro, Premium) */}
              <div className="px-1.5 mb-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setFolderToEdit(null); setIsFolderModalOpen(true); }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 border border-indigo-200/60 dark:border-indigo-800/50 shadow-sm transition-all group"
                  title="Create Folder & Workspace"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Plus size={12} />
                    </div>
                    <span>New Folder</span>
                  </div>
                </motion.button>
              </div>

              {/* Folders Tree List with Subchats */}
              <div className="space-y-0.5 px-1">
                {displayedSpaces.length === 0 ? (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-600 px-3 py-1 italic">
                    No folders yet. Click + New Folder to organize.
                  </p>
                ) : (
                  displayedSpaces.map((sp) => {
                    const isExpanded = expandedSpaceIds.has(sp.id);
                    const isSelected = activeSpaceId === sp.id;
                    const subchats = sp.subchats || [];
                    const colorCfg = getFolderColorConfig(sp.color);

                    return (
                      <div key={sp.id} className="group flex flex-col">
                        {/* Folder Row */}
                        <div
                          onClick={() => { onSelectSpace?.(sp.id); if (window.innerWidth < 768) onMobileClose?.(); }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                              : 'hover:bg-slate-100/60 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Chevron to expand subchats */}
                            <button
                              onClick={(e) => handleToggleExpandSpace(e, sp.id)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                              title={isExpanded ? "Collapse" : "Expand folder"}
                            >
                              <ChevronRight size={11} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            {/* Production-Grade Vector Badge */}
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 border ${
                                isSelected
                                  ? `${colorCfg.bg} ${colorCfg.border} ${colorCfg.text} shadow-sm shadow-indigo-500/20`
                                  : 'bg-slate-100/90 dark:bg-zinc-800/80 border-slate-200/70 dark:border-zinc-700/60 text-slate-600 dark:text-zinc-300 group-hover:border-indigo-500/40 group-hover:text-indigo-500'
                              }`}
                              style={colorCfg.customStyle || {}}
                            >
                              {renderFolderIcon(sp.icon, { size: 13, isOpen: isExpanded })}
                            </div>
                            <span className="text-xs truncate font-medium">{sp.name}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 rounded-full font-mono">
                              {(sp.chat_count || 0) + (sp.session_count || 0)}
                            </span>
                            <button
                              onClick={(e) => { handleStartSubchatInSpace(e, sp.id); if (window.innerWidth < 768) onMobileClose?.(); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                              title="Start Subchat in this Folder"
                            >
                              <Plus size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToEdit(sp);
                                setIsFolderModalOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                              title="Edit Folder Title, Logo & Color"
                            >
                              <Edit3 size={10} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSpace(e, sp.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                              title="Delete Folder"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>

                        {/* Indented Study Materials & Subchats (when expanded) */}
                        {isExpanded && (
                          <div className="ml-6 pl-2 border-l border-slate-200 dark:border-zinc-800 space-y-0.5 py-1">
                            {/* Study Materials / Documents in this Space */}
                            {sessions.filter(s => s.project_id === sp.id).map((sess) => (
                              <div
                                key={`space-session-${sess.id}`}
                                onClick={() => {
                                  onStartStudy?.({
                                    filename: sess.filename,
                                    summary: sess.summary,
                                    id: sess.id,
                                    project_id: sp.id
                                  });
                                  onSelectSpace?.(sp.id);
                                }}
                                className="group/sub flex items-center justify-between px-2 py-1 rounded-lg text-[11px] text-slate-600 dark:text-zinc-300 hover:text-indigo-600 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                title={sess.filename}
                              >
                                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                  {renderMaterialFileIcon(sess.filename)}
                                  <span className="truncate">{sess.filename}</span>
                                </div>
                              </div>
                            ))}

                            {/* Subchats */}
                            {subchats.map((chat) => (
                              <div
                                key={`subchat-${chat.id}`}
                                onClick={() => { onOpenChat?.(chat.id, sp.id); setActiveTab('AI Chat'); if (window.innerWidth < 768) onMobileClose?.(); }}
                                className="group/sub flex items-center justify-between px-2 py-1 rounded-lg text-[11px] text-slate-500 dark:text-zinc-400 hover:text-indigo-600 hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <MessageSquare size={10} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{chat.title}</span>
                                </div>
                                <button
                                  onClick={(e) => handleTogglePinChat(e, chat.id, chat.is_pinned)}
                                  className="opacity-0 group-hover/sub:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600"
                                  title={chat.is_pinned ? "Unpin" : "Pin"}
                                >
                                  <Pin size={9} className={chat.is_pinned ? "fill-current text-indigo-500 rotate-45" : ""} />
                                </button>
                              </div>
                            ))}

                            {sessions.filter(s => s.project_id === sp.id).length === 0 && subchats.length === 0 && (
                              <p className="text-[10px] text-slate-400 dark:text-zinc-600 italic py-0.5">
                                No materials or chats yet
                              </p>
                            )}

                            <button
                              onClick={(e) => { handleStartSubchatInSpace(e, sp.id); if (window.innerWidth < 768) onMobileClose?.(); }}
                              className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline pt-0.5"
                            >
                              <Plus size={10} />
                              <span>New Subchat</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Show more / Show less toggle */}
                {spaces.length > 5 && (
                  <button
                    onClick={() => setSpacesShowAll(prev => !prev)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 px-3 py-1 transition-colors"
                  >
                    {spacesShowAll ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 💬 CHATS ˅ (ChatGPT Style Dropdown from Screenshot) ── */}
          {!isCollapsed && (
            <div className="pt-3 pb-1 border-t border-slate-100/60 dark:border-zinc-800/60 mt-2">
              <button
                onClick={() => setIsChatsCollapsed(prev => !prev)}
                className="w-full flex items-center justify-between px-3 mb-1.5 text-[10px] font-black text-slate-400 dark:text-zinc-500 tracking-wider uppercase hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Chats</span>
                  <ChevronDown size={11} className={`transform transition-transform ${isChatsCollapsed ? '-rotate-90' : ''}`} />
                </div>
              </button>

              {!isChatsCollapsed && (
                <div className="space-y-0.5 px-1">
                  {displayedChats.length === 0 ? (
                    <p className="text-[10px] text-slate-400 dark:text-zinc-600 px-3 py-1 italic">
                      No recent chats
                    </p>
                  ) : (
                    displayedChats.map((chat) => (
                      <div
                        key={`chat-${chat.id}`}
                        onClick={() => { onOpenChat?.(chat.id); setActiveTab('AI Chat'); if (window.innerWidth < 768) onMobileClose?.(); }}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100/60 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      >
                        <span className="truncate flex-1 pr-2">{chat.title}</span>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleTogglePinChat(e, chat.id, false)}
                            className="p-0.5 text-slate-400 hover:text-indigo-600"
                            title="Pin chat"
                          >
                            <Pin size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="p-0.5 text-slate-400 hover:text-rose-500"
                            title="Delete chat"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {standaloneChats.length > 5 && (
                    <button
                      onClick={() => setChatsShowAll(prev => !prev)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 px-3 py-1 transition-colors"
                    >
                      {chatsShowAll ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── Provide Feedback Button (like Cursor/Claude) ── */}
        <div className={`${isCollapsed ? 'px-2' : 'px-3'} py-1.5 shrink-0 border-t border-slate-100/50 dark:border-zinc-800/50`}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenFeedback?.()}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-2.5'} py-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 text-xs font-semibold transition-all`}
            title="Provide Feedback"
          >
            <MessageSquarePlus size={15} className="text-indigo-500 shrink-0" />
            {!isCollapsed && <span>Provide Feedback</span>}
          </motion.button>
        </div>

        {/* ── Upgrade to Pro Promo Card ── */}
        {!isCollapsed && user?.plan !== 'premium' && (
          <div className="px-3 pb-2 shrink-0">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-3 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/25 rounded-2xl cursor-pointer transition-all hover:border-indigo-500/40"
              onClick={() => { onSelectSpace?.(null); setActiveTab('Pricing'); if (window.innerWidth < 768) onMobileClose?.(); }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Crown size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Upgrade to Pro</span>
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">New</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mb-2 leading-snug">
                Unlock unlimited documents, faster AI & master decks.
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectSpace?.(null); setActiveTab('Pricing'); if (window.innerWidth < 768) onMobileClose?.(); }}
                className="w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap size={12} /> Upgrade Plan
              </button>
            </motion.div>
          </div>
        )}

        {/* ── User Profile Footer (Interactive ChatGPT & Claude Style Popover Trigger) ── */}
        <div
          ref={profileMenuRef}
          className={`relative ${isCollapsed ? 'p-2' : 'p-3'} shrink-0 border-t border-slate-100/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95`}
        >
          {/* Floating Profile Popover Menu (Pops up directly above user card) */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className={`absolute bottom-full mb-2 z-[90] ${
                  isCollapsed ? 'left-2 w-72' : 'left-3 right-3'
                } bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col`}
              >
                {/* User Identity Card Header */}
                <div
                  onClick={() => {
                    setShowProfileMenu(false);
                    setProfileModalTab('overview');
                    setIsProfileModalOpen(true);
                  }}
                  className="p-3.5 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border-b border-slate-100 dark:border-zinc-800/80 hover:bg-indigo-500/15 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform">
                      {getInitials(user?.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {user?.name || 'Scholar Account'}
                        </p>
                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0 ${PLAN_COLORS[user?.plan || 'free'] || PLAN_COLORS.free}`}>
                          {user?.plan || 'free'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                        {user?.email || 'student@florix.ai'}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Level & XP Mini Banner */}
                  <div className="mt-2.5 pt-2 border-t border-indigo-500/15 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Sparkles size={10} />
                      <span>Level 1 • Scholar</span>
                    </span>
                    <span className="font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                      <Flame size={10} className="text-amber-500" />
                      <span>Active Streak</span>
                    </span>
                  </div>
                </div>

                {/* Quick Stats Pill Row */}
                <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50/50 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800 text-center text-[9px]">
                  <div className="p-1 rounded-lg">
                    <span className="font-bold block text-slate-800 dark:text-zinc-200">{userStats?.total_sessions || 0}</span>
                    <span className="text-slate-400">Docs</span>
                  </div>
                  <div className="p-1 rounded-lg">
                    <span className="font-bold block text-slate-800 dark:text-zinc-200">{userStats?.total_quizzes || 0}</span>
                    <span className="text-slate-400">Quizzes</span>
                  </div>
                  <div className="p-1 rounded-lg">
                    <span className="font-bold block text-slate-800 dark:text-zinc-200">{userStats?.avg_quiz_score ? `${userStats.avg_quiz_score}%` : '0%'}</span>
                    <span className="text-slate-400">Score</span>
                  </div>
                  <div className="p-1 rounded-lg">
                    <span className="font-bold block text-slate-800 dark:text-zinc-200">{userStats?.bookmarks_count || 0}</span>
                    <span className="text-slate-400">Saved</span>
                  </div>
                </div>

                {/* Popover Actions List */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setProfileModalTab('overview');
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                  >
                    <UserCircle size={15} className="text-indigo-500 shrink-0" />
                    <span>My Profile & Scholar Cockpit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setProfileModalTab('achievements');
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                  >
                    <Award size={15} className="text-amber-500 shrink-0" />
                    <span>Milestones & Badges</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setActiveTab('Personalization');
                      if (window.innerWidth < 768) onMobileClose?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                  >
                    <Sparkles size={15} className="text-purple-500 shrink-0" />
                    <span>AI Tutor Personalization</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setProfileModalTab('developer');
                      setIsProfileModalOpen(true);
                      if (window.innerWidth < 768) onMobileClose?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                  >
                    <Shield size={15} className="text-emerald-500 shrink-0" />
                    <span>Developer API Keys</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setActiveTab('Pricing');
                      if (window.innerWidth < 768) onMobileClose?.();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Zap size={15} className="text-indigo-500 shrink-0" />
                      <span>Subscription & Plans</span>
                    </div>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                      PRO
                    </span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={15} className="shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Profile Footer Button (Clickable Pill) */}
          <button
            type="button"
            onClick={() => setShowProfileMenu(prev => !prev)}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center' : 'gap-3'
            } p-2.5 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/60 hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm transition-all text-left cursor-pointer group`}
            title={user?.name || 'My Profile & Settings'}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              {getInitials(user?.name)}
            </div>
            {!isCollapsed && (
              <div className="flex-1 text-left overflow-hidden min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {user?.name || 'User'}
                  </p>
                  <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full capitalize shrink-0 ${PLAN_COLORS[user?.plan || 'free'] || PLAN_COLORS.free}`}>
                    {user?.plan || 'free'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {user?.email || 'Student Account'}
                  </p>
                  <MoreVertical size={12} className="text-slate-400 shrink-0 group-hover:text-slate-600 dark:group-hover:text-zinc-300" />
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Mobile close toggle */}
        {isMobileOpen && (
          <button
            onClick={onMobileClose}
            className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl"
          >
            <X size={16} />
          </button>
        )}
      </motion.aside>

      {/* ── Context Menu Overlay for Sessions ── */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
          className="z-[999] w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5"
        >
          <button
            onClick={() => handleTogglePinSession(contextMenu.sessionId)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-left transition-colors"
          >
            <Pin size={12} className="text-slate-400 shrink-0" />
            <span>{sessions.find(s => s.id === contextMenu.sessionId)?.is_pinned ? 'Unpin Session' : 'Pin Session'}</span>
          </button>

          {/* Move to Folder submenu */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowSpaceSubmenu(true)}
              onClick={() => setShowSpaceSubmenu(prev => !prev)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Folder size={12} className="text-slate-400 shrink-0" />
                <span>Move to Folder</span>
              </div>
              <ChevronRight size={12} className="text-slate-400 shrink-0" />
            </button>

            {showSpaceSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left-2 duration-100 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                <button
                  onClick={() => handleMoveToSpace(contextMenu.sessionId, null)}
                  className="flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg text-left transition-colors italic"
                >
                  <span>None (Unorganized)</span>
                  {!sessions.find(s => s.id === contextMenu.sessionId)?.project_id && (
                    <Check size={10} className="text-indigo-500 shrink-0" />
                  )}
                </button>
                {spaces.map((sp) => {
                  const isCurrent = sessions.find(s => s.id === contextMenu.sessionId)?.project_id === sp.id;
                  return (
                    <button
                      key={sp.id}
                      onClick={() => handleMoveToSpace(contextMenu.sessionId, sp.id)}
                      className="flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-lg text-left transition-colors"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderFolderIcon(sp.icon, { size: 12 })}
                        <span className="truncate">{sp.name}</span>
                      </div>
                      {isCurrent && <Check size={10} className="text-indigo-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

          <button
            onClick={() => handleDeleteSession(contextMenu.sessionId)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-left transition-colors"
          >
            <Trash2 size={12} className="shrink-0" />
            <span>Delete Session</span>
          </button>
        </div>
      )}

      {/* ── Create / Edit Folder Modal ── */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderToEdit(null);
        }}
        onFolderCreated={(folder) => {
          fetchSpaces();
          if (folder?.id) {
            onSelectSpace?.(folder.id);
          }
        }}
        editingFolder={folderToEdit}
      />

      {/* ── Scholar Profile & Settings Modal ── */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
        onLogout={onLogout}
      />
    </>
  );
};

export default Sidebar;
