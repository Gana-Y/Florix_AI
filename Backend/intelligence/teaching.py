"""
Phase 3 Adaptive Teaching Engine
Constructs pedagogical scaffolding prompts based on learner mode and intent.
Extracts structured concepts and misconceptions from Phase 2 evidence.
"""

import re
from typing import List, Dict, Any, Optional
from .models import TeachingMode, LearningIntent


class TeachingEngine:
    """
    Pedagogical orchestration that guides LLM output into structured,
    cognitively effective academic explanations.
    """

    MODE_PROMPTS = {
        TeachingMode.BEGINNER: """
## PEDAGOGICAL SCAFFOLDING (BEGINNER / INTRODUCTORY MODE)
Explain the subject with extreme clarity and zero gatekeeping.
Structure your explanation using the following sections:
1. **Core Concept**: Exactly one clear sentence defining the idea.
2. **Simple Explanation**: Intuitive, step-by-step breakdown using plain terms.
3. **Relatable Analogy**: An intuitive real-world analogy to anchor the concept.
4. **Concrete Example**: A clear, relatable walkthrough.
5. **Common Mistake**: The most frequent misunderstanding and why it happens.
6. **Quick Check**: Exactly one simple question for the learner to test their grasp.

CRITICAL: Every factual claim must be strictly grounded in the retrieved document context with [1], [2] citations.
""",
        TeachingMode.EXAM: """
## PEDAGOGICAL SCAFFOLDING (EXAMINATION / HIGH-YIELD MODE)
Structure your response for top-marks academic examination performance:
1. **Formal Definition**: Complete, rigorous definition expected by university/board examiners.
2. **Key Examination Points & Marking Criteria**: Bulleted essential criteria that examiners look for on a mark scheme.
3. **Technical Mechanism / Derivation**: The step-by-step process or formula.
4. **Annotated Example**: A complete standard exam problem solved with proper notations.
5. **Key Terminology**: Essential bold terms and keywords that award marks.
6. **Exam Trap**: A subtle nuance where students typically lose points.

CRITICAL: Ground all definitions and formulas strictly in the retrieved document context with [1], [2] citations.
""",
        TeachingMode.ADVANCED: """
## PEDAGOGICAL SCAFFOLDING (ADVANCED / RIGOROUS MASTERY MODE)
Structure your explanation for senior academic or engineering mastery:
1. **Formal Specification & Invariants**: Precise mathematical, theoretical, or algorithmic formulation.
2. **Underlying Mechanism**: How the system operates internally at a low level.
3. **Edge Cases & Failure Modes**: Boundary conditions, constraints, and when the model breaks down.
4. **Trade-offs & Alternatives**: Complexity analysis, performance bottlenecks, and comparison with alternatives.
5. **Concrete Implementation / Proof**: Code, schema, or rigorous derivation.

CRITICAL: Ground all technical specifics strictly in the retrieved document context with [1], [2] citations.
""",
        TeachingMode.INTERVIEW: """
## PEDAGOGICAL SCAFFOLDING (TECHNICAL INTERVIEW MODE)
Structure your explanation for technical interviews:
1. **Executive Summary**: 30-second high-impact definition and core purpose.
2. **Under-The-Hood Architecture**: How it functions internally.
3. **Pros, Cons & Trade-offs**: When to use it and when NOT to use it.
4. **Common Interview Trap**: Follow-up questions interviewers use to test true depth.

CRITICAL: Ground all facts strictly in the retrieved document context with [1], [2] citations.
""",
        TeachingMode.REVISION: """
## PEDAGOGICAL SCAFFOLDING (HIGH-DENSITY REVISION MODE)
Provide rapid-fire, high-yield revision material:
1. **Core Formulae / Rules**: The fundamental laws, rules, or schemas.
2. **Key Takeaways**: Bullet points summarizing the essential mechanics.
3. **Exam Trap Warning**: Immediate clarification on easily confused points.
4. **Active Recall Prompt**: A quick mental challenge to solidify memory.

CRITICAL: Ground all facts in retrieved document context with [1], [2] citations.
""",
        TeachingMode.INTERMEDIATE: """
## PEDAGOGICAL SCAFFOLDING (BALANCED ACADEMIC MODE)
Deliver a well-rounded, clear academic explanation:
1. **Overview**: Clear definition and context.
2. **Detailed Breakdown**: Core mechanics and principles.
3. **Practical Example**: Step-by-step illustration.
4. **Summary & Takeaways**: High-yield synthesis.

CRITICAL: Ground all facts strictly in the retrieved document context with [1], [2] citations.
"""
    }

    @classmethod
    def get_scaffolding_instruction(cls, mode: TeachingMode, intent: LearningIntent) -> str:
        """
        Returns pedagogical instruction block to prepend or append to LLM prompt.
        """
        instruction = cls.MODE_PROMPTS.get(mode, cls.MODE_PROMPTS[TeachingMode.INTERMEDIATE])
        
        # Specific intent adjustments
        if intent == LearningIntent.COMPARE:
            instruction += "\n**Special Focus**: Include a structured comparison table highlighting key differences and trade-offs.\n"
        elif intent == LearningIntent.PROCEDURE:
            instruction += "\n**Special Focus**: Present clear, numbered sequential steps with preconditions and postconditions.\n"
        elif intent == LearningIntent.CLARIFICATION:
            instruction += "\n**Special Focus**: Directly address the learner's confusion, validate what they got right, and pinpoint the exact conceptual pivot.\n"

        return instruction.strip()

    @staticmethod
    def extract_concepts_from_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deterministic concept extraction from Phase 2 document chunks.
        Extracts key terms, definitions, and sections without expensive LLM calls.
        """
        extracted = []
        seen_terms = set()

        def_regex = re.compile(r"([A-Z][A-Za-z0-9\s_-]{2,30}?)\s+(?:is defined as|refers to|is a|means)\s+([^.\n]{15,150}\.)", re.IGNORECASE)
        heading_regex = re.compile(r"^(?:#{1,4}\s+|[0-9]+\.[0-9]*\s+)?([A-Z][A-Za-z0-9\s_-]{3,40})$", re.MULTILINE)

        for chunk in chunks:
            text = chunk.get("text_content") or chunk.get("text") or ""
            page = chunk.get("page_number", 1)
            section = chunk.get("section_heading", "")
            chunk_id = chunk.get("chunk_id", "")

            # 1. Look for explicit definitions
            for match in def_regex.finditer(text):
                term = match.group(1).strip()
                defn = match.group(2).strip()
                t_lower = term.lower()
                if t_lower not in seen_terms and len(term) > 2:
                    seen_terms.add(t_lower)
                    extracted.append({
                        "term": term,
                        "definition": defn,
                        "source_chunk_id": chunk_id,
                        "page_number": page,
                        "section": section,
                        "type": "definition"
                    })

            # 2. Look for strong section headings
            if section and section.lower() not in seen_terms:
                seen_terms.add(section.lower())
                extracted.append({
                    "term": section,
                    "definition": f"Key topic from section: {section}",
                    "source_chunk_id": chunk_id,
                    "page_number": page,
                    "section": section,
                    "type": "section"
                })

        return extracted[:15]
