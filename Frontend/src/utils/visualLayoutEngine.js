/**
 * Florix AI — Visual Learning Layout Engine
 * Inspired by Napkin AI architecture: converts structured academic concepts into
 * interactive, auto-arranged visual formats (Timeline, Mind Map, Flowchart,
 * Concept Map, Hierarchy, Comparison, Process, Cycle).
 */

export const VISUAL_FORMATS = [
  { id: 'timeline', label: '⏳ Timeline', desc: 'Chronological progression with milestone spine', icon: 'Clock' },
  { id: 'mind_map', label: '🧠 Mind Map', desc: 'Dual-wing radiating organic concept tree', icon: 'Brain' },
  { id: 'flowchart', label: '🔀 Flowchart', desc: 'Top-down algorithmic decision and sequence graph', icon: 'GitBranch' },
  { id: 'concept_map', label: '🕸️ Concept Map', desc: 'Cross-linked semantic knowledge network', icon: 'Network' },
  { id: 'process', label: '➡️ Process', desc: 'Step-by-step sequential linear workflow', icon: 'ArrowRight' },
  { id: 'hierarchy', label: '🌳 Hierarchy', desc: 'Structured classification pyramid tree', icon: 'GitMerge' },
  { id: 'comparison', label: '⚖️ Comparison', desc: 'Side-by-side comparative column matrix', icon: 'Columns' },
  { id: 'cycle', label: '🔄 Cycle Loop', desc: 'Circular closed feedback loop system', icon: 'RefreshCw' },
];

/**
 * Calculates auto-arranged (x, y) coordinates for all nodes according to the selected pattern.
 * Center of the virtual canvas coordinate space is (600, 400).
 */
