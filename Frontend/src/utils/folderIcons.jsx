import React from 'react';
import {
  Folder, FolderPlus, FolderOpen, BookOpen, GraduationCap, Brain, Atom,
  FlaskConical, Microscope, Calculator, Stethoscope, Scale, Palette, Globe,
  Landmark, Music, Compass, Code, Terminal, Database, Cpu, Binary,
  Layers, GitBranch, Archive, Shield, Boxes, Wrench, FileText,
  Sparkles, Flame, Rocket, Target, Zap, Trophy, Lightbulb, Bookmark, Briefcase,
  Video, Play, Headphones, Mic, Image, Dna, BarChart3, TrendingUp, FileCode
} from 'lucide-react';

export const FOLDER_ICON_MAP = {
  Folder, FolderPlus, FolderOpen, BookOpen, GraduationCap, Brain, Atom,
  FlaskConical, Microscope, Calculator, Stethoscope, Scale, Palette, Globe,
  Landmark, Music, Compass, Code, Terminal, Database, Cpu, Binary,
  Layers, GitBranch, Archive, Shield, Boxes, Wrench, FileText,
  Sparkles, Flame, Rocket, Target, Zap, Trophy, Lightbulb, Bookmark, Briefcase,
  Video, Play, Headphones, Mic, Image, Dna, BarChart3, TrendingUp, FileCode
};

