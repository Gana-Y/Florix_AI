import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, BookmarkX, Loader2, FileText, Youtube, Link2, AlignLeft, Trash2, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

const SOURCE_ICONS = {
  youtube: { icon: Youtube, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  url:     { icon: Link2,   color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  audio:   { icon: AlignLeft, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  text:    { icon: AlignLeft, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
  pdf:     { icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const BookmarksTab = ({ onOpenSession }) => {
  const { addToast } = useToast();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const openSession = async (id) => {
    setOpeningId(id);
    try {
      const res = await api.get(`/library/${id}`);
      if (onOpenSession) {
        onOpenSession(res.data);
      }
    } catch {
      addToast('Failed to open document', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookmarks');
      setBookmarks(res.data);
    } catch {
      addToast('Failed to load bookmarks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeBookmark = async (sessionId) => {
    setRemoving(sessionId);
    try {
      await api.delete(`/bookmarks/${sessionId}`);
      setBookmarks(prev => prev.filter(b => b.session_id !== sessionId));
      addToast('Bookmark removed', 'info');
    } catch {
      addToast('Failed to remove bookmark', 'error');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <p className="text-slate-400 dark:text-zinc-500 text-sm">Loading bookmarks…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center">
            <Bookmark size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">Bookmarks</h2>
            <p className="text-slate-500 dark:text-zinc-400 text-sm">
              {bookmarks.length} saved {bookmarks.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 rounded-3xl flex items-center justify-center mb-4">
            <BookmarkX size={36} className="text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-zinc-200 mb-2">No bookmarks yet</h3>
          <p className="text-slate-500 dark:text-zinc-400 max-w-sm text-sm">
            Save documents to your bookmarks for quick access. Open any document from your library and click the bookmark icon.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          <AnimatePresence>
            {bookmarks.map((bookmark) => {
              const sourceType = bookmark.source_type || 'pdf';
              const iconConfig = SOURCE_ICONS[sourceType] || SOURCE_ICONS.pdf;
              const Icon = iconConfig.icon;

              return (
                <motion.div
                  key={bookmark.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                  className="group bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-5 flex items-start gap-4 hover:border-indigo-400/40 hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                >
                  {/* Icon */}
                  <div className={`${iconConfig.bg} p-3 rounded-2xl shrink-0`}>
                    <Icon size={20} className={iconConfig.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-zinc-100 truncate mb-1">
                      {bookmark.session_filename}
                    </h3>
                    {bookmark.session_summary && (
                      <p className="text-sm text-slate-500 dark:text-zinc-400 line-clamp-2 mb-2">
                        {bookmark.session_summary}
                      </p>
                    )}
                    {bookmark.note && (
                      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mb-2">
                        📝 {bookmark.note}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      Saved {new Date(bookmark.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenSession && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openSession(bookmark.session_id)}
                        disabled={openingId === bookmark.session_id || removing === bookmark.session_id}
                        className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                        title="Open document"
                      >
                        {openingId === bookmark.session_id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ExternalLink size={16} />
                        )}
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeBookmark(bookmark.session_id)}
                      disabled={removing === bookmark.session_id}
                      className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      title="Remove bookmark"
                    >
                      {removing === bookmark.session_id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default BookmarksTab;
