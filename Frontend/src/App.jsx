import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import WelcomeIntro from './components/WelcomeIntro';
import OnboardingFlow from './components/OnboardingFlow';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import InteractiveBackground from './components/InteractiveBackground';
import SharedStudySessionPage from './pages/SharedStudySessionPage';
import { AuthContext } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { useToast } from './context/ToastContext';
import api from './utils/api';

const pageVariants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 26, duration: 0.4 } },
  exit:    { opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.25, ease: 'easeInOut' } },
};

// ── Keyboard Shortcut Help Overlay ───────────────────────────────────────────
const ShortcutHelp = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200/50 dark:border-zinc-800/50"
    >
      <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-6">⌨️ Keyboard Shortcuts</h3>
      <div className="space-y-3">
        {[
          ['Ctrl + K', 'Open Search'],
          ['Ctrl + N', 'New Study Session'],
          ['Ctrl + H', 'Go to Home'],
          ['Ctrl + /', 'Show this help'],
          ['Escape',   'Close any overlay'],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800 last:border-0">
            <span className="text-sm text-slate-500 dark:text-zinc-400">{desc}</span>
            <kbd className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-mono font-bold">{key}</kbd>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors">
        Got it
      </button>
    </motion.div>
  </motion.div>
);

function AppInner() {
  const { user, loading, logout } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.substring(1) || 'landing';
  const [sessionData, setSessionData] = useState({ title: '', summary: '', id: null });
  const [isDarkMode, setIsDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (loading) return; // Prevent redirect while auth state is loading
    if (location.pathname.startsWith('/shared/')) return; // Shared links must be viewable directly

    if (!user) {
      if (['dashboard', 'welcome'].includes(currentView)) {
        navigate('/');
      }
      return;
    }
    const hasToken = !!localStorage.getItem('token');
    if (!hasToken) {
      if (['dashboard', 'welcome'].includes(currentView)) {
        navigate('/login');
      }
      return;
    }

    const welcomed = localStorage.getItem(`florix_welcomed_${user.id}`);
    if (!welcomed) {
      if (currentView === 'dashboard') {
        localStorage.setItem(`florix_welcomed_${user.id}`, 'true');
      } else if (currentView !== 'onboarding' && currentView !== 'welcome' && currentView !== 'landing') {
        navigate('/dashboard');
      }
    } else {
      // Welcomed user: prevent navigating back to auth, onboarding, or welcome screens
      if (['login', 'signup', 'onboarding', 'welcome'].includes(currentView)) {
        navigate('/dashboard');
      }
    }
  }, [user, loading, currentView, navigate, location.pathname]);

  // ── Session timeout events ────────────────────────────────────────────────
  useEffect(() => {
    const onExpiring = () => {
      addToast('⚠️ Your session expires in 5 minutes. Save your work!', 'warning', 8000);
    };
    const onExpired = () => {
      addToast('Session expired. Please log in again.', 'error', 5000);
      logout();
      navigate('/login');
    };
    const onUpgrade = (e) => {
      addToast(e.detail?.message || 'Upgrade your plan to continue.', 'warning', 5000);
    };

    window.addEventListener('florix:session-expiring', onExpiring);
    window.addEventListener('florix:session-expired', onExpired);
    window.addEventListener('florix:upgrade-required', onUpgrade);
    return () => {
      window.removeEventListener('florix:session-expiring', onExpiring);
      window.removeEventListener('florix:session-expired', onExpired);
      window.removeEventListener('florix:upgrade-required', onUpgrade);
    };
  }, [addToast, logout]);

  // ── Global Keyboard Shortcuts ─────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    // Don't fire inside inputs/textareas
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.key === 'Escape') {
      setShowShortcuts(false);
      return;
    }

    if ((e.ctrlKey || e.metaKey)) {
      switch (e.key) {
        case 'k':
        case 'K':
          e.preventDefault();
          if (user && currentView === 'dashboard') {
            window.dispatchEvent(new CustomEvent('florix:open-search'));
          }
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          if (user) {
            window.dispatchEvent(new CustomEvent('florix:new-session'));
          }
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          if (user) {
            window.dispatchEvent(new CustomEvent('florix:go-home'));
          }
          break;
        case '/':
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        default:
          break;
      }
    }
  }, [user, currentView]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleTheme = () => setIsDarkMode((d) => !d);

  const handleLogout = () => {
    setSessionData({ title: '', summary: '', id: null });
    logout();
    navigate('/');
    addToast('Logged out successfully!', 'success');
  };

  const handleStartStudy = (data) => {
    if (typeof data === 'object') {
      setSessionData({ title: data.filename || data.title, summary: data.summary, id: data.id });
    } else {
      setSessionData({ title: data, summary: '', id: null });
    }
  };

  // When student finishes the onboarding questions ("after registration completation")
  const handleOnboardingComplete = async (answers) => {
    if (user?.id) {
      localStorage.setItem(`florix_onboarding_${user.id}`, JSON.stringify(answers));
      const detectedCountry = localStorage.getItem('user_country') || 'Unknown';
      try {
        await api.post('/me/onboarding', {
          role: answers.role,
          domain: answers.domain,
          source: answers.source,
          country: detectedCountry
        });
      } catch (err) {
        console.error('Failed to sync onboarding to backend', err);
      }
    }
    // Smoothly land on celebration welcome screen with student's name
    navigate('/welcome');
  };

  // When student enters/advances from the welcome screen
  const handleWelcomeComplete = () => {
    if (user?.id) {
      localStorage.setItem(`florix_welcomed_${user.id}`, 'true');
    }
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const isAuthPage   = ['login', 'signup', 'forgot-password'].includes(currentView);
  const isLanding    = currentView === 'landing';
  const isDashboard  = currentView === 'dashboard';

  return (
    <div className={`min-h-full relative ${
      isAuthPage
        ? ''
        : isDashboard || isLanding
          ? ''
          : 'bg-[#f8fafc] dark:bg-[#09090b]'
    }`}>
      {/* 🔮 Dynamic Parallax Wave/Glow Background Effect (Auth Pages Only) */}
      {isAuthPage && <InteractiveBackground />}

      {/* ⌨️ Keyboard Shortcut Help */}
      <AnimatePresence>
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
      </AnimatePresence>

      <Routes location={location}>
          {!user ? (
            <>
              <Route path="/onboarding" element={<OnboardingFlow key="onboarding" onComplete={() => navigate('/login')} />} />
              <Route path="/landing" element={
                <motion.div key="landing-direct" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full min-h-screen flex flex-col justify-start relative z-10 no-scrollbar">
                  <LandingPage />
                </motion.div>
              } />
              <Route path="/" element={
                <motion.div key="landing" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full min-h-screen flex flex-col justify-start relative z-10 no-scrollbar">
                  <LandingPage />
                </motion.div>
              } />
              <Route path="/login" element={
                <div
                  key="login-container"
                  data-lenis-prevent="true"
                  className="fixed inset-0 w-full h-full z-50 overflow-y-auto overflow-x-hidden bg-transparent overscroll-contain no-scrollbar"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 md:p-8 py-10">
                    <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-md my-auto flex justify-center">
                      <Login />
                    </motion.div>
                  </div>
                </div>
              } />
              <Route path="/signup" element={
                <div
                  key="signup-container"
                  data-lenis-prevent="true"
                  className="fixed inset-0 w-full h-full z-50 overflow-y-auto overflow-x-hidden bg-transparent overscroll-contain no-scrollbar"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 md:p-8 py-10">
                    <motion.div key="signup" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-md my-auto flex justify-center">
                      <Signup />
                    </motion.div>
                  </div>
                </div>
              } />
              <Route path="/forgot-password" element={
                <div
                  key="forgot-container"
                  data-lenis-prevent="true"
                  className="fixed inset-0 w-full h-full z-50 overflow-y-auto overflow-x-hidden bg-transparent overscroll-contain no-scrollbar"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 md:p-8 py-10">
                    <motion.div key="forgot" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-md my-auto flex justify-center">
                      <ForgotPasswordPage onBack={() => navigate('/login')} />
                    </motion.div>
                  </div>
                </div>
              } />
              <Route path="/shared/:shareToken" element={<SharedStudySessionPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/shared/:shareToken" element={<SharedStudySessionPage />} />
              <Route path="/" element={
                <motion.div key="landing-root-auth" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full min-h-screen flex flex-col justify-start relative z-10">
                  <LandingPage />
                </motion.div>
              } />
              <Route path="/landing" element={
                <motion.div key="landing-direct-auth" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full min-h-screen flex flex-col justify-start relative z-10">
                  <LandingPage />
                </motion.div>
              } />
              <Route path="/welcome" element={<WelcomeIntro key="welcome" userName={user.name} userId={user.id} onComplete={handleWelcomeComplete} />} />
              <Route path="/onboarding" element={<OnboardingFlow key="onboarding" onComplete={handleOnboardingComplete} />} />
              <Route path="/dashboard" element={
                <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 w-full h-full overflow-hidden">
                  <Dashboard isDarkMode={isDarkMode} toggleTheme={toggleTheme} sessionData={sessionData} onStartStudy={handleStartStudy} onLogout={handleLogout} />
                </motion.div>
              } />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          )}
        </Routes>
    </div>
  );
}

function App() {
  return (
    <PreferencesProvider>
      <AppInner />
    </PreferencesProvider>
  );
}

export default App;
