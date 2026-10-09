import React, { useContext } from 'react';
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
} from 'lucide-react';
import { PreferencesContext } from '../context/PreferencesContext';

/* ─── Reusable Section Wrapper ─────────────────────────────────────────────── */
const Section = ({ icon: Icon, title, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-lg shadow-slate-200/10 dark:shadow-none"
  >
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
        <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
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
const activeCard =
  'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-md';
const idleCard =
  'border-slate-200/70 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 bg-white/40 dark:bg-zinc-900/40';

/* ─── Toggle Switch ─────────────────────────────────────────────────────────── */
const ToggleSwitch = ({ value, onChange }) => (
  <button
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      value ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-zinc-700'
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
          <Sparkles className="text-indigo-500" size={28} />
          Personalization
        </h2>
        <p className="text-slate-500 dark:text-zinc-400">Customize and tailor your study workspace and AI models.</p>
      </motion.div>

      {/* ── Accent Color ───────────────────────────────────────────────────── */}
      <Section icon={Palette} title="Accent Color">
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
          Selected: <span className="font-semibold capitalize">{prefs.accentColor}</span> — applies to buttons, badges, and key outlines.
        </p>
      </Section>

      {/* ── Chat Bubble Color ──────────────────────────────────────────────── */}
      <Section icon={MessageSquare} title="Chat Bubble Color">
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
          Selected: <span className="font-semibold capitalize">{prefs.bubbleColor}</span> — shapes your conversation aesthetics.
        </p>
      </Section>

      {/* ── Font Size ──────────────────────────────────────────────────────── */}
      <Section icon={Type} title="Font Size">
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
      <Section icon={Sparkles} title="Response Style">
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

      {/* ── AI Model Selection (NEW PREMIUM FEATURE) ────────────────────── */}
      <Section icon={Bot} title="AI Large Language Model (LLM)">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'gemini-3-flash-preview', label: 'Gemini 3 Flash ⚡ (Frontier)', desc: 'Next-generation Gemini 3 reasoning engine. Enhanced logic, agentic speed, & complex analysis.' },
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

      {/* ── AI Creativity Control (NEW PREMIUM FEATURE) ─────────────────── */}
      <Section icon={Sliders} title="AI Creativity Control (Temperature)">
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">Temperature: {prefs.aiTemperature || 0.7}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{getTemperatureLabel(prefs.aiTemperature)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={prefs.aiTemperature || 0.7}
            onChange={(e) => updatePref('aiTemperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-400 dark:text-zinc-500">
            <span>Precise / Factual (0.1)</span>
            <span>Balanced (0.5)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>
      </Section>

      {/* ── Language & Region (EXPANDED TO 12 GLOBAL LANGUAGES) ─────────── */}
      <Section icon={Languages} title="Extended Language & Flag Selector">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { key: 'en-us', label: 'English (US) 🇺🇸' },
            { key: 'en-gb', label: 'English (UK) 🇬🇧' },
            { key: 'hi',    label: 'Hindi 🇮🇳' },
            { key: 'te',    label: 'Telugu 🇮🇳' },
            { key: 'ta',    label: 'Tamil 🇮🇳' },
            { key: 'es',    label: 'Spanish 🇪🇸' },
            { key: 'fr',    label: 'French 🇫🇷' },
            { key: 'de',    label: 'German 🇩🇪' },
            { key: 'ja',    label: 'Japanese 🇯🇵' },
            { key: 'zh',    label: 'Chinese 🇨🇳' },
            { key: 'ar',    label: 'Arabic 🇸🇦' },
            { key: 'ru',    label: 'Russian 🇷🇺' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('language', opt.key)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all text-xs font-semibold ${
                prefs.language === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {prefs.language === opt.key && <Check size={12} strokeWidth={3} className="text-indigo-500 shrink-0 ml-1" />}
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── TTS Voice & Speech Settings (NEW PREMIUM FEATURE) ──────────── */}
      <Section icon={Volume2} title="Audio & Speech Customization (TTS)">
        <div className="space-y-5">
          {/* Voice profile */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Voice Assistant Profile</label>
            <select
              value={prefs.voiceProfile || 'female-us'}
              onChange={(e) => updatePref('voiceProfile', e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="female-us">Clara — Warm (Female US) 🇺🇸</option>
              <option value="male-us">James — Professional (Male US) 🇺🇸</option>
              <option value="female-uk">Olivia — Elegant (Female UK) 🇬🇧</option>
              <option value="male-uk">Harry — Clarified (Male UK) 🇬🇧</option>
              <option value="robot">Byte — Modern Cybernetic (Robot AI) 🤖</option>
            </select>
          </div>

          {/* Speech Rate */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Speech Speed</span>
              <span className="text-indigo-500">{prefs.voiceRate || 1.0}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={prefs.voiceRate || 1.0}
              onChange={(e) => updatePref('voiceRate', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
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
            />
          </div>
        </div>
      </Section>

      {/* ── Daily Study & Learning Goals (NEW PREMIUM FEATURE) ────────── */}
      <Section icon={Clock} title="Personal Learning Schedule & Focus">
        <div className="space-y-5">
          {/* Daily Study target */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Daily Target study time</span>
              <span className="text-indigo-500 font-extrabold">{prefs.dailyStudyGoal || 30} minutes</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={prefs.dailyStudyGoal || 30}
              onChange={(e) => updatePref('dailyStudyGoal', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
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
      <Section icon={Layout} title="Sidebar Layout">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'expanded', label: 'Expanded', icon: '⬛', desc: 'Show full sidebar by default' },
            { key: 'compact',  label: 'Compact',  icon: '▪️', desc: 'Start collapsed' },
            { key: 'auto',     label: 'Auto',     icon: '🔄', desc: 'Remember last state' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('sidebarLayout', opt.key)}
              className={`flex-1 min-w-[110px] flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                prefs.sidebarLayout === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="font-bold text-sm">{opt.label}</span>
              <span className="text-xs opacity-60 text-center leading-snug">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── Animation Speed ────────────────────────────────────────────────── */}
      <Section icon={Zap} title="Animation Speed">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'off',    label: 'Off',    desc: 'No animations' },
            { key: 'normal', label: 'Normal', desc: 'Default speed' },
            { key: 'smooth', label: 'Smooth', desc: 'Slower, more fluid' },
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

      {/* ── AI Persona ─────────────────────────────────────────────────────── */}
      <Section icon={Bot} title="AI Persona Style">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'scholar', label: 'Scholar 🎓', desc: 'Formal and academic' },
            { key: 'tutor',   label: 'Tutor 🧑‍🏫',  desc: 'Friendly and encouraging' },
            { key: 'coach',   label: 'Coach 🏆',   desc: 'Direct and motivating' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('aiPersona', opt.key)}
              className={`flex-1 min-w-[110px] flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                prefs.aiPersona === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="text-2xl mb-1">{opt.label.split(' ').slice(-1)[0]}</span>
              <span className="font-bold text-sm">{opt.label.split(' ').slice(0, -1).join(' ')}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ── Study Mode ─────────────────────────────────────────────────────── */}
      <Section icon={BookOpen} title="Workspace Settings">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-zinc-800">
          {[
            {
              key: 'focusMode',
              label: 'Focus Mode',
              desc: 'Hides distracting buttons and details during deep sessions.',
            },
            {
              key: 'autoSaveNotes',
              label: 'Auto-save Notes',
              desc: 'Silently back up your scribbles and notes to our database.',
            },
            {
              key: 'showWordCount',
              label: 'Show Word Count',
              desc: 'Display active text details in review panels.',
            },
          ].map((toggle, idx) => (
            <motion.div
              key={toggle.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="font-semibold text-slate-800 dark:text-white text-sm">
                  {toggle.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">{toggle.desc}</span>
              </div>
              <ToggleSwitch
                value={!!prefs[toggle.key]}
                onChange={(val) => updatePref(toggle.key, val)}
              />
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Data Retention & Privacy ────────────────────────────────────────── */}
      <Section icon={Shield} title="Data Retention & Privacy">
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          Control how long your learning activity history is retained. Auto-pruning helps optimize database health and enhances privacy.
        </p>
        <div className="flex gap-3 flex-wrap">
          {[
            { key: '30',    label: '30 Days',    desc: '1 Month retention' },
            { key: '90',    label: '90 Days',    desc: '3 Months (Recommended)' },
            { key: '180',   label: '180 Days',   desc: '6 Months retention' },
            { key: 'never', label: 'Indefinite', desc: 'Keep logs forever' },
          ].map((opt) => (
            <motion.button
              key={opt.key}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('logRetention', opt.key)}
              className={`flex-1 min-w-[120px] flex flex-col gap-1 p-4 rounded-2xl border-2 transition-all text-left ${
                (prefs.logRetention || '90') === opt.key ? activeCard : idleCard
              }`}
            >
              <span className="font-bold text-sm capitalize">{opt.label}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </motion.button>
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
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Live Preview</p>
        <div className="flex items-end gap-3">
          <div className="max-w-[70%] px-4 py-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm text-sm text-slate-600 dark:text-zinc-300">
            What model parameters are active?
          </div>
        </div>
        <div className="flex items-end gap-3 mt-3 justify-end">
          <div
            className="max-w-[70%] px-4 py-3 rounded-2xl rounded-br-sm text-sm text-white shadow-md transition-all duration-300"
            style={{ background: `hsl(var(--accent-h), var(--accent-s), 50%)` }}
          >
            {`AI Engine: ${prefs.aiModel || 'gemini-2.5-flash'} | Creativity Temp: ${prefs.aiTemperature || 0.7} | Lang: ${prefs.language || 'en-us'}`}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PersonalizationTab;
