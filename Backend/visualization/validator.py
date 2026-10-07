"""
Florix AI — Phase 5 Visual Schema Validator & Sanitization Layer
Validates visual nodes, edges, relationships, and prevents script/HTML injection.
Author: Ganesh (Lead Architect) & Aria
"""

import re
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set, Tuple

from .models import (
    VisualType,
    RelationType,
    VisualNode,
    VisualEdge,
    VisualDocument,
    ReadinessAnalysis,
    VisualReadinessStatus
)

HTML_TAG_PATTERN = re.compile(r"<[^>]*?>", re.IGNORECASE)
SCRIPT_PATTERN = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
JAVASCRIPT_URI_PATTERN = re.compile(r"javascript\s*:", re.IGNORECASE)

# Mapping common synonym relation strings to valid controlled RelationType enum
RELATION_SYNONYMS: Dict[str, RelationType] = {
    "prereq": RelationType.PREREQUISITE,
    "prerequisite": RelationType.PREREQUISITE,
    "requires": RelationType.PREREQUISITE,
    "needed_for": RelationType.PREREQUISITE,
    "part_of": RelationType.PART_OF,
    "is_part_of": RelationType.PART_OF,
    "component_of": RelationType.PART_OF,
    "contains": RelationType.CONTAINS,
    "includes": RelationType.CONTAINS,
    "has": RelationType.CONTAINS,
    "causes": RelationType.CAUSES,
    "triggers": RelationType.CAUSES,
    "affects": RelationType.CAUSES,
    "leads_to": RelationType.LEADS_TO,
    "results_in": RelationType.LEADS_TO,
    "produces": RelationType.LEADS_TO,
    "depends_on": RelationType.DEPENDS_ON,
    "relies_on": RelationType.DEPENDS_ON,
    "example_of": RelationType.EXAMPLE_OF,
    "instance_of": RelationType.EXAMPLE_OF,
    "type_of": RelationType.EXAMPLE_OF,
    "is_a": RelationType.EXAMPLE_OF,
    "contrasts_with": RelationType.CONTRASTS_WITH,
    "opposes": RelationType.CONTRASTS_WITH,
    "differs_from": RelationType.CONTRASTS_WITH,
    "versus": RelationType.CONTRASTS_WITH,
    "related_to": RelationType.RELATED_TO,
    "associates_with": RelationType.RELATED_TO,
    "connects_to": RelationType.RELATED_TO,
    "sequence": RelationType.SEQUENCE,
    "next": RelationType.SEQUENCE,
    "then": RelationType.SEQUENCE,
    "step_after": RelationType.SEQUENCE,
}

VALID_NODE_TYPES = {"concept", "definition", "example", "question", "note", "process_step"}


def sanitize_visual_text(text: Optional[str], max_len: int = 500) -> str:
    """
    Strips HTML tags, script blocks, and dangerous URIs from text fields.
    """
    if not text:
        return ""
    # Strip script blocks
    cleaned = SCRIPT_PATTERN.sub("", str(text))
    # Strip HTML tags
    cleaned = HTML_TAG_PATTERN.sub("", cleaned)
    # Strip javascript:
    cleaned = JAVASCRIPT_URI_PATTERN.sub("", cleaned)
    # Collapse extra whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]


def normalize_relation_type(val: Any) -> RelationType:
    """Normalizes any relation string to a valid RelationType enum."""
    if isinstance(val, RelationType):
        return val
    if not val:
        return RelationType.RELATED_TO
    s = str(val).strip().lower().replace("-", "_").replace(" ", "_")
    if s in RELATION_SYNONYMS:
        return RELATION_SYNONYMS[s]
    # Check if exact value is in RelationType
    for member in RelationType:
        if member.value == s:
            return member
    return RelationType.RELATED_TO