export function calculateVisualLayout(nodes = [], edges = [], visualType = 'concept_map') {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { nodes: [], edges: [], meta: {} };
  }

  const count = nodes.length;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;

  // Clone nodes to avoid mutating original objects
  const clonedNodes = nodes.map((n, idx) => ({
    ...n,
    x: n.x ?? CENTER_X,
    y: n.y ?? CENTER_Y,
    orderIndex: idx
  }));

  const meta = {
    visualType,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT
  };

  switch (visualType) {
    // ── 1. TIMELINE (Napkin AI Horizontal Milestone Spine) ──
    case 'timeline': {
      const stepX = Math.max(180, Math.min(240, 1000 / Math.max(count, 1)));
      const totalWidth = (count - 1) * stepX;
      const startX = Math.max(120, CENTER_X - totalWidth / 2);
      const spineY = CENTER_Y;

      meta.timelineSpine = {
        startX: startX - 60,
        endX: startX + totalWidth + 60,
        y: spineY
      };

      clonedNodes.forEach((node, i) => {
        const x = startX + i * stepX;
        // Alternate cards above (even) and below (odd) the central spine
        const isAbove = i % 2 === 0;
        const y = isAbove ? spineY - 140 : spineY + 140;
        node.x = x;
        node.y = y;
        node.timelineStemY = spineY;
        node.timelineStepNum = i + 1;
      });
      break;
    }

    // ── 2. PROCESS (Linear Sequential Pipeline) ──
    case 'process': {
      if (count <= 5) {
        // Single horizontal line
        const stepX = Math.max(200, Math.min(250, 1050 / Math.max(count, 1)));
        const totalWidth = (count - 1) * stepX;
        const startX = Math.max(120, CENTER_X - totalWidth / 2);

        clonedNodes.forEach((node, i) => {
          node.x = startX + i * stepX;
          node.y = CENTER_Y;
          node.processStep = i + 1;
        });
      } else {
        // Multi-row serpentine snake layout (e.g. 4 nodes per row)
        const rowSize = Math.ceil(Math.sqrt(count * 1.5));
        const stepX = 220;
        const stepY = 160;
        const numRows = Math.ceil(count / rowSize);
        const startY = CENTER_Y - ((numRows - 1) * stepY) / 2;

        clonedNodes.forEach((node, i) => {
          const row = Math.floor(i / rowSize);
          const colInRow = i % rowSize;
          const isReverse = row % 2 === 1;
          const col = isReverse ? rowSize - 1 - colInRow : colInRow;

          const rowCount = Math.min(rowSize, count - row * rowSize);
          const rowStartX = CENTER_X - ((rowCount - 1) * stepX) / 2;

          node.x = rowStartX + col * stepX;
          node.y = startY + row * stepY;
          node.processStep = i + 1;
        });
      }
      break;
    }

    // ── 3. MIND MAP (Dual-Wing Organic Tree) ──
    case 'mind_map': {
      // Root is either node with id 'node_root', or node with inDegree 0, or node 0
      const rootIdx = clonedNodes.findIndex((n) => n.id === 'node_root' || n.type === 'concept');
      const rootNode = rootIdx >= 0 ? clonedNodes[rootIdx] : clonedNodes[0];
      rootNode.x = CENTER_X;
      rootNode.y = CENTER_Y;
      rootNode.isMindMapRoot = true;

      const children = clonedNodes.filter((n) => n.id !== rootNode.id);
      if (children.length > 0) {
        // Split children into Right Wing and Left Wing
        const rightWing = [];
        const leftWing = [];
        children.forEach((c, i) => {
          if (i % 2 === 0) rightWing.push(c);
          else leftWing.push(c);
        });

        // Position Right Wing
        const rCount = rightWing.length;
        const rStepY = Math.max(90, Math.min(130, 560 / Math.max(rCount, 1)));
        const rStartY = CENTER_Y - ((rCount - 1) * rStepY) / 2;
        rightWing.forEach((n, idx) => {
          n.x = CENTER_X + 280;
          n.y = rStartY + idx * rStepY;
          n.mindMapWing = 'right';
        });

        // Position Left Wing
        const lCount = leftWing.length;
        const lStepY = Math.max(90, Math.min(130, 560 / Math.max(lCount, 1)));
        const lStartY = CENTER_Y - ((lCount - 1) * lStepY) / 2;
        leftWing.forEach((n, idx) => {
          n.x = CENTER_X - 280;
          n.y = lStartY + idx * lStepY;
          n.mindMapWing = 'left';
        });
      }
      break;
    }

    // ── 4. FLOWCHART / HIERARCHY (Layered Directed DAG) ──
    case 'flowchart':
    case 'hierarchy': {
      // Build adjacency & in-degrees
      const inDegrees = {};
      const adj = {};
      clonedNodes.forEach((n) => {
        inDegrees[n.id] = 0;
        adj[n.id] = [];
      });

      edges.forEach((e) => {
        if (inDegrees[e.target] !== undefined) inDegrees[e.target] += 1;
        if (adj[e.source] !== undefined) adj[e.source].push(e.target);
      });

      // Find roots (in-degree === 0)
      let roots = clonedNodes.filter((n) => inDegrees[n.id] === 0).map((n) => n.id);
      if (roots.length === 0) roots = [clonedNodes[0].id];

      // Assign BFS ranks
      const ranks = {};
      const queue = [...roots.map((r) => ({ id: r, rank: 0 }))];
      roots.forEach((r) => { ranks[r] = 0; });

      while (queue.length > 0) {
        const { id, rank } = queue.shift();
        (adj[id] || []).forEach((tgt) => {
          if (ranks[tgt] === undefined || ranks[tgt] < rank + 1) {
            ranks[tgt] = rank + 1;
            queue.push({ id: tgt, rank: rank + 1 });
          }
        });
      }

      // Fill unvisited nodes
      clonedNodes.forEach((n) => {
        if (ranks[n.id] === undefined) ranks[n.id] = 0;
      });

      // Group nodes by rank
      const rankBuckets = {};
      clonedNodes.forEach((n) => {
        const rk = ranks[n.id];
        if (!rankBuckets[rk]) rankBuckets[rk] = [];
        rankBuckets[rk].push(n);
      });

      const maxRank = Math.max(...Object.keys(rankBuckets).map(Number));
      const layerStepY = Math.max(130, Math.min(180, 600 / Math.max(maxRank + 1, 1)));
      const startY = CENTER_Y - (maxRank * layerStepY) / 2;

      Object.entries(rankBuckets).forEach(([rkStr, bucket]) => {
        const rk = Number(rkStr);
        const bCount = bucket.length;
        const stepX = Math.max(190, Math.min(260, 1050 / Math.max(bCount, 1)));
        const startX = CENTER_X - ((bCount - 1) * stepX) / 2;

        bucket.forEach((node, idx) => {
          node.x = startX + idx * stepX;
          node.y = startY + rk * layerStepY;
          node.dagRank = rk;
        });
      });
      break;
    }

    // ── 5. COMPARISON (Side-by-Side Dual Column Matrix) ──
    case 'comparison': {
      const mid = Math.ceil(count / 2);
      const colA = clonedNodes.slice(0, mid);
      const colB = clonedNodes.slice(mid);

      const colStepY = Math.max(90, Math.min(130, 520 / Math.max(colA.length, colB.length, 1)));
      const startYA = CENTER_Y - ((colA.length - 1) * colStepY) / 2;
      const startYB = CENTER_Y - ((colB.length - 1) * colStepY) / 2;

      colA.forEach((node, i) => {
        node.x = CENTER_X - 220;
        node.y = startYA + i * colStepY;
        node.comparisonCol = 'A';
      });

      colB.forEach((node, i) => {
        node.x = CENTER_X + 220;
        node.y = startYB + i * colStepY;
        node.comparisonCol = 'B';
      });

      meta.comparisonHeaders = [
        { label: 'Theme A / Foundation', x: CENTER_X - 220, y: Math.min(startYA, startYB) - 60 },
        { label: 'Theme B / Application', x: CENTER_X + 220, y: Math.min(startYA, startYB) - 60 }
      ];
      break;
    }

    // ── 6. CYCLE (Closed Feedback Loop) ──
    case 'cycle': {
      const radius = Math.max(180, Math.min(270, 70 * Math.sqrt(count)));
      meta.cycleCenter = { x: CENTER_X, y: CENTER_Y, radius };

      clonedNodes.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
        node.x = CENTER_X + radius * Math.cos(angle);
        node.y = CENTER_Y + radius * Math.sin(angle);
        node.cycleIndex = i + 1;
      });
      break;
    }

    // ── 7. CONCEPT MAP / AUTO (Semantic Balanced Radial Network) ──
    case 'concept_map':
    default: {
      // Root at center
      const rootNode = clonedNodes[0];
      rootNode.x = CENTER_X;
      rootNode.y = CENTER_Y;

      const outerNodes = clonedNodes.slice(1);
      if (outerNodes.length > 0) {
        if (outerNodes.length <= 6) {
          // Single outer orbit
          const radius = Math.min(300, 180 + outerNodes.length * 15);
          outerNodes.forEach((node, i) => {
            const angle = (i * 2 * Math.PI) / outerNodes.length - Math.PI / 2;
            node.x = CENTER_X + radius * Math.cos(angle);
            node.y = CENTER_Y + radius * Math.sin(angle);
          });
        } else {
          // Two concentric orbits for larger graphs
          const innerRing = outerNodes.slice(0, Math.ceil(outerNodes.length / 2));
          const outerRing = outerNodes.slice(Math.ceil(outerNodes.length / 2));

          const r1 = 210;
          innerRing.forEach((node, i) => {
            const angle = (i * 2 * Math.PI) / innerRing.length - Math.PI / 2;
            node.x = CENTER_X + r1 * Math.cos(angle);
            node.y = CENTER_Y + r1 * Math.sin(angle);
          });

          const r2 = 360;
          outerRing.forEach((node, i) => {
            const angle = (i * 2 * Math.PI) / outerRing.length - Math.PI / 4;
            node.x = CENTER_X + r2 * Math.cos(angle);
            node.y = CENTER_Y + r2 * Math.sin(angle);
          });
        }
      }
      break;
    }
  }

  return { nodes: clonedNodes, edges, meta };
}

