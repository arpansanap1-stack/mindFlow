from __future__ import annotations

from collections import Counter
from statistics import mean

from sqlalchemy.orm import Session

from app.models import FeedbackLog, Item
from .client import GeminiClient, GeminiUnavailable


def computed_metrics(db: Session, user_id: int) -> dict:
    """All numeric claims are calculated here, before an LLM may explain them."""
    items = db.query(Item).filter(Item.user_id == user_id).all()
    feedback = db.query(FeedbackLog).filter(FeedbackLog.user_id == user_id).all()
    completed = [item for item in items if item.status == "done"]
    samples = [row for row in feedback if row.estimated_duration is not None and row.actual_duration is not None]
    category_counts = Counter(item.category or "uncategorized" for item in items)
    return {
        "total_items": len(items),
        "completed_items": len(completed),
        "completion_rate": round(len(completed) / len(items), 3) if items else 0.0,
        "category_counts": dict(category_counts),
        "duration_samples": len(samples),
        "average_estimated_minutes": round(mean(row.estimated_duration for row in samples), 1) if samples else None,
        "average_actual_minutes": round(mean(row.actual_duration for row in samples), 1) if samples else None,
    }


def generate_insight(db: Session, user_id: int, client: GeminiClient | None = None) -> tuple[str, dict, str]:
    metrics = computed_metrics(db, user_id)
    service = client or GeminiClient()
    if not service.available:
        return "Your progress metrics are available above. Add completion durations to unlock estimation insights.", metrics, "deterministic_fallback"
    from pydantic import BaseModel, Field
    class _Insight(BaseModel):
        summary: str = Field(min_length=1, max_length=700)
    try:
        reply = service.generate_structured(
            "Explain the following exact MindFlow metrics in one careful, non-judgmental paragraph. Do not invent any statistic or cause. Metrics: " + str(metrics),
            _Insight,
        )
        return reply.summary, metrics, "gemini"
    except GeminiUnavailable:
        return "Your progress metrics are available above. Add completion durations to unlock estimation insights.", metrics, "deterministic_fallback"
