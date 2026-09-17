import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, BookOpen, Plus, Trash2, Edit3, Pin, ArrowLeft,
  Search, ArrowUpDown, Clock, Check, Loader2, Sparkles, Folder,
  ExternalLink, FileText, Youtube, Link2, MoreVertical, Lightbulb,
  Award, RotateCw, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Shuffle, History, X
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { renderFolderIcon, getFolderColorConfig } from '../utils/folderIcons';
import CreateFolderModal from './CreateFolderModal';

const EMOJI_OPTIONS = ['📁', '💲', '💻', '📚', '⚡', '🎯', '🔬', '🧠', '📝', '💡', '🎓', '🔥', '🚀', '⭐'];
const COLOR_OPTIONS = ['indigo', 'purple', 'emerald', 'amber', 'rose', 'blue', 'cyan'];

const COLOR_MAP = {
  indigo: 'from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500',
  purple: 'from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500',
  emerald: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500',
  amber: 'from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500',
  rose: 'from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500',
  blue: 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500',
  cyan: 'from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500',
};

const SpaceWorkspaceHub = ({
  spaceId,
  onBack,
  onOpenSubchat,
  onOpenStudySession,
  onUploadInSpace,
  onSpaceUpdated,
  onSpaceDeleted,
}) => {
  const { addToast } = useToast();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [isCreatingSubchat, setIsCreatingSubchat] = useState(false);
  const [newSubchatTitle, setNewSubchatTitle] = useState('');

  // Space Quiz Review Modal state
  const [selectedQuizReview, setSelectedQuizReview] = useState(null);

  // Master Flashcards state
  const [cardSourceFilter, setCardSourceFilter] = useState('all');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState(() => new Set());

  useEffect(() => {
    if (spaceId) {
      fetchSpaceDetails();
    }
  }, [spaceId]);

  const fetchSpaceDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${spaceId}`);
      setSpace(res.data);
      setEditTitle(res.data.name);
    } catch (err) {
      addToast('Failed to load space details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || editTitle.trim() === space?.name) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await api.patch(`/projects/${spaceId}`, { name: editTitle.trim() });
      setSpace(prev => ({ ...prev, name: editTitle.trim() }));
      setIsEditingTitle(false);
      addToast('Space renamed successfully', 'success');
      onSpaceUpdated?.();
    } catch (err) {
      addToast('Failed to rename space', 'error');
    }
  };

  const handleUpdateEmoji = async (emoji) => {
    setIsEmojiPickerOpen(false);
    try {
      await api.patch(`/projects/${spaceId}`, { icon: emoji });
      setSpace(prev => ({ ...prev, icon: emoji }));
      addToast('Icon updated', 'success');
      onSpaceUpdated?.();
    } catch (err) {
      addToast('Failed to update icon', 'error');
    }
  };

  const handleUpdateColor = async (color) => {
    try {
      await api.patch(`/projects/${spaceId}`, { color });
      setSpace(prev => ({ ...prev, color }));
      onSpaceUpdated?.();
    } catch (err) {
      addToast('Failed to update color', 'error');
    }
  };

  const handleTogglePin = async () => {
    const newPinned = !space.is_pinned;
    try {
      await api.patch(`/projects/${spaceId}`, { is_pinned: newPinned });
      setSpace(prev => ({ ...prev, is_pinned: newPinned }));
      addToast(newPinned ? 'Space pinned to top' : 'Space unpinned', 'success');
      onSpaceUpdated?.();
    } catch (err) {
      addToast('Failed to update pin', 'error');
    }
  };

  const handleDeleteSpace = async () => {
    if (!window.confirm(`Delete "${space.name}"? Your subchats and study materials will be kept in standalone chats and library.`)) {
      return;
    }
    try {
      await api.delete(`/projects/${spaceId}`);
      addToast('Space deleted', 'success');
      onSpaceDeleted?.();
      onBack?.();
    } catch (err) {
      addToast('Failed to delete space', 'error');
    }
  };

  const handleCreateSubchat = async (e) => {
    e.preventDefault();
    if (!newSubchatTitle.trim()) return;
    try {
      const res = await api.post('/conversations', {
        title: newSubchatTitle.trim(),
        project_id: spaceId,
      });
      setNewSubchatTitle('');
      setIsCreatingSubchat(false);
      addToast(`Subchat "${res.data.title}" started!`, 'success');
      fetchSpaceDetails();
      onOpenSubchat?.(res.data.id, space);
    } catch (err) {
      addToast('Failed to create subchat', 'error');
    }
  };

  const handleDeleteSubchat = async (e, subchatId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;
    try {
      await api.delete(`/conversations/${subchatId}`);
      setSpace(prev => ({
        ...prev,
        subchats: prev.subchats.filter(c => c.id !== subchatId),
        chat_count: prev.chat_count - 1
      }));
      addToast('Subchat deleted', 'success');
    } catch (err) {
      addToast('Failed to delete subchat', 'error');
    }
  };

  const handleTogglePinSubchat = async (e, subchatId, currentPinned) => {
    e.stopPropagation();
    try {
      await api.patch(`/conversations/${subchatId}/pin`, { is_pinned: !currentPinned });
      setSpace(prev => ({
        ...prev,
        subchats: prev.subchats.map(c => c.id === subchatId ? { ...c, is_pinned: !currentPinned } : c)
      }));
      addToast(!currentPinned ? 'Subchat pinned' : 'Subchat unpinned', 'success');
    } catch (err) {
      addToast('Failed to update pin', 'error');
    }
  };

  const filteredSubchats = (space?.subchats || []).filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
    if (sortBy === 'oldest') return new Date(a.updated_at) - new Date(b.updated_at);
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const filteredMaterials = (space?.study_sessions || []).filter(s =>
    s.filename.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'alphabetical') return a.filename.localeCompare(b.filename);
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
        <Loader2 size={36} className="animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-semibold">Opening Space Workspace...</p>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
        <Folder size={48} className="text-slate-300 dark:text-zinc-700 mb-3" />
        <p className="font-bold text-slate-700 dark:text-zinc-300">Space Not Found</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-3 md:px-6">
      {/* Top Navigation & Back */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>All Folders</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditFolderModalOpen(true)}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300/50 bg-white dark:bg-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Edit Folder Name, Logo & Color"
          >
            <Edit3 size={13} />
            <span>Edit Folder</span>
          </button>
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 ${
              space.is_pinned
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300/60 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Pin size={13} className={space.is_pinned ? 'fill-current rotate-45' : ''} />
            <span>{space.is_pinned ? 'Pinned' : 'Pin Folder'}</span>
          </button>
          <button
            onClick={handleDeleteSpace}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-300/50 bg-white dark:bg-zinc-900 transition-colors"
            title="Delete Folder"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Space Hero Banner */}
      {(() => {
        const colorCfg = getFolderColorConfig(space.color);
        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-br ${colorCfg.banner || 'from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/30'} border shadow-lg backdrop-blur-xl`}
            style={colorCfg.customStyle || {}}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4 min-w-0">
                {/* Folder Icon / Logo Button */}
                <div className="relative">
                  <button
                    onClick={() => setIsEditFolderModalOpen(true)}
                    className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    title="Click to customize folder icon, logo, and color"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm ${colorCfg.badge || 'bg-indigo-500 text-white'}`}
                      style={colorCfg.customBadgeStyle || {}}
                    >
                      {renderFolderIcon(space.icon, { size: 24 })}
                    </div>
                  </button>
                </div>

            {/* Title & Stats */}
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    autoFocus
                    className="text-2xl font-black bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl border border-indigo-500 text-slate-800 dark:text-white outline-none"
                  />
                  <button onClick={handleSaveTitle} className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1
                    onDoubleClick={() => setIsEditingTitle(true)}
                    className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white truncate cursor-pointer hover:underline"
                    title="Double-click to rename"
                  >
                    {space.name}
                  </h1>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity"
                    title="Rename Space"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-3">
                <span>💬 {space.chat_count || 0} Subchats</span>
                <span>•</span>
                <span>📚 {space.session_count || 0} Study Materials</span>
                <span>•</span>
                <span>Created {new Date(space.created_at).toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          {/* Color Switcher */}
          <div className="flex items-center gap-1.5 bg-white/70 dark:bg-zinc-900/70 p-1.5 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-md">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => handleUpdateColor(c)}
                className={`w-4 h-4 rounded-full transition-all ${
                  c === 'indigo' ? 'bg-indigo-500' :
                  c === 'purple' ? 'bg-purple-500' :
                  c === 'emerald' ? 'bg-emerald-500' :
                  c === 'amber' ? 'bg-amber-500' :
                  c === 'rose' ? 'bg-rose-500' :
                  c === 'blue' ? 'bg-blue-500' : 'bg-cyan-500'
                } ${space.color === c ? 'ring-2 ring-offset-2 ring-slate-700 dark:ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                title={`Theme: ${c}`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  })()}

      {/* Action Toolbar: Create Subchat, Add Material, Search, Sort */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subchats or materials in this space..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <ArrowUpDown size={13} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="newest">Date: Newest</option>
              <option value="oldest">Date: Oldest</option>
              <option value="alphabetical">Name: A to Z</option>
            </select>
          </div>

          <button
            onClick={() => setIsCreatingSubchat(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20"
          >
            <Plus size={14} />
            <span>New Subchat</span>
          </button>

          <button
            onClick={() => onUploadInSpace?.(spaceId)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all"
          >
            <BookOpen size={14} className="text-indigo-500" />
            <span>Add Study Note</span>
          </button>
        </div>
      </div>

      {/* Inline New Subchat Form */}
      <AnimatePresence>
        {isCreatingSubchat && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleCreateSubchat}
            className="p-4 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <MessageSquare size={16} />
            </div>
            <input
              type="text"
              required
              autoFocus
              value={newSubchatTitle}
              onChange={(e) => setNewSubchatTitle(e.target.value)}
              placeholder="What topic do you want to study in this chat? (e.g. Dynamic Programming Notes)..."
              className="flex-1 text-xs bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!newSubchatTitle.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
            >
              Start Chat
            </button>
            <button
              type="button"
              onClick={() => { setIsCreatingSubchat(false); setNewSubchatTitle(''); }}
              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Workspace View Tabs: Subchats vs Study Materials */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 pb-1 gap-2">
        <button
          onClick={() => setActiveTab('subchats')}
          className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'subchats'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare size={14} />
          <span>Subchats ({space.subchats?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'materials'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BookOpen size={14} />
          <span>Study Materials ({space.study_sessions?.length || 0})</span>
        </button>
        <button
          onClick={() => { setActiveTab('flashcards'); setActiveCardIndex(0); setIsCardFlipped(false); }}
          className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'flashcards'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Lightbulb size={14} />
          <span>Master Flashcards ({space.master_flashcards?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'quizzes'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Award size={14} />
          <span>Quizzes & History ({space.space_quizzes?.length || 0})</span>
        </button>
      </div>

      {/* Tab Content: SUBCHATS */}
      {activeTab === 'subchats' && (
        <div className="space-y-3">
          {filteredSubchats.length === 0 ? (
            <div className="py-20 text-center text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-white/40 dark:bg-zinc-900/40">
              <MessageSquare size={36} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
              <p className="font-bold text-slate-700 dark:text-zinc-300 text-sm">No subchats in this Space yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a dedicated discussion thread for this subject!</p>
              <button
                onClick={() => setIsCreatingSubchat(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                + Start First Subchat
              </button>
            </div>
          ) : (
            filteredSubchats.map((subchat) => (
              <motion.div
                key={subchat.id}
                onClick={() => onOpenSubchat?.(subchat.id, space)}
                whileHover={{ y: -2 }}
                className="group p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 hover:border-indigo-500/50 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {subchat.title}
                      </h4>
                      {subchat.is_pinned && (
                        <Pin size={11} className="fill-current text-indigo-500 rotate-45 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                      {subchat.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    {new Date(subchat.updated_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => handleTogglePinSubchat(e, subchat.id, subchat.is_pinned)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title={subchat.is_pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin size={13} className={subchat.is_pinned ? 'fill-current text-indigo-500' : ''} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteSubchat(e, subchat.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: STUDY MATERIALS */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaterials.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-white/40 dark:bg-zinc-900/40">
              <BookOpen size={36} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
              <p className="font-bold text-slate-700 dark:text-zinc-300 text-sm">No study documents in this Space yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload lecture notes, PDFs, or YouTube links directly into this Space!</p>
              <button
                onClick={() => onUploadInSpace?.(spaceId)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                + Add Study Material
              </button>
            </div>
          ) : (
            filteredMaterials.map((mat) => (
              <motion.div
                key={mat.id}
                whileHover={{ y: -3 }}
                onClick={() => onOpenStudySession?.(mat)}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between gap-4 cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                      {mat.category || mat.source_type || 'Study Material'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {mat.created_at ? new Date(mat.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {mat.filename}
                  </h4>
                  {mat.summary && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                      {mat.summary}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenStudySession?.(mat);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>Start Studying</span>
                    <ExternalLink size={12} />
                  </button>
                  {mat.flashcard_count > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      {mat.flashcard_count} flashcards
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: MASTER FLASHCARDS (Unified Space Deck) */}
      {activeTab === 'flashcards' && (() => {
        const allCards = space.master_flashcards || [];
        const filteredCards = cardSourceFilter === 'all'
          ? allCards
          : allCards.filter(c => String(c.source_id) === String(cardSourceFilter));
        const currentCard = filteredCards[activeCardIndex] || null;

        return (
          <div className="space-y-6">
            {allCards.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-white/40 dark:bg-zinc-900/40">
                <Lightbulb size={36} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
                <p className="font-bold text-slate-700 dark:text-zinc-300 text-sm">No flashcards in this Space yet</p>
                <p className="text-xs text-slate-400 mt-1">Upload a lecture, PDF, or YouTube video to generate cards automatically!</p>
                <button
                  onClick={() => onUploadInSpace?.(spaceId)}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  + Add First Study Material
                </button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Deck Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Master Deck:
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                      {filteredCards.length} Cards Total ({masteredCards.size} Mastered)
                    </span>
                  </div>

                  {/* Filter by Document */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <button
                      onClick={() => { setCardSourceFilter('all'); setActiveCardIndex(0); setIsCardFlipped(false); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        cardSourceFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                      }`}
                    >
                      All ({allCards.length})
                    </button>
                    {(space.study_sessions || []).map(s => {
                      const count = allCards.filter(c => String(c.source_id) === String(s.id)).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setCardSourceFilter(s.id); setActiveCardIndex(0); setIsCardFlipped(false); }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold truncate max-w-[130px] transition-all ${
                            String(cardSourceFilter) === String(s.id)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                          }`}
                          title={s.filename}
                        >
                          {s.filename.slice(0, 15)}... ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Flip Card Container */}
                {currentCard ? (
                  <div className="space-y-4">
                    <div
                      onClick={() => setIsCardFlipped(f => !f)}
                      className="min-h-[260px] p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-slate-200/80 dark:border-zinc-700/80 shadow-lg cursor-pointer hover:border-indigo-400 transition-all flex flex-col justify-between select-none relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          Card {activeCardIndex + 1} of {filteredCards.length}
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold max-w-[200px] truncate">
                          <FileText size={11} />
                          <span className="truncate">{currentCard.source_title}</span>
                        </div>
                      </div>

                      <div className="py-6 text-center">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 block">
                          {isCardFlipped ? 'Answer' : 'Question (Click card to flip)'}
                        </span>
                        <p className={`text-xl font-bold dark:text-white leading-relaxed ${isCardFlipped ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800'}`}>
                          {isCardFlipped ? currentCard.back : currentCard.front}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
                        <RotateCw size={13} />
                        <span>Click to flip</span>
                      </div>
                    </div>

                    {/* Navigation & Spaced Repetition Buttons */}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          if (activeCardIndex > 0) {
                            setActiveCardIndex(prev => prev - 1);
                            setIsCardFlipped(false);
                          }
                        }}
                        disabled={activeCardIndex === 0}
                        className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={18} />
                      </button>

                      {/* Anki Rating Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (activeCardIndex < filteredCards.length - 1) {
                              setActiveCardIndex(prev => prev + 1);
                              setIsCardFlipped(false);
                            }
                          }}
                          className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold hover:scale-105 transition-transform"
                        >
                          🔴 Hard
                        </button>
                        <button
                          onClick={() => {
                            if (activeCardIndex < filteredCards.length - 1) {
                              setActiveCardIndex(prev => prev + 1);
                              setIsCardFlipped(false);
                            }
                          }}
                          className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold hover:scale-105 transition-transform"
                        >
                          🟡 Good
                        </button>
                        <button
                          onClick={() => {
                            setMasteredCards(prev => new Set([...prev, currentCard.id]));
                            if (activeCardIndex < filteredCards.length - 1) {
                              setActiveCardIndex(prev => prev + 1);
                              setIsCardFlipped(false);
                            }
                          }}
                          className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:scale-105 transition-transform"
                        >
                          🟢 Mastered
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          if (activeCardIndex < filteredCards.length - 1) {
                            setActiveCardIndex(prev => prev + 1);
                            setIsCardFlipped(false);
                          }
                        }}
                        disabled={activeCardIndex >= filteredCards.length - 1}
                        className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400">No cards match this filter.</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab Content: SPACE QUIZZES & HISTORY */}
      {activeTab === 'quizzes' && (() => {
        const quizzes = space.space_quizzes || [];
        const avgScore = quizzes.length > 0
          ? Math.round(quizzes.reduce((acc, q) => acc + q.percentage, 0) / quizzes.length)
          : 0;

        return (
          <div className="space-y-6">
            {quizzes.length === 0 ? (
              <div className="py-20 text-center text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-white/40 dark:bg-zinc-900/40">
                <Award size={36} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
                <p className="font-bold text-slate-700 dark:text-zinc-300 text-sm">No quizzes taken in this Space yet</p>
                <p className="text-xs text-slate-400 mt-1">Practice a quiz inside any study session to track your mastery here!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Header */}
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Space Quiz Mastery</h3>
                    <p className="text-xs text-slate-500">{quizzes.length} quiz attempts across this subject</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{avgScore}%</span>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Avg Accuracy</p>
                  </div>
                </div>

                {/* List of quizzes */}
                <div className="grid gap-3">
                  {quizzes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuizReview(q)}
                      className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 hover:border-indigo-500 shadow-sm transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${q.percentage >= 70 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {q.percentage}%
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                            {q.source_title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Scored {q.score}/{q.total_questions} correct · {q.date_taken ? new Date(q.date_taken).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Review Answers →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quiz Review Modal for Space Quizzes */}
      {selectedQuizReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Quiz Review: {selectedQuizReview.source_title}</h3>
                <p className="text-xs text-slate-400">Score: {selectedQuizReview.score}/{selectedQuizReview.total_questions} ({selectedQuizReview.percentage}%)</p>
              </div>
              <button
                onClick={() => setSelectedQuizReview(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-3">
              {selectedQuizReview.details && selectedQuizReview.details.length > 0 ? (
                selectedQuizReview.details.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border text-xs ${item.is_correct ? 'bg-emerald-50/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-50/30 border-red-200 dark:border-red-800'}`}>
                    <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">#{idx+1}. {item.question}</p>
                    <p className="text-slate-600 dark:text-zinc-300">Your Answer: <span className={item.is_correct ? 'font-bold text-emerald-600' : 'font-bold text-red-500 line-through'}>{item.user_answer}</span></p>
                    {!item.is_correct && <p className="text-emerald-700 dark:text-emerald-400 font-bold mt-1">Correct Answer: {item.correct_answer}</p>}
                    {item.explanation && <p className="text-slate-500 mt-2 italic bg-white/50 dark:bg-zinc-800/50 p-2 rounded-lg">{item.explanation}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No detailed question breakdown recorded for this legacy attempt.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Edit Folder Modal ── */}
      <CreateFolderModal
        isOpen={isEditFolderModalOpen}
        onClose={() => setIsEditFolderModalOpen(false)}
        onFolderCreated={() => {
          fetchSpaceDetails();
          onSpaceUpdated?.();
        }}
        editingFolder={space}
      />
    </div>
  );
};

export default SpaceWorkspaceHub;
