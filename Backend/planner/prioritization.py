"""Transparent multi-factor planning priority scoring and explainability engine.

Core Architectural Invariant:
Does NOT replace or modify LearnerTopicMastery or SM-2 algorithms.
Computes a derived planning-specific score for scheduling and task ordering.
"""

from typing import Optional, Dict, Any, Tuple


def compute_planning_priority(
    mastery_score: Optional[float] = None,
    sm2_due_count: int = 0,
    recent_quiz_accuracy: Optional[float] = None,
    days_to_exam: Optional[int] = None,
    days_since_last_studied: Optional[int] = None,
    is_user_goal: bool = False,
) -> Tuple[float, str, str, Dict[str, Any]]:
    """Calculates transparent Planning Priority (0-100) and human-readable reasoning.

    Returns:
        (priority_score, priority_level, explanation_text, structured_factors)
    """
    score = 45.0  # Baseline neutral priority
    reasons = []
    factors: Dict[str, Any] = {}

    # 1. Weakness / Mastery Evaluation
    if mastery_score is not None:
        factors["mastery_score"] = round(mastery_score, 2)
        if mastery_score < 0.40:
            score += 30.0
            reasons.append(f"Low topic mastery ({int(mastery_score * 100)}%) requires focused review")
        elif mastery_score < 0.70:
            score += 15.0
            reasons.append(f"Moderate topic mastery ({int(mastery_score * 100)}%) needs reinforcement")
        elif mastery_score >= 0.85:
            score -= 20.0
            reasons.append(f"High topic mastery ({int(mastery_score * 100)}%)")
    else:
        factors["mastery_score"] = None
        score += 10.0
        reasons.append("New or unassessed topic needs initial exploration")

    # 2. Spaced Repetition Due Cards (SM-2)
    factors["sm2_due_count"] = sm2_due_count
    if sm2_due_count > 0:
        score += 25.0
        reasons.append(f"{sm2_due_count} flashcard{'s' if sm2_due_count != 1 else ''} due for SM-2 spaced repetition")

    # 3. Quiz Performance
    if recent_quiz_accuracy is not None:
        factors["recent_quiz_accuracy"] = round(recent_quiz_accuracy, 2)
        if recent_quiz_accuracy < 50.0:
            score += 25.0
            reasons.append(f"Recent quiz accuracy was low ({int(recent_quiz_accuracy)}%)")
        elif recent_quiz_accuracy < 70.0:
            score += 10.0
            reasons.append(f"Recent quiz accuracy was {int(recent_quiz_accuracy)}%")
        elif recent_quiz_accuracy >= 90.0:
            score -= 15.0
            reasons.append(f"Recent quiz performance was strong ({int(recent_quiz_accuracy)}%)")

    # 4. Exam / Deadline Urgency
    if days_to_exam is not None:
        factors["days_to_exam"] = days_to_exam
        if days_to_exam <= 3:
            score += 35.0
            reasons.append(f"Exam is approaching in {days_to_exam} day{'s' if days_to_exam != 1 else ''}")
        elif days_to_exam <= 7:
            score += 25.0
            reasons.append(f"Exam in {days_to_exam} days")
        elif days_to_exam <= 14:
            score += 15.0
            reasons.append(f"Exam in {days_to_exam} days")
        elif days_to_exam <= 30:
            score += 5.0
            reasons.append(f"Exam in {days_to_exam} days")

    # 5. Decay / Time Since Last Studied
    if days_since_last_studied is not None:
        factors["days_since_last_studied"] = days_since_last_studied
        if days_since_last_studied > 14:
            score += 15.0
            reasons.append(f"Has not been reviewed in {days_since_last_studied} days")
        elif days_since_last_studied > 7:
            score += 8.0
            reasons.append(f"Last studied {days_since_last_studied} days ago")

    # 6. Learner Explicit Goal
    if is_user_goal:
        factors["is_user_goal"] = True
        score += 15.0
        reasons.append("Selected as a key focus goal by learner")

    # Clamp priority score between 5.0 and 100.0
    final_score = max(5.0, min(100.0, score))

    if final_score >= 80.0:
        level = "critical"
    elif final_score >= 60.0:
        level = "high"
    elif final_score >= 40.0:
        level = "medium"
    else:
        level = "low"

    explanation = "; ".join(reasons) if reasons else "Standard scheduled study progression"
    return final_score, level, explanation, factors
