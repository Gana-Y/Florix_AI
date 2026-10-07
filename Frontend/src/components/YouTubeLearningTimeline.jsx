import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play, Sparkles, BookOpen, Target, FileText, CheckCircle2,
  Clock, ExternalLink, Search, Tag, ChevronDown, ChevronUp,
  Loader2, AlertCircle, RefreshCw, X, HelpCircle, Layers, Check
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

/**
 * YouTubeLearningTimeline
 * 
 * Florix-Native Interactive YouTube Video Knowledge Experience:
 * Video Header & Thumbnail -> Interactive Timeline River -> What Video Says + Florix Explains
 * -> Actions ([▶ Watch], [Explain], [Quiz Me], [Ask this moment], [Notes])
 * -> Progress tracking, Concept filtering, and Collapsible Transcript Drawer.
 */
const YouTubeLearningTimeline = ({
  sessionId,
  sessionDetail,
  onAskThisMoment,
  onAddNote,
  onOpenChat,
}) => {
  const { addToast } = useToast();
  // 1. Instant hydration if timeline is already present in sessionDetail
  const initialTimeline = sessionDetail?.doc_metadata?.learning_timeline || null;
  const [timeline, setTimeline] = useState(initialTimeline);
  const [loading, setLoading] = useState(!initialTimeline);
  const [error, setError] = useState(null);

  // Sync if sessionDetail loads/updates after mount
  useEffect(() => {
    if (sessionDetail?.doc_metadata?.learning_timeline && !timeline) {
      setTimeline(sessionDetail.doc_metadata.learning_timeline);
      setLoading(false);
    }
  }, [sessionDetail, timeline]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);

  // Panels
  const [showTranscript, setShowTranscript] = useState(false);
  const [showConceptMap, setShowConceptMap] = useState(false);

  // Interactive Section Actions State
  const [sectionExplains, setSectionExplains] = useState({});
  const [loadingExplains, setLoadingExplains] = useState({});

  const [sectionQuizzes, setSectionQuizzes] = useState({});
  const [loadingQuizzes, setLoadingQuizzes] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});

  const [progress, setProgress] = useState({});

  // ── 1. Fetch Timeline Data ──
  const fetchTimeline = useCallback(async (isManualRefresh = false) => {
    if (!sessionId) return;
    // Only show full loading spinner if we don't already have timeline data
    if (!timeline && !sessionDetail?.doc_metadata?.learning_timeline) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await api.get(`/sessions/${sessionId}/learning-timeline`);
      setTimeline(res.data);
      if (res.data?.progress) {
        setProgress(res.data.progress);
      }
    } catch (err) {
      console.error('Failed to load learning timeline:', err);
      if (!timeline && !sessionDetail?.doc_metadata?.learning_timeline) {
        setError(err.response?.data?.detail || 'Could not generate learning timeline. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, timeline, sessionDetail]);

  useEffect(() => {
    fetchTimeline();
  }, [sessionId]);

  // Derive Video ID with multi-level resilience
  const videoId = useMemo(() => {
    if (timeline?.video_id && timeline.video_id.trim()) return timeline.video_id.trim();
    if (sessionDetail?.doc_metadata?.video_id && sessionDetail.doc_metadata.video_id.trim()) {
      return sessionDetail.doc_metadata.video_id.trim();
    }
    if (sessionDetail?.doc_metadata?.learning_timeline?.video_id) {
      return sessionDetail.doc_metadata.learning_timeline.video_id.trim();
    }

    // Check thumbnail URL
    const thumbUrl = timeline?.thumbnail_url || sessionDetail?.doc_metadata?.thumbnail_url || sessionDetail?.doc_metadata?.learning_timeline?.thumbnail_url || '';
    const thumbMatch = thumbUrl.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
    if (thumbMatch) return thumbMatch[1];

    // Check source URL in doc_metadata
    const sourceUrl = sessionDetail?.doc_metadata?.source_url || '';
    const sourceMatch = sourceUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|vi\/)([a-zA-Z0-9_-]{11})/);
    if (sourceMatch) return sourceMatch[1];

    // Scan session timeline events
    if (Array.isArray(sessionDetail?.timeline)) {
      for (const item of sessionDetail.timeline) {
        const text = typeof item === 'string' ? item : (item?.detail || item?.event || '');
        const m = text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|vi\/)([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
      }
    }

    // Fallback extraction from content and filename
    const raw = `${sessionDetail?.filename || ''} ${sessionDetail?.content || ''}`;
    const m = raw.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/|vi\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }, [timeline, sessionDetail]);

  // Derived sections & concept map
  const sections = useMemo(() => timeline?.sections || [], [timeline]);

  // Filtered sections based on search query & selected concept
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        sec.title.toLowerCase().includes(q) ||
        sec.what_video_says.toLowerCase().includes(q) ||
        sec.florix_explanation.toLowerCase().includes(q) ||
        (sec.concept_tags && sec.concept_tags.some(c => c.toLowerCase().includes(q)))
      );

      const matchesConcept = !selectedConcept || (
        sec.concept_tags && sec.concept_tags.map(c => c.toLowerCase()).includes(selectedConcept.toLowerCase())
      );

      return matchesQuery && matchesConcept;
    });
  }, [sections, searchQuery, selectedConcept]);

  // Distinct concepts
  const allConcepts = useMemo(() => {
    if (timeline?.concepts_map) {
      return Object.keys(timeline.concepts_map);
    }
    const tags = new Set();
    sections.forEach(s => s.concept_tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [timeline, sections]);

  // Progress Calculation
  const progressStats = useMemo(() => {
    const total = sections.length;
    if (total === 0) return { explored: 0, total: 0, percent: 0 };
    const explored = sections.filter(s => progress[s.section_id]?.viewed || progress[s.section_id]?.explained || progress[s.section_id]?.quizzed).length;
    const percent = Math.round((explored / total) * 100);
    return { explored, total, percent };
  }, [sections, progress]);

  // Record section action progress
  const markProgress = useCallback(async (sectionId, status, score = null) => {
    setProgress(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [status]: true, ...(score !== null ? { score } : {}) }
    }));
    try {
      await api.post(`/sessions/${sessionId}/learning-timeline/progress`, {
        section_id: sectionId,
        status,
        score
      });
    } catch (e) {
      console.warn('Could not save section progress:', e);
    }
  }, [sessionId]);

  // ── Action Handlers ──
  const handleSectionClick = (sec) => {
    setActiveSectionId(prev => prev === sec.section_id ? null : sec.section_id);
    if (!progress[sec.section_id]?.viewed) {
      markProgress(sec.section_id, 'viewed');
    }
  };

  const handleExplainSection = async (e, sec) => {
    e.stopPropagation();
    if (sectionExplains[sec.section_id]) {
      // Toggle visibility
      setActiveSectionId(sec.section_id);
      return;
    }
    setLoadingExplains(prev => ({ ...prev, [sec.section_id]: true }));
    setActiveSectionId(sec.section_id);
    try {
      const res = await api.post(`/sessions/${sessionId}/learning-timeline/sections/${sec.section_id}/explain`, {
        section_title: sec.title,
        timestamp_str: sec.timestamp_str,
        what_video_says: sec.what_video_says,
        concept_tags: sec.concept_tags
      });
      setSectionExplains(prev => ({ ...prev, [sec.section_id]: res.data.explanation }));
      markProgress(sec.section_id, 'explained');
      addToast('Generated focused section explanation', 'success');
    } catch (err) {
      console.error('Failed to explain section:', err);
      addToast('Failed to generate explanation. Try asking in Chat.', 'error');
    } finally {
      setLoadingExplains(prev => ({ ...prev, [sec.section_id]: false }));
    }
  };

  const handleQuizSection = async (e, sec) => {
    e.stopPropagation();
    if (sectionQuizzes[sec.section_id]) {
      setActiveSectionId(sec.section_id);
      return;
    }
    setLoadingQuizzes(prev => ({ ...prev, [sec.section_id]: true }));
    setActiveSectionId(sec.section_id);
    try {
      const res = await api.post(`/sessions/${sessionId}/learning-timeline/sections/${sec.section_id}/quiz`, {
        section_title: sec.title,
        timestamp_str: sec.timestamp_str,
        what_video_says: sec.what_video_says,
        concept_tags: sec.concept_tags
      });
      setSectionQuizzes(prev => ({ ...prev, [sec.section_id]: res.data.quiz }));
      addToast('Generated section quiz question', 'info');
    } catch (err) {
      console.error('Failed to quiz section:', err);
      addToast('Failed to create quiz question.', 'error');
    } finally {
      setLoadingQuizzes(prev => ({ ...prev, [sec.section_id]: false }));
    }
  };

  const handleSelectQuizOption = (sectionId, optIndex, correctIndex) => {
    const isCorrect = optIndex === correctIndex;
    setQuizAnswers(prev => ({
      ...prev,
      [sectionId]: { selected: optIndex, isCorrect, submitted: true }
    }));
    markProgress(sectionId, 'quizzed', isCorrect ? 100 : 0);
    if (isCorrect) {
      addToast('Correct! Great active recall.', 'success');
    } else {
      addToast('Incorrect. Check the explanation below.', 'info');
    }
  };

  const handleAskThisMoment = (e, sec) => {
    e.stopPropagation();
    if (onAskThisMoment) {
      onAskThisMoment(sec);
    } else if (onOpenChat) {
      onOpenChat(`[Regarding moment ${sec.timestamp_str} — "${sec.title}"]: `);
    }
  };

  const handleAddNoteForSection = (e, sec) => {
    e.stopPropagation();
    const noteSnippet = `\n\n📌 **[${sec.timestamp_str}] ${sec.title}**\n- ${sec.key_takeaways?.[0] || sec.what_video_says.slice(0, 120)}`;
    if (onAddNote) {
      onAddNote(noteSnippet);
      addToast(`Added section note for ${sec.timestamp_str}`, 'success');
    }
  };

  // ── Render Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-5 animate-pulse">
          <Sparkles size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-1">
          Structuring Video Knowledge...
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-6">
          Florix AI is analyzing speech timestamps, identifying semantic boundaries, and generating your interactive Learning Timeline.
        </p>
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3.5 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
          <Loader2 size={13} className="animate-spin" />
          <span>Building chronological concepts & takeaways</span>
        </div>
      </div>
    );
  }

  // ── Render Error State ──
  if (error && (!timeline || sections.length === 0)) {
    return (
      <div className="p-8 text-center bg-red-50/50 dark:bg-red-950/20 rounded-3xl border border-red-200 dark:border-red-900/50 my-6">
        <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">Could not load Learning Timeline</h4>
        <p className="text-xs text-red-600 dark:text-red-400 max-w-md mx-auto mb-4">{error}</p>
        <button
          onClick={fetchTimeline}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Retry Timeline Generation</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── 1. Video Header & Identity Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800/80 shadow-xl text-white p-5 md:p-6">
        {/* Background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row gap-5 items-start md:items-center">
          {/* Video Thumbnail Preview */}
          {videoId ? (
            <div className="relative w-full md:w-56 aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/10 shrink-0 bg-zinc-950 group">
              <img
                src={timeline?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt={timeline?.video_title || "Video Thumbnail"}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallbackStep) {
                    target.dataset.fallbackStep = 'mq';
                    target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                  } else if (target.dataset.fallbackStep === 'mq') {
                    target.dataset.fallbackStep = 'zero';
                    target.src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                  } else if (target.dataset.fallbackStep === 'zero') {
                    target.dataset.fallbackStep = 'default';
                    target.src = `https://img.youtube.com/vi/${videoId}/default.jpg`;
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
              <a
                href={timeline?.sections?.[0]?.watch_url || `https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity"
                title="Watch on YouTube"
              >
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50 group-hover:scale-110 transition-transform">
                  <Play size={16} className="ml-0.5 fill-white" />
                </div>
              </a>
              {timeline?.duration_str && (
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white/90">
                  {timeline.duration_str}
                </span>
              )}
            </div>
          ) : (
            <div className="w-full md:w-56 aspect-video rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Play size={28} />
            </div>
          )}

          {/* Video Details */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                <Play size={9} className="fill-red-400" /> YouTube
              </span>
              {timeline?.duration_str && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  <Clock size={9} /> {timeline.duration_str}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Layers size={9} /> {sections.length} Learning Sections
              </span>
            </div>

            <h2 className="text-base md:text-lg font-bold text-white tracking-tight leading-snug line-clamp-2">
              {timeline?.video_title || sessionDetail?.ai_title || sessionDetail?.filename || 'YouTube Lecture'}
            </h2>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
                >
                  <ExternalLink size={12} />
                  <span>Open Video</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowTranscript(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  showTranscript
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white/10 hover:bg-white/20 text-white/90'
                }`}
              >
                <BookOpen size={12} />
                <span>{showTranscript ? 'Hide Transcript' : 'View Transcript'}</span>
              </button>
              {allConcepts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConceptMap(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    showConceptMap
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-white/10 hover:bg-white/20 text-white/90'
                  }`}
                >
                  <Tag size={12} />
                  <span>Concepts ({allConcepts.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Learning Progress Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-white/80">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Learning Progress</span>
            </span>
            <span className="font-mono text-[11px] text-indigo-300">
              {progressStats.explored} / {progressStats.total} Sections Explored ({progressStats.percent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${progressStats.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Collapsible Full Transcript Drawer ── */}
      {showTranscript && (
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider">
                Full Video Transcript (Timestamp Grounded)
              </h3>
            </div>
            <button
              onClick={() => setShowTranscript(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar text-xs leading-relaxed space-y-2 pr-2 select-text font-sans">
            {sessionDetail?.content ? (
              sessionDetail.content.split('\n').filter(l => l.trim()).map((line, idx) => (
                <div key={idx} className="flex items-start gap-2 py-1 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 rounded px-2 transition-colors">
                  <span className="text-slate-600 dark:text-zinc-300">{line}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No raw transcript text available.</p>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Concept Map Filter Drawer ── */}
      {showConceptMap && (
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Tag size={15} className="text-purple-600 dark:text-purple-400" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider">
                Key Concepts Covered in Video
              </h3>
            </div>
            <button
              onClick={() => setShowConceptMap(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedConcept(null)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                !selectedConcept
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
              }`}
            >
              All Concepts ({sections.length})
            </button>
            {allConcepts.map((concept) => (
              <button
                key={concept}
                onClick={() => setSelectedConcept(prev => prev === concept ? null : concept)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedConcept === concept
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                <span>#{concept}</span>
                {timeline?.concepts_map?.[concept] && (
                  <span className="text-[10px] opacity-70 bg-black/20 px-1.5 rounded-full">
                    {timeline.concepts_map[concept].length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search this video for topics, spoken words, or concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {selectedConcept && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs shrink-0">
            <span>Filtered: <strong>#{selectedConcept}</strong></span>
            <button onClick={() => setSelectedConcept(null)} className="hover:text-purple-900 dark:hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── 5. Interactive Learning Timeline River ── */}
      <div className="relative pl-6 md:pl-8 space-y-6">
        {/* Continuous Timeline Vertical Line */}
        <div className="absolute top-4 bottom-4 left-3 md:left-4 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-slate-200 dark:to-zinc-800" />

        {filteredSections.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-zinc-900/50 rounded-3xl border border-slate-200 dark:border-zinc-800 text-slate-500 text-xs">
            No sections match your search query. Try clearing the search filter.
          </div>
        ) : (
          filteredSections.map((sec, idx) => {
            const isExpanded = activeSectionId === sec.section_id;
            const secProg = progress[sec.section_id] || {};
            const isExplored = secProg.viewed || secProg.explained || secProg.quizzed;

            return (
              <div
                key={sec.section_id || idx}
                className="relative group transition-all"
              >
                {/* Timeline Node Icon / Dot */}
                <div
                  className={`absolute -left-6 md:-left-8 top-4 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold transition-all shadow-md z-10 ${
                    isExplored
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/50'
                      : isExpanded
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  {isExplored ? <Check size={12} className="stroke-[3]" /> : idx + 1}
                </div>

                {/* Section Knowledge Card */}
                <div
                  onClick={() => handleSectionClick(sec)}
                  className={`rounded-3xl border transition-all cursor-pointer overflow-hidden shadow-sm ${
                    isExpanded
                      ? 'bg-white dark:bg-zinc-900 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-lg'
                      : 'bg-white dark:bg-zinc-900/70 border-slate-200/80 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      {/* Timestamp Pill */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                        <Clock size={12} />
                        {sec.timestamp_str}
                      </span>
                      <h4 className="text-sm md:text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug">
                        {sec.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {secProg.explained && (
                        <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                          ✨ Explained
                        </span>
                      )}
                      {secProg.quizzed && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/60">
                          🎯 Quizzed
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 md:p-5 space-y-4">
                    {/* A. WHAT THE VIDEO SAYS */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        <BookOpen size={12} className="text-indigo-500" />
                        <span>What The Video Says</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed pl-3 border-l-2 border-indigo-500/40 select-text">
                        {sec.what_video_says}
                      </p>
                    </div>

                    {/* B. FLORIX EXPLAINS */}
                    <div className="space-y-1.5 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 p-3.5 rounded-2xl border border-purple-500/15 dark:border-purple-500/20">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        <Sparkles size={12} />
                        <span>Florix Explains</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-800 dark:text-zinc-200 leading-relaxed select-text font-medium">
                        {sec.florix_explanation}
                      </p>
                    </div>

                    {/* Concept Tags */}
                    {sec.concept_tags && sec.concept_tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {sec.concept_tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConcept(tag);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/70 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 dark:hover:text-purple-300 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Tag size={10} />
                            <span>#{tag}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── Interactive Actions Bar ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* [▶ Watch] */}
                        {(sec.watch_url || videoId) && (
                          <a
                            href={sec.watch_url || `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(sec.timestamp_start || 0)}s`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                            title={`Jump to ${sec.timestamp_str} on YouTube`}
                          >
                            <Play size={11} className="fill-white" />
                            <span>Watch {sec.timestamp_str.split(' ')[0]}</span>
                          </a>
                        )}

                        {/* [Explain] */}
                        <button
                          type="button"
                          onClick={(e) => handleExplainSection(e, sec)}
                          disabled={loadingExplains[sec.section_id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {loadingExplains[sec.section_id] ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          <span>Explain</span>
                        </button>

                        {/* [Quiz Me] */}
                        <button
                          type="button"
                          onClick={(e) => handleQuizSection(e, sec)}
                          disabled={loadingQuizzes[sec.section_id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {loadingQuizzes[sec.section_id] ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Target size={12} />
                          )}
                          <span>Quiz Me</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* [✨ Ask this moment] */}
                        <button
                          type="button"
                          onClick={(e) => handleAskThisMoment(e, sec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                          title="Ask questions about this specific moment in the chat tutor"
                        >
                          <Sparkles size={11} className="text-indigo-500" />
                          <span>Ask this moment</span>
                        </button>

                        {/* [Notes] */}
                        <button
                          type="button"
                          onClick={(e) => handleAddNoteForSection(e, sec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                          title="Add timestamped note to personal notes"
                        >
                          <FileText size={11} />
                          <span>Notes</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Section-Specific AI Explanation */}
                    {sectionExplains[sec.section_id] && (
                      <div className="mt-3 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-800 dark:text-indigo-200">
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={13} /> Detailed In-Depth Explanation
                          </span>
                          <span className="text-[10px] font-mono opacity-70">
                            ⏱ {sec.timestamp_str}
                          </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed select-text">
                          {sectionExplains[sec.section_id]}
                        </p>
                      </div>
                    )}

                    {/* Inline Section-Specific Quiz */}
                    {sectionQuizzes[sec.section_id] && (
                      <div className="mt-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                          <Target size={13} />
                          <span>Active Recall: Test Your Understanding</span>
                        </div>
                        <p className="text-xs md:text-sm font-semibold text-slate-800 dark:text-zinc-100">
                          {sectionQuizzes[sec.section_id].question}
                        </p>

                        {/* Options */}
                        <div className="space-y-1.5">
                          {sectionQuizzes[sec.section_id].options?.map((opt, optIdx) => {
                            const ansState = quizAnswers[sec.section_id];
                            const isSelected = ansState?.selected === optIdx;
                            const isCorrectOpt = sectionQuizzes[sec.section_id].correct_index === optIdx;

                            let optStyle = "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-400";
                            if (ansState?.submitted) {
                              if (isCorrectOpt) {
                                optStyle = "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-semibold";
                              } else if (isSelected) {
                                optStyle = "bg-red-50 dark:bg-red-950/50 border-red-500 text-red-800 dark:text-red-200 line-through";
                              } else {
                                optStyle = "opacity-50 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800";
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={ansState?.submitted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectQuizOption(sec.section_id, optIdx, sectionQuizzes[sec.section_id].correct_index);
                                }}
                                className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center gap-2 cursor-pointer ${optStyle}`}
                              >
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {quizAnswers[sec.section_id]?.submitted && sectionQuizzes[sec.section_id].explanation && (
                          <div className="pt-2 text-xs text-slate-600 dark:text-zinc-300 italic border-t border-amber-200/50 dark:border-amber-800/40">
                            <strong>Explanation:</strong> {sectionQuizzes[sec.section_id].explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default YouTubeLearningTimeline;
