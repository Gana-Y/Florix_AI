import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, Bug, Sparkles, CreditCard, MessageSquare, Send, Mail } from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const FEEDBACK_TYPES = [
  {
    id: 'Bug Report',
    label: 'Bug Report',
    icon: Bug,
    color: 'text-rose-500',
    placeholder: 'Describe the bug you encountered...',
    guidance: [
      'Steps to reproduce the issue',
      'Expected behavior',
      'Actual behavior',
      'Any error messages',
      'Any relevant information',
    ],
  },
  {
    id: 'Feature Request',
    label: 'Feature Request',
    icon: Sparkles,
    color: 'text-purple-500',
    placeholder: 'Describe the feature you would love to have in Florix AI...',
    guidance: [
      'What problem does this feature solve for you?',
      'How would you expect it to work in your workflow?',
      'Why is this important for your study or revision?',
    ],
  },
  {
    id: 'Auth and Billing',
    label: 'Auth and Billing',
    icon: CreditCard,
    color: 'text-amber-500',
    placeholder: 'Describe your account, subscription, or payment inquiry...',
    guidance: [
      'Account email or plan tier (Free / Pro / Premium)',
      'Transaction ID or payment reference if applicable',
      'Expected outcome and details of the issue',
    ],
  },
  {
    id: 'General Feedback',
    label: 'General Feedback',
    icon: MessageSquare,
    color: 'text-indigo-500',
    placeholder: 'Share your thoughts, impressions, or suggestions for Florix AI...',
    guidance: [
      'What do you like best about Florix AI?',
      'What areas feel slow, confusing, or could be improved?',
      'Any other thoughts you want the team to know',
    ],
  },
];

const ProvideFeedbackModal = ({ isOpen, onClose }) => {
  const { user } = useContext(AuthContext);
  const { addToast } = useToast();

  const [selectedType, setSelectedType] = useState('Bug Report');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const currentConfig = FEEDBACK_TYPES.find((t) => t.id === selectedType) || FEEDBACK_TYPES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      addToast('Please write a short description before submitting.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api.post('/feedback', {
        feedback_type: selectedType,
        description: description.trim(),
      });
      setSubmitted(true);
      addToast('Thank you! Your feedback has been sent directly to the team.', 'success');
      setTimeout(() => {
        setSubmitted(false);
        setDescription('');
        onClose();
      }, 1600);
    } catch (err) {
      console.error('Feedback submit error:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to submit feedback. Please try again.';
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="mb-5 pr-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Provide Feedback
            </h2>
            {user?.email && (
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 flex items-center gap-1.5">
                <Mail size={13} className="text-indigo-500" />
                Submitting as <span className="font-semibold text-slate-600 dark:text-zinc-300">{user.email}</span>
              </p>
            )}
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-16 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Feedback Received!
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">
                Thank you for helping us improve Florix AI. Our team will review your submission and may reach out via Gmail if we have any follow-ups!
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar space-y-5 pr-1">
              {/* Feedback Type Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-2.5">
                  Feedback Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((type) => {
                    const isSelected = selectedType === type.id;
                    const Icon = type.icon;
                    return (
                      <button
                        type="button"
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm'
                            : 'border-slate-200 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-900/40 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {/* Radio indicator */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 dark:border-zinc-600'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <Icon size={16} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : type.color} />
                        <span className="text-sm font-semibold truncate">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Guidance */}
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800 rounded-2xl p-4 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-zinc-300">
                  Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-500 dark:text-zinc-400">
                  {currentConfig.guidance.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Description Input */}
              <div className="flex-1 flex flex-col min-h-[120px]">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-2">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={currentConfig.placeholder}
                  className="w-full flex-1 p-3.5 bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none custom-scrollbar"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80 shrink-0">
                <span className="text-xs text-slate-400 dark:text-zinc-500">
                  {description.length} characters
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || !description.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProvideFeedbackModal;
