import React, { useState, useContext, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import rehypeSanitize from 'rehype-sanitize';
import { 
  ArrowLeft, CheckCircle, Loader2, RefreshCw, Share2, Copy, Check,
  Save, Sparkles, Clock, FileText, Award, Calendar, Lightbulb, BookOpen,
  Clipboard, HelpCircle, Maximize2, Minimize2, PanelLeftClose, GripVertical,
  AlertCircle, ChevronDown, ChevronUp, Globe, Lock, Users, X, Search, Sun, Moon, Download, History, CheckCircle2, XCircle
} from 'lucide-react';
const PDFExport = lazy(() => import('./PDFExport'));
import api from '../utils/api';
import GlobalChatTab from './GlobalChatTab';
import FloatingSelectionToolbar from './FloatingSelectionToolbar';
import YouTubeLearningTimeline from './YouTubeLearningTimeline';
import { PreferencesContext } from '../context/PreferencesContext';
import { useToast } from '../context/ToastContext';

const StudySession = ({ data, onBack, isDarkMode, toggleTheme }) => {
  const { prefs } = useContext(PreferencesContext);
  const { addToast } = useToast();
  const [activeView, setActiveView] = useState('summary'); 
  const [youtubeView, setYoutubeView] = useState('timeline'); // 'timeline' | 'guide'
  const [regenerating, setRegenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [currentSummary, setCurrentSummary] = useState(data?.summary || null);

  useEffect(() => {
    if (data?.summary) {
      setCurrentSummary(data.summary);
    }
  }, [data?.summary]);
  
  const [numQuestions, setNumQuestions] = useState(5);
  const [numFlashcards, setNumFlashcards] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizData, setQuizData] = useState([]);
  const [flashcards, setFlashcards] = useState(data?.flashcards || []);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [flashcardsFinished, setFlashcardsFinished] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [pastQuizzes, setPastQuizzes] = useState([]);
  const [showPastQuizzesModal, setShowPastQuizzesModal] = useState(false);
  const [selectedPastQuiz, setSelectedPastQuiz] = useState(null);
  const [isExportingQuiz, setIsExportingQuiz] = useState(false);

  // 📝 Personal Notes States
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const lastSavedNotesRef = useRef('');

  // 🧠 Session Intelligence & Timeline States
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);

  // 📋 One-Click AI Outputs States
  const [aiOutput, setAiOutput] = useState(null);
  const [aiOutputContent, setAiOutputContent] = useState('');
  const [loadingOutput, setLoadingOutput] = useState(false);

  // 🔗 Share System States
  const [shareType, setShareType] = useState('public');
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);

  // 🖥️ Layout States — Split Screen, Focus, Fullscreen
  const [splitRatio, setSplitRatio] = useState(() => {
    try { return parseFloat(localStorage.getItem('florix_split_ratio')) || 50; } catch { return 50; }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(() => {
    try { return localStorage.getItem('florix_notes_panel') !== 'false'; } catch { return true; }
  });
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  // ❌ Error recovery states
  const [regenError, setRegenError] = useState(null);
  const [quizError, setQuizError] = useState(null);

  // 🔍 Left side Document/Guide Viewer States
  const [leftTab, setLeftTab] = useState('source'); // 'source' or 'summary'
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionDetail, setSessionDetail] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const textareaRef = useRef(null);
  const sessionRootRef = useRef(null);
  const markdownScrollRef = useRef(null);

  // 🪄 Floating Selection Contextual Actions
  const [externalChatPrompt, setExternalChatPrompt] = useState('');

  const handleFloatingExplain = useCallback((text) => {
    setActiveView('summary');
    setExternalChatPrompt(`Explain this concept clearly with an intuitive example: "${text}"`);
    addToast('Asking AI tutor to explain snippet...', 'info');
  }, [addToast]);

  const handleFloatingFlashcard = useCallback((text) => {
    setActiveView('summary');
    setExternalChatPrompt(`Create an active recall flashcard based on this concept (Front: Concept/Question, Back: Clear Explanation): "${text}"`);
    addToast('Generating flashcard in Chat...', 'info');
  }, [addToast]);

  const handleFloatingQuiz = useCallback((text) => {
    setActiveView('summary');
    setExternalChatPrompt(`Generate a single multiple-choice quiz question with 4 options to test my understanding of this exact concept: "${text}"`);
    addToast('Generating quiz question in Chat...', 'info');
  }, [addToast]);

  const handleFloatingFormat = useCallback((formatType, text) => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (formatType === 'highlight') {
          const mark = document.createElement('mark');
          mark.className = 'bg-amber-300/30 dark:bg-amber-400/25 text-inherit rounded px-1 transition-colors';
          mark.appendChild(range.extractContents());
          range.insertNode(mark);
          sel.removeAllRanges();
          addToast('Highlighted in Study Guide', 'success');
          return;
        } else {
          const tag = formatType === 'bold' ? 'strong'
            : formatType === 'italic' ? 'em'
            : formatType === 'underline' ? 'u'
            : 's';
          const el = document.createElement(tag);
          el.appendChild(range.extractContents());
          range.insertNode(el);
          sel.removeAllRanges();
          addToast(`Formatted as ${formatType}`, 'info');
          return;
        }
      }
    } catch {
      addToast(`Selected: "${text.slice(0, 35)}..."`, 'info');
    }
  }, [addToast]);

  useEffect(() => {
    if (sessionRootRef.current) {
      sessionRootRef.current.scrollTop = 0;
    }
    if (markdownScrollRef.current) {
      markdownScrollRef.current.scrollTop = 0;
    }
  }, [data?.id, currentSummary, aiOutput]);

  // ── Polling and Loading Session Detail ──
  const fetchSessionDetail = useCallback(async () => {
    if (!data?.id) return;
    try {
      const res = await api.get(`/library/${data.id}`);
      setSessionDetail(res.data);
      if (res.data.summary && res.data.summary !== 'Processing...') {
        setCurrentSummary(res.data.summary);
      }
      setLoadingSession(false);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
      setLoadingSession(false);
    }
  }, [data?.id]);

  useEffect(() => {
    if (!data?.id) return;
    setLoadingSession(true);
    fetchSessionDetail();
  }, [data?.id, fetchSessionDetail]);

  useEffect(() => {
    if (!data?.id) return;
    
    // Check if we need to poll (if session is processing)
    const isProcessing = !sessionDetail || sessionDetail.summary === 'Processing...';
    if (!isProcessing) return;

    const interval = setInterval(async () => {
      const updated = await fetchSessionDetail();
      if (updated && updated.summary && updated.summary !== 'Processing...') {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [data?.id, sessionDetail, fetchSessionDetail]);

  // Markdown helper function for notes editor
  const insertMarkdown = (type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'bullet':
        replacement = selectedText
          ? selectedText.split('\n').map(line => `- ${line}`).join('\n')
          : '- ';
        cursorOffset = replacement.length;
        break;
      case 'number':
        replacement = selectedText
          ? selectedText.split('\n').map((line, idx) => `${idx + 1}. ${line}`).join('\n')
          : '1. ';
        cursorOffset = replacement.length;
        break;
      case 'heading':
        replacement = `## ${selectedText || 'Heading'}`;
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    const newNotes = text.substring(0, startPos) + replacement + text.substring(endPos);
    setNotes(newNotes);

    // Focus back and set selection selection positions
    setTimeout(() => {
      textarea.focus();
      const nextPos = startPos + cursorOffset;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  const getYoutubeId = (session) => {
    if (!session) return null;
    // Check timeline source URL
    if (session.timeline) {
      for (const event of session.timeline) {
        if (event.detail && (event.detail.includes('youtube.com') || event.detail.includes('youtu.be'))) {
          const match = event.detail.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^?&\s]+)/);
          if (match) return match[1];
        }
      }
    }
    // Check title/filename if it has the ID
    if (session.filename && session.filename.startsWith('YouTube: ')) {
      return session.filename.replace('YouTube: ', '').trim();
    }
    // Try extract from content (sometimes it contains YouTube URL)
    if (session.content) {
      const match = session.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^?&\s]+)/);
      if (match) return match[1];
    }
    return null;
  };

  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim()) {
      return text;
    }
    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-slate-900 dark:text-white px-0.5 rounded-sm font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const renderSourceContent = () => {
    if (loadingSession || !sessionDetail) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-600 mb-4" />
          <p className="text-slate-500 text-xs">Loading document content...</p>
        </div>
      );
    }

    const sType = sessionDetail.source_type || 'pdf';

    if (sType === 'youtube') {
      const ytid = getYoutubeId(sessionDetail);
      if (ytid) {
        return (
          <div className="flex flex-col gap-4 h-full">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md shrink-0 bg-black">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${ytid}?rel=0&modestbranding=1`}
                title="YouTube Player"
                allowFullScreen
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60">
              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Video Transcript</span>
              <div className="flex-1 overflow-y-auto custom-scrollbar prose prose-slate dark:prose-invert text-xs leading-relaxed max-w-none select-text pr-1">
                {sessionDetail.content || 'Transcript is loading or unavailable.'}
              </div>
            </div>
          </div>
        );
      }
    }

    if (sType === 'image') {
      return (
        <div className="flex flex-col gap-4 h-full justify-center items-center text-center p-8 bg-slate-50 dark:bg-zinc-900/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <Sparkles size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Screenshot AI Insights</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md">
            This session was generated from an image. Switch to the <strong className="text-indigo-600 dark:text-indigo-400">AI Study Guide</strong> tab to view the complete OCR extraction, visual diagrams analysis, and explanation guide.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        {/* Search header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document content..."
            className="flex-1 bg-transparent border-none text-xs text-slate-700 dark:text-zinc-200 outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors shrink-0">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Scrollable text canvas */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar select-text pr-4">
          <div className="max-w-2xl mx-auto font-serif text-sm leading-relaxed text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">
            {sessionDetail.content ? highlightText(sessionDetail.content, searchQuery) : 'No content available.'}
          </div>
        </div>
      </div>
    );
  };

  // Persist split ratio
  useEffect(() => {
    localStorage.setItem('florix_split_ratio', String(splitRatio));
  }, [splitRatio]);

  useEffect(() => {
    localStorage.setItem('florix_notes_panel', String(showNotesPanel));
  }, [showNotesPanel]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Fetch Notes, Insights, Timeline, Intelligence on view change
  useEffect(() => {
    if (!data?.id) return;
    
    if (activeView === 'summary' || activeView === 'notes') {
      const fetchNotes = async () => {
        try {
          const res = await api.get(`/library/${data.id}/notes`);
          const fetchedNotes = res.data.notes || '';
          setNotes(fetchedNotes);
          lastSavedNotesRef.current = fetchedNotes;
        } catch (_) {}
      };
      fetchNotes();
    }
    
    if (activeView === 'insights') {
      const fetchInsightsAndIntel = async () => {
        setLoadingInsights(true);
        setLoadingIntelligence(true);
        try {
          const [insRes, intRes] = await Promise.all([
            api.get(`/library/${data.id}/insights`),
            api.get(`/library/${data.id}/intelligence`)
          ]);
          setInsights(insRes.data);
          setIntelligence(intRes.data);
        } catch (_) {}
        setLoadingInsights(false);
        setLoadingIntelligence(false);
      };
      fetchInsightsAndIntel();
    }
    
    if (activeView === 'timeline') {
      const fetchTimeline = async () => {
        setLoadingTimeline(true);
        try {
          const res = await api.get(`/library/${data.id}/timeline`);
          setTimeline(res.data);
        } catch (_) {}
        setLoadingTimeline(false);
      };
      fetchTimeline();
    }

    if (activeView === 'flashcards') {
      const fetchFlashcards = async () => {
        try {
          const res = await api.get(`/library/${data.id}/flashcards`);
          if (Array.isArray(res.data) && res.data.length > 0) {
            setFlashcards(res.data);
          }
        } catch (_) {}
      };
      fetchFlashcards();
    }
  }, [activeView, data?.id]);

  // 🔮 Debounced auto-save hook
  useEffect(() => {
    if (!data?.id) return;
    if (activeView !== 'summary' && activeView !== 'notes') return;
    if (notes === lastSavedNotesRef.current) return;

    const timer = setTimeout(async () => {
      try {
        setSavingNotes(true);
        await api.put(`/library/${data.id}/notes`, { notes });
        lastSavedNotesRef.current = notes;
        window.dispatchEvent(new CustomEvent('florix:session-updated'));
      } catch (_) {
        console.warn('Failed to auto-save notes.');
      } finally {
        setSavingNotes(false);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [notes, activeView, data?.id]);

  const handleSaveNotes = async () => {
    if (!data?.id) return;
    setSavingNotes(true);
    try {
      await api.put(`/library/${data.id}/notes`, { notes });
      lastSavedNotesRef.current = notes;
      addToast('Study notes saved successfully! 📝', 'success');
      window.dispatchEvent(new CustomEvent('florix:session-updated'));
    } catch (_) {
      addToast('Failed to save study notes.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleGenerateOneClickOutput = async (type) => {
    setLoadingOutput(true);
    setAiOutput(type);
    setAiOutputContent('');
    
    const docSummary = currentSummary ?? data?.summary ?? sessionDetail?.summary ?? '';
    const instruction = type === 'revision'
      ? "You are an expert tutor. Create a comprehensive, well-structured 1-page Revision / Cheat Sheet from this study material in clean GitHub-Flavored Markdown. Include key formulas, bullet points, checklists, and high-yield exam takeaways."
      : "You are an expert technical interviewer. Generate 10 high-probability Conceptual and Practical Interview Questions with detailed sample answers from this study material in clean GitHub-Flavored Markdown.";
    
    try {
      const res = await api.post(`/chat`, {
        message: `${instruction}\n\nStudy Material:\n${docSummary.slice(0, 8000)}`,
        session_id: data?.id
      });
      setAiOutputContent(res.data.reply || res.data.message || 'Content generated successfully.');
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to generate output. Please try again.', 'error');
      setAiOutput(null);
    } finally {
      setLoadingOutput(false);
    }
  };

  const handleGenerateContent = async (type) => {
    if (!data?.id) {
      setQuizError("Please select or save a study document first.");
      return;
    }
    setIsGenerating(true);
    setQuizError(null);
    setUserAnswers([]);
    const endpoint = type === 'quiz' ? '/generate_quiz' : '/generate_flashcards';
    const payload = type === 'quiz' 
      ? { num_questions: parseInt(numQuestions) || 5, session_id: data.id } 
      : { num_cards: parseInt(numFlashcards) || 6, session_id: data.id };

    try {
      const response = await api.post(endpoint, payload);
      const result = response.data;
      
      if (type === 'quiz') {
        setQuizData(result);
        setCurrentQuestion(0);
        setScore(0);
        setQuizFinished(false);
        setShowFeedback(false);
        setSelectedOption(null);
      } else {
        setFlashcards(result);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setFlashcardsFinished(false);
      }
    } catch (error) {
      const msg = error.response?.data?.detail || "AI Brain is offline or encountered an error.";
      setQuizError(msg);
      addToast(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!data?.id) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await api.post(`/library/${data.id}/regenerate`);
      setCurrentSummary(res.data.summary);
      addToast('Summary regenerated successfully!', 'success');
      window.dispatchEvent(new CustomEvent('florix:session-updated'));
    } catch (err) {
      const msg = err.response?.data?.detail || 'Regeneration failed. Please try again.';
      setRegenError(msg);
      addToast(msg, 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleShare = async () => {
    if (!data?.id) return;
    setSharing(true);
    try {
      const res = await api.post(`/library/${data.id}/share`, { share_type: shareType });
      const shareUrl = `${window.location.origin}/shared/${res.data.share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      addToast('Shareable link copied to clipboard! 🔗', 'success');
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) {
        addToast(detail, 'error');
      } else {
        addToast('Could not generate share link. Please check your connection.', 'error');
      }
    } finally {
      setSharing(false);
      setShareDropdownOpen(false);
    }
  };

  const handleOptionClick = (index) => {
    if (showFeedback || selectedOption !== null) return;
    setSelectedOption(index);
    setShowFeedback(true);
    const q = quizData[currentQuestion];
    const rawAnswer = q?.answer;
    let isCorrect = false;
    if (typeof rawAnswer === 'number') {
      isCorrect = index === rawAnswer;
    } else if (typeof rawAnswer === 'string') {
      const numAnswer = parseInt(rawAnswer, 10);
      if (!isNaN(numAnswer)) {
        isCorrect = index === numAnswer;
      } else {
        const letterIndex = rawAnswer.trim().toUpperCase().charCodeAt(0) - 65;
        isCorrect = index === letterIndex;
      }
    }
    if (isCorrect) setScore(prev => prev + 1);

    const record = {
      question: q.question,
      options: q.options || [],
      user_answer: (q.options && q.options[index]) || `Option ${index + 1}`,
      user_index: index,
      correct_answer: typeof rawAnswer === 'number' && q.options ? q.options[rawAnswer] : String(rawAnswer),
      is_correct: isCorrect,
      explanation: q.explanation || ''
    };
    setUserAnswers(prev => [...prev, record]);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption(null);
      setShowFeedback(false);
    } else {
      setQuizFinished(true);
      if (data?.id) {
        api.post('/quiz-result', {
          session_id: data.id,
          score,
          total_questions: quizData.length,
          details: userAnswers
        }).then(() => {
          window.dispatchEvent(new CustomEvent('florix:session-updated'));
          fetchPastQuizzes();
        }).catch(err => console.warn('Failed to save quiz result:', err));
      }
    }
  };

  const resetQuiz = () => {
    setQuizData([]);
    setQuizFinished(false);
    setCurrentQuestion(0);
    setScore(0);
    setShowFeedback(false);
    setQuizError(null);
    setUserAnswers([]);
  };

  const fetchPastQuizzes = useCallback(async () => {
    if (!data?.id) return;
    try {
      const res = await api.get(`/library/${data.id}/quizzes`);
      setPastQuizzes(res.data || []);
    } catch (err) {
      console.warn('Failed to fetch past quizzes:', err);
    }
  }, [data?.id]);

  useEffect(() => {
    fetchPastQuizzes();
  }, [fetchPastQuizzes]);

  const handleDownloadQuizPdf = async () => {
    setIsExportingQuiz(true);
    try {
      const quotaRes = await api.post('/track-download', {
        type: 'quiz',
        title: data?.filename || 'Practice Quiz'
      });
      addToast(
        quotaRes.data.is_unlimited
          ? 'Generating Quiz PDF (Unlimited plan)...'
          : `Downloading Quiz (${quotaRes.data.remaining} downloads left today)...`,
        'success'
      );

      const element = document.getElementById('quiz-printable-export');
      if (!element) {
        addToast('Could not find quiz export container.', 'error');
        return;
      }
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${(data?.filename || 'Quiz').replace(/\s+/g, '_')}_Practice_Quiz.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(element).save();
      addToast('Quiz PDF successfully saved!', 'success');
    } catch (err) {
      if (err.response?.status === 402) {
        addToast(err.response.data.detail || 'Daily download limit reached! Free users get 6/day, Pro gets 15/day, Premium gets Unlimited.', 'warning');
      } else {
        addToast('Download failed: ' + (err.message || 'Unknown error'), 'error');
      }
    } finally {
      setIsExportingQuiz(false);
    }
  };


  const handleRateFlashcard = async (quality = 4) => {
    if (data?.id && flashcards.length > 0) {
      try {
        api.post('/learning/flashcard-review', {
          session_id: data.id,
          card_index: currentCardIndex,
          quality: quality,
          idempotency_key: `fc-${data.id}-${currentCardIndex}-${Date.now()}`
        }).then(() => {
          setIntelligence(prev => prev ? ({
            ...prev,
            flashcards_reviewed: (prev?.flashcards_reviewed || 0) + 1
          }) : prev);
        }).catch(() => {});
      } catch (_) {}
    }

    if (currentCardIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentCardIndex(prev => prev + 1), 150);
    } else {
      setFlashcardsFinished(true);
    }
  };

  const handleNextFlashcard = () => {
    handleRateFlashcard(4);
  };

  const resetAndReturn = () => {
    setFlashcards([]);
    setQuizData([]);
    setFlashcardsFinished(false);
    setQuizFinished(false);
    setCurrentCardIndex(0);
    setCurrentQuestion(0);
    setIsFlipped(false);
    setActiveView('summary'); 
  };

  const goBackToSummary = () => {
    setActiveView('summary');
  };

  // 🖥️ Layout Controls
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode(prev => !prev);
    window.dispatchEvent(new CustomEvent('florix:toggle-sidebar'));
  }, []);

  const expandOutput = () => { setSplitRatio(100); };
  const collapseOutput = () => { setSplitRatio(35); };
  const resetSplit = () => { setSplitRatio(50); };

  // 🔀 Drag-to-resize handler
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const pct = Math.max(30, Math.min(80, (x / rect.width) * 100));
      setSplitRatio(pct);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Auto-save status indicator
  const NotesStatusBadge = () => (
    <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
      {savingNotes ? (
        <>
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping shrink-0" />
          <span>Saving...</span>
        </>
      ) : notes !== lastSavedNotesRef.current ? (
        <>
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
          <span>Unsaved</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
          <span className="text-emerald-600 dark:text-emerald-400">✓ Saved</span>
        </>
      )}
    </span>
  );

  const SubViewBackBar = ({ label }) => (
    <div className="shrink-0 flex items-center gap-3 px-6 py-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50">
      <button
        onClick={goBackToSummary}
        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Summary
      </button>
      {label && (
        <>
          <span className="text-slate-300 dark:text-zinc-600">/</span>
          <span className="text-slate-600 dark:text-zinc-400 text-sm font-medium">{label}</span>
        </>
      )}
    </div>
  );

  const handleTabClick = (tab) => {
    setActiveView(tab);
  };

  const Toolbar = () => (
    <div className="shrink-0 flex items-center gap-1 p-1 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200/50 dark:border-zinc-800/50 flex-wrap">
      <button
        onClick={() => insertMarkdown('bold')}
        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-xs transition-all w-8 h-8 flex items-center justify-center"
        title="Bold text (**bold**)"
      >
        B
      </button>
      <button
        onClick={() => insertMarkdown('italic')}
        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 italic text-xs transition-all w-8 h-8 flex items-center justify-center"
        title="Italic text (*italic*)"
      >
        I
      </button>
      <button
        onClick={() => insertMarkdown('heading')}
        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs transition-all w-8 h-8 flex items-center justify-center"
        title="Heading (## Heading)"
      >
        H
      </button>
      <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 mx-1" />
      <button
        onClick={() => insertMarkdown('bullet')}
        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-sm transition-all w-8 h-8 flex items-center justify-center font-bold"
        title="Bullet list (- item)"
      >
        •
      </button>
      <button
        onClick={() => insertMarkdown('number')}
        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs transition-all w-8 h-8 flex items-center justify-center font-bold"
        title="Numbered list (1. item)"
      >
        1.
      </button>
    </div>
  );

  return (
    <div ref={sessionRootRef} className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden transition-colors duration-300">

      {/* ── TOP NAVIGATION BAR ── */}
      <div className="h-14 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10">
        <button
          onClick={() => onBack?.(sessionDetail?.project_id || data?.project_id)}
          className="flex items-center text-slate-500 hover:text-indigo-600 font-medium transition-colors text-sm font-bold cursor-pointer"
        >
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-x-auto max-w-[65%] no-scrollbar shrink-0">
          {['summary', 'notes', 'quiz', 'flashcards', 'insights', 'timeline'].map((tab) => (
            <button 
              key={tab}
              onClick={() => handleTabClick(tab)} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeView === tab
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab === 'summary' ? 'Study Space' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(activeView === 'summary' || activeView === 'notes') && (
            <Suspense fallback={<div className="w-[60px]"><Loader2 size={14} className="animate-spin text-slate-400" /></div>}>
              <PDFExport 
                summary={currentSummary ?? data?.summary} 
                quizData={quizData} 
                flashcards={flashcards} 
              />
            </Suspense>
          )}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-zinc-700/60"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* ── REDESIGNED DUAL-PANE WORKSPACE ── */}
      {(activeView === 'summary' || activeView === 'notes') && (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Toolbar bar */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200/50 dark:border-zinc-800/50 flex-wrap">
            {/* Breadcrumb */}
            <button
              onClick={() => onBack?.(sessionDetail?.project_id || data?.project_id)}
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} /> {sessionDetail?.project_id || data?.project_id ? 'Space Hub' : 'Back'}
            </button>
            <span className="text-slate-300 dark:text-zinc-700 text-xs">/</span>
            <span className="text-slate-600 dark:text-zinc-400 text-xs font-medium truncate max-w-[200px]">
              {sessionDetail?.filename || data?.title || 'Study Session'}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* One-Click Outputs */}
            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1 mr-1">
              <Sparkles size={10} className="text-indigo-500" /> Outputs:
            </span>
            <button
              onClick={() => handleGenerateOneClickOutput('revision')}
              disabled={loadingOutput}
              className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-zinc-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1"
            >
              <Clipboard size={10} /> Revision
            </button>
            <button
              onClick={() => handleGenerateOneClickOutput('interview')}
              disabled={loadingOutput}
              className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-zinc-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1"
            >
              <HelpCircle size={10} /> Interview
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />

            {/* Share with type selector */}
            <div className="relative">
              <button
                onClick={() => setShareDropdownOpen(!shareDropdownOpen)}
                disabled={sharing}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-emerald-500 hover:border-emerald-400 transition-all disabled:opacity-50"
              >
                {shareCopied ? <Check size={10} className="text-emerald-500" /> : sharing ? <Loader2 size={10} className="animate-spin" /> : <Share2 size={10} />}
                {shareCopied ? 'Copied!' : 'Share'}
                <ChevronDown size={10} />
              </button>
              {shareDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 w-44 py-1 animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { value: 'public', label: 'Public Link', icon: Globe, desc: 'Anyone with link' },
                    { value: 'private', label: 'Private Link', icon: Lock, desc: 'Only you' },
                    { value: 'team', label: 'Team Link', icon: Users, desc: 'Signed-in users' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setShareType(opt.value); setShareDropdownOpen(false); handleShare(); }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 ${shareType === opt.value ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                    >
                      <opt.icon size={12} className="text-slate-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{opt.label}</p>
                        <p className="text-[9px] text-slate-400 dark:text-zinc-500">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Regenerate */}
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-indigo-500 hover:border-indigo-400 transition-all disabled:opacity-50"
            >
              {regenerating ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              {regenerating ? 'Working...' : 'Regen'}
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />

            {/* Layout controls */}
            <button onClick={toggleFocusMode} title="Focus Mode"
              className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all ${isFocusMode ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-500'}`}>
              <PanelLeftClose size={13} />
            </button>
            <button onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-indigo-500 transition-all">
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          {/* Regen error with retry */}
          {regenError && (
            <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <span className="text-red-600 dark:text-red-400 flex-1">{regenError}</span>
              <button onClick={handleRegenerate} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg font-bold text-[10px] transition-colors">
                Retry
              </button>
              <button onClick={() => setRegenError(null)} className="text-red-400 hover:text-red-600"><X size={12} /></button>
            </div>
          )}

          {/* ── Split Screen Content ── */}
          <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
            {/* LEFT SIDE PANEL — AI Study Guide */}
            <div className="h-full flex flex-col min-w-0 overflow-hidden border-r border-slate-200/60 dark:border-zinc-800/60" style={{ width: `${splitRatio}%`, transition: isDragging.current ? 'none' : 'width 0.2s ease' }}>
              {/* Left pane header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                    {aiOutput
                      ? (aiOutput === 'revision' ? 'Revision Sheet' : 'Interview Q&A')
                      : (sessionDetail?.source_type === 'youtube' ? 'Interactive Video Learning' : 'AI Study Guide')}
                  </span>
                </div>

                {/* View Switcher for YouTube Sessions */}
                {sessionDetail?.source_type === 'youtube' && !aiOutput && (
                  <div className="flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-zinc-800/80 border border-slate-300/60 dark:border-zinc-700/60 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setYoutubeView('timeline')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        youtubeView === 'timeline'
                          ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      ⚡ Learning Timeline
                    </button>
                    <button
                      type="button"
                      onClick={() => setYoutubeView('guide')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        youtubeView === 'guide'
                          ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      📄 Study Guide
                    </button>
                  </div>
                )}

                {aiOutput && (
                  <button
                    onClick={() => setAiOutput(null)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Guide
                  </button>
                )}
              </div>

              {/* Left Content Area */}
              <div ref={markdownScrollRef} className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto custom-scrollbar">
                {aiOutput ? (
                  <div className="max-w-3xl mx-auto bg-slate-50 dark:bg-zinc-800/40 p-6 rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 relative">
                    <button onClick={() => setAiOutput(null)} className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 rounded-xl text-slate-600 dark:text-zinc-300 transition-colors">
                      Close Output
                    </button>
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles size={16} className="text-indigo-500" />
                      <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {aiOutput === 'revision' ? 'Revision Sheet' : 'Interview Q&A'} Generated
                      </span>
                    </div>
                    <article className="prose prose-slate dark:prose-invert max-w-none prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-p:leading-relaxed text-sm">
                      {loadingOutput ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <Loader2 size={36} className="animate-spin text-indigo-600 mb-4" />
                          <p className="text-slate-500 text-sm">AI is writing your custom study sheet...</p>
                        </div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                          {aiOutputContent}
                        </ReactMarkdown>
                      )}
                    </article>
                  </div>
                ) : sessionDetail?.source_type === 'youtube' && youtubeView === 'timeline' ? (
                  <div className="max-w-3xl mx-auto">
                    <YouTubeLearningTimeline
                      sessionId={data?.id}
                      sessionDetail={sessionDetail}
                      onAskThisMoment={(sec) => {
                        setActiveView('summary');
                        setExternalChatPrompt(`[Regarding moment ${sec.timestamp_str} — "${sec.title}"]: Explain what the speaker means when they discuss: "${sec.what_video_says}"`);
                        addToast(`Ask AI Tutor about ${sec.timestamp_str}`, 'info');
                      }}
                      onAddNote={(noteText) => {
                        setNotes(prev => (prev ? prev + noteText : noteText.trim()));
                        addToast('Appended timestamped note to Personal Notes', 'success');
                      }}
                      onOpenChat={(prompt) => {
                        setActiveView('summary');
                        setExternalChatPrompt(prompt);
                      }}
                    />
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto h-full">
                    {loadingSession || (sessionDetail && sessionDetail.summary === 'Processing...') || (!currentSummary && !data?.summary) ? (
                      <div className="flex flex-col items-center justify-center py-24 text-center h-full">
                        <Loader2 size={48} className="animate-spin text-indigo-600 mb-6" />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Analyzing your content...</h2>
                        <p className="text-slate-500 mt-2 max-w-md text-sm">Gemini is generating your AI study guide in the background. Feel free to use the chat assistant on the right in the meantime!</p>
                      </div>
                    ) : (
                      <article className="prose prose-slate dark:prose-invert max-w-none prose-h1:text-3xl prose-h1:font-extrabold prose-h1:text-indigo-600 prose-h1:mb-6 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2 prose-p:text-slate-600 dark:prose-p:text-zinc-400 prose-p:leading-relaxed prose-p:mb-4 prose-li:my-1.5 select-text animate-fade-in">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                          {currentSummary ?? data?.summary ?? ''}
                        </ReactMarkdown>
                      </article>
                    )}
                  </div>
                )}
              </div>

              {/* Contextual Floating Selection Toolbar */}
              <FloatingSelectionToolbar
                containerRef={markdownScrollRef}
                onExplain={handleFloatingExplain}
                onFlashcard={handleFloatingFlashcard}
                onQuiz={handleFloatingQuiz}
                onFormat={handleFloatingFormat}
              />
            </div>

            {/* DRAG HANDLE */}
            <div
              onMouseDown={handleMouseDown}
              onDoubleClick={resetSplit}
              className="w-[5px] shrink-0 bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-300 dark:hover:bg-indigo-600 cursor-col-resize flex items-center justify-center group transition-colors relative z-10"
              title="Drag to resize • Double-click to reset"
            >
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="w-1 h-1 bg-slate-400 dark:bg-zinc-500 rounded-full" />
                <span className="w-1 h-1 bg-slate-400 dark:bg-zinc-500 rounded-full" />
                <span className="w-1 h-1 bg-slate-400 dark:bg-zinc-500 rounded-full" />
              </div>
            </div>

            {/* RIGHT SIDE PANEL — Chat or Notes */}
            <div className="h-full flex flex-col min-w-0 overflow-hidden" style={{ width: `${100 - splitRatio}%`, transition: isDragging.current ? 'none' : 'width 0.2s ease' }}>
              {activeView === 'summary' ? (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-900/85 border-b border-slate-200/60 dark:border-zinc-800/60">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Chat Assistant</span>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <GlobalChatTab
                      sessionId={data?.id}
                      documentTitle={sessionDetail?.ai_title || sessionDetail?.filename || data?.title || 'Document'}
                      externalPrompt={externalChatPrompt}
                      onPromptHandled={() => setExternalChatPrompt('')}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col min-w-0 overflow-hidden bg-white dark:bg-zinc-950">
                  {/* Notes header */}
                  <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-zinc-900/85 border-b border-slate-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2">
                       <FileText size={13} className="text-indigo-500" />
                       <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Personal Notes</span>
                       <NotesStatusBadge />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={handleSaveNotes} disabled={savingNotes}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50">
                        {savingNotes ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                        Save Notes
                      </button>
                    </div>
                  </div>

                  {/* Formatting Toolbar */}
                  <Toolbar />

                  {/* Notes Editor (occupies 100% height) */}
                  <div className="flex-1 p-3 min-h-0">
                    <textarea
                      ref={textareaRef}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Write your personal study notes here... Formatting toolbar is available on top! Supports Markdown editing."
                      className="w-full h-full bg-white dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm leading-relaxed text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none resize-none font-mono custom-scrollbar focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QUIZ VIEW ── */}
      {activeView === 'quiz' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
          <SubViewBackBar label="Quiz" />
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-full">
              {quizData.length === 0 ? (
                <div className="bg-slate-50 dark:bg-zinc-800 p-10 rounded-[32px] shadow-xl border border-slate-100 dark:border-zinc-700 text-center max-w-md w-full">
                  <h2 className="text-2xl font-bold dark:text-white mb-2">Quiz Setup</h2>
                  <p className="text-slate-500 mb-8 text-sm">How many questions from your document?</p>
                  <input
                    type="number"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(e.target.value)}
                    className="w-24 text-center text-xl font-bold p-3 rounded-2xl border-2 border-slate-100 dark:bg-zinc-900 dark:text-white mb-6 outline-none"
                  />
                  {quizError && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
                      <AlertCircle size={14} className="shrink-0" />
                      <span className="flex-1">{quizError}</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleGenerateContent('quiz')}
                    disabled={isGenerating}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold transition-all hover:bg-indigo-700 disabled:opacity-70 shadow-md shadow-indigo-500/20"
                  >
                    {isGenerating ? <Loader2 className="animate-spin mx-auto" /> : quizError ? "Retry Quiz Generation" : "Start Practice Quiz"}
                  </button>

                  {pastQuizzes.length > 0 && (
                    <button
                      onClick={() => setShowPastQuizzesModal(true)}
                      className="w-full mt-3 py-3 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <History size={14} className="text-indigo-500" />
                      <span>Past Quiz Attempts ({pastQuizzes.length})</span>
                    </button>
                  )}
                </div>
              ) : quizFinished ? (
                <div className="w-full max-w-3xl bg-slate-50 dark:bg-zinc-800/80 p-6 md:p-8 rounded-[32px] shadow-xl border border-slate-200/80 dark:border-zinc-700/80 space-y-6">
                  {/* Score Header */}
                  <div className="text-center pb-6 border-b border-slate-200 dark:border-zinc-700">
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black uppercase tracking-wider">
                      Quiz Completed
                    </span>
                    <h2 className="text-4xl font-black dark:text-white mt-3 mb-2">
                      {Math.round((score / quizData.length) * 100)}% Accuracy
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                      You scored <span className="font-bold text-indigo-600 dark:text-indigo-400">{score}</span> out of {quizData.length} questions correctly.
                    </p>

                    <div className="flex items-center justify-center gap-4 mt-4">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                        <CheckCircle2 size={14} />
                        <span>{score} Correct</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold">
                        <XCircle size={14} />
                        <span>{quizData.length - score} Incorrect</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                      <button
                        onClick={handleDownloadQuizPdf}
                        disabled={isExportingQuiz}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
                      >
                        {isExportingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>Download Quiz PDF</span>
                      </button>

                      <button
                        onClick={resetQuiz}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <RefreshCw size={14} />
                        <span>Retake Quiz</span>
                      </button>

                      {pastQuizzes.length > 0 && (
                        <button
                          onClick={() => setShowPastQuizzesModal(true)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all"
                        >
                          <History size={14} />
                          <span>Past Attempts ({pastQuizzes.length})</span>
                        </button>
                      )}

                      <button
                        onClick={goBackToSummary}
                        className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      >
                        Back to Study Space
                      </button>
                    </div>
                  </div>

                  {/* Detailed Question by Question Answer Review */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Detailed Answer Breakdown ({userAnswers.length} Questions)
                    </h3>

                    {userAnswers.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          item.is_correct
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-800/50'
                            : 'bg-red-50/40 dark:bg-red-950/10 border-red-200/80 dark:border-red-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            <span className="text-slate-400 mr-2">#{idx + 1}</span>
                            {item.question}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              item.is_correct
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {item.is_correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500">Your Answer:</span>
                            <span className={`font-semibold ${item.is_correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400 line-through'}`}>
                              {item.user_answer}
                            </span>
                          </div>

                          {!item.is_correct && (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">Correct Answer:</span>
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                                {item.correct_answer}
                              </span>
                            </div>
                          )}

                          {item.explanation && (
                            <div className="mt-2 p-2.5 rounded-xl bg-white/70 dark:bg-zinc-900/70 border border-slate-200/60 dark:border-zinc-800/60 text-slate-600 dark:text-zinc-300 flex items-start gap-2">
                              <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{item.explanation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-8">
                    <p className="text-indigo-600 font-bold text-sm uppercase">
                      Question {currentQuestion + 1} of {quizData.length}
                    </p>
                    <p className="text-slate-500 font-bold dark:text-zinc-300">Score: {score}</p>
                  </div>
                  <h2 className="text-3xl font-bold dark:text-white mb-8 leading-tight">
                    {quizData[currentQuestion].question}
                  </h2>
                  <div className="grid gap-4">
                    {quizData[currentQuestion].options.map((opt, i) => {
                      const isCorrect = i === quizData[currentQuestion].answer;
                      const isSelected = i === selectedOption;
                      let btnStyle = "border-slate-100 dark:border-zinc-800 dark:text-white";
                      if (showFeedback) {
                        if (isCorrect) btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
                        else if (isSelected) btnStyle = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
                        else btnStyle = "opacity-40 border-slate-100 dark:border-zinc-800";
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => handleOptionClick(i)}
                          className={`w-full p-5 text-left border-2 rounded-2xl transition-all font-medium flex justify-between items-center ${btnStyle}`}
                        >
                          {opt}
                          {showFeedback && isCorrect && <CheckCircle size={20} className="text-emerald-500" />}
                        </button>
                      );
                    })}
                  </div>
                  {showFeedback && (
                    <button
                      onClick={handleNextQuestion}
                      className="mt-10 float-right px-8 py-3 bg-slate-900 dark:bg-white dark:text-black text-white rounded-xl font-bold transition-all"
                    >
                      {currentQuestion === quizData.length - 1 ? "View Results" : "Next Question"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FLASHCARDS VIEW ── */}
      {activeView === 'flashcards' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
          <SubViewBackBar label="Flashcards" />
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-full">
              {flashcards.length === 0 ? (
                <div className="bg-slate-50 dark:bg-zinc-800 p-10 rounded-[32px] shadow-xl border border-slate-100 dark:border-zinc-700 text-center max-w-md w-full">
                  <h2 className="text-2xl font-bold dark:text-white mb-2">Flashcard Setup</h2>
                  <p className="text-slate-500 mb-8 text-sm">How many concepts?</p>
                  <input
                    type="number"
                    value={numFlashcards}
                    onChange={(e) => setNumFlashcards(e.target.value)}
                    className="w-24 text-center text-xl font-bold p-3 rounded-2xl border-2 border-slate-100 dark:bg-zinc-900 dark:text-white mb-8 outline-none"
                  />
                  <button
                    onClick={() => handleGenerateContent('cards')}
                    disabled={isGenerating}
                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold transition-all hover:bg-purple-700 disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="animate-spin mx-auto" /> : "Generate Cards"}
                  </button>
                </div>
              ) : flashcardsFinished ? (
                <div className="text-center p-10 bg-slate-50 dark:bg-zinc-800 rounded-[32px] shadow-xl border dark:border-zinc-700 w-full max-w-md">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} />
                  </div>
                  <h2 className="text-3xl font-bold dark:text-white mb-2">Mastered! 🎉</h2>
                  <p className="text-slate-500 mb-8">Deck Finished.</p>
                  <button onClick={resetAndReturn} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700">
                    Back to Summary
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-xl flex flex-col items-center">
                  <div onClick={() => setIsFlipped(!isFlipped)} className="w-full aspect-[5/3.5] perspective-1000 cursor-pointer">
                    <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      <div className="absolute w-full h-full backface-hidden bg-indigo-600 rounded-[40px] flex items-center justify-center p-8 text-center text-white shadow-2xl">
                        <h3 className="text-3xl font-bold leading-tight select-none">
                          {flashcards[currentCardIndex].front}
                        </h3>
                      </div>
                      <div className="absolute w-full h-full backface-hidden bg-white dark:bg-zinc-900 border-4 border-indigo-50 dark:border-zinc-800 rounded-[40px] flex items-center justify-center p-6 text-center rotate-y-180 shadow-2xl overflow-hidden">
                        <div className="w-full max-h-full overflow-y-auto px-4 custom-scrollbar">
                          <h3 className="text-xl font-medium dark:text-white leading-relaxed">
                            {flashcards[currentCardIndex].back}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mt-6 font-medium">
                    Card {currentCardIndex + 1} of {flashcards.length}
                  </p>
                  {isFlipped ? (
                    <div className="flex flex-col items-center gap-2 mt-4 w-full max-w-sm">
                      <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Rate Your Recall</p>
                      <div className="grid grid-cols-4 gap-2 w-full">
                        <button
                          onClick={() => handleRateFlashcard(1)}
                          className="py-2.5 px-1.5 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-semibold text-xs transition-all hover:bg-red-100 flex flex-col items-center gap-0.5"
                          title="Forgot / Incorrect"
                        >
                          <span className="font-bold">Again</span>
                          <span className="text-[10px] opacity-75">1m</span>
                        </button>
                        <button
                          onClick={() => handleRateFlashcard(3)}
                          className="py-2.5 px-1.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-semibold text-xs transition-all hover:bg-amber-100 flex flex-col items-center gap-0.5"
                          title="Recalled with effort"
                        >
                          <span className="font-bold">Hard</span>
                          <span className="text-[10px] opacity-75">1d</span>
                        </button>
                        <button
                          onClick={() => handleRateFlashcard(4)}
                          className="py-2.5 px-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-semibold text-xs transition-all hover:bg-blue-100 flex flex-col items-center gap-0.5"
                          title="Good recall"
                        >
                          <span className="font-bold">Good</span>
                          <span className="text-[10px] opacity-75">3d</span>
                        </button>
                        <button
                          onClick={() => handleRateFlashcard(5)}
                          className="py-2.5 px-1.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold text-xs transition-all hover:bg-emerald-100 flex flex-col items-center gap-0.5"
                          title="Instant, effortless recall"
                        >
                          <span className="font-bold">Easy</span>
                          <span className="text-[10px] opacity-75">6d</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 mt-4 w-full max-w-sm">
                      <button
                        disabled={currentCardIndex === 0}
                        onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => p - 1); }}
                        className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 dark:text-white font-bold disabled:opacity-30 transition-all hover:bg-slate-200 dark:hover:bg-zinc-700"
                      >
                        Previous
                      </button>
                      <button
                        onClick={handleNextFlashcard}
                        className="flex-1 py-4 rounded-2xl bg-emerald-50 text-emerald-600 font-bold transition-all hover:bg-emerald-100"
                      >
                        {currentCardIndex === flashcards.length - 1 ? "Finish" : "Next Card"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INSIGHTS VIEW ── */}
      {activeView === 'insights' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
          <SubViewBackBar label="AI Learning Insights" />
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {loadingInsights || loadingIntelligence ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 size={48} className="animate-spin text-indigo-600 mb-6" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-200">Analyzing Session Intelligence...</h3>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                {intelligence && (
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between">
                    <div className="space-y-2 max-w-md z-10">
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-200">Session Learning Index</p>
                      <h2 className="text-3xl font-extrabold">Knowledge Depth: {intelligence.depth}</h2>
                      <p className="text-indigo-100 text-xs">Based on quiz accuracy, spaced repetition reviews, and chat conversations.</p>
                      <div className="flex gap-4 pt-2">
                        <div className="bg-white/10 px-3 py-1.5 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-indigo-200 uppercase">Quizzes</p>
                          <p className="text-sm font-black">{intelligence.quizzes_taken}</p>
                        </div>
                        <div className="bg-white/10 px-3 py-1.5 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-indigo-200 uppercase">Avg Score</p>
                          <p className="text-sm font-black">{intelligence.average_quiz_score}%</p>
                        </div>
                        <div className="bg-white/10 px-3 py-1.5 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-indigo-200 uppercase">Flashcards</p>
                          <p className="text-sm font-black">{intelligence.flashcards_reviewed}</p>
                        </div>
                      </div>
                    </div>
                    <div className="relative w-28 h-28 flex items-center justify-center shrink-0 z-10">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,0.15)" strokeWidth="8" fill="transparent" />
                        <circle cx="56" cy="56" r="48" stroke="white" strokeWidth="8" fill="transparent"
                          strokeDasharray={2 * Math.PI * 48}
                          strokeDashoffset={2 * Math.PI * 48 * (1 - intelligence.score / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-2xl font-black">{intelligence.score}%</span>
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                  </div>
                )}
                {insights && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                        <BookOpen size={18} />
                        <h3 className="font-extrabold text-sm uppercase tracking-wider">Topics Covered</h3>
                      </div>
                      <ul className="space-y-2">
                        {insights.topics_covered?.map((topic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-300">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
                        <Award size={18} />
                        <h3 className="font-extrabold text-sm uppercase tracking-wider">Key Concepts</h3>
                      </div>
                      <ul className="space-y-2">
                        {insights.concepts_learned?.map((concept, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-300">
                            <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            <span>{concept}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-rose-600 dark:text-rose-400">
                        <Lightbulb size={18} />
                        <h3 className="font-extrabold text-sm uppercase tracking-wider">Weak Areas</h3>
                      </div>
                      <ul className="space-y-2">
                        {insights.weak_areas?.map((weak, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-300">
                            <span className="text-rose-500 font-bold shrink-0">⚠️</span>
                            <span>{weak}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400">
                        <Sparkles size={18} />
                        <h3 className="font-extrabold text-sm uppercase tracking-wider">Next study steps</h3>
                      </div>
                      <ul className="space-y-2">
                        {insights.suggested_next?.map((next, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-300">
                            <span className="text-amber-500 shrink-0">🚀</span>
                            <span>{next}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TIMELINE VIEW ── */}
      {activeView === 'timeline' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
          <SubViewBackBar label="Visual Learning Timeline" />
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {loadingTimeline ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 size={48} className="animate-spin text-indigo-600 mb-6" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-200">Retrieving Timeline...</h3>
              </div>
            ) : (
              <div className="max-w-xl mx-auto relative pl-6 border-l border-indigo-100 dark:border-indigo-900/60 py-4">
                {timeline.length === 0 ? (
                  <p className="text-slate-400 italic">No activity timeline recorded yet.</p>
                ) : (
                  timeline.map((event, i) => (
                    <div key={i} className="mb-8 relative last:mb-0">
                      <span className="absolute -left-[31px] top-1.5 w-4 h-4 bg-indigo-500 rounded-full border-4 border-white dark:border-zinc-900 flex items-center justify-center shrink-0 shadow-sm" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{event.event}</span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock size={9} />
                            {new Date(event.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {event.detail && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-medium bg-slate-50/50 dark:bg-zinc-800/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-zinc-800/10">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── PAST QUIZZES HISTORY MODAL ── */}
      {showPastQuizzesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="text-indigo-500" size={18} />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Past Quiz Attempts ({pastQuizzes.length})</h3>
              </div>
              <button
                onClick={() => { setShowPastQuizzesModal(false); setSelectedPastQuiz(null); }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
              {selectedPastQuiz ? (
                <div>
                  <button
                    onClick={() => setSelectedPastQuiz(null)}
                    className="mb-4 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    ← Back to attempts list
                  </button>
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-lg">Score: {selectedPastQuiz.score} / {selectedPastQuiz.total_questions} ({selectedPastQuiz.percentage}%)</h4>
                      <p className="text-xs text-slate-500">Date: {new Date(selectedPastQuiz.date_taken).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedPastQuiz.details && selectedPastQuiz.details.length > 0 ? (
                      selectedPastQuiz.details.map((item, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border text-xs ${item.is_correct ? 'bg-emerald-50/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-50/30 border-red-200 dark:border-red-800'}`}>
                          <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">#{idx+1}. {item.question}</p>
                          <p className="text-slate-600 dark:text-zinc-300">Your Answer: <span className={item.is_correct ? 'font-bold text-emerald-600' : 'font-bold text-red-500 line-through'}>{item.user_answer}</span></p>
                          {!item.is_correct && <p className="text-emerald-700 dark:text-emerald-400 font-bold mt-1">Correct: {item.correct_answer}</p>}
                          {item.explanation && <p className="text-slate-500 mt-2 italic bg-white/50 dark:bg-zinc-800/50 p-2 rounded-lg">{item.explanation}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Detailed question breakdown not recorded for this legacy attempt.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastQuizzes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedPastQuiz(q)}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${q.percentage >= 70 ? 'text-emerald-600' : 'text-amber-500'}`}>{q.percentage}%</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">({q.score}/{q.total_questions} correct)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{new Date(q.date_taken).toLocaleString()}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Review Answers →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN PRINTABLE CONTAINER FOR QUIZ PDF EXPORT ── */}
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '800px', background: 'white', zIndex: -1 }}>
        <div id="quiz-printable-export" className="p-10 text-black font-sans bg-white">
          <div className="text-center mb-8 border-b-2 border-indigo-600 pb-4">
            <h1 className="text-3xl font-extrabold text-indigo-700">{data?.filename || 'Study Session'} — Practice Quiz</h1>
            <p className="text-gray-500 text-sm mt-1">Florix AI Practice Exam Sheet</p>
          </div>

          {/* Section 1: Practice Exam (Blank choices for testing) */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-indigo-600 uppercase tracking-wide">Section 1: Practice Questions</h2>
            <div className="space-y-6">
              {quizData.map((q, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-xl bg-gray-50 break-inside-avoid">
                  <p className="font-bold text-base text-gray-900 mb-3">{i+1}. {q.question}</p>
                  <div className="ml-4 space-y-1.5">
                    {q.options?.map((opt, j) => (
                      <p key={j} className="text-sm text-gray-700">
                        ○ {opt}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Page break */}
          <div className="html2pdf__page-break"></div>

          {/* Section 2: Answer Key & Explanations */}
          <section className="mt-8">
            <h2 className="text-xl font-bold mb-4 text-emerald-600 uppercase tracking-wide">Section 2: Answer Key & Explanations</h2>
            <div className="space-y-4">
              {quizData.map((q, i) => (
                <div key={i} className="p-4 border border-emerald-200 rounded-xl bg-emerald-50/30 break-inside-avoid text-sm">
                  <p className="font-bold text-gray-900">Question {i+1}: {q.question}</p>
                  <p className="text-emerald-700 font-bold mt-1">Correct Answer: {typeof q.answer === 'number' && q.options ? q.options[q.answer] : q.answer}</p>
                  {q.explanation && (
                    <p className="text-gray-600 mt-2 italic bg-white p-2.5 rounded-lg border border-gray-100">
                      💡 Explanation: {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StudySession;