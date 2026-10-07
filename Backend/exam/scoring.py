"""Deterministic scoring engine and topic performance analysis for Exam Engine."""

from typing import List, Dict, Any, Optional, Tuple


def evaluate_answer(user_answer: Optional[int], correct_answer: int) -> bool:
    """Evaluates whether the user answer matches the correct answer.
    Guarantees that None == None NEVER evaluates as True.
    """
    if user_answer is None:
        return False
    try:
        return int(user_answer) == int(correct_answer)
    except (ValueError, TypeError):
        return False


def calculate_topic_performance(graded_questions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Aggregates scores by topic into structured metrics:
    {
        "DBMS Normalization": {"correct": 2, "total": 3, "percentage": 67},
        "Transactions": {"correct": 4, "total": 4, "percentage": 100}
    }
    """
    topic_map: Dict[str, Dict[str, int]] = {}

    for q in graded_questions:
        topic = (q.get("topic") or "General").strip()
        if topic not in topic_map:
            topic_map[topic] = {"correct": 0, "total": 0}
        topic_map[topic]["total"] += 1
        if q.get("is_correct"):
            topic_map[topic]["correct"] += 1

    result: Dict[str, Dict[str, Any]] = {}
    for topic, counts in topic_map.items():
        total = counts["total"]
        correct = counts["correct"]
        pct = round((correct / total) * 100) if total > 0 else 0
        result[topic] = {
            "correct": correct,
            "total": total,
            "percentage": pct
        }

    return result


def generate_recommended_actions(
    topic_scores: Dict[str, Dict[str, Any]],
    passing_percentage: int = 70
) -> List[str]:
    """Generates evidence-based next actions based on topic performance."""
    recommendations = []
    weak_topics = []

    for topic, stats in topic_scores.items():
        if stats.get("percentage", 0) < passing_percentage:
            weak_topics.append(f"{topic} ({stats.get('percentage')}%)")

    if weak_topics:
        recommendations.append(
            f"Review focus required for weak areas: {', '.join(weak_topics)}."
        )
        recommendations.append(
            "Use the Adaptive Study Planner to schedule targeted review sessions for these topics."
        )
        recommendations.append(
            "Practice targeted flashcards and concept maps for incorrect questions."
        )
    else:
        recommendations.append(
            "Outstanding performance! All tested topics achieved the mastery threshold."
        )
        recommendations.append(
            "Consider attempting an advanced difficulty exam or full-syllabus simulation."
        )

    return recommendations
