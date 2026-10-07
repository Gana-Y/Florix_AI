"""
Florix AI — Phase 5 Grounded Visual Learning Engine
Data Models, Schemas, and Enums for Academic Concept Mapping and Visualization.
Author: Ganesh (Lead Architect) & Aria
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class VisualType(str, Enum):
    """Supported academic visual formats."""
    AUTO = "auto"
    CONCEPT_MAP = "concept_map"
    FLOWCHART = "flowchart"
    MIND_MAP = "mind_map"
    HIERARCHY = "hierarchy"
    COMPARISON = "comparison"
    PROCESS = "process"
    TIMELINE = "timeline"
    CYCLE = "cycle"


class RelationType(str, Enum):
    """Controlled relationship vocabulary for grounded academic graphs."""
    PREREQUISITE = "prerequisite"
    PART_OF = "part_of"
    CONTAINS = "contains"
    CAUSES = "causes"
    LEADS_TO = "leads_to"
    DEPENDS_ON = "depends_on"
    EXAMPLE_OF = "example_of"
    CONTRASTS_WITH = "contrasts_with"
    RELATED_TO = "related_to"
    SEQUENCE = "sequence"


class VisualReadinessStatus(str, Enum):
    """Deterministic visual readiness evaluation state."""
    READY = "READY"
    LIMITED = "LIMITED"
    INSUFFICIENT = "INSUFFICIENT"
    UNAVAILABLE = "UNAVAILABLE"
    ERROR = "ERROR"


class ReadinessAnalysis(BaseModel):
    """Result of analyzing content for visual generation readiness."""
    status: VisualReadinessStatus
    message: str
    can_generate: bool = False
    detected_concepts: List[str] = Field(default_factory=list)
    suggested_visual_type: VisualType = VisualType.CONCEPT_MAP
    semantic_density_score: float = 0.0
    word_count: int = 0


class VisualNode(BaseModel):
    """A semantic concept node in a visual document."""
    id: str = Field(..., max_length=50)
    label: str = Field(..., max_length=120)
    type: str = Field(default="concept", max_length=50)  # concept | definition | example | question | note | process_step
    description: Optional[str] = Field(default=None, max_length=600)
    source_chunk_ids: List[str] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    mastery_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    mastery_status: Optional[str] = Field(default=None, max_length=50)  # mastered | learning | review_needed | struggling | untested
    weak_subtopics: List[str] = Field(default_factory=list)
    x: Optional[float] = None
    y: Optional[float] = None


class VisualEdge(BaseModel):
    """A directed semantic or dependency relation between two concept nodes."""
    id: str = Field(..., max_length=80)
    source: str = Field(..., max_length=50)
    target: str = Field(..., max_length=50)
    relation_type: RelationType = RelationType.RELATED_TO
    label: Optional[str] = Field(default=None, max_length=100)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    is_prerequisite: bool = False
    has_foundation_alert: bool = False
    source_chunk_ids: List[str] = Field(default_factory=list)


class VisualDocument(BaseModel):
    """A complete validated visual learning artifact."""
    visual_id: str
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    visual_type: VisualType = VisualType.CONCEPT_MAP
    nodes: List[VisualNode] = Field(default_factory=list)
    edges: List[VisualEdge] = Field(default_factory=list)
    source_session_id: int
    is_manual: bool = False
    is_modified: bool = False
    created_at: str
    updated_at: str
    version: int = 1
    suggested_topics: List[str] = Field(default_factory=list)
    readiness: Optional[ReadinessAnalysis] = None


from pydantic import BaseModel, Field, field_validator


# API Request / Response schemas
class VisualizeRequest(BaseModel):
    snippet: Optional[str] = None
    topic: Optional[str] = Field(default=None, max_length=200)
    visual_type: VisualType = VisualType.AUTO
    include_mastery: bool = True

    @field_validator("topic", mode="before")
    @classmethod
    def clean_topic(cls, v):
        if isinstance(v, str):
            cleaned = v.strip()
            return cleaned if len(cleaned) > 0 else None
        return None


class VisualArtifactCreate(BaseModel):
    title: str = Field(..., max_length=200)
    visual_type: str = "concept_map"
    visual_data: Dict[str, Any]
    is_manual: bool = True


class VisualArtifactUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    visual_data: Optional[Dict[str, Any]] = None
    is_manual: Optional[bool] = None
