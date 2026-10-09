import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';

export const PreferencesContext = createContext();

export const DEFAULT_PREFS = {
  accentColor: 'indigo',
  bubbleColor: 'indigo',
  fontSize: 'normal',
  responseStyle: 'balanced',
  sidebarLayout: 'auto',
  language: 'en-us',
  animationSpeed: 'normal',
  aiPersona: 'tutor',
  focusMode: false,
  autoSaveNotes: true,
  showWordCount: true,
  // Advanced AI engineering settings
  aiModel: 'gemini-3-flash-preview',
  aiTemperature: 0.7,
  voiceProfile: 'female-us',
  voiceRate: 1.0,
  autoReadAnswers: false,
  dailyStudyGoal: 30,
  learningGoal: 'exams',
  logRetention: '90',
};

export const COLOR_MAP = {
  indigo:  { hue: '238', sat: '84%', hex: '#6366f1' },
  purple:  { hue: '270', sat: '75%', hex: '#a855f7' },
  emerald: { hue: '152', sat: '68%', hex: '#10b981' },
  rose:    { hue: '347', sat: '77%', hex: '#f43f5e' },
  amber:   { hue: '43',  sat: '96%', hex: '#f59e0b' },
};

export const BUBBLE_COLOR_MAP = {
  indigo: {
    bg: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
    shadow: 'shadow-indigo-500/20',
    border: 'border-indigo-400/40',
    text: 'text-white',
  },
  purple: {
    bg: 'bg-gradient-to-r from-purple-600 to-violet-700',
    shadow: 'shadow-purple-500/20',
    border: 'border-purple-400/40',
    text: 'text-white',
  },
  emerald: {
    bg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
    shadow: 'shadow-emerald-500/20',
    border: 'border-emerald-400/40',
    text: 'text-white',
  },
  rose: {
    bg: 'bg-gradient-to-r from-rose-600 to-pink-700',
    shadow: 'shadow-rose-500/20',
    border: 'border-rose-400/40',
    text: 'text-white',
  },
  amber: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
    border: 'border-amber-400/40',
    text: 'text-white',
  },
};

export const ACCENT_THEMES = {
  indigo: {
    key: 'indigo',
    label: 'Indigo',
    bg: 'bg-indigo-500',
    ring: 'ring-indigo-400',
    activeCard: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-md',
    badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    sliderAccent: 'accent-indigo-600 dark:accent-indigo-500',
    checkColor: 'text-indigo-500',
  },
  purple: {
    key: 'purple',
    label: 'Purple',
    bg: 'bg-purple-500',
    ring: 'ring-purple-400',
    activeCard: 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 shadow-md',
    badge: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50',
    btn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
    accentText: 'text-purple-600 dark:text-purple-400',
    sliderAccent: 'accent-purple-600 dark:accent-purple-500',
    checkColor: 'text-purple-500',
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-400',
    activeCard: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-md',
    badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    sliderAccent: 'accent-emerald-600 dark:accent-emerald-500',
    checkColor: 'text-emerald-500',
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    bg: 'bg-rose-500',
    ring: 'ring-rose-400',
    activeCard: 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 shadow-md',
    badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50',
    btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    accentText: 'text-rose-600 dark:text-rose-400',
    sliderAccent: 'accent-rose-600 dark:accent-rose-500',
    checkColor: 'text-rose-500',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    bg: 'bg-amber-500',
    ring: 'ring-amber-400',
    activeCard: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-md',
    badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    accentText: 'text-amber-600 dark:text-amber-400',
    sliderAccent: 'accent-amber-600 dark:accent-amber-500',
    checkColor: 'text-amber-500',
  },
};

export const FONT_SIZE_MAP = {
  compact:     '14px',
  normal:      '16px',
  comfortable: '18px',
};

export const PreferencesProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // Load prefs from localStorage whenever user changes
  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`florix_prefs_${user.id}`);
    if (stored) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {
        setPrefs(DEFAULT_PREFS);
      }
    } else {
      setPrefs(DEFAULT_PREFS);
    }
  }, [user?.id]);

  // Apply CSS variables and data attributes whenever prefs change
  useEffect(() => {
    const color = COLOR_MAP[prefs.accentColor] || COLOR_MAP.indigo;
    document.documentElement.style.setProperty('--accent-h', color.hue);
    document.documentElement.style.setProperty('--accent-s', color.sat);
    document.documentElement.style.setProperty('--font-size-base', FONT_SIZE_MAP[prefs.fontSize] || '16px');
    document.documentElement.setAttribute('data-accent', prefs.accentColor || 'indigo');
    document.documentElement.setAttribute('data-bubble', prefs.bubbleColor || 'indigo');
    document.documentElement.setAttribute('data-language', prefs.language || 'en-us');
  }, [prefs]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      if (user?.id) {
        localStorage.setItem(`florix_prefs_${user.id}`, JSON.stringify(next));
      }
      return next;
    });
  }, [user?.id]);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref, COLOR_MAP, BUBBLE_COLOR_MAP, ACCENT_THEMES, FONT_SIZE_MAP }}>
      {children}
    </PreferencesContext.Provider>
  );
};
