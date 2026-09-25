from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from app.classification.pipeline import classify_text
from .client import GeminiClient, GeminiUnavailable
from .prompts import TASK_INTERPRETATION_PROMPT
from .schemas import NormalizedTaskInterpretation, TaskInterpretation


def _local_deadline(value: Optional[str], tz: ZoneInfo) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo:
        parsed = parsed.astimezone(tz).replace(tzinfo=None)
    # Existing scheduler stores wall-clock datetimes. Keep that durable
    # contract while making the interpretation relative to the user's zone.
    return parsed


def _priority_name(priority: Optional[int]) -> str:
    return "urgent" if (priority or 3) >= 5 else "high" if (priority or 3) >= 4 else "low" if (priority or 3) <= 2 else "medium"


def fallback_interpretation(text: str, timezone_name: str, now: datetime) -> NormalizedTaskInterpretation:
    result = classify_text(text, now=now, allow_llm=False)
    category = "project_idea" if result.category == "idea" else (result.category or "random_thought")
    return NormalizedTaskInterpretation(
        intent=category if category in {"task", "reminder", "deadline", "study", "project_idea", "question", "note", "random_thought"} else "random_thought",
        title=" ".join(text.split())[:240],
        category=category if category in {"task", "reminder", "deadline", "study", "project_idea", "question", "note", "random_thought"} else "random_thought",
        priority=_priority_name(result.priority),
        estimated_minutes=result.est_duration_min,
        deadline=result.deadline.replace(tzinfo=None) if result.deadline else None,
        actionable=category in {"task", "reminder", "deadline", "study"},
        project_candidate=category == "project_idea",
        confidence=max(0.0, min(result.confidence, 1.0)),
    )


def interpret_task(text: str, timezone_name: str, now: Optional[datetime] = None, client: Optional[GeminiClient] = None) -> NormalizedTaskInterpretation:
    tz = ZoneInfo(timezone_name)
    local_now = now.astimezone(tz) if now and now.tzinfo else (now.replace(tzinfo=tz) if now else datetime.now(tz))
    service = client or GeminiClient()
    if not service.available:
        raise GeminiUnavailable("Gemini is not configured")
    parsed = service.generate_structured(
        TASK_INTERPRETATION_PROMPT.format(timezone=timezone_name, now=local_now.isoformat(), text=text),
        TaskInterpretation,
    )
    try:
        return NormalizedTaskInterpretation(**parsed.model_dump(exclude={"deadline"}), deadline=_local_deadline(parsed.deadline, tz))
    except (TypeError, ValueError) as exc:
        # A schema-valid string can still be an invalid datetime. Treat it as
        # unreliable provider output and let the deterministic path continue.
        raise GeminiUnavailable("Gemini returned an invalid deadline") from exc
