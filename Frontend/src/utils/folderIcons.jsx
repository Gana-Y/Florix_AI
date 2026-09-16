import React from 'react';
import {
  Folder, FolderPlus, FolderOpen, BookOpen, GraduationCap, Brain, Atom,
  FlaskConical, Microscope, Calculator, Stethoscope, Scale, Palette, Globe,
  Landmark, Music, Compass, Code, Terminal, Database, Cpu, Binary,
  Layers, GitBranch, Archive, Shield, Boxes, Wrench, FileText,
  Sparkles, Flame, Rocket, Target, Zap, Trophy, Lightbulb, Bookmark, Briefcase
} from 'lucide-react';

export const FOLDER_ICON_MAP = {
  Folder, FolderPlus, FolderOpen, BookOpen, GraduationCap, Brain, Atom,
  FlaskConical, Microscope, Calculator, Stethoscope, Scale, Palette, Globe,
  Landmark, Music, Compass, Code, Terminal, Database, Cpu, Binary,
  Layers, GitBranch, Archive, Shield, Boxes, Wrench, FileText,
  Sparkles, Flame, Rocket, Target, Zap, Trophy, Lightbulb, Bookmark, Briefcase
};

export const ICON_CATEGORIES = [
  {
    id: 'academic',
    label: 'Academic & Sciences',
    icons: [
      'GraduationCap', 'BookOpen', 'Brain', 'Atom', 'FlaskConical',
      'Microscope', 'Calculator', 'Stethoscope', 'Scale', 'Palette',
      'Globe', 'Landmark', 'Music', 'Compass'
    ]
  },
  {
    id: 'tech',
    label: 'Tech & Code',
    icons: [
      'Code', 'Terminal', 'Database', 'Cpu', 'Binary',
      'Layers', 'GitBranch', 'Shield', 'Boxes', 'Wrench'
    ]
  },
  {
    id: 'productivity',
    label: 'Productivity & Goals',
    icons: [
      'Folder', 'FolderPlus', 'FileText', 'Sparkles', 'Flame',
      'Rocket', 'Target', 'Zap', 'Trophy', 'Lightbulb',
      'Bookmark', 'Briefcase', 'Archive'
    ]
  },
  {
    id: 'emojis',
    label: 'Popular Emojis',
    icons: [
      '📁', '📚', '💻', '🔬', '🧠', '⚡', '🎯', '📝', '💡', '🎓',
      '🔥', '🚀', '⚖️', '🎨', '🧪', '📊', '🩺', '🏛️', '🧬', '📈'
    ]
  }
];

export const FOLDER_COLORS = [
  {
    id: 'indigo',
    name: 'Cyber Indigo',
    hex: '#6366f1',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'border-indigo-500/40',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500 text-white shadow-indigo-500/30',
    banner: 'from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/30',
    ring: 'ring-indigo-500',
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    hex: '#06b6d4',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    border: 'border-cyan-500/40',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-500 text-white shadow-cyan-500/30',
    banner: 'from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30',
    ring: 'ring-cyan-500',
  },
  {
    id: 'purple',
    name: 'Neon Purple',
    hex: '#a855f7',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'border-purple-500/40',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500 text-white shadow-purple-500/30',
    banner: 'from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30',
    ring: 'ring-purple-500',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    hex: '#10b981',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500 text-white shadow-emerald-500/30',
    banner: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30',
    ring: 'ring-emerald-500',
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    hex: '#f59e0b',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500 text-white shadow-amber-500/30',
    banner: 'from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30',
    ring: 'ring-amber-500',
  },
  {
    id: 'rose',
    name: 'Crimson Ruby',
    hex: '#f43f5e',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500 text-white shadow-rose-500/30',
    banner: 'from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30',
    ring: 'ring-rose-500',
  },
  {
    id: 'orange',
    name: 'Sunset Coral',
    hex: '#f97316',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500 text-white shadow-orange-500/30',
    banner: 'from-orange-500/20 via-orange-500/5 to-transparent border-orange-500/30',
    ring: 'ring-orange-500',
  },
  {
    id: 'blue',
    name: 'Cobalt Blue',
    hex: '#3b82f6',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/40',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500 text-white shadow-blue-500/30',
    banner: 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/30',
    ring: 'ring-blue-500',
  },
  {
    id: 'fuchsia',
    name: 'Cyber Fuchsia',
    hex: '#d946ef',
    bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15',
    border: 'border-fuchsia-500/40',
    text: 'text-fuchsia-600 dark:text-fuchsia-400',
    badge: 'bg-fuchsia-500 text-white shadow-fuchsia-500/30',
    banner: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent border-fuchsia-500/30',
    ring: 'ring-fuchsia-500',
  },
  {
    id: 'slate',
    name: 'Stealth Silver',
    hex: '#64748b',
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    border: 'border-slate-500/40',
    text: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-500 text-white shadow-slate-500/30',
    banner: 'from-slate-500/20 via-slate-500/5 to-transparent border-slate-500/30',
    ring: 'ring-slate-500',
  },
];

export const getFolderColorConfig = (colorKeyOrHex) => {
  if (!colorKeyOrHex) return FOLDER_COLORS[0];
  
  const found = FOLDER_COLORS.find(c => c.id === colorKeyOrHex || c.hex.toLowerCase() === colorKeyOrHex.toLowerCase());
  if (found) return found;

  // If custom hex
  if (typeof colorKeyOrHex === 'string' && colorKeyOrHex.startsWith('#')) {
    return {
      id: 'custom',
      name: 'Custom',
      hex: colorKeyOrHex,
      bg: '',
      border: '',
      text: '',
      badge: 'text-white',
      banner: '',
      ring: '',
      customStyle: {
        backgroundColor: `${colorKeyOrHex}18`,
        borderColor: `${colorKeyOrHex}60`,
        color: colorKeyOrHex,
      },
      customBadgeStyle: {
        backgroundColor: colorKeyOrHex,
        boxShadow: `0 4px 14px ${colorKeyOrHex}40`,
      }
    };
  }

  return FOLDER_COLORS[0];
};

export const renderFolderIcon = (iconKey, { size = 16, className = '', style = {} } = {}) => {
  if (!iconKey) {
    return <Folder size={size} className={className} style={style} />;
  }

  const LucideComponent = FOLDER_ICON_MAP[iconKey];
  if (LucideComponent) {
    return <LucideComponent size={size} className={className} style={style} />;
  }

  // Otherwise render as emoji or text
  return (
    <span
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ fontSize: `${Math.max(size - 2, 12)}px`, lineHeight: 1, ...style }}
    >
      {iconKey}
    </span>
  );
};
