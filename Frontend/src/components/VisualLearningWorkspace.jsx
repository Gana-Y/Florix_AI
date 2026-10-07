import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Network,
  Plus,
  Trash2,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Edit3,
  Layers,
  FileText,
  X,
  Compass,
  Link as LinkIcon,
  ChevronDown,
  Loader2,
  ShieldAlert,
  GraduationCap,
  Maximize2,
  Move,
  Clock,
  Brain,
  GitBranch,
  Columns,
  RefreshCw
} from 'lucide-react';
import api from '../utils/api';
import {
  VISUAL_FORMATS,
  calculateVisualLayout,
  calculateFitToView,
  generateConnectorPath
} from '../utils/visualLayoutEngine';

const VISUAL_TYPES = VISUAL_FORMATS;

const RELATION_TYPES = [
  { id: 'prerequisite', label: 'Prerequisite (Foundation)' },
  { id: 'part_of', label: 'Part Of (Component)' },
  { id: 'contains', label: 'Contains (Encloses)' },
  { id: 'causes', label: 'Causes (Triggers)' },
  { id: 'leads_to', label: 'Leads To (Produces)' },
  { id: 'depends_on', label: 'Depends On (Requires)' },
  { id: 'example_of', label: 'Example Of (Instance)' },
  { id: 'contrasts_with', label: 'Contrasts With (Versus)' },
  { id: 'related_to', label: 'Related To (Associates)' },
  { id: 'sequence', label: 'Sequence (Next Step)' },
];

const NODE_TYPES = [
  { id: 'concept', label: 'Concept', color: '#6366f1' },
  { id: 'definition', label: 'Definition', color: '#06b6d4' },
  { id: 'example', label: 'Example', color: '#10b981' },
  { id: 'question', label: 'Question', color: '#f59e0b' },
  { id: 'process_step', label: 'Process Step', color: '#8b5cf6' },
  { id: 'note', label: 'Note', color: '#64748b' },
];

