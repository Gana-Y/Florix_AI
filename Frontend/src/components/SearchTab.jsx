import React, { useState, useEffect } from 'react';
import { Search, FileText, Hash, Clock, Loader2, Sparkles, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

const CATEGORY_COLORS = {
  Study: "bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Coding: "bg-purple-100/70 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Research: "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Business: "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Personal: "bg-pink-100/70 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Career: "bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Interview: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const SearchTab = ({ onOpenSession }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim() !== '') {
        performSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/knowledge-vault/search?q=${encodeURIComponent(query)}`);
      setResults(res.data);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 24 } } };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
          <Sparkles size={22} className="animate-pulse" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white leading-tight">AI Knowledge Vault</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-0.5">Semantic search across all study sessions</p>
        </div>
      </div>
      
      {/* Information Helper Badge */}
      <div className="bg-slate-100/50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-medium mb-6">
        💡 <strong className="text-indigo-600 dark:text-indigo-400">Semantic AI Search:</strong> Searches concepts and ideas across all your uploaded PDFs, website links, YouTube videos, and audio notes, rather than just matching keywords.
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question or search concepts, e.g. 'explain neural network layers'..." 
          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl pl-12 pr-12 py-4 text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
        />
        {loading && (
           <div className="absolute right-4 top-4">
               <Loader2 className="animate-spin text-indigo-500" size={20} />
           </div>
        )}
      </div>

      <div className="space-y-4">
        {query.length > 0 && (
          <h3 className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">
            Top Relevant Insights
          </h3>
        )}
        
        {loading && query.length > 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col p-5 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl animate-pulse">
                <div className="flex justify-between items-center mb-3">
                   <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
                   <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-12"></div>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-zinc-800/50 rounded w-full mb-2"></div>
                <div className="h-3 bg-slate-100 dark:bg-zinc-800/50 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : query.length > 0 && results.length === 0 ? (
          <motion.div variants={itemVariants} className="text-center py-16 text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl shadow-sm">
            <p className="text-sm font-medium">No semantic matches found for "{query}"</p>
            <p className="text-xs text-slate-400 mt-1">Try rephrasing or search for a broader topic.</p>
          </motion.div>
        ) : (
          results.map((item) => (
            <motion.div 
              variants={itemVariants} 
              key={item.session_id} 
              onClick={() => onOpenSession?.(item.session_id)}
              className="flex flex-col p-5 bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl hover:border-indigo-500/50 dark:hover:border-indigo-500/40 cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
            >
               <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                     <div className="p-2 bg-slate-50 dark:bg-zinc-950 rounded-xl text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20 transition-all shrink-0">
                       <FileText size={16} />
                     </div>
                     <span className="text-slate-800 dark:text-zinc-200 font-extrabold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                       {item.session_title}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.category && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Study}`}>
                        {item.category}
                      </span>
                    )}
                    
                    {/* Relevance Match Badge */}
                    {item.score > 0 && (
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Award size={10} />
                        {Math.round(item.score * 100)}% Match
                      </span>
                    )}
                  </div>
               </div>
               
               {/* Excpet text snippet */}
               <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed pl-1">
                 {item.excerpt}
               </p>
               
               {/* Hover interactive glow path */}
               <div className="absolute right-0 bottom-0 top-0 w-1 bg-transparent group-hover:bg-indigo-500 transition-all duration-300" />
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default SearchTab;