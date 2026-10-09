import React, { useContext, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  Type,
  MessageSquare,
  Sparkles,
  Check,
  Globe,
  Zap,
  Brain,
  BookOpen,
  Layout,
  Languages,
  Bot,
  Clock,
  Volume2,
  Sliders,
  Shield,
  Compass,
  Play,
  Square,
  VolumeX,
} from 'lucide-react';
import { PreferencesContext, ACCENT_THEMES, BUBBLE_COLOR_MAP } from '../context/PreferencesContext';
import FlagIcon from './FlagIcon';
import { speakText, stopSpeaking } from '../utils/tts';

/* ─── Reusable Section Wrapper ─────────────────────────────────────────────── */
const Section = ({ icon: Icon, title, theme, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-lg shadow-slate-200/10 dark:shadow-none"
  >
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-2.5 rounded-xl ${theme?.badge || 'bg-indigo-50 dark:bg-indigo-500/10'}`}>
        <Icon size={20} className={theme?.accentText || 'text-indigo-600 dark:text-indigo-400'} />
      </div>
      <h3 className="font-bold text-slate-800 dark:text-white text-lg">{title}</h3>
    </div>
    {children}
  </motion.div>
);

/* ─── Color Palette ─────────────────────────────────────────────────────────── */
const COLOR_OPTIONS = [
  { key: 'indigo',  label: 'Indigo',  bg: 'bg-indigo-500',  ring: 'ring-indigo-400' },
  { key: 'purple',  label: 'Purple',  bg: 'bg-purple-500',  ring: 'ring-purple-400' },
  { key: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { key: 'rose',    label: 'Rose',    bg: 'bg-rose-500',    ring: 'ring-rose-400' },
  { key: 'amber',   label: 'Amber',   bg: 'bg-amber-500',   ring: 'ring-amber-400' },
];

/* ─── Shared button styles ──────────────────────────────────────────────────── */
const idleCard =
  'border-slate-200/70 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 bg-white/40 dark:bg-zinc-900/40';

/* ─── Toggle Switch ─────────────────────────────────────────────────────────── */
const ToggleSwitch = ({ value, onChange, theme }) => (
  <button
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      value ? (theme?.bg || 'bg-indigo-500') : 'bg-slate-300 dark:bg-zinc-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
        value ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

/* ─── Main Component ────────────────────────────────────────────────────────── */
const PersonalizationTab = () => {
  const { prefs, updatePref } = useContext(PreferencesContext);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const currentTheme = ACCENT_THEMES[prefs.accentColor] || ACCENT_THEMES.indigo;
  const currentBubble = BUBBLE_COLOR_MAP[prefs.bubbleColor] || BUBBLE_COLOR_MAP.indigo;
  const activeCard = currentTheme.activeCard;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const getTemperatureLabel = (temp) => {
    if (temp <= 0.3) return 'Precise & Factual 🎯';
    if (temp <= 0.6) return 'Balanced & Logical ⚖️';
    if (temp <= 0.8) return 'Creative & Engaging 🎨';
    return 'Highly Imaginative 🧠';
  };

  const handleTestVoice = () => {
    if (isPlayingTest) {
      stopSpeaking();
      setIsPlayingTest(false);
      return;
    }

    const phrases = {
      'female-us': "Hello! I'm Clara, your warm academic study partner. Ready to review your notes?",
      'male-us': "Hello. I'm James, your professional engineering mentor. Let's analyze your coursework.",
      'female-uk': "Good day! I'm Olivia, pleased to assist you with your studies and research.",
      'male-uk': "Cheers! I'm Harry, ready to help you clarify complex academic concepts.",
      'robot': "System operational. I am Byte, your cybernetic AI engineering co-pilot.",
    };

    const text = phrases[prefs.voiceProfile || 'female-us'] || phrases['female-us'];
    setIsPlayingTest(true);

    const started = speakText(text, {
      voiceProfile: prefs.voiceProfile,
      voiceRate: prefs.voiceRate,
      language: prefs.language,
      onEnd: () => setIsPlayingTest(false),
      onError: () => setIsPlayingTest(false),
    });

    if (!started) {
      setIsPlayingTest(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="max-w-2xl mx-auto space-y-6 pb-20"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-1 flex items-center gap-3">
          <Sparkles className={currentTheme.accentText} size={28} />
          Personalization
        </h2>
        <p className="text-slate-500 dark:text-zinc-400">Customize and tailor your study workspace and AI models.</p>
      </motion.div>

      {/* ── Accent Color ───────────────────────────────────────────────────── */}
      <Section icon={Palette} title="Accent Color" theme={currentTheme}>
        <div className="flex flex-wrap gap-3">
          {COLOR_OPTIONS.map((c) => (
            <motion.button
              key={c.key}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => updatePref('accentColor', c.key)}
              title={c.label}
              className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                prefs.accentColor === c.key
                  ? `ring-4 ${c.ring} ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-lg`
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {prefs.accentColor === c.key && <Check size={16} className="text-white" strokeWidth={3} />}
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-3">
          Selected: <span className="font-semibold capitalize">{prefs.accentColor}</span> — shapes buttons, active badges, and focus rings.
        </p>
      </Section>

      {/* ── Chat Bubble Color ──────────────────────────────────────────────── */}
      <Section icon={MessageSquare} title="Chat Bubble Color" theme={currentTheme}>
        <div className="flex flex-wrap gap-3">
          {COLOR_OPTIONS.map((c) => (
            <motion.button
              key={c.key}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => updatePref('bubbleColor', c.key)}
              title={c.label}
              className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                prefs.bubbleColor === c.key
                  ? `ring-4 ${c.ring} ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-lg`
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {prefs.bubbleColor === c.key && <Check size={16} className="text-white" strokeWidth={3} />}
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-3">
          Selected: <span className="font-semibold capitalize">{prefs.bubbleColor}</span> — live in Chat & AI Workspace.
        </p>

        {/* Live Chat Bubble Preview */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-800 flex justify-end">
          <div className={`px-4 py-2.5 rounded-2xl rounded-tr-xs ${currentBubble.bg} ${currentBubble.shadow} text-white text-xs font-medium`}>
            Your chat message bubble aesthetic in Florix AI ✨
          </div>
        </div>
      </Section>

      {/* ── Font Size ──────────────────────────────────────────────────────── */}
      <Section icon={Type} title="Font Size" theme={currentTheme}>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'compact',     label: 'Compact',     desc: '14px', size: 'text-sm' },
            { key: 'normal',      label: 'Normal',      desc: '16px', size: 'text-base' },
            { key: 'comfortable', label: 'Comfortable', desc: '18px', size: 'text-lg' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('fontSize', opt.key)}
              className={`flex-1 min-w-[100px] flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all ${
                prefs.fontSize === opt.key ? activeCard : idleCard
              }`}
            >
              <span className={`font-bold ${opt.size}`}>{opt.label}</span>
              <span className="text-xs opacity-60">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── Response Style ─────────────────────────────────────────────────── */}
      <Section icon={Sparkles} title="Response Style" theme={currentTheme}>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'concise',  label: 'Concise',  desc: 'Short & sharp answers' },
            { key: 'balanced', label: 'Balanced', desc: 'Moderate detail' },
            { key: 'detailed', label: 'Detailed', desc: 'In-depth explanations' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('responseStyle', opt.key)}
              className={`flex-1 min-w-[100px] flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                prefs.responseStyle === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="font-bold capitalize">{opt.label}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── AI Model Selection ─────────────────────────────────────────────── */}
      <Section icon={Bot} title="AI Large Language Model (LLM)" theme={currentTheme}>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'gemini-3-flash-preview', label: 'Gemini 3 Flash ⚡ (Frontier)', desc: 'Next-generation reasoning engine. Enhanced logic, agentic speed, & complex analysis.' },
            { key: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash 🛡️ (Stable)', desc: 'High-speed production standard. Fast summaries, flashcards, & real-time study guide creation.' },
            { key: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro 📚',   desc: 'Legacy multi-million context model. Excels at analyzing massive textbooks and extensive articles.' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updatePref('aiModel', opt.key)}
              className={`w-full flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                prefs.aiModel === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="font-bold text-sm">{opt.label}</span>
              <span className="text-xs opacity-70 leading-relaxed">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── AI Creativity Control (Temperature) ─────────────────────────── */}
      <Section icon={Sliders} title="AI Creativity Control (Temperature)" theme={currentTheme}>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">Temperature: {prefs.aiTemperature || 0.7}</span>
            <span className={`${currentTheme.accentText} font-bold`}>{getTemperatureLabel(prefs.aiTemperature)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={prefs.aiTemperature || 0.7}
            onChange={(e) => updatePref('aiTemperature', parseFloat(e.target.value))}
            className={`w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer ${currentTheme.sliderAccent}`}
          />
          <div className="flex justify-between text-xs text-slate-400 dark:text-zinc-500">
            <span>Precise / Factual (0.1)</span>
            <span>Balanced (0.5)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>
      </Section>

      {/* ── Language & Region (EXPANDED TO 12 GLOBAL LANGUAGES WITH UNIVERSAL SVG FLAGS) ── */}
      <Section icon={Languages} title="Extended Language & Flag Selector" theme={currentTheme}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { key: 'en-us', country: 'us', label: 'English (US)' },
            { key: 'en-gb', country: 'gb', label: 'English (UK)' },
            { key: 'hi',    country: 'in', label: 'Hindi' },
            { key: 'te',    country: 'in', label: 'Telugu' },
            { key: 'ta',    country: 'in', label: 'Tamil' },
            { key: 'es',    country: 'es', label: 'Spanish' },
            { key: 'fr',    country: 'fr', label: 'French' },
            { key: 'de',    country: 'de', label: 'German' },
            { key: 'ja',    country: 'jp', label: 'Japanese' },
            { key: 'zh',    country: 'cn', label: 'Chinese' },
            { key: 'ar',    country: 'sa', label: 'Arabic' },
            { key: 'ru',    country: 'ru', label: 'Russian' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('language', opt.key)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all text-xs font-semibold ${
                prefs.language === opt.key ? activeCard : idleCard
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FlagIcon code={opt.country} className="w-5 h-3.5 shadow-xs" />
                <span className="truncate">{opt.label}</span>
              </div>
              {prefs.language === opt.key && <Check size={12} strokeWidth={3} className={currentTheme.checkColor} />}
            </motion.button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-3">
          Applies to AI explanations, Speech Recognition dictation, and Text-to-Speech audio output.
        </p>
      </Section>

      {/* ── TTS Voice & Speech Settings ────────────────────────────────────── */}
      <Section icon={Volume2} title="Audio & Speech Customization (TTS)" theme={currentTheme}>
        <div className="space-y-5">
          {/* Voice profile */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Voice Assistant Profile</label>
              <button
                type="button"
                onClick={handleTestVoice}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  isPlayingTest
                    ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                    : currentTheme.btn
                }`}
              >
                {isPlayingTest ? <Square size={12} /> : <Play size={12} />}
                <span>{isPlayingTest ? 'Stop Voice' : 'Test Voice Profile'}</span>
              </button>
            </div>
            <select
              value={prefs.voiceProfile || 'female-us'}
              onChange={(e) => updatePref('voiceProfile', e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="female-us">Clara — Warm (Female US)</option>
              <option value="male-us">James — Professional (Male US)</option>
              <option value="female-uk">Olivia — Elegant (Female UK)</option>
              <option value="male-uk">Harry — Clarified (Male UK)</option>
              <option value="robot">Byte — Modern Cybernetic (Robot AI)</option>
            </select>
          </div>

          {/* Speech Rate */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Speech Speed</span>
              <span className={currentTheme.accentText}>{prefs.voiceRate || 1.0}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={prefs.voiceRate || 1.0}
              onChange={(e) => updatePref('voiceRate', parseFloat(e.target.value))}
              className={`w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer ${currentTheme.sliderAccent}`}
            />
          </div>

          {/* Auto Read Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">Auto-read AI Responses</span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">Speak AI answers automatically when received.</span>
            </div>
            <ToggleSwitch
              value={!!prefs.autoReadAnswers}
              onChange={(val) => updatePref('autoReadAnswers', val)}
              theme={currentTheme}
            />
          </div>
        </div>
      </Section>

      {/* ── Daily Study & Learning Goals ─────────────────────────────────── */}
      <Section icon={Clock} title="Personal Learning Schedule & Focus" theme={currentTheme}>
        <div className="space-y-5">
          {/* Daily Study target */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Daily Target study time</span>
              <span className={`${currentTheme.accentText} font-extrabold`}>{prefs.dailyStudyGoal || 30} minutes</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={prefs.dailyStudyGoal || 30}
              onChange={(e) => updatePref('dailyStudyGoal', parseInt(e.target.value))}
              className={`w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer ${currentTheme.sliderAccent}`}
            />
          </div>

          {/* Primary Learning focus */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Learning Goal</label>
            <select
              value={prefs.learningGoal || 'exams'}
              onChange={(e) => updatePref('learningGoal', e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="exams">Ace Exams & Tests 📝</option>
              <option value="skills">Learn Practical Skills & Coding 🚀</option>
              <option value="curiosity">Broaden General Curiosity 🧠</option>
              <option value="research">Write Academic Papers & Research 🔬</option>
            </select>
          </div>
        </div>
      </Section>

      {/* ── Sidebar Layout ─────────────────────────────────────────────────── */}
      <Section icon={Layout} title="Sidebar Layout" theme={currentTheme}>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'auto',      label: 'Auto',      desc: 'Adapts to screen' },
            { key: 'expanded',  label: 'Expanded',  desc: 'Always open' },
            { key: 'collapsed', label: 'Collapsed', desc: 'Icon only' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('sidebarLayout', opt.key)}
              className={`flex-1 min-w-[100px] flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                prefs.sidebarLayout === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="font-bold capitalize">{opt.label}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── Animation Speed ────────────────────────────────────────────────── */}
      <Section icon={Zap} title="Animation Speed" theme={currentTheme}>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'reduced', label: 'Reduced', desc: 'Minimal motion' },
            { key: 'normal',  label: 'Normal',  desc: 'Smooth defaults' },
            { key: 'fast',    label: 'Snappy',  desc: 'Ultra-fast UI' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('animationSpeed', opt.key)}
              className={`flex-1 min-w-[100px] flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                prefs.animationSpeed === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="font-bold capitalize">{opt.label}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── Study Experience Toggles ───────────────────────────────────────── */}
      <Section icon={Brain} title="Study Experience" theme={currentTheme}>
        <div className="space-y-4">
          {[
            {
              key: 'focusMode',
              label: 'Focus Mode',
              desc: 'Hide non-essential UI elements during deep study sessions.',
            },
            {
              key: 'autoSaveNotes',
              label: 'Auto-save Notes',
              desc: 'Automatically commit your notes to local storage as you type.',
            },
            {
              key: 'showWordCount',
              label: 'Show Word Count',
              desc: 'Display live word and character counters in the text input area.',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{item.label}</span>
                <span className="text-xs text-slate-400 dark:text-zinc-500">{item.desc}</span>
              </div>
              <ToggleSwitch
                value={!!prefs[item.key]}
                onChange={(val) => updatePref(item.key, val)}
                theme={currentTheme}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Live Preview ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl p-6"
      >
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Live Parameters Active</p>
        <div className="flex items-end gap-3">
          <div className="max-w-[70%] px-4 py-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm text-sm text-slate-600 dark:text-zinc-300">
            What personalization settings are currently active in my session?
          </div>
        </div>
        <div className="flex items-end gap-3 mt-3 justify-end">
          <div
            className={`max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm text-sm text-white shadow-md transition-all duration-300 ${currentBubble.bg}`}
          >
            {`AI Model: ${prefs.aiModel || 'gemini-3-flash-preview'} | Temp: ${prefs.aiTemperature || 0.7} | Lang: ${prefs.language || 'en-us'} | Voice: ${prefs.voiceProfile || 'female-us'}`}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PersonalizationTab;