export const ICON_CATEGORIES = [
  {
    id: 'academic',
    label: 'Academic & Sciences',
    icons: [
      'GraduationCap', 'BookOpen', 'Brain', 'Atom', 'FlaskConical',
      'Microscope', 'Calculator', 'Stethoscope', 'Scale', 'Palette',
      'Globe', 'Landmark', 'Music', 'Compass', 'Dna'
    ]
  },
  {
    id: 'media',
    label: 'Documents & Media',
    icons: [
      'Folder', 'FolderOpen', 'FolderPlus', 'FileText', 'BookOpen',
      'Globe', 'Play', 'Video', 'Headphones', 'Mic',
      'Image', 'Archive', 'Sparkles'
    ]
  },
  {
    id: 'tech',
    label: 'Tech & Code',
    icons: [
      'Code', 'Terminal', 'Database', 'Cpu', 'Binary',
      'Layers', 'GitBranch', 'Shield', 'Boxes', 'Wrench',
      'FileCode'
    ]
  },
  {
    id: 'productivity',
    label: 'Productivity & Goals',
    icons: [
      'Target', 'Zap', 'Trophy', 'Lightbulb', 'Bookmark',
      'Briefcase', 'Flame', 'Rocket', 'BarChart3', 'TrendingUp'
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

// Comprehensive normalization mapping: maps any system emoji to crisp vector Lucide components
export const EMOJI_TO_VECTOR_MAP = {
  // Folders & Systems
  '📁': 'Folder',
  '📂': 'FolderOpen',
  '🗂️': 'Folder',
  '🗂': 'Folder',
  '📦': 'Boxes',
  // Documents & Academics
  '📚': 'BookOpen',
  '📖': 'BookOpen',
  '📕': 'BookOpen',
  '📗': 'BookOpen',
  '📘': 'BookOpen',
  '📙': 'BookOpen',
  '📝': 'FileText',
  '📄': 'FileText',
  '📃': 'FileText',
  '📑': 'FileText',
  '🎓': 'GraduationCap',
  '🏛️': 'Landmark',
  '🏛': 'Landmark',
  // Web & Geography
  '🌐': 'Globe',
  '🌍': 'Globe',
  '🌎': 'Globe',
  '🌏': 'Globe',
  '🗺️': 'Compass',
  '🗺': 'Compass',
  // Media & Video / Audio
  '▶️': 'Play',
  '▶': 'Play',
  '🎬': 'Video',
  '🎥': 'Video',
  '📹': 'Video',
  '🎙️': 'Mic',
  '🎙': 'Mic',
  '🎧': 'Headphones',
  '🎵': 'Music',
  '🎶': 'Music',
  // Images
  '🖼️': 'Image',
  '🖼': 'Image',
  '📷': 'Image',
  '📸': 'Image',
  // Tech & Science
  '💻': 'Terminal',
  '🖥️': 'Terminal',
  '🖥': 'Terminal',
  '🔬': 'Microscope',
  '🧠': 'Brain',
  '⚡': 'Zap',
  '🎯': 'Target',
  '💡': 'Lightbulb',
  '🔥': 'Flame',
  '🚀': 'Rocket',
  '⚖️': 'Scale',
  '⚖': 'Scale',
  '🎨': 'Palette',
  '🧪': 'FlaskConical',
  '📊': 'BarChart3',
  '📈': 'TrendingUp',
  '🩺': 'Stethoscope',
  '🧬': 'Dna',
  '🏆': 'Trophy',
  '✨': 'Sparkles',
  '🔧': 'Wrench',
  '🛡️': 'Shield',
  '🛡': 'Shield',
};

export const renderFolderIcon = (
  iconKey,
  { size = 16, className = '', style = {}, isOpen = false } = {}
) => {
  if (!iconKey) {
    return (
      <Folder
        size={size}
        className={className}
        style={style}
        strokeWidth={1.8}
      />
    );
  }

  // 1. Check if it's an emoji that should be normalized to vector
  let resolvedKey = EMOJI_TO_VECTOR_MAP[iconKey] || iconKey;

  // 2. Dynamic open folder state
  if (isOpen && (resolvedKey === 'Folder' || resolvedKey === '📁')) {
    resolvedKey = 'FolderOpen';
  }

  // 3. Render Lucide component
  const LucideComponent = FOLDER_ICON_MAP[resolvedKey];
  if (LucideComponent) {
    return (
      <LucideComponent
        size={size}
        className={className}
        style={style}
        strokeWidth={1.8}
      />
    );
  }

  // 4. Otherwise fallback to text/custom string
  return (
    <span
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ fontSize: `${Math.max(size - 2, 12)}px`, lineHeight: 1, ...style }}
    >
      {iconKey}
    </span>
  );
};

export const SMART_KEYWORD_RULES = [
  // 1. Algorithms & DSA
  {
    keywords: ['dsa', 'algorithm', 'leetcode', 'binary', 'tree', 'graph', 'sorting', 'recursion', 'dynamic programming', 'dp', 'structure'],
    icon: 'Binary',
    color: 'purple',
    category: 'tech'
  },
  // 2. Terminal, Linux, DevOps, Cloud
  {
    keywords: ['terminal', 'cli', 'bash', 'shell', 'linux', 'ubuntu', 'devops', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'cloud', 'server', 'deploy', 'sysadmin'],
    icon: 'Terminal',
    color: 'slate',
    category: 'tech'
  },
  // 3. Database & SQL
  {
    keywords: ['database', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'redis', 'data', 'dataset', 'analytics', 'warehouse'],
    icon: 'Database',
    color: 'cyan',
    category: 'tech'
  },
  // 4. Hardware, CPU, Electronics, IoT
  {
    keywords: ['hardware', 'cpu', 'gpu', 'processor', 'chip', 'circuit', 'electronics', 'embedded', 'iot', 'robot', 'semiconductor', 'arduino', 'raspberry'],
    icon: 'Cpu',
    color: 'amber',
    category: 'tech'
  },
  // 5. Cybersecurity & Auth
  {
    keywords: ['security', 'cyber', 'infosec', 'hack', 'penetration', 'crypto', 'cryptography', 'shield', 'firewall', 'auth'],
    icon: 'Shield',
    color: 'rose',
    category: 'tech'
  },
  // 6. Coding, Programming & Web Development
  {
    keywords: ['code', 'coding', 'program', 'developer', 'dev', 'python', 'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'html', 'css', 'c++', 'java', 'rust', 'golang', 'frontend', 'backend', 'fullstack', 'api', 'web', 'app', 'git'],
    icon: 'Code',
    color: 'indigo',
    category: 'tech'
  },
  // 7. Medical, Healthcare, Doctors & Nursing
  {
    keywords: ['med', 'medical', 'medicine', 'doctor', 'hospital', 'health', 'clinical', 'nursing', 'nurse', 'surgery', 'cardio', 'pathology', 'anatomy', 'physiology', 'stethoscope', 'pharma', 'clinic'],
    icon: 'Stethoscope',
    color: 'rose',
    category: 'academic'
  },
  // 8. Chemistry & Biochemistry
  {
    keywords: ['chem', 'chemistry', 'organic', 'inorganic', 'biochem', 'chemical', 'molecule', 'reaction', 'lab', 'laboratory', 'flask', 'toxic'],
    icon: 'FlaskConical',
    color: 'emerald',
    category: 'academic'
  },
  // 9. Biology, Genetics, Microbiology
  {
    keywords: ['bio', 'biology', 'microbiology', 'genetics', 'dna', 'gene', 'cell', 'cellular', 'evolution', 'botany', 'zoology', 'ecology', 'virus', 'bacteria', 'microscope'],
    icon: 'Microscope',
    color: 'emerald',
    category: 'academic'
  },
  // 10. AI, Machine Learning, Neuroscience & Psychology
  {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'ml', 'neural', 'nlp', 'llm', 'gpt', 'brain', 'neuro', 'neuroscience', 'psychology', 'cognitive', 'mind', 'mental', 'behavior'],
    icon: 'Brain',
    color: 'purple',
    category: 'academic'
  },
  // 11. Physics, Quantum, Space & Astronomy
  {
    keywords: ['physics', 'quantum', 'relativity', 'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'astro', 'astronomy', 'cosmo', 'cosmology', 'gravity', 'space', 'universe', 'atom'],
    icon: 'Atom',
    color: 'cyan',
    category: 'academic'
  },
  // 12. Mathematics, Calculus, Statistics
  {
    keywords: ['math', 'mathematics', 'calculus', 'algebra', 'geometry', 'stats', 'statistics', 'probability', 'discrete', 'trig', 'equation', 'linear algebra'],
    icon: 'Calculator',
    color: 'indigo',
    category: 'academic'
  },
  // 13. Law, Justice, Court & Constitution
  {
    keywords: ['law', 'legal', 'court', 'justice', 'jurisprudence', 'constitution', 'constitutional', 'rights', 'contract', 'tort', 'bar exam', 'attorney', 'lawyer', 'judiciary', 'litigation', 'scale'],
    icon: 'Scale',
    color: 'amber',
    category: 'academic'
  },
  // 14. Art, Design, UI/UX & Graphics
  {
    keywords: ['art', 'design', 'ui', 'ux', 'graphic', 'illustration', 'draw', 'paint', 'sketch', 'color', 'creative', 'animation', 'visual', 'palette', 'figma'],
    icon: 'Palette',
    color: 'fuchsia',
    category: 'academic'
  },
  // 15. Music, Audio & Sound
  {
    keywords: ['music', 'audio', 'song', 'sound', 'instrument', 'guitar', 'piano', 'vocal', 'composition', 'melody', 'harmony'],
    icon: 'Music',
    color: 'purple',
    category: 'academic'
  },
  // 16. History, Politics, Civilizations
  {
    keywords: ['history', 'historical', 'civilization', 'empire', 'war', 'revolution', 'politics', 'political', 'government', 'policy', 'sociology', 'anthropology', 'landmark'],
    icon: 'Landmark',
    color: 'amber',
    category: 'academic'
  },
  // 17. Geography, World & Languages
  {
    keywords: ['geography', 'geo', 'world', 'earth', 'global', 'map', 'language', 'linguistics', 'english', 'french', 'spanish', 'german', 'japanese', 'chinese', 'globe'],
    icon: 'Globe',
    color: 'blue',
    category: 'academic'
  },
  // 18. Exams, College, University, Semester
  {
    keywords: ['exam', 'exams', 'test', 'quiz', 'midterm', 'finals', 'university', 'college', 'school', 'semester', 'academic', 'course', 'grade', 'gpa', 'degree', 'grad', 'graduation'],
    icon: 'GraduationCap',
    color: 'indigo',
    category: 'academic'
  },
  // 19. Books, Literature, Reading & Notes
  {
    keywords: ['book', 'books', 'reading', 'read', 'novel', 'literature', 'poetry', 'essay', 'writing', 'journal', 'story'],
    icon: 'BookOpen',
    color: 'indigo',
    category: 'academic'
  },
  // 20. Business, Management & Career
  {
    keywords: ['business', 'management', 'mba', 'startup', 'entrepreneur', 'career', 'job', 'interview', 'work', 'resume', 'finance', 'marketing', 'strategy', 'briefcase'],
    icon: 'Briefcase',
    color: 'blue',
    category: 'productivity'
  },
  // 21. Goals, Roadmap, Milestones
  {
    keywords: ['goal', 'goals', 'target', 'milestone', 'roadmap', 'plan', 'habit'],
    icon: 'Target',
    color: 'rose',
    category: 'productivity'
  },
  // 22. Launch & Rockets
  {
    keywords: ['rocket', 'launch', 'project', 'mission', 'venture'],
    icon: 'Rocket',
    color: 'orange',
    category: 'productivity'
  },
  // 23. Priority, Streak & Flame
  {
    keywords: ['flame', 'fire', 'hot', 'urgent', 'priority', 'streak'],
    icon: 'Flame',
    color: 'orange',
    category: 'productivity'
  },
  // 24. Ideas & Concepts
  {
    keywords: ['idea', 'ideas', 'innovate', 'innovation', 'concept', 'brainstorm', 'lightbulb'],
    icon: 'Lightbulb',
    color: 'amber',
    category: 'productivity'
  },
];

export const getSmartFolderThemeForTitle = (title) => {
  if (!title || typeof title !== 'string') {
    return { icon: 'Folder', color: 'indigo', category: 'productivity', matched: false };
  }

  const normalized = title.toLowerCase().trim();
  if (!normalized) {
    return { icon: 'Folder', color: 'indigo', category: 'productivity', matched: false };
  }
  
  // Split title into alphanumeric words/tokens
  const words = normalized.split(/[^a-z0-9#+]/).filter(Boolean);
  if (words.length === 0) {
    return { icon: 'Folder', color: 'indigo', category: 'productivity', matched: false };
  }

  for (const rule of SMART_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (kw.includes(' ')) {
        // Multi-word phrase (e.g. 'machine learning', 'organic chemistry', 'deep learning')
        if (normalized.includes(kw)) {
          return {
            icon: rule.icon,
            color: rule.color,
            category: rule.category,
            matched: true,
            matchedKeyword: kw
          };
        }
      } else {
        // Word boundary matching to avoid false positive substring matches
        const isMatched = words.some(w => {
          // Exact token match (e.g. "med", "python", "ai", "dsa", "c++")
          if (w === kw) return true;
          // Word starts with keyword if keyword is at least 3 chars (e.g. "medical" starts with "med", "algorithm" starts with "algo")
          if (kw.length >= 3 && w.startsWith(kw)) return true;
          // Keyword starts with partial user word if word has at least 3 chars (e.g. user typed "medic" for "medical", "pyth" for "python")
          if (w.length >= 3 && kw.startsWith(w)) return true;
          return false;
        });

        if (isMatched) {
          return {
            icon: rule.icon,
            color: rule.color,
            category: rule.category,
            matched: true,
            matchedKeyword: kw
          };
        }
      }
    }
  }

  return { icon: 'Folder', color: 'indigo', category: 'productivity', matched: false };
};
