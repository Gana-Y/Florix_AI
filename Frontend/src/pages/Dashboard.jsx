import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import {
  Book, Clock, Star, Sun, Moon, ArrowRight, Menu,
  TrendingUp, Bookmark, ChevronLeft, ChevronRight, CalendarCheck,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import StudyInput       from '../components/StudyInput';
import StudySession     from '../components/StudySession';
import LibraryTab       from '../components/LibraryTab';
import SearchTab        from '../components/SearchTab';
import HistoryTab       from '../components/HistoryTab';
import HelpGuideTab     from '../components/HelpGuideTab';
import PersonalizationTab from '../components/PersonalizationTab';
import ChatPage         from '../components/ChatPage';
import ProfileTab       from '../components/ProfileTab';
import BookmarksTab     from '../components/BookmarksTab';
import ProgressStats    from '../components/ProgressStats';
import AdaptiveStudyPlanner from '../components/AdaptiveStudyPlanner';
import ExamWorkspace       from '../components/ExamWorkspace';
import MetacognitiveDebugger from '../components/MetacognitiveDebugger';
import VivaWorkspace        from '../components/VivaWorkspace';
import PricingTab       from '../components/PricingTab';
import AdminPanel       from '../components/AdminPanel';
import SystemMonitor    from '../components/SystemMonitor';
import ProvideFeedbackModal from '../components/ProvideFeedbackModal';
import SpaceWorkspaceHub from '../components/SpaceWorkspaceHub';
import NotificationCenter from '../components/NotificationCenter';
import api from '../utils/api';

// ── Color Map ─────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   { bgLight: 'bg-blue-500/10',   iconBg: 'bg-blue-100 dark:bg-blue-500/20',     iconText: 'text-blue-600 dark:text-blue-400',     ti: 'text-blue-600 dark:text-blue-400' },
  purple: { bgLight: 'bg-purple-500/10', iconBg: 'bg-purple-100 dark:bg-purple-500/20', iconText: 'text-purple-600 dark:text-purple-400', ti: 'text-purple-600 dark:text-purple-400' },
  orange: { bgLight: 'bg-orange-500/10', iconBg: 'bg-orange-100 dark:bg-orange-500/20', iconText: 'text-orange-600 dark:text-orange-400', ti: 'text-orange-600 dark:text-orange-400' },
  green:  { bgLight: 'bg-emerald-500/10',iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',iconText: 'text-emerald-600 dark:text-emerald-400',ti: 'text-emerald-600 dark:text-emerald-400' },
};

// ── Tab animation variants ────────────────────────────────────────────────────
const tabVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeInOut' } },
};

// ── Standard scrollable tab wrapper ─────────────────────────────────────────
const ScrollPane = ({ children }) => (
  <div data-lenis-prevent className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar">
    <div className="w-full max-w-6xl mx-auto px-5 md:px-8 py-6">
      {children}
    </div>
  </div>
);

// ── Centered pane (vertically + horizontally) for workspace-style tabs ────────
const CenteredPane = ({ children, maxWidth = 'max-w-3xl' }) => (
  <div data-lenis-prevent className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar">
    <div className={`w-full ${maxWidth} mx-auto px-5 md:px-8 py-8 min-h-full flex flex-col`}>
      {children}
    </div>
  </div>
);

