"""
Phase 3 Learner Model & Mastery Engine
Deterministic, transparent learner state tracking, weak topic identification,
and spaced revision scheduling.
"""

import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from database import LearnerTopicMastery, LearningEvent, FlashcardProgress, StudySession


class LearnerEngine:
    """
    Transparent mathematical mastery and revision engine.
    Computes mastery using:
        Mastery = 0.50 * Accuracy + 0.25 * Recency + 0.15 * Repetition + 0.10 * DifficultyWeight
    Where:
        - Accuracy (A): correct / attempts (range [0.0, 1.0])
        - Recency (R): exp(-0.10 * days_ago) exponential memory decay (range (0.0, 1.0])
        - Repetition (N): min(1.0, attempts / 10.0) practice volume curve (range [0.0, 1.0])
        - Difficulty (D): curriculum tier weight (Beginner: 0.60, Intermediate: 0.80, Advanced/Exam: 1.00)
    """

    DIFFICULTY_WEIGHTS = {
        "beginner": 0.60,
        "intermediate": 0.80,
        "advanced": 1.00,
        "exam": 1.00
    }

    @classmethod
    def compute_mastery(
        cls,
        attempts: int,
        correct: int,
        last_reviewed: Optional[datetime] = None,
        difficulty: str = "intermediate"
    ) -> float:
        """
        Calculates explainable mastery score clamped between 0.0 and 1.0.
        """
        if attempts <= 0:
            return 0.0

        # 1. Accuracy component (0.0 to 1.0)
        accuracy = max(0.0, min(1.0, correct / attempts))

        # 2. Recency component (0.0 to 1.0, exponential decay over days)
        if last_reviewed is None:
            recency = 1.0
        else:
            days_ago = max(0.0, (datetime.utcnow() - last_reviewed).total_seconds() / 86400.0)
            recency = math.exp(-0.10 * days_ago)

        # 3. Repetition component (0.0 to 1.0, asymptotes at 10 attempts)
        repetition = min(1.0, attempts / 10.0)

        # 4. Difficulty weighting (0.60 to 1.0)
        diff_weight = cls.DIFFICULTY_WEIGHTS.get(difficulty.lower(), 0.80)

        raw_score = (
            0.50 * accuracy +
            0.25 * recency +
            0.15 * repetition +
            0.10 * diff_weight
        )
        return round(max(0.0, min(1.0, raw_score)), 2)

    @classmethod
    def get_mastery_status(cls, score: float) -> str:
        """Categorizes mastery score into user-facing status."""
        if score >= 0.85:
            return "mastered"
        elif score >= 0.65:
            return "learning"
        elif score >= 0.40:
            return "review_needed"
        else:
            return "struggling"

    @classmethod
    def record_topic_interaction(
        cls,
        db: Session,
        user_id: int,
        session_id: int,
        topic: str,
        is_correct: bool,
        difficulty: str = "intermediate",
        subtopic: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Updates topic mastery record and logs a learning event.
        Guarantees cross-user isolation via user_id filter.
        Prevents double-counting attempts if idempotency_key is repeated.
        """
        clean_topic = (topic or "General").strip()

        # Idempotency check
        if idempotency_key:
            existing_events = db.query(LearningEvent).filter(
                LearningEvent.user_id == user_id,
                LearningEvent.session_id == session_id,
                LearningEvent.event_type == "QUIZ_INTERACTION"
            ).order_by(LearningEvent.id.desc()).limit(100).all()
            for ev in existing_events:
                if ev.payload and ev.payload.get("idempotency_key") == idempotency_key:
                    record = db.query(LearnerTopicMastery).filter(
                        LearnerTopicMastery.user_id == user_id,
                        LearnerTopicMastery.session_id == session_id,
                        LearnerTopicMastery.topic == clean_topic
                    ).first()
                    if record:
                        return {
                            "topic": record.topic,
                            "mastery_score": record.mastery_score,
                            "attempts": record.attempts,
                            "correct": record.correct,
                            "status": cls.get_mastery_status(record.mastery_score),
                            "weak_subtopics": record.weak_subtopics or [],
                            "last_reviewed": record.last_reviewed.isoformat() if record.last_reviewed else None,
                            "idempotent_replay": True
                        }

        record = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user_id,
            LearnerTopicMastery.session_id == session_id,
            LearnerTopicMastery.topic == clean_topic
        ).first()

        now = datetime.utcnow()

        if not record:
            record = LearnerTopicMastery(
                user_id=user_id,
                session_id=session_id,
                topic=clean_topic,
                attempts=1,
                correct=1 if is_correct else 0,
                weak_subtopics=[subtopic] if (not is_correct and subtopic) else [],
                last_reviewed=now,
                mastery_score=cls.compute_mastery(1, 1 if is_correct else 0, now, difficulty)
            )
            db.add(record)
        else:
            record.attempts += 1
            if is_correct:
                record.correct += 1
                # If subtopic was weak but learner got it right, remove from weak list
                if subtopic and record.weak_subtopics and subtopic in record.weak_subtopics:
                    curr_weak = list(record.weak_subtopics)
                    curr_weak.remove(subtopic)
                    record.weak_subtopics = curr_weak
            else:
                # Add to weak subtopics if not already tracked
                if subtopic:
                    curr_weak = list(record.weak_subtopics or [])
                    if subtopic not in curr_weak:
                        curr_weak.append(subtopic)
                        record.weak_subtopics = curr_weak

            record.last_reviewed = now
            record.mastery_score = cls.compute_mastery(record.attempts, record.correct, now, difficulty)

        # Log learning event
        event = LearningEvent(
            user_id=user_id,
            session_id=session_id,
            event_type="QUIZ_INTERACTION",
            payload={
                "topic": clean_topic,
                "is_correct": is_correct,
                "subtopic": subtopic,
                "difficulty": difficulty,
                "resulting_mastery": record.mastery_score,
                "idempotency_key": idempotency_key
            },
            timestamp=now
        )
        db.add(event)
        db.commit()
        db.refresh(record)

        return {
            "topic": record.topic,
            "mastery_score": record.mastery_score,
            "attempts": record.attempts,
            "correct": record.correct,
            "status": cls.get_mastery_status(record.mastery_score),
            "weak_subtopics": record.weak_subtopics or [],
            "last_reviewed": record.last_reviewed.isoformat() if record.last_reviewed else None,
            "idempotent_replay": False
        }

    @classmethod
    def get_session_mastery(cls, db: Session, user_id: int, session_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves all topic mastery states for a user session.
        Guarantees cross-user multi-tenant isolation.
        """
        records = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user_id,
            LearnerTopicMastery.session_id == session_id
        ).order_by(LearnerTopicMastery.mastery_score.asc()).all()

        return [
            {
                "topic": r.topic,
                "mastery_score": r.mastery_score,
                "attempts": r.attempts,
                "correct": r.correct,
                "accuracy": round(r.correct / max(1, r.attempts), 2),
                "status": cls.get_mastery_status(r.mastery_score),
                "weak_subtopics": r.weak_subtopics or [],
                "last_reviewed": r.last_reviewed.isoformat() if r.last_reviewed else None
            }
            for r in records
        ]

    @classmethod
    def get_weak_topics_and_recommendations(
        cls,
        db: Session,
        user_id: int,
        session_id: int,
        threshold: float = 0.65
    ) -> Dict[str, Any]:
        """
        Identifies weak topics and generates actionable, evidence-based study recommendations.
        """
        records = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user_id,
            LearnerTopicMastery.session_id == session_id
        ).all()

        weak = []
        recommendations = []

        for r in records:
            if r.mastery_score < threshold or (r.weak_subtopics and len(r.weak_subtopics) > 0):
                weak.append({
                    "topic": r.topic,
                    "mastery_score": r.mastery_score,
                    "weak_subtopics": r.weak_subtopics or [],
                    "accuracy": round(r.correct / max(1, r.attempts), 2)
                })
                sub_str = f" (focusing on {', '.join(r.weak_subtopics)})" if r.weak_subtopics else ""
                recommendations.append(f"Strengthen understanding in '{r.topic}'{sub_str}. Practice 5 focused questions.")

        if not recommendations:
            recommendations.append("Mastery levels are solid across reviewed topics! Proceed to advanced synthesis or take an exam-style quiz.")

        return {
            "session_id": session_id,
            "weak_topics": weak,
            "recommendations": recommendations,
            "total_topics_tracked": len(records)
        }

    @classmethod
    def update_flashcard_sm2(
        cls,
        db: Session,
        user_id: int,
        session_id: int,
        card_index: int,
        quality: int,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Updates SM-2 spaced repetition state in FlashcardProgress (single source of truth).
        quality: 0 (blackout) to 5 (perfect recall).
        EF range: minimum 1.30 (stored as 130).
        """
        clean_quality = max(0, min(5, quality))
        now = datetime.utcnow()

        # Idempotency check via LearningEvent
        if idempotency_key:
            existing_events = db.query(LearningEvent).filter(
                LearningEvent.user_id == user_id,
                LearningEvent.session_id == session_id,
                LearningEvent.event_type == "FLASHCARD_REVIEW"
            ).order_by(LearningEvent.id.desc()).limit(100).all()
            for ev in existing_events:
                if ev.payload and ev.payload.get("idempotency_key") == idempotency_key:
                    rec = db.query(FlashcardProgress).filter(
                        FlashcardProgress.user_id == user_id,
                        FlashcardProgress.session_id == session_id,
                        FlashcardProgress.card_index == card_index
                    ).first()
                    if rec:
                        return {
                            "card_index": rec.card_index,
                            "interval": rec.interval,
                            "repetitions": rec.repetitions,
                            "ease_factor": round(rec.ease_factor / 100.0, 2),
                            "next_review": rec.next_review.isoformat() if rec.next_review else None,
                            "last_quality": rec.last_quality,
                            "idempotent_replay": True
                        }

        # Query or create FlashcardProgress
        progress = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.session_id == session_id,
            FlashcardProgress.card_index == card_index
        ).first()

        if not progress:
            progress = FlashcardProgress(
                user_id=user_id,
                session_id=session_id,
                card_index=card_index,
                ease_factor=250,  # 2.50
                interval=1,
                repetitions=0,
                last_quality=clean_quality,
                next_review=now,
                updated_at=now
            )
            db.add(progress)
            db.flush()

        # Calculate SM-2 algorithm:
        q = clean_quality
        ef_float = (progress.ease_factor / 100.0) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        ef_float = max(1.30, ef_float)
        progress.ease_factor = int(round(ef_float * 100))

        if q < 3:
            progress.repetitions = 0
            progress.interval = 1
        else:
            if progress.repetitions == 0:
                progress.interval = 1
            elif progress.repetitions == 1:
                progress.interval = 6
            else:
                progress.interval = min(3650, max(1, int(round(progress.interval * (progress.ease_factor / 100.0)))))
            progress.repetitions += 1

        progress.last_quality = q
        progress.updated_at = now
        safe_interval = min(3650, max(1, progress.interval or 1))
        progress.interval = safe_interval
        progress.next_review = now + timedelta(days=safe_interval)

        # Log event
        event = LearningEvent(
            user_id=user_id,
            session_id=session_id,
            event_type="FLASHCARD_REVIEW",
            payload={
                "card_index": card_index,
                "quality": q,
                "interval": progress.interval,
                "repetitions": progress.repetitions,
                "ease_factor": progress.ease_factor,
                "next_review": progress.next_review.isoformat(),
                "idempotency_key": idempotency_key
            },
            timestamp=now
        )
        db.add(event)
        db.commit()
        db.refresh(progress)

        return {
            "card_index": progress.card_index,
            "interval": progress.interval,
            "repetitions": progress.repetitions,
            "ease_factor": round(progress.ease_factor / 100.0, 2),
            "next_review": progress.next_review.isoformat(),
            "last_quality": progress.last_quality,
            "idempotent_replay": False
        }

    @classmethod
    def get_spaced_revision_cards(
        cls,
        db: Session,
        user_id: int,
        session_id: int
    ) -> Dict[str, Any]:
        """
        Finds flashcards scheduled for review (next_review <= now) or never reviewed.
        Scattered across session flashcard array with ownership isolation.
        """
        session = db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.user_id == user_id
        ).first()
        if not session:
            return {"session_id": session_id, "due_cards": [], "total_cards": 0, "due_count": 0}

        cards = session.flashcards or []
        now = datetime.utcnow()

        progress_records = {
            p.card_index: p
            for p in db.query(FlashcardProgress).filter(
                FlashcardProgress.user_id == user_id,
                FlashcardProgress.session_id == session_id
            ).all()
        }

        due_cards = []
        for idx, card in enumerate(cards):
            prog = progress_records.get(idx)
            if prog is None:
                # Never reviewed yet - automatically due
                due_cards.append({
                    "card_index": idx,
                    "card": card,
                    "interval": 0,
                    "repetitions": 0,
                    "ease_factor": 2.50,
                    "next_review": now.isoformat(),
                    "status": "new"
                })
            elif prog.next_review <= now:
                due_cards.append({
                    "card_index": idx,
                    "card": card,
                    "interval": prog.interval,
                    "repetitions": prog.repetitions,
                    "ease_factor": round(prog.ease_factor / 100.0, 2),
                    "next_review": prog.next_review.isoformat() if prog.next_review else now.isoformat(),
                    "status": "due"
                })

        return {
            "session_id": session_id,
            "due_cards": due_cards,
            "total_cards": len(cards),
            "due_count": len(due_cards)
        }
