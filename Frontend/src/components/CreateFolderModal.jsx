import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderPlus, X, Sparkles, Check, Loader2, Edit3,
  Layers, BookOpen, MessageSquare, Palette
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import {
  FOLDER_ICON_MAP,
  ICON_CATEGORIES,
  FOLDER_COLORS,
  getFolderColorConfig,
  renderFolderIcon,
  getSmartFolderThemeForTitle,
  EMOJI_TO_VECTOR_MAP
} from '../utils/folderIcons';

const QUICK_SUGGESTIONS = [
  'DSA & Algorithms',
  'Medical Sciences',
  'Organic Chemistry',
  'Machine Learning',
  'Constitutional Law',
  'Exams 2026',
];

export default function CreateFolderModal({
  isOpen,
  onClose,
  onFolderCreated,
  editingFolder = null,
}) {
  const { addToast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [customHex, setCustomHex] = useState('');
  const [activeCategory, setActiveCategory] = useState('academic');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userModifiedIcon, setUserModifiedIcon] = useState(false);
  const [userModifiedColor, setUserModifiedColor] = useState(false);
  const [autoMatchedBadge, setAutoMatchedBadge] = useState('');

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      if (editingFolder) {
        setFolderName(editingFolder.name || '');
        setFolderDescription(editingFolder.description || '');
        setSelectedIcon(editingFolder.icon || 'Folder');
        setSelectedColor(editingFolder.color || 'indigo');
        setUserModifiedIcon(true);
        setUserModifiedColor(true);
        setAutoMatchedBadge('');
        if (editingFolder.color?.startsWith('#')) {
          setCustomHex(editingFolder.color);
        } else {
          setCustomHex('');
        }
      } else {
        setFolderName('');
        setFolderDescription('');
        setSelectedIcon('Folder');
        setSelectedColor('indigo');
        setCustomHex('');
        setCustomEmojiInput('');
        setUserModifiedIcon(false);
        setUserModifiedColor(false);
        setAutoMatchedBadge('');
      }
    }
  }, [isOpen, editingFolder]);

  if (!isOpen) return null;

  const colorConfig = getFolderColorConfig(customHex || selectedColor);

  // Dynamic Title Change with Smart Logo and Color matching
  const handleTitleChange = (val) => {
    setFolderName(val);

    // If user erases the title (empty or whitespace only), the logo and theme should GO!
    if (!val.trim()) {
      setUserModifiedIcon(false);
      setUserModifiedColor(false);
      setAutoMatchedBadge('');
      setCustomEmojiInput('');
      if (!editingFolder) {
        setSelectedIcon('Folder');
        if (!customHex) {
          setSelectedColor('indigo');
        }
        setActiveCategory('academic');
      } else {
        // If editing an existing folder, restore its saved state
        setSelectedIcon(editingFolder.icon || 'Folder');
        setSelectedColor(editingFolder.color || 'indigo');
      }
      return;
    }

    const match = getSmartFolderThemeForTitle(val);
    if (match.matched) {
      if (!userModifiedIcon) {
        setSelectedIcon(match.icon);
        setActiveCategory(match.category);
        setCustomEmojiInput('');
      }
      if (!userModifiedColor && !customHex) {
        setSelectedColor(match.color);
      }
      setAutoMatchedBadge(match.matchedKeyword || 'matched');
    } else {
      // Title does not match any keyword (e.g. user backspaced to a partial non-word or generic name)
      // The auto-selected logo and theme should go back to default Folder + Indigo
      if (!userModifiedIcon) {
        setSelectedIcon(editingFolder ? (editingFolder.icon || 'Folder') : 'Folder');
        setActiveCategory('academic');
      }
      if (!userModifiedColor && !customHex) {
        setSelectedColor(editingFolder ? (editingFolder.color || 'indigo') : 'indigo');
      }
      setAutoMatchedBadge('');
    }
  };

  // When user explicitly selects or changes the icon manually
  const handleSelectIconManually = (iconKey) => {
    setSelectedIcon(iconKey);
    setUserModifiedIcon(true);
  };

  // When user types custom emoji or icon symbol
  const handleCustomEmojiChange = (emojiVal) => {
    setCustomEmojiInput(emojiVal);
    const trimmed = (emojiVal || '').trim();
    if (trimmed) {
      const vectorMapped = EMOJI_TO_VECTOR_MAP[trimmed] || trimmed;
      setSelectedIcon(vectorMapped);
      setUserModifiedIcon(true);
    }
  };

  // When user selects a color palette manually
  const handleSelectColorManually = (colorId) => {
    setSelectedColor(colorId);
    setCustomHex('');
    setUserModifiedColor(true);
  };

  // When user picks a custom hex color
  const handleCustomHexChange = (hexVal) => {
    setCustomHex(hexVal);
    setUserModifiedColor(true);
  };

  // Reset to auto-matched logo if user changed their mind
  const handleResetToAuto = () => {
    setUserModifiedIcon(false);
    setUserModifiedColor(false);
    const match = getSmartFolderThemeForTitle(folderName);
    if (match.matched) {
      setSelectedIcon(match.icon);
      setActiveCategory(match.category);
      setSelectedColor(match.color);
      setCustomHex('');
      setCustomEmojiInput('');
      setAutoMatchedBadge(match.matchedKeyword || 'matched');
    } else {
      setSelectedIcon('Folder');
      setSelectedColor('indigo');
      setCustomHex('');
      setCustomEmojiInput('');
      setAutoMatchedBadge('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      addToast('Please enter a folder title', 'error');
      return;
    }

    setLoading(true);
    const finalColor = customHex || selectedColor;
    const finalIcon = selectedIcon || 'Folder';

    try {
      if (editingFolder) {
        // Update existing folder
        const res = await api.patch(`/projects/${editingFolder.id}`, {
          name: trimmedName,
          color: finalColor,
          icon: finalIcon,
          description: folderDescription.trim() || null,
        });
        addToast(`Folder "${res.data.name || trimmedName}" updated!`, 'success');
        onFolderCreated?.(res.data || { ...editingFolder, name: trimmedName, color: finalColor, icon: finalIcon, description: folderDescription.trim() });
      } else {
        // Create new folder (unrestricted, for Free, Pro, and Premium)
        const res = await api.post('/projects', {
          name: trimmedName,
          color: finalColor,
          icon: finalIcon,
          description: folderDescription.trim() || null,
        });
        addToast(`Folder "${res.data.name}" created!`, 'success');
        onFolderCreated?.(res.data);
      }
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err?.response?.data?.detail || 'Failed to save folder', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentCategoryIcons = ICON_CATEGORIES.find(c => c.id === activeCategory)?.icons || [];

  return (
    <div
      data-lenis-prevent="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto custom-scrollbar animate-in fade-in duration-150"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all ${colorConfig.badge || ''}`}
              style={colorConfig.customBadgeStyle || {}}
            >
              {renderFolderIcon(selectedIcon, { size: 22 })}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {editingFolder ? 'Edit Folder & Workspace' : 'Create New Folder'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Organize subchats, study sessions, and master decks in one cockpit.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div
          data-lenis-prevent="true"
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 custom-scrollbar"
        >
          {/* Live Preview Card */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-500" />
              <span>Cockpit Live Preview</span>
            </label>
            <div
              className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border shadow-sm transition-all duration-300 bg-gradient-to-br ${colorConfig.banner || 'from-indigo-500/15 to-transparent border-indigo-500/30'}`}
              style={colorConfig.customStyle || {}}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 transition-transform ${colorConfig.badge || ''}`}
                    style={colorConfig.customBadgeStyle || {}}
                  >
                    {renderFolderIcon(selectedIcon, { size: 24 })}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                      {folderName.trim() || 'Untitled Academic Folder'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {folderDescription.trim() || 'Custom academic workspace ready for materials & subchats'}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full bg-white/70 dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
                    <BookOpen size={10} className="text-indigo-500" />
                    <span>0 Materials</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full bg-white/70 dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
                    <MessageSquare size={10} className="text-purple-500" />
                    <span>0 Subchats</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Folder Title Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                Folder Title <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {folderName.length}/50
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={50}
                value={folderName}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms, Neurobiology 2026..."
                className="w-full text-sm pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-zinc-800/90 rounded-xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
              />
              {folderName && (
                <button
                  type="button"
                  onClick={() => handleTitleChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                  title="Clear title and reset logo"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {/* Quick Title Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleTitleChange(sug)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
              Description or Subject Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={folderDescription}
              onChange={(e) => setFolderDescription(e.target.value)}
              placeholder="e.g. Midterm prep, research papers, Professor Chen's lecture notes..."
              className="w-full text-xs px-3.5 py-2 bg-slate-50 dark:bg-zinc-800/90 rounded-xl border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Color Customizer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Palette size={13} className="text-indigo-500" />
                <span>Custom Glowing Theme & Color</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400">
                {colorConfig.name || 'Custom'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FOLDER_COLORS.map((c) => {
                const isSelected = !customHex && selectedColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectColorManually(c.id)}
                    className={`group relative w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900 scale-110 shadow-lg'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {isSelected && <Check size={14} className="text-white drop-shadow-md" />}
                  </button>
                );
              })}

              {/* Custom Hex Color Picker Input */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-700">
                <div className="relative">
                  <input
                    type="color"
                    value={customHex || '#6366f1'}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    className="w-8 h-8 rounded-xl cursor-pointer opacity-0 absolute inset-0 z-10"
                    title="Pick custom hex color"
                  />
                  <div
                    className={`w-8 h-8 rounded-xl border border-slate-300 dark:border-zinc-700 flex items-center justify-center text-xs font-bold transition-transform ${
                      customHex ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900 scale-110' : ''
                    }`}
                    style={{ backgroundColor: customHex || 'transparent' }}
                  >
                    {!customHex && <span className="text-[10px] font-bold text-slate-400">HEX</span>}
                  </div>
                </div>
                {customHex && (
                  <button
                    type="button"
                    onClick={() => { setCustomHex(''); setUserModifiedColor(false); }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logo & Icon Library */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Choose Folder Logo & Discipline Icon
                </label>
                {/* Auto-matched indicator */}
                {autoMatchedBadge && !userModifiedIcon && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-in fade-in">
                    <Sparkles size={10} />
                    <span>Auto-selected</span>
                  </span>
                )}
                {/* User modified tag + option to reset to auto */}
                {userModifiedIcon && folderName.trim() && (
                  <button
                    type="button"
                    onClick={handleResetToAuto}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Re-run smart auto-detection for current title"
                  >
                    <span>(Modified)</span>
                    <span className="underline decoration-dotted">Reset to auto-logo</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                <span>Selected:</span>
                <span className="font-bold text-slate-700 dark:text-zinc-200">
                  {selectedIcon}
                </span>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl overflow-x-auto custom-scrollbar text-[11px] font-bold">
              {ICON_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Icon Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/60 dark:border-zinc-800 max-h-44 overflow-y-auto custom-scrollbar">
              {currentCategoryIcons.map((ic) => {
                const isSelected = selectedIcon === ic;
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => handleSelectIconManually(ic)}
                    className={`h-10 rounded-xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105 ring-2 ring-indigo-400'
                        : 'bg-white dark:bg-zinc-800/90 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:scale-105 border border-slate-200/50 dark:border-zinc-700/50'
                    }`}
                    title={ic}
                  >
                    {renderFolderIcon(ic, { size: 18 })}
                  </button>
                );
              })}
            </div>

            {/* Custom Emoji or text input for full freedom */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 shrink-0">Or type custom emoji:</span>
              <input
                type="text"
                maxLength={4}
                value={customEmojiInput}
                onChange={(e) => handleCustomEmojiChange(e.target.value)}
                placeholder="e.g. 🪐"
                className="w-16 text-center text-sm py-1 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !folderName.trim()}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving Folder…</span>
              </>
            ) : (
              <>
                <FolderPlus size={15} />
                <span>{editingFolder ? 'Save Changes' : 'Create Folder'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