/**
 * Calculates pan and zoom to fit all nodes neatly inside the canvas container.
 */
export function calculateFitToView(nodes = [], containerWidth = 1000, containerHeight = 700, padding = 100) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { pan: { x: 0, y: 0 }, zoom: 1 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    if (n.x != null && n.y != null) {
      minX = Math.min(minX, n.x - 75);
      maxX = Math.max(maxX, n.x + 75);
      minY = Math.min(minY, n.y - 35);
      maxY = Math.max(maxY, n.y + 35);
    }
  });

  if (minX === Infinity) {
    return { pan: { x: 0, y: 0 }, zoom: 1 };
  }

  const graphWidth = Math.max(100, maxX - minX);
  const graphHeight = Math.max(100, maxY - minY);
  const graphCenterX = (minX + maxX) / 2;
  const graphCenterY = (minY + maxY) / 2;

  const availWidth = Math.max(100, containerWidth - padding * 2);
  const availHeight = Math.max(100, containerHeight - padding * 2);

  const zoomX = availWidth / graphWidth;
  const zoomY = availHeight / graphHeight;
  const optimalZoom = Math.max(0.4, Math.min(1.4, Math.min(zoomX, zoomY)));

  // Pan places graphCenterX, graphCenterY directly at container center
  const panX = containerWidth / 2 - graphCenterX * optimalZoom;
  const panY = containerHeight / 2 - graphCenterY * optimalZoom;

  return {
    pan: { x: panX, y: panY },
    zoom: optimalZoom
  };
}

/**
 * Generates an SVG path string between two nodes based on the visual layout type.
 */
export function generateConnectorPath(src, tgt, visualType = 'concept_map') {
  if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) {
    return '';
  }

  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;

  // 1. Mind Map: Horizontal S-curve cubic bezier
  if (visualType === 'mind_map') {
    const midX = (src.x + tgt.x) / 2;
    return `M ${src.x} ${src.y} C ${midX} ${src.y}, ${midX} ${tgt.y}, ${tgt.x} ${tgt.y}`;
  }

  // 2. Flowchart / Hierarchy: Vertical layered orthogonal curve
  if (visualType === 'flowchart' || visualType === 'hierarchy') {
    const midY = (src.y + tgt.y) / 2;
    return `M ${src.x} ${src.y} C ${src.x} ${midY}, ${tgt.x} ${midY}, ${tgt.x} ${tgt.y}`;
  }

  // 3. Cycle: Curved circular arc
  if (visualType === 'cycle') {
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    // Gentle perpendicular arc bend
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    const bend = 30;
    const ctrlX = midX - (dy / norm) * bend;
    const ctrlY = midY + (dx / norm) * bend;
    return `M ${src.x} ${src.y} Q ${ctrlX} ${ctrlY} ${tgt.x} ${tgt.y}`;
  }

  // 4. Default / Process / Timeline / Concept Map: Straight line
  return `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`;
}
