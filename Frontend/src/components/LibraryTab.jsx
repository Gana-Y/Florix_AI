import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, ExternalLink, Loader2, Search, ArrowUpDown, Clock, HardDrive, Type, ArrowDownAZ, AlertTriangle, CheckCircle2, ArrowLeft, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

const DeleteConfirmationModal = ({ onConfirm, onCancel, filename }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }}
      className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative text-center"
    >
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={32} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete File?</h3>
      <p className="text-slate-500 dark:text-zinc-400 text-sm mb-8">
        Are you sure you want to permanently delete <strong>{filename}</strong>? This action cannot be undone.
      </p>
      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold rounded-2xl transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-500/30">
          Delete
        </button>
      </div>
    </motion.div>
  </div>
);

const BookmarkNoteModal = ({ onConfirm, onCancel, filename }) => {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
      >
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
          <Bookmark size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Save Bookmark</h3>
        <p className="text-slate-500 dark:text-zinc-400 text-xs mb-4">
          Add an optional study note for <strong>{filename}</strong>.
        </p>
        <input 
          type="text" 
          placeholder="e.g. Focus on Chapter 3 formulas" 
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-3.5 mb-6 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-zinc-200"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 font-bold rounded-xl transition-colors text-sm">
            Cancel
          </button>
          <button onClick={() => onConfirm(note)} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 text-sm">
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 ${
        type === 'success' 
        ? 'bg-green-500 text-white shadow-green-500/20' 
        : 'bg-red-500 text-white shadow-red-500/20'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      {message}
    </motion.div>
  );
};