// ── Home tab ─────────────────────────────────────────────────────────────────
const HomeTab = ({ user, stats, statsLoading, setActiveTab }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8 pb-4">
      {/* Greeting */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">{user?.name?.split(' ')[0] || 'Student'}</span> 👋
          </h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 text-base">Ready to accelerate your learning today?</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('Study Planner')}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-200 rounded-2xl font-bold shadow-md hover:shadow-lg border border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all"
          >
            <CalendarCheck size={15} className="text-purple-500" /> Study Plan
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('Progress')}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-200 rounded-2xl font-bold shadow-md hover:shadow-lg border border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all"
          >
            <TrendingUp size={15} className="text-indigo-500" /> Progress
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('New Study Session')}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-md hover:shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all"
          >
            New Session <ArrowRight size={15} />
          </motion.button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Book,      color: 'blue',   label: 'Documents Studied', value: statsLoading ? '…' : (stats?.total_sessions ?? 0).toString(),    trend: statsLoading ? 'Loading…' : `${stats?.plan || 'free'} plan` },
          { icon: Clock,     color: 'purple', label: 'Quiz Attempts',     value: statsLoading ? '…' : (stats?.total_quizzes ?? 0).toString(),       trend: statsLoading ? 'Loading…' : 'all time' },
          { icon: Star,      color: 'orange', label: 'Avg Quiz Score',    value: statsLoading ? '…' : (stats?.total_quizzes ? `${stats.avg_quiz_score}%` : 'N/A'), trend: statsLoading ? 'Loading…' : (stats?.total_quizzes ? `${stats.total_quizzes} quizzes` : 'No quizzes yet') },
          { icon: Bookmark,  color: 'green',  label: 'Bookmarked',        value: statsLoading ? '…' : (stats?.bookmarks_count ?? 0).toString(),     trend: statsLoading ? 'Loading…' : 'saved documents' },
        ].map((stat, i) => {
          const clr = COLOR_MAP[stat.color] || COLOR_MAP.blue;
          return (
            <motion.div
              key={i} variants={itemVariants}
              whileHover={{ y: -4 }}
              className="bg-white/85 dark:bg-zinc-900/85 p-5 rounded-2xl shadow-md hover:shadow-xl border border-slate-200/60 dark:border-zinc-800/60 transition-all group overflow-hidden relative"
            >
              <div className={`absolute top-0 right-0 w-28 h-28 ${clr.bgLight} rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${clr.iconBg} ${clr.iconText} shadow-inner`}>
                  <stat.icon size={20} />
                </div>
                <h3 className="text-slate-500 dark:text-zinc-400 font-medium text-xs leading-tight">{stat.label}</h3>
              </div>
              {statsLoading
                ? <div className="h-8 w-20 bg-slate-200 dark:bg-zinc-800 rounded-xl animate-pulse mb-1" />
                : <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{stat.value}</p>
              }
              <p className={`text-xs mt-1.5 ${clr.ti} font-medium`}>{stat.trend}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Access */}
      <motion.div variants={itemVariants}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
          <Clock size={18} className="text-indigo-500" /> Quick Access
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { tab: 'My Library', icon: Book,       label: 'My Library',  sub: 'Browse all your documents', gradient: 'from-indigo-500 to-purple-600' },
            { tab: 'Bookmarks',  icon: Bookmark,   label: 'Bookmarks',   sub: 'Your saved documents',       gradient: 'from-amber-500 to-orange-600' },
            { tab: 'Progress',   icon: TrendingUp, label: 'Progress',    sub: 'Charts & analytics',         gradient: 'from-emerald-500 to-teal-600' },
          ].map((item) => (
            <motion.div
              key={item.tab}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(item.tab)}
              className="p-4 bg-white/85 dark:bg-zinc-900/85 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:shadow-xl shadow-md transition-all flex items-center gap-4 group"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
                <item.icon size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm">{item.label}</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      {!statsLoading && stats?.recent_activities?.length > 0 && (
        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
            <Star size={18} className="text-amber-500" /> Recent Activity
          </h3>
          <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800">
            {stats.recent_activities.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-2 h-2 bg-indigo-400 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{a.action}</p>
                  {a.details && <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{a.details}</p>}
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 shrink-0">
                  {new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ── Dashboard ──────────────────────────────────────────────────────────────────
const Dashboard = ({ isDarkMode, toggleTheme, sessionData, onStartStudy, onLogout }) => {
  const { user, logout } = useContext(AuthContext);
  const { addToast } = useToast();
  const handleLogout = onLogout || logout;

  const [activeTab, setActiveTab]   = useState('Home');
  const [studyState, setStudyState] = useState('input');
  const [studyData, setStudyData]   = useState(null);
  const [isCollapsed, setIsCollapsed]       = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [activeSpaceId, setActiveSpaceId]   = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);

  // Fetch stats once; if unauthenticated, ensure clean logout & redirect
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      handleLogout();
      return;
    }
    api.get('/stats')
      .then(r => setStats(r.data))
      .catch(err => console.error('Stats fetch failed', err))
      .finally(() => setStatsLoading(false));
  }, [handleLogout]);



  // Listen for 402 upgrade-required events → redirect to Pricing
  useEffect(() => {
    const handleUpgradeRequired = (e) => {
      setActiveTab('Pricing');
      addToast(
        e.detail?.message || 'Upgrade your plan to continue.',
        'info'
      );
    };
    window.addEventListener('florix:upgrade-required', handleUpgradeRequired);
    return () => window.removeEventListener('florix:upgrade-required', handleUpgradeRequired);
  }, [addToast]);

  // Clear selectedChatId if the conversation was deleted
  useEffect(() => {
    const handleChatDeleted = (e) => {
      const deletedId = e.detail?.chatId;
      if (deletedId && selectedChatId === deletedId) {
        setSelectedChatId(null);
      }
    };
    window.addEventListener('florix:conversation-deleted', handleChatDeleted);
    return () => window.removeEventListener('florix:conversation-deleted', handleChatDeleted);
  }, [selectedChatId]);

  // Redirect legacy Profile tab to Home (Profile is now accessed via bottom-left popover & modal)
  useEffect(() => {
    if (activeTab === 'Profile') {
      setActiveTab('Home');
    }
  }, [activeTab]);

  // Lock window/document scrolling while Dashboard is mounted to eliminate all layout shifts
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, []);

  // Listen for focus mode toggle from StudySession
  useEffect(() => {
    const handleToggleSidebar = () => setIsCollapsed(prev => !prev);
    window.addEventListener('florix:toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('florix:toggle-sidebar', handleToggleSidebar);
  }, []);

  // Re-hydrate study session on mount
  useEffect(() => {
    if (typeof sessionData?.title === 'string' && sessionData.title) {
      setStudyData({ title: sessionData.title, summary: sessionData.summary || '', id: sessionData.id });
      setStudyState('result');
    }
  }, []); // eslint-disable-line

  // ⌨️ Global keyboard shortcut listeners
  useEffect(() => {
    const onSearch  = () => setActiveTab('Search content');
    const onNew     = () => setActiveTab('New Study Session');
    const onHome    = () => setActiveTab('Home');
    window.addEventListener('florix:open-search', onSearch);
    window.addEventListener('florix:new-session', onNew);
    window.addEventListener('florix:go-home',     onHome);
    return () => {
      window.removeEventListener('florix:open-search', onSearch);
      window.removeEventListener('florix:new-session', onNew);
      window.removeEventListener('florix:go-home',     onHome);
    };
  }, []);


  const handleTabChange = (tab, forceReset = false) => {
    window.scrollTo(0, 0);
    setActiveTab(tab);
    if (tab !== 'New Study Session' || forceReset) {
      setStudyState('input');
      setStudyData(null);
    }
  };

  const handleStartNewSession = () => {
    window.scrollTo(0, 0);
    setStudyState('input');
    setStudyData(null);
    setActiveTab('New Study Session');
  };

  const isChat = activeTab === 'AI Chat'; // eslint-disable-line

  return (
    <div data-lenis-prevent="true" className="fixed inset-0 w-screen h-screen flex bg-[#f8fafc] dark:bg-[#09090b] text-slate-800 dark:text-white overflow-hidden font-sans" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}>

      {/* Background glow orbs */}
      <div className="pointer-events-none fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/8 dark:bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/8 dark:bg-purple-600/10 rounded-full blur-[120px]" />

      {/* ── Sidebar ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onNewSessionClick={handleStartNewSession}
        onLogout={handleLogout}
        user={user}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(c => !c)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onStartStudy={(fileData) => {
          window.scrollTo(0, 0);
          setStudyData({
            title: fileData.filename,
            summary: fileData.full_summary || fileData.summary,
            id: fileData.id,
            project_id: fileData.project_id
          });
          setStudyState('result');
          setActiveTab('New Study Session');
        }}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        activeSpaceId={activeSpaceId}
        onSelectSpace={(id) => {
          setActiveSpaceId(id);
          if (id) handleTabChange('SpaceHub');
        }}
        onOpenChat={(chatId, spaceId) => {
          setSelectedChatId(chatId);
          if (spaceId) setActiveSpaceId(spaceId);
          handleTabChange('AI Chat');
        }}
      />

      {/* ── Sidebar Collapse Toggle — fixed at 50vh, NEVER moves ──
           Rendered outside <aside> so it's immune to sidebar layout shifts.
           Uses fixed positioning relative to the viewport edge of the sidebar. */}
      <motion.button
        onClick={() => setIsCollapsed(c => !c)}
        animate={{ left: isCollapsed ? 76 - 14 : 260 - 14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        className="hidden md:flex fixed z-[60] items-center justify-center
          w-7 h-7 rounded-full
          bg-white dark:bg-zinc-900
          border border-slate-200 dark:border-zinc-700
          text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400
          shadow-md transition-colors"
        style={{ top: 'calc(50vh - 14px)' }}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </motion.button>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 overflow-hidden">

        {/* Top bar — theme toggle + mobile menu (hidden when in New Study Session so StudyInput/StudySession own their clean layouts completely) */}
        {activeTab !== 'New Study Session' && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-100/60 dark:border-zinc-800/40 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-sm relative z-40">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Current page title */}
            <span className="hidden md:block text-sm font-semibold text-slate-400 dark:text-zinc-500 tracking-wide uppercase">
              {activeTab}
            </span>

            <div className="ml-auto flex items-center gap-3">
              <NotificationCenter
                onOpenSession={(session) => {
                  window.scrollTo(0, 0);
                  setStudyData({
                    title: session.filename || session.title,
                    summary: session.summary || '',
                    id: session.id,
                    initialView: session.initialView || 'summary'
                  });
                  setStudyState('result');
                  handleTabChange('New Study Session');
                }}
                currentSessionId={studyData?.id || null}
              />
              <motion.button
                whileHover={{ scale: 1.08, rotate: 15 }} whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 shadow-md border border-slate-200/50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center shrink-0"
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
              </motion.button>
            </div>
          </div>
        )}

        {/* ── Tab Views (each gets its own isolated layout) ── */}
        <div className="flex-1 h-full min-h-0 relative z-0 overflow-hidden flex flex-col">
          <motion.div
            key={`${activeTab}-${studyState}-${studyData?.id || 'none'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
          >
              {/* ── HOME ── */}
              {activeTab === 'Home' && (
                <ScrollPane>
                  <HomeTab
                    user={user}
                    stats={stats}
                    statsLoading={statsLoading}
                    setActiveTab={handleTabChange}
                  />
                </ScrollPane>
              )}

              {/* ── SPACE WORKSPACE HUB (YouLearn + Claude Style) ── */}
              {activeTab === 'SpaceHub' && activeSpaceId && (
                <ScrollPane>
                  <SpaceWorkspaceHub
                    spaceId={activeSpaceId}
                    onBack={() => { setActiveSpaceId(null); handleTabChange('Home'); }}
                    onOpenSubchat={(chatId) => {
                      setSelectedChatId(chatId);
                      handleTabChange('AI Chat');
                    }}
                    onOpenStudySession={(session) => {
                      window.scrollTo(0, 0);
                      setStudyData({
                        title: session.filename,
                        summary: session.summary,
                        id: session.id,
                        project_id: session.project_id || activeSpaceId
                      });
                      setStudyState('result');
                      handleTabChange('New Study Session');
                    }}
                    onUploadInSpace={() => {
                      setStudyState('input');
                      handleTabChange('New Study Session');
                    }}
                    onSpaceUpdated={() => {
                      window.dispatchEvent(new CustomEvent('florix:session-updated'));
                    }}
                    onSpaceDeleted={() => {
                      setActiveSpaceId(null);
                      handleTabChange('Home');
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── AI CHAT (no scroll wrapper — fills entire pane) ── */}
              {activeTab === 'AI Chat' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-zinc-950">
                  <ChatPage
                    initialConvId={selectedChatId}
                    activeSpaceId={activeSpaceId}
                    onClearSpace={() => setActiveSpaceId(null)}
                  />
                </div>
              )}

              {/* ── SEARCH ── */}
              {activeTab === 'Search content' && (
                <ScrollPane>
                  <SearchTab
                    onOpenSession={async (sessionId) => {
                      try {
                        const res = await api.get(`/library/${sessionId}`);
                        window.scrollTo(0, 0);
                        setStudyData({
                          title: res.data.filename,
                          summary: res.data.summary,
                          id: res.data.id
                        });
                        setStudyState('result');
                        handleTabChange('New Study Session');
                      } catch (_) {
                        addToast('Failed to load search result session.', 'error');
                      }
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── HISTORY ── */}
              {activeTab === 'History' && (
                <ScrollPane><HistoryTab onBack={() => handleTabChange('Home')} /></ScrollPane>
              )}

              {/* ── PROFILE ── */}
              {activeTab === 'Profile' && (
                <ScrollPane><ProfileTab onLogout={handleLogout} /></ScrollPane>
              )}

              {/* ── BOOKMARKS ── */}
              {activeTab === 'Bookmarks' && (
                <ScrollPane>
                  <BookmarksTab
                    onOpenSession={(sessionData) => {
                      window.scrollTo(0, 0);
                      setStudyData({
                        title: sessionData.filename,
                        summary: sessionData.summary,
                        id: sessionData.id
                      });
                      setStudyState('result');
                      handleTabChange('New Study Session');
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── PROGRESS ── */}
              {activeTab === 'Progress' && (
                <ScrollPane><ProgressStats /></ScrollPane>
              )}

              {/* ── ADAPTIVE STUDY PLANNER ── */}
              {activeTab === 'Study Planner' && (
                <ScrollPane>
                  <AdaptiveStudyPlanner
                    user={user}
                    onOpenSession={async (sessionId) => {
                      try {
                        const res = await api.get(`/library/${sessionId}`);
                        window.scrollTo(0, 0);
                        setStudyData({
                          title: res.data.filename,
                          summary: res.data.summary,
                          id: res.data.id
                        });
                        setStudyState('result');
                        handleTabChange('New Study Session');
                      } catch (_) {
                        addToast('Failed to load session.', 'error');
                      }
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── EXAMS & MOCK ASSESSMENTS ── */}
              {activeTab === 'Exams' && (
                <ScrollPane>
                  <ExamWorkspace
                    user={user}
                    onOpenSession={async (sessionId) => {
                      try {
                        const res = await api.get(`/library/${sessionId}`);
                        window.scrollTo(0, 0);
                        setStudyData({
                          title: res.data.filename,
                          summary: res.data.summary,
                          id: res.data.id
                        });
                        setStudyState('result');
                        handleTabChange('New Study Session');
                      } catch (_) {
                        addToast('Failed to load session.', 'error');
                      }
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── MISTAKE INTELLIGENCE & METACOGNITIVE DEBUGGER ── */}
              {activeTab === 'Mistakes' && (
                <ScrollPane>
                  <MetacognitiveDebugger user={user} />
                </ScrollPane>
              )}

              {/* ── VIVA / ORAL EXAMINATION MODE ── */}
              {activeTab === 'Viva' && (
                <ScrollPane>
                  <VivaWorkspace
                    user={user}
                    onOpenSession={async (sessionId) => {
                      try {
                        const res = await api.get(`/library/${sessionId}`);
                        window.scrollTo(0, 0);
                        setStudyData({
                          title: res.data.filename,
                          summary: res.data.summary,
                          id: res.data.id
                        });
                        setStudyState('result');
                        handleTabChange('New Study Session');
                      } catch (_) {
                        addToast('Failed to load session.', 'error');
                      }
                    }}
                  />
                </ScrollPane>
              )}

              {/* ── PRICING ── */}
              {activeTab === 'Pricing' && (
                <ScrollPane><PricingTab /></ScrollPane>
              )}

              {/* ── ADMIN PANEL ── */}
              {activeTab === 'Admin Panel' && (
                <ScrollPane><AdminPanel /></ScrollPane>
              )}

              {/* ── SYSTEM MONITOR ── */}
              {activeTab === 'System Monitor' && (
                <ScrollPane><SystemMonitor /></ScrollPane>
              )}

              {/* ── NEW STUDY SESSION (Workspace or Active Session) ── */}
              {activeTab === 'New Study Session' && (
                studyState === 'result' && studyData ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <StudySession
                      key={studyData.id || studyData.title}
                      data={studyData}
                      onBack={(spaceIdFromSession) => {
                        const targetSpace = spaceIdFromSession || studyData?.project_id || activeSpaceId;
                        setStudyState('input');
                        setStudyData(null);
                        if (targetSpace) {
                          setActiveSpaceId(targetSpace);
                          handleTabChange('SpaceHub');
                        } else {
                          handleTabChange('Home');
                        }
                      }}
                      isDarkMode={isDarkMode}
                      toggleTheme={toggleTheme}
                    />
                  </div>
                ) : (
                  <CenteredPane maxWidth="max-w-3xl">
                    <StudyInput
                      isDarkMode={isDarkMode}
                      toggleTheme={toggleTheme}
                      activeSpaceId={activeSpaceId}
                      onClearSpace={() => setActiveSpaceId(null)}
                      onStartStudy={(data) => {
                        window.scrollTo(0, 0);
                        onStartStudy?.(data);
                        const assignedSpace = data?.project_id || activeSpaceId;
                        if (assignedSpace) {
                          setActiveSpaceId(assignedSpace);
                        }
                        setStudyData(
                          typeof data === 'string'
                            ? { title: data, summary: 'Loading AI summary…' }
                            : { title: data.filename, summary: data.summary, id: data.id, project_id: data.project_id || assignedSpace }
                        );
                        setStudyState('result');
                        window.dispatchEvent(new CustomEvent('florix:session-updated'));
                      }}
                      onBack={() => handleTabChange(activeSpaceId ? 'SpaceHub' : 'Home')}
                    />
                  </CenteredPane>
                )
              )}

              {/* ── PERSONALIZATION ── */}
              {activeTab === 'Personalization' && (
                <ScrollPane><PersonalizationTab onBack={() => handleTabChange('Home')} /></ScrollPane>
              )}

              {/* ── HELP & GUIDE ── */}
              {activeTab === 'Help & Guide' && (
                <ScrollPane><HelpGuideTab onBack={() => handleTabChange('Home')} /></ScrollPane>
              )}

              {/* ── MY LIBRARY ── */}
              {activeTab === 'My Library' && (
                <ScrollPane>
                  <LibraryTab
                    onBack={() => handleTabChange('Home')}
                    onUploadNew={() => { setStudyState('input'); handleTabChange('New Study Session'); }}
                    onStudyTopic={(fileData) => {
                      window.scrollTo(0, 0);
                      setStudyData({
                        title: fileData.filename,
                        summary: fileData.full_summary || fileData.summary,
                        id: fileData.id,
                        project_id: fileData.project_id || null
                      });
                      setStudyState('result');
                      handleTabChange('New Study Session');
                    }}
                  />
                </ScrollPane>
              )}

            </motion.div>
        </div>
      </div>
      {/* 💬 Provide Feedback Modal (Cursor/Claude Style) */}
      <ProvideFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
