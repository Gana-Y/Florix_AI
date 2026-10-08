import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, Sparkles, Play, Layers, HelpCircle, ArrowLeft,
  Lock, AlertCircle, Share2, Check, ExternalLink, Calendar,
  GraduationCap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import api from '../utils/api';
import { preprocessLatex } from '../utils/latexHelper';

export default function SharedStudySessionPage() {
  const { shareToken } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'flashcards' | 'quiz' | 'timeline'

  useEffect(() => {
    const fetchShared = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/shared/${shareToken}`);
        setSession(res.data);
      } catch (err) {
        console.error('Failed to load shared session:', err);
        const status = err.response?.status;
        const detail = err.response?.data?.detail;
        if (status === 401) {
          setError({
            type: 'auth_required',
            title: 'Team Access Only',
            message: detail || 'This study session is restricted to signed-in team members. Please sign in to view.'
          });
        } else if (status === 403) {
          setError({
            type: 'private',
            title: 'Private Study Session',
            message: detail || 'This study session is marked as private by its creator and cannot be viewed via public link.'
          });
        } else {
          setError({
            type: 'not_found',
            title: 'Session Not Found',
            message: detail || 'This shared study link is either invalid or has expired.'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchShared();
    }
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse mb-4">
          <GraduationCap size={24} className="text-white" />
        </div>
        <h2 className="text-base font-bold text-slate-200">Loading Shared Study Material...</h2>
        <p className="text-xs text-slate-400 mt-1">Grounded by Florix AI Academic Tutor</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 text-center text-white shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            {error.type === 'auth_required' || error.type === 'private' ? <Lock size={26} /> : <AlertCircle size={26} />}
          </div>
          <h2 className="text-lg font-black text-slate-100">{error.title}</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{error.message}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            {error.type === 'auth_required' ? (
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
              >
                Sign In to Florix AI
              </Link>
            ) : (
              <Link
                to="/"
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition-all inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} /> Go to Home
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const timeline = session?.doc_metadata?.learning_timeline;
  const hasTimeline = Boolean(timeline?.sections && timeline.sections.length > 0);
  const flashcards = session?.flashcards || [];
  const quizzes = session?.quiz_data || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Top Shared Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <GraduationCap size={16} />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                FLORIX AI
              </span>
              <span className="text-[10px] text-indigo-400 font-bold block -mt-1 uppercase tracking-wider">
                Shared Study Space
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/signup"
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            Create Free Account
          </Link>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Session Header Card */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {session?.source_type || 'Study Document'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                  <Sparkles size={10} /> Grounded Study Guide
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {session?.ai_title || session?.filename || 'Untitled Study Session'}
              </h1>
              <p className="text-xs text-slate-400">
                Shared via Florix AI Academic Intelligence Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <BookOpen size={13} /> Study Guide
            </button>

            {hasTimeline && (
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Play size={13} /> Video Timeline ({timeline.sections.length})
              </button>
            )}

            {flashcards.length > 0 && (
              <button
                onClick={() => setActiveTab('flashcards')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'flashcards'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Layers size={13} /> Flashcards ({flashcards.length})
              </button>
            )}

            {quizzes.length > 0 && (
              <button
                onClick={() => setActiveTab('quiz')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'quiz'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <HelpCircle size={13} /> Practice Quiz ({quizzes.length})
              </button>
            )}
          </div>
        </div>

        {/* ── Tab Views ── */}
        {activeTab === 'summary' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl leading-relaxed">
            {session?.summary && session.summary !== 'Processing...' ? (
              <div className="prose prose-invert prose-indigo max-w-none text-slate-300 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {preprocessLatex(session.summary)}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <p className="text-slate-400 text-xs">Summary is being structured or transcript available.</p>
                {session?.content && (
                  <div className="text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {session.content.slice(0, 3000)}...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && hasTimeline && (
          <div className="space-y-4">
            {timeline.sections.map((sec, idx) => (
              <div
                key={sec.section_id || idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-400 font-mono">
                    {sec.timestamp_str || `Section ${idx + 1}`}
                  </span>
                  {sec.watch_url && (
                    <a
                      href={sec.watch_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300"
                    >
                      <Play size={10} className="fill-red-400" /> Watch
                    </a>
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{sec.what_video_says}</p>
                {sec.florix_explanation && (
                  <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-xs text-indigo-200">
                    <span className="font-bold">Florix AI Explanation: </span>
                    {sec.florix_explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'flashcards' && flashcards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {flashcards.map((card, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Card {idx + 1}
                </div>
                <div className="text-sm font-bold text-white">{card.question || card.front}</div>
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {card.answer || card.back}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'quiz' && quizzes.length > 0 && (
          <div className="space-y-4">
            {quizzes.map((q, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="text-xs font-bold text-indigo-400">
                  Question {idx + 1}:
                </div>
                <div className="text-sm font-bold text-white">{q.question}</div>
                {q.options && (
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className="px-3 py-2 rounded-xl bg-slate-800/60 text-xs text-slate-300 border border-slate-700/60"
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.explanation && (
                  <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-800">
                    Explanation: {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer Callout ── */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-900/60 py-6 px-4 text-center">
        <p className="text-xs text-slate-400">
          Powered by <span className="font-bold text-white">Florix AI</span> · Academic Tutor & Active Recall Intelligence
        </p>
      </footer>
    </div>
  );
}
