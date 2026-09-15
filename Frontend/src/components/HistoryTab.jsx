import React, { useState, useEffect, useContext } from 'react';
import { Star, Upload, Book, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { PreferencesContext } from '../context/PreferencesContext';

const HistoryTab = ({ onBack }) => {
  const { prefs } = useContext(PreferencesContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchHistory = async (filterVal) => {
    setLoading(true);
    try {
      const pruneDays = prefs.logRetention && prefs.logRetention !== 'never' ? parseInt(prefs.logRetention) : '';
      let url = `/history?prune_days=${pruneDays}`;
      if (filterVal && filterVal !== 'all') {
        url += `&days=${filterVal}`;
      }
      const res = await api.get(url);
      setHistory(res.data);
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(activeFilter);
  }, [activeFilter, prefs.logRetention]); // eslint-disable-line

  const getIcon = (action) => {
    if (action.includes("Quiz")) return { icon: Star, color: "orange" };
    if (action.includes("Upload")) return { icon: Upload, color: "blue" };
    if (action.includes("Flashcards")) return { icon: FileText, color: "green" };
    return { icon: Book, color: "purple" };
  };

  const colorClassMap = {
    orange: { bg: 'bg-orange-500', text: 'text-orange-500' },
    blue:   { bg: 'bg-blue-500',   text: 'text-blue-500'   },
    green:  { bg: 'bg-emerald-500',text: 'text-emerald-500'},
    purple: { bg: 'bg-purple-500', text: 'text-purple-500'  },
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-2xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Activity History</h2>
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-indigo-600 font-medium transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back
        </button>
      </div>

      {/* Time Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar shrink-0 no-scrollbar">
        {[
          { key: 'all', label: 'All' },
          { key: '7',   label: '7 Days' },
          { key: '15',  label: '15 Days' },
          { key: '30',  label: '30 Days' },
          { key: '60',  label: '2 Months' },
          { key: '90',  label: '3 Months' },
          { key: '180', label: '6 Months' },
        ].map((f) => (
          <motion.button
            key={f.key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border shrink-0 whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            {f.label}
          </motion.button>
        ))}
      </div>
      
      {loading ? (
        <div className="space-y-8 ml-3 border-l-2 border-slate-100 dark:border-zinc-800">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="pl-8 relative animate-pulse">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-black bg-slate-200 dark:bg-zinc-800"></div>
              <div className="h-20 bg-slate-100 dark:bg-zinc-900 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <motion.p variants={itemVariants} className="text-slate-500">No recent activity.</motion.p>
      ) : (
        <div className="relative border-l-2 border-slate-100 dark:border-zinc-800 ml-3 space-y-8">
          {history.map((item, i) => {
            const { icon: Icon, color } = getIcon(item.action);
            const cc = colorClassMap[color] || colorClassMap.purple;
            return (
              <motion.div variants={itemVariants} key={i} className="relative pl-8">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-black ${cc.bg}`}></div>
                
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 mb-1">
                    <Icon size={16} className={cc.text} />
                    <span className="font-bold text-slate-700 dark:text-zinc-300">{item.action}</span>
                  </div>
                  <span className="text-xs text-slate-400">{item.timestamp} - {item.details}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};


export default HistoryTab;