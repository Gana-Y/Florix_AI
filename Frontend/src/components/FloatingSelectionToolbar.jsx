import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, Target, Highlighter } from 'lucide-react';

/**
 * FloatingSelectionToolbar
 * 
 * Sleek, floating contextual action menu matching:
 * [ ✨ Explain | B / U S | 📖 Flashcard | 🎯 Quiz ]
 * 
 * Floats directly above/below user-highlighted text inside any referenced container.
 */
const FloatingSelectionToolbar = ({
  containerRef,
  onExplain,
  onFlashcard,
  onQuiz,
  onFormat,
}) => {
  const [position, setPosition] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef(null);

  const updatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setIsVisible(false);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setIsVisible(false);
      return;
    }

    // Ensure the selection is actually inside the watched container
    if (containerRef?.current) {
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (
        !containerRef.current.contains(anchorNode) ||
        !containerRef.current.contains(focusNode)
      ) {
        setIsVisible(false);
        return;
      }
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) {
        setIsVisible(false);
        return;
      }

      // Position centered directly above the selection
      const toolbarHeight = 44;
      let top = rect.top - toolbarHeight - 10;
      let placement = 'top';

      // If near viewport top, flip below the selection
      if (top < 16) {
        top = rect.bottom + 10;
        placement = 'bottom';
      }

      // Clamp left within viewport bounds
      const minLeft = 180;
      const maxLeft = window.innerWidth - 180;
      const left = Math.max(minLeft, Math.min(maxLeft, rect.left + rect.width / 2));

      setSelectedText(text);
      setPosition({ top, left, placement });
      setIsVisible(true);
    } catch {
      setIsVisible(false);
    }
  }, [containerRef]);

  useEffect(() => {
    const handleMouseUp = (e) => {
      // Don't hide if clicking inside the toolbar itself
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) {
        return;
      }
      // Small timeout allows browser to finalize range
      setTimeout(updatePosition, 10);
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
        window.getSelection()?.removeAllRanges();
        return;
      }
      setTimeout(updatePosition, 10);
    };

    const handleScrollOrResize = () => {
      if (isVisible) {
        updatePosition();
      }
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [updatePosition, isVisible]);

  // Action handlers
  const handleExplainClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      onExplain?.(selectedText);
      setIsVisible(false);
    }
  };

  const handleFlashcardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      onFlashcard?.(selectedText);
      setIsVisible(false);
    }
  };

  const handleQuizClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      onQuiz?.(selectedText);
      setIsVisible(false);
    }
  };

  const handleFormatClick = (e, formatType) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      onFormat?.(formatType, selectedText);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && position && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: position.placement === 'top' ? 6 : -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position.placement === 'top' ? 4 : -4, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="select-none pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Main Pill Toolbar */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-950/95 text-white border border-zinc-800/90 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            {/* ✨ Explain Button (Purple Pill) */}
            <button
              type="button"
              onClick={handleExplainClick}
              title="Explain this selected concept with AI"
              className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-900/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Sparkles size={12} className="text-white fill-white/20 group-hover:rotate-12 transition-transform" />
              <span>Explain</span>
            </button>

            {/* Formatting Group: B / U S */}
            <div className="flex items-center gap-0.5 px-1 font-mono text-xs">
              <button
                type="button"
                onClick={(e) => handleFormatClick(e, 'bold')}
                title="Bold"
                className="w-6 h-6 flex items-center justify-center font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded transition-colors cursor-pointer"
              >
                B
              </button>
              <button
                type="button"
                onClick={(e) => handleFormatClick(e, 'italic')}
                title="Italic"
                className="w-6 h-6 flex items-center justify-center italic font-serif text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded transition-colors cursor-pointer"
              >
                /
              </button>
              <button
                type="button"
                onClick={(e) => handleFormatClick(e, 'underline')}
                title="Underline"
                className="w-6 h-6 flex items-center justify-center underline text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded transition-colors cursor-pointer"
              >
                U
              </button>
              <button
                type="button"
                onClick={(e) => handleFormatClick(e, 'strikethrough')}
                title="Strikethrough"
                className="w-6 h-6 flex items-center justify-center line-through text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded transition-colors cursor-pointer"
              >
                S
              </button>
              <button
                type="button"
                onClick={(e) => handleFormatClick(e, 'highlight')}
                title="Highlight"
                className="w-6 h-6 flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:bg-zinc-800/80 rounded transition-colors cursor-pointer"
              >
                <Highlighter size={12} />
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-3.5 bg-zinc-800" />

            {/* 📖 Flashcard Button */}
            <button
              type="button"
              onClick={handleFlashcardClick}
              title="Create an active recall flashcard from this selection"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-indigo-300 hover:bg-zinc-800/60 transition-colors cursor-pointer group"
            >
              <BookOpen size={13} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Flashcard</span>
            </button>

            {/* 🎯 Quiz Button */}
            <button
              type="button"
              onClick={handleQuizClick}
              title="Generate a targeted quiz question from this selection"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-amber-300 hover:bg-zinc-800/60 transition-colors cursor-pointer group"
            >
              <Target size={13} className="text-amber-400 group-hover:rotate-45 transition-transform" />
              <span>Quiz</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default FloatingSelectionToolbar;
