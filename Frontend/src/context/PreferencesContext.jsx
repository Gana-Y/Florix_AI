import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';

export const PreferencesContext = createContext();

const DEFAULT_PREFS = {
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
  aiModel: 'gemini-2.5-flash',
  aiTemperature: 0.7,
  voiceProfile: 'female-us',
  voiceRate: 1.0,
  autoReadAnswers: false,
  dailyStudyGoal: 30,
  learningGoal: 'exams',
  logRetention: '90',
};

const COLOR_MAP = {
  indigo:  { hue: '238', sat: '84%' },
  purple:  { hue: '270', sat: '75%' },
  emerald: { hue: '152', sat: '68%' },
  rose:    { hue: '347', sat: '77%' },
  amber:   { hue: '43',  sat: '96%' },
};

const FONT_SIZE_MAP = {
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

  // Apply CSS variables whenever prefs change
  useEffect(() => {
    const color = COLOR_MAP[prefs.accentColor] || COLOR_MAP.indigo;
    document.documentElement.style.setProperty('--accent-h', color.hue);
    document.documentElement.style.setProperty('--accent-s', color.sat);
    document.documentElement.style.setProperty('--font-size-base', FONT_SIZE_MAP[prefs.fontSize] || '16px');
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
    <PreferencesContext.Provider value={{ prefs, updatePref, COLOR_MAP, FONT_SIZE_MAP }}>
      {children}
    </PreferencesContext.Provider>
  );
};