const LibraryTab = ({ onBack, onUploadNew, onStudyTopic }) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Sorting states
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortMethod, setSortMethod] = useState("Date (Newest)"); 

  // Modal and Toast States
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [bookmarkCandidate, setBookmarkCandidate] = useState(null); // { id: number, filename: string }
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' }

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const res = await api.get('/library');
      setFiles(res.data);
    } catch (error) {
      console.error("Failed to load library", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Client-side validation
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setToast({ message: 'Only PDF files are supported. Please select a .pdf file.', type: 'error' });
      event.target.value = '';
      return;
    }
    const maxMB = 50;
    if (file.size > maxMB * 1024 * 1024) {
      setToast({ message: `File too large. Maximum size is ${maxMB}MB. Your file is ${(file.size / (1024*1024)).toFixed(1)}MB.`, type: 'error' });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data?.summary) {
        setToast({ message: `"${response.data.filename}" processed successfully!`, type: 'success' });
        fetchLibrary();
      }
    } catch (error) {
      const status  = error.response?.status;
      const detail  = error.response?.data?.detail || '';
      let msg = 'Upload failed. Please try again.';
      if (status === 413) msg = 'File too large. Maximum allowed size is 50MB.';
      else if (status === 422) msg = detail || 'PDF appears to be empty or scanned. Please use a text-based PDF.';
      else if (status === 400) msg = detail || 'Invalid file type. Only PDF files are supported.';
      else if (status === 401 || status === 403) msg = 'Session expired. Please log in again.';
      else if (status === 429) msg = 'Upload limit reached. Please upgrade your plan.';
      else if (detail) msg = detail;
      setToast({ message: msg, type: 'error' });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await api.delete(`/library/${deleteCandidate.id}`);
      setFiles(files.filter(f => f.id !== deleteCandidate.id));
      setToast({ message: "File deleted successfully", type: 'success' });
    } catch (error) {
      setToast({ message: "Failed to delete file", type: 'error' });
    } finally {
      setDeleteCandidate(null);
    }
  };

  const handleToggleBookmark = async (file) => {
    if (file.is_bookmarked) {
      try {
        await api.delete(`/bookmarks/${file.id}`);
        setToast({ message: `Removed bookmark for "${file.filename}"`, type: 'success' });
        fetchLibrary();
      } catch (error) {
        setToast({ message: "Failed to remove bookmark", type: 'error' });
      }
    } else {
      setBookmarkCandidate({ id: file.id, filename: file.filename });
    }
  };

  const confirmBookmark = async (noteText) => {
    if (!bookmarkCandidate) return;
    try {
      await api.post('/bookmarks', {
        session_id: bookmarkCandidate.id,
        note: noteText.trim() || null
      });
      setToast({ message: `"${bookmarkCandidate.filename}" added to Bookmarks!`, type: 'success' });
      fetchLibrary();
    } catch (error) {
      setToast({ message: error.response?.data?.detail || "Failed to add bookmark", type: 'error' });
    } finally {
      setBookmarkCandidate(null);
    }
  };

  // Helper to determine type
  const getFileType = (filename) => {
    if (filename.toLowerCase().includes('.pdf')) return 'PDF';
    if (filename.toLowerCase().includes('youtube')) return 'Video';
    if (filename.toLowerCase().includes('http')) return 'Web';
    return 'Text';
  };

  // Sorting Logic
  const getSortedFiles = (filesToSort) => {
    return [...filesToSort].sort((a, b) => {
      switch (sortMethod) {
        case 'Date (Newest)':
          return new Date(b.raw_date || b.added) - new Date(a.raw_date || a.added);
        case 'Date (Oldest)':
          return new Date(a.raw_date || a.added) - new Date(b.raw_date || b.added);
        case 'Size (Largest)':
          return (b.size || 0) - (a.size || 0);
        case 'Size (Smallest)':
          return (a.size || 0) - (b.size || 0);
        case 'Name (A-Z)':
          return a.filename.localeCompare(b.filename);
        case 'Name (Z-A)':
          return b.filename.localeCompare(a.filename);
        case 'Type':
          return getFileType(a.filename).localeCompare(getFileType(b.filename));
        default:
          return 0;
      }
    });
  };

  const filteredFiles = files.filter(f => 
    f.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const sortedAndFilteredFiles = getSortedFiles(filteredFiles);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Animation variants
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } } };
  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.1 } },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-8 pb-20 relative z-0">
      
       {/* Header Area */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div className="flex flex-col items-start md:items-center">
           <h2 className="text-3xl font-bold text-slate-800 dark:text-white">My Library</h2>
           <p className="text-slate-500 dark:text-zinc-400 mt-1">Your uploaded study materials.</p>
         </div>
         <div className="flex flex-row items-center gap-3">
            <button
              onClick={onBack}
             className="flex items-center text-slate-500 hover:text-indigo-600 font-medium transition-colors"
           >
             <ArrowLeft size={20} className="mr-2" /> Back
           </button>
           <motion.label 
             whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
             className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30"
           >
             {isUploading ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20} />}
             {isUploading ? "Processing AI..." : "Upload PDF / Image"}
             <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" disabled={isUploading}/>
           </motion.label>
         </div>
       </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-zinc-200"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative w-full md:w-auto z-50">
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="w-full md:w-auto px-6 py-4 flex items-center justify-between gap-3 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-500 transition-colors text-slate-700 dark:text-zinc-200 font-semibold"
          >
            <span className="flex items-center gap-2"><ArrowUpDown size={18} className="text-indigo-500" /> Sort: {sortMethod.split(' ')[0]}</span>
          </motion.button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div 
                variants={dropdownVariants} initial="hidden" animate="show" exit="hidden"
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden py-2"
              >
                {[
                  { label: 'Date (Newest)', icon: Clock },
                  { label: 'Date (Oldest)', icon: Clock },
                  { label: 'Size (Largest)', icon: HardDrive },
                  { label: 'Size (Smallest)', icon: HardDrive },
                  { label: 'Name (A-Z)', icon: ArrowDownAZ },
                  { label: 'Name (Z-A)', icon: ArrowDownAZ },
                  { label: 'Type', icon: Type }
                ].map((option, i) => (
                  <button 
                    key={i}
                    onClick={() => { setSortMethod(option.label); setIsSortOpen(false); }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${sortMethod === option.label ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-zinc-300 font-medium'}`}
                  >
                    <option.icon size={16} /> {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white/60 dark:bg-zinc-900/60 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 h-56 animate-pulse flex flex-col justify-between">
              <div className="w-14 h-14 bg-slate-200 dark:bg-zinc-800 rounded-2xl mb-4"></div>
              <div className="space-y-3">
                <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
                <div className="h-4 bg-slate-100 dark:bg-zinc-800/50 rounded w-1/2 mb-4"></div>
                <div className="h-12 bg-slate-100 dark:bg-zinc-800 rounded-xl w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedAndFilteredFiles.length === 0 ? (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-white/30 dark:bg-zinc-900/30 backdrop-blur-sm">
          <FileText size={64} className="text-slate-200 dark:text-zinc-800 mb-4" />
          <p className="text-slate-500 dark:text-zinc-400 font-medium text-lg">
            {searchTerm ? "No match found." : "Library is empty."}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {sortedAndFilteredFiles.map((file) => (
              <motion.div 
                layout
                variants={itemVariants} 
                initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                whileHover={{ y: -5 }}
                key={file.id} 
                className="bg-white/90 dark:bg-zinc-900/90 p-6 rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 hover:border-indigo-500/50 shadow-md hover:shadow-xl hover:shadow-indigo-500/10 transition-all group flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="p-3 bg-gradient-to-br from-red-400 to-rose-500 text-white rounded-2xl shadow-lg shadow-red-500/20">
                    <FileText size={24} />
                  </div>
                  <div className="flex gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggleBookmark(file)} 
                      className={`p-2 rounded-full transition-all border ${
                        file.is_bookmarked
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-200/50 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:border-amber-500/20 text-amber-500 shadow-md shadow-amber-500/5'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/50 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:border-zinc-700/50 text-slate-300 dark:text-zinc-600 hover:text-slate-400 dark:hover:text-zinc-500'
                      }`}
                      title={file.is_bookmarked ? "Remove Bookmark" : "Save Bookmark"}
                    >
                      <Bookmark size={18} fill={file.is_bookmarked ? "currentColor" : "none"} />
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 10 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteCandidate(file)} 
                      className="p-2 text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors bg-slate-50 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-900/20 rounded-full"
                      title="Delete document"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>
                
                <div className="flex-1 relative z-10">
                  <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-lg mb-1 truncate pr-2">{file.filename}</h3>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 mb-6">
                    <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{file.added}</span>
                    <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{formatSize(file.size)}</span>
                  </div>
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => onStudyTopic(file)}
                  className="w-full py-3.5 bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all relative z-10"
                >
                  Start Studying <ExternalLink size={16}/>
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals and Toasts */}
      <AnimatePresence>
        {deleteCandidate && (
          <DeleteConfirmationModal 
            filename={deleteCandidate.filename} 
            onCancel={() => setDeleteCandidate(null)} 
            onConfirm={confirmDelete} 
          />
        )}
        {bookmarkCandidate && (
          <BookmarkNoteModal 
            filename={bookmarkCandidate.filename} 
            onCancel={() => setBookmarkCandidate(null)} 
            onConfirm={confirmBookmark} 
          />
        )}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LibraryTab;