class VisualValidator:
    """
    Validates, sanitizes, and lays out visual graphs.
    """

    @classmethod
    def validate_and_layout(
        cls,
        raw_data: Dict[str, Any],
        source_session_id: int,
        available_chunk_ids: Optional[List[str]] = None,
        is_manual: bool = False,
        visual_id: Optional[str] = None
    ) -> VisualDocument:
        """
        Validates raw dictionary into a guaranteed safe, grounded VisualDocument.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        doc_id = visual_id or f"vis_{int(datetime.now(timezone.utc).timestamp() * 1000)}"

        # 1. Title and Description
        raw_title = raw_data.get("title") or "Academic Concept Map"
        title = sanitize_visual_text(raw_title, max_len=200) or "Academic Concept Map"

        raw_desc = raw_data.get("description")
        description = sanitize_visual_text(raw_desc, max_len=1000) if raw_desc else None

        # 2. Visual Type
        raw_vtype = str(raw_data.get("visual_type", "concept_map")).strip().lower()
        try:
            visual_type = VisualType(raw_vtype)
        except ValueError:
            visual_type = VisualType.CONCEPT_MAP

        # 3. Validate Nodes
        raw_nodes = raw_data.get("nodes", [])
        if not isinstance(raw_nodes, list):
            raw_nodes = []

        validated_nodes: List[VisualNode] = []
        seen_ids: Set[str] = set()

        for idx, n in enumerate(raw_nodes[:25]):  # Cap at 25 nodes
            if not isinstance(n, dict):
                continue
            
            raw_nid = str(n.get("id", f"node_{idx+1}")).strip()
            # Clean ID
            nid = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_nid)[:50] or f"node_{idx+1}"
            if nid in seen_ids:
                nid = f"{nid}_{idx+1}"
            seen_ids.add(nid)

            label = sanitize_visual_text(n.get("label"), max_len=120) or f"Concept {idx+1}"
            ntype = str(n.get("type", "concept")).lower().strip()
            if ntype not in VALID_NODE_TYPES:
                ntype = "concept"

            ndesc = sanitize_visual_text(n.get("description"), max_len=600) or None

            # Source chunk IDs filter
            chunk_ids = n.get("source_chunk_ids", [])
            if not isinstance(chunk_ids, list):
                chunk_ids = []
            clean_chunk_ids = [
                sanitize_visual_text(str(cid), max_len=50)
                for cid in chunk_ids
                if str(cid).strip()
            ]
            if available_chunk_ids:
                # If chunk filter provided, retain those matching available chunks
                valid_cids = set(available_chunk_ids)
                clean_chunk_ids = [cid for cid in clean_chunk_ids if cid in valid_cids]

            # Citations list
            citations = n.get("citations", [])
            if not isinstance(citations, list):
                citations = []

            # Confidence
            conf = 1.0
            try:
                if "confidence" in n:
                    conf = max(0.0, min(1.0, float(n["confidence"])))
            except (ValueError, TypeError):
                conf = 1.0

            # Mastery fields
            mastery_score = None
            if n.get("mastery_score") is not None:
                try:
                    mastery_score = max(0.0, min(1.0, float(n["mastery_score"])))
                except (ValueError, TypeError):
                    mastery_score = None

            mastery_status = sanitize_visual_text(n.get("mastery_status"), max_len=50) or None

            weak_subtopics = []
            if isinstance(n.get("weak_subtopics"), list):
                weak_subtopics = [
                    sanitize_visual_text(str(st), max_len=100)
                    for st in n["weak_subtopics"]
                    if str(st).strip()
                ]

            x_coord = float(n["x"]) if n.get("x") is not None else None
            y_coord = float(n["y"]) if n.get("y") is not None else None

            node_obj = VisualNode(
                id=nid,
                label=label,
                type=ntype,
                description=ndesc,
                source_chunk_ids=clean_chunk_ids,
                citations=citations,
                confidence=conf,
                mastery_score=mastery_score,
                mastery_status=mastery_status,
                weak_subtopics=weak_subtopics,
                x=x_coord,
                y=y_coord
            )
            validated_nodes.append(node_obj)

        # 4. Validate Edges
        valid_node_ids = {node.id for node in validated_nodes}
        raw_edges = raw_data.get("edges", [])
        if not isinstance(raw_edges, list):
            raw_edges = []

        validated_edges: List[VisualEdge] = []
        seen_edges: Set[Tuple[str, str, str]] = set()

        for idx, e in enumerate(raw_edges[:40]):  # Cap at 40 edges
            if not isinstance(e, dict):
                continue
            src = str(e.get("source", "")).strip()
            tgt = str(e.get("target", "")).strip()

            if src not in valid_node_ids or tgt not in valid_node_ids:
                continue
            if src == tgt:
                continue  # Disallow self-loops for academic clarity

            rel = normalize_relation_type(e.get("relation_type"))
            edge_key = (src, tgt, rel.value)
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)

            raw_eid = str(e.get("id", f"edge_{src}_{tgt}")).strip()
            eid = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_eid)[:80] or f"edge_{idx+1}"

            label = sanitize_visual_text(e.get("label"), max_len=100) or None
            is_prereq = bool(
                e.get("is_prerequisite") or
                rel in (RelationType.PREREQUISITE, RelationType.DEPENDS_ON)
            )

            # Edge chunks
            e_chunks = e.get("source_chunk_ids", [])
            if not isinstance(e_chunks, list):
                e_chunks = []
            clean_e_chunks = [
                sanitize_visual_text(str(c), max_len=50)
                for c in e_chunks
                if str(c).strip()
            ]

            edge_obj = VisualEdge(
                id=eid,
                source=src,
                target=tgt,
                relation_type=rel,
                label=label,
                is_prerequisite=is_prereq,
                has_foundation_alert=bool(e.get("has_foundation_alert", False)),
                source_chunk_ids=clean_e_chunks
            )
            validated_edges.append(edge_obj)

        # 5. Suggested topics
        raw_topics = raw_data.get("suggested_topics", [])
        suggested_topics: List[str] = []
        if isinstance(raw_topics, list):
            for t in raw_topics[:6]:
                st = sanitize_visual_text(str(t), max_len=100)
                if st and st not in suggested_topics:
                    suggested_topics.append(st)

        # 6. Apply initial layout coordinates if missing
        cls._apply_layout_if_needed(validated_nodes, validated_edges, visual_type)

        return VisualDocument(
            visual_id=doc_id,
            title=title,
            description=description,
            visual_type=visual_type,
            nodes=validated_nodes,
            edges=validated_edges,
            source_session_id=source_session_id,
            is_manual=is_manual,
            is_modified=raw_data.get("is_modified", False),
            created_at=raw_data.get("created_at") or now_iso,
            updated_at=now_iso,
            version=int(raw_data.get("version", 1)),
            suggested_topics=suggested_topics
        )

    @classmethod
    def _apply_layout_if_needed(
        cls,
        nodes: List[VisualNode],
        edges: List[VisualEdge],
        visual_type: VisualType
    ) -> None:
        """
        Calculates deterministic, visually balanced SVG canvas coordinates (800x600)
        for nodes that lack x/y positions.
        """
        unpositioned = [n for n in nodes if n.x is None or n.y is None]
        if not unpositioned:
            return

        n_count = len(nodes)
        if n_count == 0:
            return

        width = 800.0
        height = 600.0
        center_x = width / 2.0
        center_y = height / 2.0

        if n_count == 1:
            nodes[0].x = center_x
            nodes[0].y = center_y
            return

        # 1. Timeline Layout: Linear horizontal progression
        if visual_type == VisualType.TIMELINE:
            step_x = (width - 160.0) / max(1, n_count - 1)
            for i, node in enumerate(nodes):
                if node.x is None or node.y is None:
                    node.x = 80.0 + (i * step_x)
                    node.y = center_y + (30.0 if i % 2 == 1 else -30.0)
            return

        # 2. Process / Flowchart / Hierarchy: Directed Layered Layout
        if visual_type in (VisualType.PROCESS, VisualType.FLOWCHART, VisualType.HIERARCHY):
            # Compute in-degrees
            in_degrees = {n.id: 0 for n in nodes}
            adj = {n.id: [] for n in nodes}
            for e in edges:
                if e.target in in_degrees:
                    in_degrees[e.target] += 1
                if e.source in adj:
                    adj[e.source].append(e.target)

            # Assign ranks via BFS from roots (in-degree == 0)
            ranks: Dict[str, int] = {}
            roots = [nid for nid, deg in in_degrees.items() if deg == 0]
            if not roots:
                roots = [nodes[0].id]

            queue = [(r, 0) for r in roots]
            for r in roots:
                ranks[r] = 0

            while queue:
                curr, rk = queue.pop(0)
                for neighbor in adj.get(curr, []):
                    if neighbor not in ranks or ranks[neighbor] < rk + 1:
                        ranks[neighbor] = rk + 1
                        queue.append((neighbor, rk + 1))

            # Fill unreached nodes
            for n in nodes:
                if n.id not in ranks:
                    ranks[n.id] = 0

            max_rank = max(ranks.values()) if ranks else 0
            # Group nodes by rank
            rank_groups: Dict[int, List[VisualNode]] = {}
            for n in nodes:
                rk = ranks[n.id]
                rank_groups.setdefault(rk, []).append(n)

            y_step = (height - 160.0) / max(1, max_rank) if max_rank > 0 else 0
            for rk, group in rank_groups.items():
                x_step = width / (len(group) + 1)
                for idx, node in enumerate(group):
                    if node.x is None or node.y is None:
                        node.x = (idx + 1) * x_step
                        node.y = 80.0 + (rk * y_step) if max_rank > 0 else center_y
            return

        # 3. Comparison Layout: Two balanced vertical columns
        if visual_type == VisualType.COMPARISON:
            mid = math.ceil(n_count / 2)
            left_col = nodes[:mid]
            right_col = nodes[mid:]

            y_step_l = (height - 140.0) / max(1, len(left_col))
            for idx, node in enumerate(left_col):
                if node.x is None or node.y is None:
                    node.x = width * 0.28
                    node.y = 70.0 + (idx * y_step_l) + (y_step_l / 2.0)

            y_step_r = (height - 140.0) / max(1, len(right_col))
            for idx, node in enumerate(right_col):
                if node.x is None or node.y is None:
                    node.x = width * 0.72
                    node.y = 70.0 + (idx * y_step_r) + (y_step_r / 2.0)
            return

        # 4. Mind Map / Concept Map / Auto: Radial / Concentric arrangement
        # First node in center, rest distributed evenly in radial orbits
        if nodes[0].x is None or nodes[0].y is None:
            nodes[0].x = center_x
            nodes[0].y = center_y

        outer_nodes = nodes[1:]
        if not outer_nodes:
            return

        radius = min(width, height) * 0.36
        angle_step = (2.0 * math.pi) / len(outer_nodes)

        for i, node in enumerate(outer_nodes):
            if node.x is None or node.y is None:
                angle = i * angle_step - (math.pi / 2.0)
                node.x = center_x + radius * math.cos(angle)
                node.y = center_y + radius * math.sin(angle)