const VisualLearningWorkspace = ({
  session,
  initialSnippet,
  onClearSnippet,
  isDarkMode = false,
  addToast = () => {}
}) => {
  const sessionId = session?.id;

  // Workspace mode & documents
  const [visualDoc, setVisualDoc] = useState(null);
  const [selectedVisualType, setSelectedVisualType] = useState('concept_map');
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedVisuals, setSavedVisuals] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Edge cases & validation state
  const [inputError, setInputError] = useState(null);
  const [isInputShaking, setIsInputShaking] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const generationTimeoutRef = useRef(null);

  // Canvas container & responsive size
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 750 });

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const nodeDragStartRef = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });
  const touchStartRef = useRef({ touches: [], mode: null, startX: 0, startY: 0, startDist: 0, startZoom: 1, startPanX: 0, startPanY: 0 });

  // History stack for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Modals for adding node & connecting edge
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newNodeType, setNewNodeType] = useState('concept');

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectSource, setConnectSource] = useState('');
  const [connectTarget, setConnectTarget] = useState('');
  const [connectRelation, setConnectRelation] = useState('leads_to');
  const [connectLabel, setConnectLabel] = useState('');

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Extract contextual topic suggestions from current study session
  const documentSuggestions = useMemo(() => {
    const list = [];
    if (session?.ai_title && typeof session.ai_title === 'string' && session.ai_title.trim()) {
      list.push(session.ai_title.trim());
    }
    if (Array.isArray(session?.topics)) {
      session.topics.forEach((t) => {
        const str = typeof t === 'string' ? t.trim() : t?.name || t?.title;
        if (str && str.length >= 2 && str.length < 50 && !list.includes(str)) {
          list.push(str);
        }
      });
    }
    if (Array.isArray(session?.key_points)) {
      session.key_points.forEach((kp) => {
        const text = typeof kp === 'string' ? kp.trim() : kp?.title || kp?.point;
        if (text && text.length >= 2 && text.length < 50 && !list.includes(text)) {
          list.push(text);
        }
      });
    }
    return list.slice(0, 4);
  }, [session]);

  // Push state to undo history
  const pushHistory = (newDoc) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newDoc)));
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setVisualDoc(JSON.parse(JSON.stringify(history[nextIndex])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setVisualDoc(JSON.parse(JSON.stringify(history[nextIndex])));
    }
  };

  // 1. Fetch saved visuals on mount
  const fetchSavedVisuals = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/study/${sessionId}/visuals`);
      if (Array.isArray(res.data)) {
        setSavedVisuals(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch saved visuals:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSavedVisuals();
  }, [fetchSavedVisuals]);

  // Cleanup timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    };
  }, []);

  // 2. Handle initial snippet from highlight toolbar
  useEffect(() => {
    if (initialSnippet && sessionId) {
      handleGenerateVisual({ snippet: initialSnippet });
      onClearSnippet?.();
    }
  }, [initialSnippet, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel active AI generation
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
    setIsGenerating(false);
    setGenerationStatus('');
    addToast('Generation cancelled.', 'info');
  };

  // Trigger input shake animation and focus
  const triggerInputShake = (errorMsg) => {
    setInputError(errorMsg);
    setIsInputShaking(true);
    setTimeout(() => setIsInputShaking(false), 500);
    inputRef.current?.focus();
  };

  // 3. Generate Visual with AI (Edge-case hardened)
  const handleGenerateVisual = async (params = {}) => {
    if (isGenerating) return;

    if (!sessionId) {
      addToast('No active study session loaded. Please select a document from your library.', 'error');
      return;
    }

    const explicitTopic = params.topic !== undefined ? params.topic : customTopic.trim();
    const hasSnippet = Boolean(params.snippet && params.snippet.trim());
    const isWholeDocument = Boolean(params.wholeDocument);
    const targetType = params.visualType || selectedVisualType;

    // Edge Case 1: Empty input with no snippet or whole-document intent
    if (!explicitTopic && !hasSnippet && !isWholeDocument) {
      triggerInputShake('Please enter a topic to visualize, or choose a suggested topic below.');
      return;
    }

    // Edge Case 2: Too short topic (< 2 characters)
    if (explicitTopic && explicitTopic.length < 2 && !hasSnippet) {
      triggerInputShake('Topic must be at least 2 characters long.');
      return;
    }

    // Edge Case 3: Too long topic (> 120 characters)
    if (explicitTopic && explicitTopic.length > 120) {
      triggerInputShake('Topic is too long (max 120 characters). Please provide a concise concept.');
      return;
    }

    setInputError(null);
    setIsGenerating(true);
    setGenerationStatus(
      isWholeDocument
        ? 'Mapping full document overview & core architecture...'
        : `Analyzing source evidence & generating map for "${explicitTopic || 'Selected Snippet'}"...`
    );

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timeout safety net: automatically cancel after 80s
    generationTimeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsGenerating(false);
        setGenerationStatus('');
        addToast('Visual generation timed out after 80s. You can try a narrower topic or build manually.', 'error');
      }
    }, 80000);

    try {
      const payload = {
        snippet: params.snippet || null,
        topic: isWholeDocument ? null : (explicitTopic || null),
        visual_type: targetType,
        include_mastery: true
      };

      const res = await api.post(`/study/${sessionId}/visualize`, payload, {
        signal: controller.signal
      });

      const rawGenerated = res.data;
      const actualType = rawGenerated.visual_type || targetType;
      setSelectedVisualType(actualType);

      // Apply client layout engine
      const layoutResult = calculateVisualLayout(rawGenerated.nodes, rawGenerated.edges, actualType);
      const generated = {
        ...rawGenerated,
        visual_type: actualType,
        nodes: layoutResult.nodes,
        edges: layoutResult.edges,
        meta: layoutResult.meta
      };

      setVisualDoc(generated);
      setSelectedNode(null);
      setHistory([JSON.parse(JSON.stringify(generated))]);
      setHistoryIndex(0);

      // Auto-fit to view
      const fit = calculateFitToView(layoutResult.nodes, containerSize.width, containerSize.height);
      setPan(fit.pan);
      setZoom(fit.zoom);

      addToast(`Grounded ${actualType.replace('_', ' ')} generated!`, 'success');
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      const msg = err.response?.data?.detail || 'Failed to generate visual. Please try a different topic.';
      addToast(msg, 'error');
    } finally {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  // 4. Dynamic Visual Format Switcher (Napkin AI Style instant re-layout)
  const handleFormatChange = (newType) => {
    setSelectedVisualType(newType);
    if (!visualDoc || !visualDoc.nodes?.length) return;

    const layoutResult = calculateVisualLayout(visualDoc.nodes, visualDoc.edges, newType);
    const updatedDoc = {
      ...visualDoc,
      visual_type: newType,
      nodes: layoutResult.nodes,
      edges: layoutResult.edges,
      meta: layoutResult.meta,
      is_modified: true
    };

    setVisualDoc(updatedDoc);
    pushHistory(updatedDoc);

    // Auto-fit canvas to newly arranged layout
    const fit = calculateFitToView(layoutResult.nodes, containerSize.width, containerSize.height);
    setPan(fit.pan);
    setZoom(fit.zoom);

    const formatInfo = VISUAL_FORMATS.find((f) => f.id === newType);
    addToast(`Switched layout to ${formatInfo?.label || newType}`, 'info');
  };

  // 5. Fit to View Action (Centers and scales entire diagram)
  const handleFitToView = () => {
    if (!visualDoc || !visualDoc.nodes?.length) return;
    const fit = calculateFitToView(visualDoc.nodes, containerSize.width, containerSize.height);
    setPan(fit.pan);
    setZoom(fit.zoom);
    addToast('Canvas centered & fit to screen', 'info');
  };

  // 6. Save current visual artifact
  const handleSaveVisual = async () => {
    if (!visualDoc || !sessionId) return;
    setIsSaving(true);
    try {
      const payload = {
        title: visualDoc.title || 'Academic Concept Map',
        visual_type: visualDoc.visual_type || 'concept_map',
        visual_data: visualDoc,
        is_manual: editMode
      };
      const res = await api.post(`/study/${sessionId}/visuals`, payload);
      addToast('Visual learning artifact saved to your library!', 'success');
      fetchSavedVisuals();
      if (res.data?.id) {
        setVisualDoc((prev) => ({ ...prev, visual_id: res.data.id }));
      }
    } catch {
      addToast('Failed to save visual artifact.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 7. Load a saved visual
  const handleLoadSavedVisual = (item) => {
    if (item.visual_data) {
      const vData = item.visual_data;
      const vType = vData.visual_type || selectedVisualType;
      setSelectedVisualType(vType);

      // Re-layout loaded nodes if needed
      const layoutResult = calculateVisualLayout(vData.nodes, vData.edges, vType);
      const loadedDoc = {
        ...vData,
        nodes: layoutResult.nodes,
        meta: layoutResult.meta
      };

      setVisualDoc(loadedDoc);
      setSelectedNode(null);
      setHistory([JSON.parse(JSON.stringify(loadedDoc))]);
      setHistoryIndex(0);

      const fit = calculateFitToView(layoutResult.nodes, containerSize.width, containerSize.height);
      setPan(fit.pan);
      setZoom(fit.zoom);
      addToast(`Loaded "${item.title}"`, 'info');
    }
  };

  // 8. Delete a saved visual
  const handleDeleteSavedVisual = async (e, visualId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved visual artifact?')) return;
    try {
      await api.delete(`/study/${sessionId}/visuals/${visualId}`);
      addToast('Visual artifact deleted', 'info');
      fetchSavedVisuals();
      if (visualDoc?.visual_id === visualId) {
        setVisualDoc(null);
      }
    } catch {
      addToast('Failed to delete visual artifact', 'error');
    }
  };

  // 9. Manual Editing: Add Node
  const handleAddNode = () => {
    if (!newNodeLabel.trim() || !visualDoc) return;
    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      label: newNodeLabel.trim(),
      type: newNodeType,
      description: newNodeDesc.trim() || null,
      source_chunk_ids: [],
      citations: [],
      confidence: 1.0,
      mastery_status: 'untested',
      weak_subtopics: [],
      x: 600 + (Math.random() * 80 - 40),
      y: 400 + (Math.random() * 80 - 40)
    };

    const nextDoc = {
      ...visualDoc,
      nodes: [...visualDoc.nodes, newNode],
      is_modified: true
    };
    setVisualDoc(nextDoc);
    pushHistory(nextDoc);
    setShowAddNodeModal(false);
    setNewNodeLabel('');
    setNewNodeDesc('');
    addToast('Concept node added', 'success');
  };

  // 10. Manual Editing: Connect Nodes
  const handleConnectNodes = () => {
    if (!connectSource || !connectTarget || connectSource === connectTarget || !visualDoc) return;
    const newEdgeId = `edge_${connectSource}_${connectTarget}_${Date.now()}`;
    const isPrereq = connectRelation === 'prerequisite' || connectRelation === 'depends_on';

    const newEdge = {
      id: newEdgeId,
      source: connectSource,
      target: connectTarget,
      relation_type: connectRelation,
      label: connectLabel.trim() || null,
      confidence: 1.0,
      is_prerequisite: isPrereq,
      has_foundation_alert: false,
      source_chunk_ids: []
    };

    const nextDoc = {
      ...visualDoc,
      edges: [...visualDoc.edges, newEdge],
      is_modified: true
    };
    setVisualDoc(nextDoc);
    pushHistory(nextDoc);
    setShowConnectModal(false);
    setConnectLabel('');
    addToast('Relationship link created', 'success');
  };

  // 11. Manual Editing: Delete Selected Node
  const handleDeleteNode = (nodeId) => {
    if (!visualDoc) return;
    const nextDoc = {
      ...visualDoc,
      nodes: visualDoc.nodes.filter((n) => n.id !== nodeId),
      edges: visualDoc.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      is_modified: true
    };
    setVisualDoc(nextDoc);
    pushHistory(nextDoc);
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
    addToast('Node and connected links removed', 'info');
  };

  // ── 12. CANVAS DRAG & PAN IN ALL DIRECTIONS ──
  const handleCanvasMouseDown = (e) => {
    // If click is on a node or interactive button/menu, do not initiate canvas panning
    if (e.target.closest('[data-node-id]') || e.target.closest('button') || e.target.closest('select')) {
      return;
    }

    if (e.button === 0 || e.button === 1) { // Left click or Middle click
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      };
      // Deselect selected node on background click
      setSelectedNode(null);
    }
  };

  // Global mousemove and mouseup listeners to keep drag silky smooth even outside window
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy
        });
      } else if (draggingNodeId) {
        const dx = (e.clientX - nodeDragStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - nodeDragStartRef.current.mouseY) / zoom;
        setVisualDoc((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === draggingNodeId
                ? {
                    ...n,
                    x: Math.round(nodeDragStartRef.current.nodeX + dx),
                    y: Math.round(nodeDragStartRef.current.nodeY + dy)
                  }
                : n
            )
          };
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }
      if (draggingNodeId) {
        setDraggingNodeId(null);
        if (visualDoc) pushHistory(visualDoc);
      }
    };

    if (isPanning || draggingNodeId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isPanning, draggingNodeId, zoom, visualDoc]);

  // Start node dragging
  const handleStartNodeDrag = (e, node) => {
    e.stopPropagation();
    setSelectedNode(node);
    setDraggingNodeId(node.id);
    nodeDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y
    };
  };

  // ── 13. MOUSE ROLLER / WHEEL ZOOM (Centered at cursor) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Trackpad 2-finger pan (without ctrlKey pinch)
      if (!e.ctrlKey && (Math.abs(e.deltaX) > 0 || (e.shiftKey && Math.abs(e.deltaY) > 0))) {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
        return;
      }

      // Mouse roller zoom (or trackpad pinch zoom)
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((prevZoom) => {
        const nextZoom = Math.max(0.2, Math.min(3.5, prevZoom * zoomFactor));
        // Keep point under cursor invariant
        setPan((prevPan) => {
          const graphX = (mouseX - prevPan.x) / prevZoom;
          const graphY = (mouseY - prevPan.y) / prevZoom;
          return {
            x: mouseX - graphX * nextZoom,
            y: mouseY - graphY * nextZoom
          };
        });
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // ── 14. TOUCH & SWIPE GESTURES (Single-finger pan, two-finger pinch zoom) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          mode: 'pan',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startPanX: pan.x,
          startPanY: pan.y
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartRef.current = {
          mode: 'pinch',
          startDist: Math.sqrt(dx * dx + dy * dy),
          startZoom: zoom
        };
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && touchStartRef.current.mode === 'pan') {
        const dx = e.touches[0].clientX - touchStartRef.current.startX;
        const dy = e.touches[0].clientY - touchStartRef.current.startY;
        setPan({
          x: touchStartRef.current.startPanX + dx,
          y: touchStartRef.current.startPanY + dy
        });
      } else if (e.touches.length === 2 && touchStartRef.current.mode === 'pinch') {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / (touchStartRef.current.startDist || 1);
        setZoom(Math.max(0.2, Math.min(3.5, touchStartRef.current.startZoom * scale)));
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [pan, zoom]);

  // Helper for Mastery Badge Color
  const getMasteryBadge = (status, score) => {
    switch (status) {
      case 'mastered':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          label: `Mastered (${Math.round((score || 0.9) * 100)}%)`,
          icon: CheckCircle2
        };
      case 'learning':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
          label: `Learning (${Math.round((score || 0.7) * 100)}%)`,
          icon: GraduationCap
        };
      case 'review_needed':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
          label: `Review Needed (${Math.round((score || 0.5) * 100)}%)`,
          icon: AlertTriangle
        };
      case 'struggling':
        return {
          bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
          label: `Struggling (${Math.round((score || 0.3) * 100)}%)`,
          icon: ShieldAlert
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700',
          label: 'Untested Concept',
          icon: Compass
        };
    }
  };

  const activeFormatInfo = VISUAL_FORMATS.find((f) => f.id === selectedVisualType) || VISUAL_FORMATS[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden select-none">
      {/* ── TOP ACTION HEADER ── */}
      <div className="h-14 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Network size={16} />
          </div>
          <div className="truncate">
            <h2 className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate flex items-center gap-1.5">
              <span>{visualDoc?.title || 'Visual Learning & Concept Mapping'}</span>
              {visualDoc?.is_modified && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/30">
                  Edited
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
              {visualDoc
                ? `${visualDoc.nodes.length} concepts • ${visualDoc.edges.length} relationships • ${activeFormatInfo.label}`
                : 'Napkin AI-inspired conceptual visual transformation'}
            </p>
          </div>
        </div>

        {/* Visual Format Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Format Selector Dropdown (Napkin AI Pattern Switcher) */}
          <div className="relative flex items-center gap-1.5">
            <div className="relative">
              <select
                value={selectedVisualType}
                onChange={(e) => handleFormatChange(e.target.value)}
                className="bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-800 dark:text-zinc-100 text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer transition-colors shadow-sm"
                title="Switch layout style or pattern"
              >
                {VISUAL_FORMATS.map((vt) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* AI Re-Structure in this pattern button */}
            {visualDoc && (
              <button
                onClick={() => handleGenerateVisual({ visualType: selectedVisualType, wholeDocument: !customTopic })}
                disabled={isGenerating}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition-all cursor-pointer"
                title="Use AI to re-synthesize concepts specifically for this visual pattern"
              >
                <Sparkles size={12} />
                <span>AI Restructure</span>
              </button>
            )}
          </div>

          {/* New Map / Reset Button */}
          {visualDoc && (
            <button
              onClick={() => {
                setVisualDoc(null);
                setEditMode(false);
                setSelectedNode(null);
                setCustomTopic('');
                setInputError(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-sm"
              title="Create a new visual map or change topic"
            >
              <Plus size={13} />
              <span>New Map</span>
            </button>
          )}

          {/* Edit Mode Toggle */}
          {visualDoc && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
                editMode
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
              }`}
            >
              <Edit3 size={13} />
              <span>{editMode ? 'Editing' : 'Edit'}</span>
            </button>
          )}

          {/* Save Button */}
          {visualDoc && (
            <button
              onClick={handleSaveVisual}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-sm shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save</span>
            </button>
          )}

          {/* Saved Visuals Drawer Trigger */}
          {savedVisuals.length > 0 && (
            <div className="relative group">
              <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                <Layers size={13} className="text-indigo-500" />
                <span>Saved ({savedVisuals.length})</span>
                <ChevronDown size={11} />
              </button>
              <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 hidden group-hover:block z-50">
                <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">
                  Saved Visual Artifacts
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {savedVisuals.map((sv) => (
                    <div
                      key={sv.id}
                      onClick={() => handleLoadSavedVisual(sv)}
                      className="flex items-center justify-between p-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer group/item transition-colors"
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{sv.title}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{sv.visual_type} • v{sv.version}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSavedVisual(e, sv.id)}
                        className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-rose-500 text-slate-400 transition-opacity"
                        title="Delete saved visual"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN WORKSPACE BODY ── */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* If no visual doc loaded: Empty / Prompt state */}
        {!visualDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10 mb-5">
              <Network size={32} />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              Transform Coursework into Grounded Visual Maps
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
              Generate grounded conceptual networks, timelines, flowcharts, or mind maps with topic mastery telemetry and prerequisite foundation alerts.
            </p>

            {/* Quick Generator Input Card */}
            <motion.div
              animate={{ x: isInputShaking ? [-8, 8, -6, 6, -3, 3, 0] : 0 }}
              transition={{ duration: 0.4 }}
              className={`w-full bg-white dark:bg-zinc-900 border rounded-3xl p-4 shadow-xl flex flex-col gap-3 transition-colors ${
                inputError
                  ? 'border-rose-400 dark:border-rose-500/60 ring-2 ring-rose-400/20'
                  : 'border-slate-200 dark:border-zinc-800 focus-within:border-indigo-500/50'
              }`}
            >
              <div className="flex items-center gap-2 relative">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={customTopic}
                    maxLength={120}
                    disabled={isGenerating}
                    onChange={(e) => {
                      setCustomTopic(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!isGenerating) handleGenerateVisual();
                      }
                      if (e.key === 'Escape') {
                        setInputError(null);
                      }
                    }}
                    placeholder="Enter a topic (e.g. Binary Search, Mitosis, ACID Properties, Transformers)..."
                    className={`w-full bg-slate-50 dark:bg-zinc-800/70 text-slate-800 dark:text-zinc-100 text-xs font-medium px-4 py-2.5 pr-8 rounded-2xl border transition-all focus:outline-none focus:ring-2 ${
                      inputError
                        ? 'border-rose-300 dark:border-rose-700/80 focus:ring-rose-500/50'
                        : 'border-slate-200 dark:border-zinc-700/80 focus:ring-indigo-500'
                    }`}
                  />
                  {customTopic && !isGenerating && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTopic('');
                        setInputError(null);
                        inputRef.current?.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 rounded-full"
                      title="Clear topic"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {isGenerating ? (
                  <button
                    onClick={handleCancelGeneration}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 text-xs font-bold transition-all cursor-pointer"
                    title="Cancel generation"
                  >
                    <X size={13} />
                    <span>Cancel</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleGenerateVisual()}
                    disabled={isGenerating}
                    type="button"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={14} />
                    <span>Generate</span>
                  </button>
                )}
              </div>

              {/* Live Character Limit indicator */}
              {customTopic.length > 70 && !isGenerating && (
                <div className="flex justify-end px-2 -mt-1 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                  {customTopic.length}/120
                </div>
              )}

              {/* Validation Warning Alert */}
              {inputError && (
                <div className="flex items-center gap-1.5 px-2 text-rose-500 dark:text-rose-400 text-[11px] font-medium animate-fadeIn">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{inputError}</span>
                </div>
              )}

              {/* In-Flight Status Indicator */}
              {isGenerating && generationStatus && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  <Loader2 size={13} className="animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">{generationStatus}</span>
                </div>
              )}

              {/* Format selection pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {VISUAL_FORMATS.slice(0, 5).map((vt) => (
                  <button
                    key={vt.id}
                    disabled={isGenerating}
                    onClick={() => setSelectedVisualType(vt.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all ${
                      selectedVisualType === vt.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>

              {/* Contextual Topic Suggestions from Study Material */}
              {documentSuggestions.length > 0 && !isGenerating && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col items-start gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Suggested from this material:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {documentSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomTopic(sug);
                          setInputError(null);
                        }}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/50 text-slate-600 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-zinc-700/60 transition-colors flex items-center gap-1"
                        title={`Use "${sug}"`}
                      >
                        <span>💡 {sug}</span>
                      </button>
                    ))}
                    {/* Explicit Full Document Map Button */}
                    <button
                      type="button"
                      onClick={() => handleGenerateVisual({ wholeDocument: true })}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 transition-colors flex items-center gap-1"
                      title="Generate complete document architecture overview"
                    >
                      <Sparkles size={11} />
                      <span>Map Full Document</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Quick Action: Start Manual Map */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs text-slate-400">or</span>
              <button
                onClick={() => {
                  const emptyDoc = {
                    visual_id: `vis_${Date.now()}`,
                    title: 'New Concept Map',
                    visual_type: 'concept_map',
                    nodes: [
                      {
                        id: 'node_1',
                        label: 'Core Concept',
                        type: 'concept',
                        description: 'Root topic of your concept map.',
                        source_chunk_ids: [],
                        citations: [],
                        confidence: 1.0,
                        mastery_status: 'untested',
                        weak_subtopics: [],
                        x: 600,
                        y: 400
                      }
                    ],
                    edges: [],
                    source_session_id: sessionId || 0,
                    is_manual: true,
                    is_modified: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    version: 1,
                    suggested_topics: []
                  };
                  setVisualDoc(emptyDoc);
                  setEditMode(true);
                  setHistory([emptyDoc]);
                  setHistoryIndex(0);
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Build Manually from Scratch</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── INTERACTIVE CANVAS VIEW (Figma / Napkin AI Pan & Zoom Engine) ── */
          <div
            ref={containerRef}
            className={`flex-1 relative overflow-hidden bg-slate-100/70 dark:bg-zinc-950 select-none ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onMouseDown={handleCanvasMouseDown}
          >
            {/* SVG Render Canvas */}
            <svg
              ref={svgRef}
              id="canvas-svg"
              className="w-full h-full block"
              viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
            >
              <defs>
                {/* Standard Arrow Marker */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill={isDarkMode ? '#818cf8' : '#6366f1'} />
                </marker>

                {/* Prerequisite Arrow Marker */}
                <marker
                  id="arrow-prereq"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
                </marker>

                {/* Canvas grid pattern */}
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.2" fill={isDarkMode ? '#27272a' : '#cbd5e1'} />
                </pattern>
              </defs>

              {/* Background grid canvas (always spans viewport) */}
              <rect x="0" y="0" width={containerSize.width} height={containerSize.height} fill="url(#grid)" />

              {/* ── ROOT TRANSFORM GROUP (All nodes, edges & visual features) ── */}
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                style={{
                  transition: isPanning || draggingNodeId ? 'none' : 'transform 0.05s ease-out'
                }}
              >
                {/* ── TIMELINE PATTERN: Central Glowing Horizontal Spine ── */}
                {selectedVisualType === 'timeline' && visualDoc.meta?.timelineSpine && (
                  <g className="timeline-feature animate-fadeIn">
                    {/* Spine background track */}
                    <line
                      x1={visualDoc.meta.timelineSpine.startX}
                      y1={visualDoc.meta.timelineSpine.y}
                      x2={visualDoc.meta.timelineSpine.endX}
                      y2={visualDoc.meta.timelineSpine.y}
                      stroke={isDarkMode ? '#312e81' : '#e0e7ff'}
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    {/* Spine active core line */}
                    <line
                      x1={visualDoc.meta.timelineSpine.startX}
                      y1={visualDoc.meta.timelineSpine.y}
                      x2={visualDoc.meta.timelineSpine.endX}
                      y2={visualDoc.meta.timelineSpine.y}
                      stroke="#6366f1"
                      strokeWidth="3"
                      strokeDasharray="6,4"
                    />
                  </g>
                )}

                {/* ── CYCLE PATTERN: Dashed Guide Ring ── */}
                {selectedVisualType === 'cycle' && visualDoc.meta?.cycleCenter && (
                  <g className="cycle-feature">
                    <circle
                      cx={visualDoc.meta.cycleCenter.x}
                      cy={visualDoc.meta.cycleCenter.y}
                      r={visualDoc.meta.cycleCenter.radius}
                      fill="none"
                      stroke={isDarkMode ? '#4338ca' : '#c7d2fe'}
                      strokeWidth="2.5"
                      strokeDasharray="6,6"
                      opacity="0.8"
                    />
                  </g>
                )}

                {/* ── COMPARISON PATTERN: Column Header Badges ── */}
                {selectedVisualType === 'comparison' && visualDoc.meta?.comparisonHeaders && (
                  <g className="comparison-headers">
                    {visualDoc.meta.comparisonHeaders.map((hdr, i) => (
                      <g key={i} transform={`translate(${hdr.x}, ${hdr.y})`}>
                        <rect
                          x="-100"
                          y="-16"
                          width="200"
                          height="32"
                          rx="16"
                          fill={i === 0 ? (isDarkMode ? '#1e1b4b' : '#eef2ff') : (isDarkMode ? '#064e3b' : '#ecfdf5')}
                          stroke={i === 0 ? '#6366f1' : '#10b981'}
                          strokeWidth="1.5"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={i === 0 ? (isDarkMode ? '#c7d2fe' : '#4f46e5') : (isDarkMode ? '#a7f3d0' : '#059669')}
                          fontSize="11"
                          fontWeight="700"
                        >
                          {hdr.label}
                        </text>
                      </g>
                    ))}
                  </g>
                )}

                {/* ── 1. EDGES / CONNECTORS (Adaptive to pattern type) ── */}
                {visualDoc.edges.map((edge) => {
                  const src = visualDoc.nodes.find((n) => n.id === edge.source);
                  const tgt = visualDoc.nodes.find((n) => n.id === edge.target);
                  if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return null;

                  const isPrereq = edge.is_prerequisite;
                  const isAlert = edge.has_foundation_alert;

                  const midX = (src.x + tgt.x) / 2;
                  const midY = (src.y + tgt.y) / 2;

                  const strokeColor = isAlert ? '#f43f5e' : isPrereq ? '#e11d48' : isDarkMode ? '#6366f1' : '#818cf8';
                  const strokeWidth = isAlert ? 2.5 : isPrereq ? 2.0 : 1.7;

                  // Generate smart path depending on pattern (Mind map curve, Flowchart curve, or straight)
                  const pathData = generateConnectorPath(src, tgt, selectedVisualType);

                  return (
                    <g key={edge.id} className="group/edge">
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={isAlert ? '6,4' : isPrereq ? '4,4' : 'none'}
                        markerEnd={isPrereq ? 'url(#arrow-prereq)' : 'url(#arrow)'}
                        className={isAlert ? 'animate-pulse' : ''}
                      />

                      {/* Edge Label Pill */}
                      {edge.label && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x={-(edge.label.length * 3.6 + 8)}
                            y="-9"
                            width={edge.label.length * 7.2 + 16}
                            height="18"
                            rx="9"
                            fill={isDarkMode ? '#18181b' : '#ffffff'}
                            stroke={isAlert ? '#f43f5e' : isDarkMode ? '#3f3f46' : '#e2e8f0'}
                            strokeWidth="1"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={isAlert ? '#f43f5e' : isDarkMode ? '#a1a1aa' : '#64748b'}
                            fontSize="9"
                            fontWeight="600"
                          >
                            {edge.label}
                          </text>
                        </g>
                      )}

                      {/* Foundation Alert Warning Icon Pill */}
                      {isAlert && (
                        <g transform={`translate(${midX}, ${midY - 14})`}>
                          <circle r="8" fill="#f43f5e" />
                          <text textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="9" fontWeight="bold">
                            !
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* ── 2. TIMELINE STEMS & MILESTONE DOTS ── */}
                {selectedVisualType === 'timeline' &&
                  visualDoc.nodes.map((node) => {
                    if (node.x == null || node.y == null || node.timelineStemY == null) return null;
                    const stemStartY = node.y > node.timelineStemY ? node.y - 32 : node.y + 32;
                    return (
                      <g key={`timeline_stem_${node.id}`} className="timeline-stem">
                        {/* Connecting stem line */}
                        <line
                          x1={node.x}
                          y1={stemStartY}
                          x2={node.x}
                          y2={node.timelineStemY}
                          stroke="#6366f1"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                        />
                        {/* Milestone dot on spine */}
                        <circle
                          cx={node.x}
                          cy={node.timelineStemY}
                          r="12"
                          fill={isDarkMode ? '#1e1b4b' : '#eef2ff'}
                          stroke="#6366f1"
                          strokeWidth="2.5"
                        />
                        <text
                          x={node.x}
                          y={node.timelineStemY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#6366f1"
                          fontSize="9"
                          fontWeight="800"
                        >
                          {node.timelineStepNum < 10 ? `0${node.timelineStepNum}` : node.timelineStepNum}
                        </text>
                      </g>
                    );
                  })}

                {/* ── 3. NODES (Cards with tactile hover and selection) ── */}
                {visualDoc.nodes.map((node) => {
                  if (node.x == null || node.y == null) return null;
                  const isSelected = selectedNode?.id === node.id;
                  const typeInfo = NODE_TYPES.find((t) => t.id === node.type) || NODE_TYPES[0];
                  const isDragging = draggingNodeId === node.id;

                  return (
                    <g
                      key={node.id}
                      data-node-id={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onMouseDown={(e) => handleStartNodeDrag(e, node)}
                      className={`cursor-pointer group/node ${isDragging ? 'opacity-90' : ''}`}
                    >
                      {/* Selected glow */}
                      {isSelected && (
                        <rect
                          x="-74"
                          y="-34"
                          width="148"
                          height="68"
                          rx="16"
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="3"
                          strokeDasharray="4,4"
                          className="animate-spin"
                          style={{ transformOrigin: '0 0' }}
                        />
                      )}

                      {/* Node Card Background */}
                      <rect
                        x="-70"
                        y="-30"
                        width="140"
                        height="60"
                        rx="14"
                        fill={isDarkMode ? '#18181b' : '#ffffff'}
                        stroke={
                          isSelected
                            ? '#6366f1'
                            : node.mastery_status === 'struggling'
                            ? '#f43f5e'
                            : node.mastery_status === 'mastered'
                            ? '#10b981'
                            : isDarkMode
                            ? '#27272a'
                            : '#e2e8f0'
                        }
                        strokeWidth={isSelected ? '2' : '1.5'}
                        filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
                        className="transition-all"
                      />

                      {/* Node Type Top Indicator Bar */}
                      <rect
                        x="-70"
                        y="-30"
                        width="140"
                        height="5"
                        rx="2"
                        fill={typeInfo.color}
                      />

                      {/* Process Step Badge (if process pattern) */}
                      {selectedVisualType === 'process' && node.processStep && (
                        <g transform="translate(-62, -22)">
                          <rect x="0" y="0" width="22" height="13" rx="6" fill="#6366f1" />
                          <text x="11" y="7" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="8" fontWeight="800">
                            {node.processStep < 10 ? `0${node.processStep}` : node.processStep}
                          </text>
                        </g>
                      )}

                      {/* Node Label (Centered, truncated) */}
                      <text
                        x="0"
                        y="-6"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isDarkMode ? '#f4f4f5' : '#0f172a'}
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="Inter, sans-serif"
                      >
                        {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                      </text>

                      {/* Node Type / Citations Pill */}
                      <text
                        x="0"
                        y="14"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isDarkMode ? '#a1a1aa' : '#64748b'}
                        fontSize="9"
                        fontWeight="500"
                      >
                        {node.citations?.length > 0 ? `📑 [${node.citations.length} sources]` : typeInfo.label}
                      </text>

                      {/* Mastery Status Circle Indicator at Top Right */}
                      {node.mastery_status && node.mastery_status !== 'untested' && (
                        <circle
                          cx="60"
                          cy="-22"
                          r="4"
                          fill={
                            node.mastery_status === 'mastered'
                              ? '#10b981'
                              : node.mastery_status === 'learning'
                              ? '#3b82f6'
                              : node.mastery_status === 'review_needed'
                              ? '#f59e0b'
                              : '#f43f5e'
                          }
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Canvas Floating Controls (Bottom Left Toolbar) */}
            <div className="absolute bottom-5 left-5 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl z-10">
              {/* Zoom In */}
              <button
                onClick={() => setZoom((z) => Math.min(3.5, Number((z * 1.2).toFixed(2))))}
                title="Zoom In (or roll mouse wheel up)"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <ZoomIn size={15} />
              </button>

              {/* Zoom Out */}
              <button
                onClick={() => setZoom((z) => Math.max(0.2, Number((z / 1.2).toFixed(2))))}
                title="Zoom Out (or roll mouse wheel down)"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <ZoomOut size={15} />
              </button>

              {/* Zoom percentage pill (click to reset to 100%) */}
              <button
                onClick={() => setZoom(1)}
                title="Click to reset zoom to 100%"
                className="px-2 h-7 flex items-center justify-center rounded-lg text-[11px] font-mono font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>

              <div className="w-[1px] h-4 bg-slate-200 dark:bg-zinc-800 mx-0.5" />

              {/* Fit to View */}
              <button
                onClick={handleFitToView}
                title="Fit diagram to screen"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Maximize2 size={14} />
              </button>

              {/* Reset View */}
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                title="Reset View"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>

              <div className="w-[1px] h-4 bg-slate-200 dark:bg-zinc-800 mx-0.5" />

              {/* Undo */}
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Undo2 size={14} />
              </button>

              {/* Redo */}
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Redo2 size={14} />
              </button>
            </div>

            {/* Quick Floating Hint Pill */}
            <div className="absolute top-4 left-4 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/60 dark:border-zinc-800/60 text-[10px] text-slate-500 dark:text-zinc-400 pointer-events-none shadow-sm">
              <Move size={11} className="text-indigo-500" />
              <span>Drag canvas in any direction • Scroll wheel to zoom</span>
            </div>

            {/* Edit Mode Quick Tools (Bottom Right) */}
            {editMode && (
              <div className="absolute bottom-5 right-5 flex items-center gap-2 p-1.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 shadow-xl z-10">
                <button
                  onClick={() => setShowAddNodeModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Concept</span>
                </button>
                <button
                  onClick={() => setShowConnectModal(true)}
                  disabled={visualDoc.nodes.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold border border-slate-200 dark:border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <LinkIcon size={14} />
                  <span>Connect</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── NODE INSPECTOR & CITATIONS SIDE DRAWER ── */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-zinc-800 shadow-2xl p-5 flex flex-col justify-between shrink-0 z-30 overflow-y-auto"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                      {selectedNode.type}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                      {selectedNode.label}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Explanation */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Academic Explanation
                  </label>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-zinc-700/60">
                    {selectedNode.description || 'No direct description provided for this concept.'}
                  </p>
                </div>

                {/* Learner Topic Mastery */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <GraduationCap size={12} className="text-indigo-500" />
                    <span>Your Mastery Telemetry</span>
                  </label>
                  {(() => {
                    const badge = getMasteryBadge(selectedNode.mastery_status, selectedNode.mastery_score);
                    const Icon = badge.icon;
                    return (
                      <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${badge.bg}`}>
                        <Icon size={16} className="shrink-0" />
                        <div>
                          <p>{badge.label}</p>
                          {selectedNode.weak_subtopics?.length > 0 && (
                            <p className="text-[10px] font-normal opacity-80 mt-0.5">
                              Weak areas: {selectedNode.weak_subtopics.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Interactive Citations */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <BookOpen size={12} className="text-emerald-500" />
                    <span>Source Evidence ({selectedNode.citations?.length || 0})</span>
                  </label>
                  {selectedNode.citations && selectedNode.citations.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedNode.citations.map((cite, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                            <span>{cite.page_number ? `Page ${cite.page_number}` : cite.section_heading || 'Course Section'}</span>
                            <span className="font-mono text-[9px] opacity-75">{cite.chunk_id}</span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-zinc-300 italic line-clamp-3">
                            "{cite.snippet}..."
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No direct citations recorded.</p>
                  )}
                </div>
              </div>

              {/* Delete Node action if in edit mode */}
              {editMode && (
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 mt-4">
                  <button
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete Concept</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODAL: ADD CONCEPT NODE ── */}
      {showAddNodeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Add Concept Node</h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Concept Label</label>
                <input
                  type="text"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  placeholder="e.g. QuickSort Algorithm"
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Node Type</label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700"
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Explanation</label>
                <textarea
                  rows="2"
                  value={newNodeDesc}
                  onChange={(e) => setNewNodeDesc(e.target.value)}
                  placeholder="Brief academic definition or summary..."
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddNodeModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNode}
                disabled={!newNodeLabel.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
              >
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONNECT NODES ── */}
      {showConnectModal && visualDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Connect Concept Nodes</h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Source Concept</label>
                <select
                  value={connectSource}
                  onChange={(e) => setConnectSource(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700"
                >
                  <option value="">Select source...</option>
                  {visualDoc.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Target Concept</label>
                <select
                  value={connectTarget}
                  onChange={(e) => setConnectTarget(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700"
                >
                  <option value="">Select target...</option>
                  {visualDoc.nodes.map((n) => (
                    <option key={n.id} value={n.id} disabled={n.id === connectSource}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Relationship Type</label>
                <select
                  value={connectRelation}
                  onChange={(e) => setConnectRelation(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700"
                >
                  {RELATION_TYPES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Link Label (Optional)</label>
                <input
                  type="text"
                  value={connectLabel}
                  onChange={(e) => setConnectLabel(e.target.value)}
                  placeholder="e.g. requires, develops into..."
                  className="w-full mt-1 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectNodes}
                disabled={!connectSource || !connectTarget || connectSource === connectTarget}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLearningWorkspace;
