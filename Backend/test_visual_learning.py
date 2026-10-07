"""
Florix AI — Phase 5 Visual Learning & Concept Mapping Test Suite
Validates visual schemas, readiness analysis, HTML/script sanitization,
deterministic layout, learner topic mastery overlay, Foundation Alerts,
multi-tenant authorization, and CRUD endpoints.
Author: Ganesh (Lead Architect) & Aria
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.insert(0, os.path.abspath("Backend"))

from database import (
    Base, User, StudySession, DocumentChunk, LearnerTopicMastery,
    LearningEvent, VisualArtifact
)
from auth import get_password_hash, create_access_token
from main import app, get_db
from visualization import (
    VisualType,
    RelationType,
    VisualReadinessStatus,
    ReadinessAnalysis,
    VisualNode,
    VisualEdge,
    VisualDocument,
    VisualizeRequest,
    VisualArtifactCreate,
    VisualArtifactUpdate,
    VisualReadinessAnalyzer,
    VisualValidator,
    VisualLearningService,
    sanitize_visual_text,
    normalize_relation_type
)

# In-memory test SQLite DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine_test = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine_test)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db):
    user = User(
        email="student@florix.edu",
        hashed_password=get_password_hash("ValidPass123!"),
        name="Alex Student"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def attacker_headers(db):
    user = User(
        email="attacker@florix.edu",
        hashed_password=get_password_hash("ValidPass123!"),
        name="Attacker"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def sample_session(db, auth_headers):
    _, user = auth_headers
    session = StudySession(
        user_id=user.id,
        filename="Data_Structures_Algorithms.pdf",
        ai_title="Data Structures and Algorithms",
        summary="Covers Arrays, Linked Lists, Trees, Graphs, Sorting algorithms and Dynamic Programming.",
        content="Fundamental algorithms and data structures. Tree traversals: preorder, inorder, postorder. Graph search: BFS and DFS.",
        source_type="pdf",
        processing_status="READY"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Add chunks
    chunks = [
        DocumentChunk(
            session_id=session.id,
            chunk_index=0,
            text_content="Arrays and Linked Lists are linear data structures. Array elements are stored contiguously in memory.",
            embedding=[0.1] * 8,
            page_number=1,
            section_heading="Linear Structures",
            content_type="text"
        ),
        DocumentChunk(
            session_id=session.id,
            chunk_index=1,
            text_content="Binary Search Trees enforce left child < root < right child. Tree balance determines search time complexity.",
            embedding=[0.2] * 8,
            page_number=2,
            section_heading="Binary Search Trees",
            content_type="text"
        ),
        DocumentChunk(
            session_id=session.id,
            chunk_index=2,
            text_content="Graph Algorithms: Breadth-First Search uses a Queue. Depth-First Search uses recursion or a Stack.",
            embedding=[0.3] * 8,
            page_number=3,
            section_heading="Graph Traversals",
            content_type="text"
        ),
    ]
    for c in chunks:
        db.add(c)
    db.commit()

    return session


# =============================================================================
# 1. READINESS ANALYZER TESTS
# =============================================================================

def test_readiness_analyzer_rejects_empty_or_whitespace():
    res1 = VisualReadinessAnalyzer.analyze_content("")
    assert res1.status == VisualReadinessStatus.UNAVAILABLE
    assert not res1.can_generate

    res2 = VisualReadinessAnalyzer.analyze_content("    \n\t  ")
    assert res2.status == VisualReadinessStatus.UNAVAILABLE
    assert not res2.can_generate


def test_readiness_analyzer_rejects_noise_and_punctuation():
    noise_samples = [
        ",,,,,,,,,,",
        ".................",
        "!@#$%^&*()_+",
        "asdfghjkl qwertyuiop",
        "1234567890 9876543210"
    ]
    for sample in noise_samples:
        res = VisualReadinessAnalyzer.analyze_content(sample)
        assert res.status in (VisualReadinessStatus.INSUFFICIENT, VisualReadinessStatus.LIMITED)
        assert not res.can_generate


def test_readiness_analyzer_accepts_academic_content():
    content = (
        "Binary search algorithm operates on sorted arrays in O(log n) logarithmic time. "
        "It repeatedly divides the search interval in half. If the value of the search key is less than "
        "the item in the middle of the interval, narrow the interval to the lower half."
    )
    res = VisualReadinessAnalyzer.analyze_content(content)
    assert res.can_generate
    assert res.status in (VisualReadinessStatus.READY, VisualReadinessStatus.LIMITED)
    assert len(res.detected_concepts) > 0


# =============================================================================
# 2. VALIDATION, SANITIZATION & LAYOUT TESTS
# =============================================================================

def test_sanitize_visual_text_strips_scripts_and_html():
    raw_payload = '<script>alert("xss")</script><b>Hello</b> <a href="javascript:steal()">World</a>'
    cleaned = sanitize_visual_text(raw_payload)
    assert "<script>" not in cleaned
    assert "<b>" not in cleaned
    assert "javascript:" not in cleaned
    assert "Hello World" in cleaned


def test_relation_normalization():
    assert normalize_relation_type("prerequisite") == RelationType.PREREQUISITE
    assert normalize_relation_type("requires") == RelationType.PREREQUISITE
    assert normalize_relation_type("part-of") == RelationType.PART_OF
    assert normalize_relation_type("triggers") == RelationType.CAUSES
    assert normalize_relation_type("unknown_junk_string") == RelationType.RELATED_TO


def test_validator_enforces_bounds_and_strips_invalid_edges():
    raw_data = {
        "title": "Clean Test <script>hack()</script>",
        "visual_type": "concept_map",
        "nodes": [
            {"id": "n1", "label": "Node 1", "type": "concept"},
            {"id": "n2", "label": "Node 2", "type": "concept"},
            # Duplicate id
            {"id": "n2", "label": "Node 2 Duplicate", "type": "concept"}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2", "relation_type": "causes"},
            # Edge pointing to non-existent node
            {"id": "e2", "source": "n1", "target": "n999", "relation_type": "leads_to"},
            # Self-loop
            {"id": "e3", "source": "n1", "target": "n1", "relation_type": "related_to"},
        ]
    }
    doc = VisualValidator.validate_and_layout(raw_data, source_session_id=1)
    assert "<script>" not in doc.title
    assert len(doc.nodes) == 3
    # IDs deduplicated
    node_ids = {n.id for n in doc.nodes}
    assert len(node_ids) == 3
    # Invalid edge and self-loop removed
    assert len(doc.edges) == 1
    assert doc.edges[0].source == "n1"
    assert doc.edges[0].target == "n2"


def test_validator_computes_layout_coordinates():
    raw_data = {
        "title": "Layout Test",
        "visual_type": "process",
        "nodes": [
            {"id": "step1", "label": "Input", "type": "process_step"},
            {"id": "step2", "label": "Process", "type": "process_step"},
            {"id": "step3", "label": "Output", "type": "process_step"},
        ],
        "edges": [
            {"id": "e1", "source": "step1", "target": "step2", "relation_type": "sequence"},
            {"id": "e2", "source": "step2", "target": "step3", "relation_type": "sequence"}
        ]
    }
    doc = VisualValidator.validate_and_layout(raw_data, source_session_id=1)
    for n in doc.nodes:
        assert n.x is not None
        assert n.y is not None
        assert 0 <= n.x <= 1000
        assert 0 <= n.y <= 750


# =============================================================================
# 3. SERVICE & LEARNER MASTERY OVERLAY TESTS
# =============================================================================

def test_mastery_overlay_and_foundation_alerts(db, auth_headers, sample_session):
    _, user = auth_headers

    # Seed Learner Topic Mastery
    # 1. Arrays: Struggling (mastery_score = 0.25)
    # 2. Binary Search Trees: Learning (mastery_score = 0.70)
    mastery_arrays = LearnerTopicMastery(
        user_id=user.id,
        session_id=sample_session.id,
        topic="Arrays",
        mastery_score=0.25,
        attempts=4,
        correct=1,
        weak_subtopics=["Contiguous Memory Allocation"]
    )
    mastery_bst = LearnerTopicMastery(
        user_id=user.id,
        session_id=sample_session.id,
        topic="Binary Search Trees",
        mastery_score=0.70,
        attempts=10,
        correct=7,
        weak_subtopics=[]
    )
    db.add(mastery_arrays)
    db.add(mastery_bst)
    db.commit()

    # Create visual doc where Arrays is prerequisite for BST
    raw_doc = {
        "title": "Data Structures Map",
        "visual_type": "concept_map",
        "nodes": [
            {"id": "n_arrays", "label": "Arrays", "type": "concept"},
            {"id": "n_bst", "label": "Binary Search Trees", "type": "concept"}
        ],
        "edges": [
            {
                "id": "e_arrays_bst",
                "source": "n_arrays",
                "target": "n_bst",
                "relation_type": "prerequisite",
                "is_prerequisite": True
            }
        ]
    }
    doc = VisualValidator.validate_and_layout(raw_doc, source_session_id=sample_session.id)
    VisualLearningService.apply_mastery_overlay(
        user_id=user.id,
        session_id=sample_session.id,
        visual_doc=doc,
        db=db
    )

    # Check node 1 (Arrays) is marked struggling
    arr_node = next(n for n in doc.nodes if n.id == "n_arrays")
    assert arr_node.mastery_status == "struggling"
    assert arr_node.mastery_score == 0.25
    assert "Contiguous Memory Allocation" in arr_node.weak_subtopics

    # Check edge has Foundation Alert triggered!
    edge = doc.edges[0]
    assert edge.is_prerequisite
    assert edge.has_foundation_alert is True


# =============================================================================
# 4. API ENDPOINT TESTS & MULTI-TENANT ISOLATION
# =============================================================================

def test_api_check_readiness(client):
    res = client.post("/study/visualize/readiness", json={"text": ",,,,,,"})
    assert res.status_code == 200
    data = res.json()
    assert not data["can_generate"]

    res_valid = client.post("/study/visualize/readiness", json={
        "text": "Depth-First Search traverses a graph by exploring as far as possible along each branch before backtracking."
    })
    assert res_valid.status_code == 200
    assert res_valid.json()["can_generate"]


def test_api_generate_visual_success(client, auth_headers, sample_session):
    headers, _ = auth_headers
    payload = {
        "topic": "Binary Search Trees",
        "visual_type": "concept_map",
        "include_mastery": True
    }
    res = client.post(f"/study/{sample_session.id}/visualize", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert len(data["nodes"]) > 0
    assert "edges" in data
    assert data["source_session_id"] == sample_session.id


def test_api_multi_tenant_isolation_idor_protection(client, attacker_headers, sample_session):
    att_headers, _ = attacker_headers
    payload = {"topic": "Trees"}
    # Attacker tries to generate visual for Alex's session
    res = client.post(f"/study/{sample_session.id}/visualize", json=payload, headers=att_headers)
    assert res.status_code == 404
    assert "unauthorized" in res.json()["detail"].lower() or "not found" in res.json()["detail"].lower()


def test_api_visual_artifact_crud_flow(client, auth_headers, sample_session):
    headers, _ = auth_headers

    # 1. Save artifact
    create_payload = {
        "title": "Algorithms Overview Graph",
        "visual_type": "flowchart",
        "is_manual": True,
        "visual_data": {
            "title": "Algorithms Overview Graph",
            "visual_type": "flowchart",
            "nodes": [
                {"id": "start", "label": "Start", "type": "process_step"},
                {"id": "decision", "label": "Key Found?", "type": "question"},
                {"id": "finish", "label": "End", "type": "process_step"}
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "decision", "relation_type": "sequence"},
                {"id": "e2", "source": "decision", "target": "finish", "relation_type": "leads_to"}
            ]
        }
    }
    res = client.post(f"/study/{sample_session.id}/visuals", json=create_payload, headers=headers)
    assert res.status_code == 200
    saved = res.json()
    artifact_id = saved["id"]
    assert saved["title"] == "Algorithms Overview Graph"
    assert saved["version"] == 1

    # 2. List artifacts
    list_res = client.get(f"/study/{sample_session.id}/visuals", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["id"] == artifact_id

    # 3. Get single artifact
    get_res = client.get(f"/study/{sample_session.id}/visuals/{artifact_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == artifact_id

    # 4. Patch/Update artifact
    update_payload = {
        "title": "Algorithms Overview Graph (Updated)",
        "visual_data": {
            "title": "Algorithms Overview Graph (Updated)",
            "visual_type": "flowchart",
            "nodes": [
                {"id": "start", "label": "Start (Updated)", "type": "process_step"},
                {"id": "decision", "label": "Key Found?", "type": "question"},
                {"id": "finish", "label": "End", "type": "process_step"}
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "decision", "relation_type": "sequence"}
            ]
        }
    }
    patch_res = client.patch(f"/study/{sample_session.id}/visuals/{artifact_id}", json=update_payload, headers=headers)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Algorithms Overview Graph (Updated)"
    assert updated["is_modified"] is True
    assert updated["version"] == 2

    # 5. Delete artifact
    del_res = client.delete(f"/study/{sample_session.id}/visuals/{artifact_id}", headers=headers)
    assert del_res.status_code == 200

    # 6. Verify gone
    get_after = client.get(f"/study/{sample_session.id}/visuals/{artifact_id}", headers=headers)
    assert get_after.status_code == 404


def test_api_unauthorized_artifact_access(client, auth_headers, attacker_headers, sample_session):
    headers, _ = auth_headers
    att_headers, _ = attacker_headers

    # 1. User creates artifact
    payload = {
        "title": "Private Concept Map",
        "visual_type": "concept_map",
        "is_manual": True,
        "visual_data": {"title": "Private Map", "nodes": [{"id": "n1", "label": "Secret"}], "edges": []}
    }
    create_res = client.post(f"/study/{sample_session.id}/visuals", json=payload, headers=headers)
    assert create_res.status_code == 200
    art_id = create_res.json()["id"]

    # 2. Attacker attempts to GET
    get_att = client.get(f"/study/{sample_session.id}/visuals/{art_id}", headers=att_headers)
    assert get_att.status_code == 404

    # 3. Attacker attempts to PATCH
    patch_att = client.patch(f"/study/{sample_session.id}/visuals/{art_id}", json={"title": "Hacked"}, headers=att_headers)
    assert patch_att.status_code == 404

    # 4. Attacker attempts to DELETE
    del_att = client.delete(f"/study/{sample_session.id}/visuals/{art_id}", headers=att_headers)
    assert del_att.status_code == 404

    # 5. Attacker attempts to LIST session's visuals
    list_att = client.get(f"/study/{sample_session.id}/visuals", headers=att_headers)
    assert list_att.status_code == 404


def test_validator_caps_large_graphs():
    # Construct 35 nodes and 50 edges
    raw_nodes = [{"id": f"node_{i}", "label": f"Concept {i}", "type": "concept"} for i in range(35)]
    raw_edges = [
        {"id": f"edge_{i}_{i+1}", "source": f"node_{i}", "target": f"node_{i+1}", "relation_type": "leads_to"}
        for i in range(34)
    ] + [
        {"id": f"edge_0_{i}", "source": "node_0", "target": f"node_{i}", "relation_type": "contains"}
        for i in range(2, 20)
    ]

    raw_doc = {
        "title": "Massive Graph Test",
        "visual_type": "concept_map",
        "nodes": raw_nodes,
        "edges": raw_edges
    }
    doc = VisualValidator.validate_and_layout(raw_doc, source_session_id=1)
    # Maximum 25 nodes
    assert len(doc.nodes) <= 25
    # Maximum 40 edges
    assert len(doc.edges) <= 40


def test_layout_all_visual_types():
    nodes = [{"id": f"n{i}", "label": f"Concept {i}", "type": "concept"} for i in range(5)]
    edges = [{"id": f"e{i}", "source": f"n{i}", "target": f"n{i+1}", "relation_type": "leads_to"} for i in range(4)]

    types_to_test = [
        VisualType.TIMELINE,
        VisualType.COMPARISON,
        VisualType.HIERARCHY,
        VisualType.FLOWCHART,
        VisualType.MIND_MAP,
        VisualType.PROCESS,
        VisualType.CONCEPT_MAP
    ]

    for vt in types_to_test:
        raw_doc = {
            "title": f"Test {vt.value}",
            "visual_type": vt.value,
            "nodes": [dict(n) for n in nodes],
            "edges": [dict(e) for e in edges]
        }
        doc = VisualValidator.validate_and_layout(raw_doc, source_session_id=1)
        assert doc.visual_type == vt
        for n in doc.nodes:
            assert n.x is not None
            assert n.y is not None
            assert isinstance(n.x, float)
            assert isinstance(n.y, float)


def test_deterministic_fallback_generator():
    chunks = [
        {"chunk_index": 0, "section_heading": "Introduction", "text_content": "Introduction to Algorithms"},
        {"chunk_index": 1, "section_heading": "Sorting", "text_content": "Sorting includes QuickSort and MergeSort"}
    ]
    fb = VisualLearningService._generate_deterministic_fallback(
        chunks=chunks,
        topic="Algorithms",
        visual_type=VisualType.FLOWCHART
    )
    assert fb["visual_type"] == "flowchart"
    assert len(fb["nodes"]) >= 3
    assert len(fb["edges"]) >= 2
    assert "Algorithms" in fb["title"]


def test_session_concept_map_endpoint(client, auth_headers, sample_session):
    headers, _ = auth_headers
    res = client.get(f"/study/{sample_session.id}/concept-map", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert len(data["nodes"]) > 0
    assert "edges" in data
    assert data["source_session_id"] == sample_session.id

