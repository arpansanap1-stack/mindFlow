import json
import logging
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

import dateparser
from app.config import settings
from app.classification.types import ClassificationResult, CategoryType

logger = logging.getLogger(__name__)


class LLMClassificationSchema(BaseModel):
    category: CategoryType = Field(
        description="Category of the item: 'task' | 'idea' | 'reminder' | 'deadline'"
    )
    priority: int = Field(
        ge=1,
        le=5,
        default=3,
        description="Priority between 1 (lowest) and 5 (highest)",
    )
    est_duration_min: int = Field(
        ge=5,
        default=30,
        description="Estimated duration in minutes (e.g. 15, 30, 45, 60)",
    )
    deadline: Optional[str] = Field(
        None,
        description="ISO-8601 formatted datetime string if any deadline is specified or implied, otherwise null",
    )
    topic_tag: Optional[str] = Field(
        None,
        description="Short, lowercase single-word topic or context tag (e.g. work, personal, learning, health)",
    )


def classify_by_llm(
    text: str,
    partial_result: Optional[ClassificationResult] = None,
    api_key: Optional[str] = None,
    client=None,
    model: Optional[str] = None,
) -> ClassificationResult:
    """
    Layer 3: LLM fallback for ambiguous captures (SPEC 1.5).
    Calls Gemini API with strict JSON schema:
    {"category": "task|idea|reminder|deadline", "priority": 1, "est_duration_min": 30, "deadline": "ISO-8601 or null", "topic_tag": "string"}
    
    Returns ClassificationResult with confidence=0.9 and layer_used='llm'.
    If no API key is configured or Gemini call fails, safely falls back to partial_result.
    """
    key = api_key or settings.GEMINI_API_KEY
    if not key and client is None:
        logger.debug("No GEMINI_API_KEY configured; skipping Layer 3 LLM fallback.")
        if partial_result:
            return partial_result
        return ClassificationResult(
            category=None,
            priority=3,
            est_duration_min=30,
            confidence=0.0,
            layer_used="llm_skipped",
        )

    model_name = model or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")

    try:
        if client is None:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=key)
        else:
            from google.genai import types

        prompt = f"""You are the classification engine for MindFlow, a personal task and thought management system.
Classify the following user capture into structured fields.
Reference datetime: {datetime.now().isoformat()}

User capture:
"{text}"
"""

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=LLMClassificationSchema.model_json_schema(),
                temperature=0.1,
            ),
        )

        response_text = response.text if hasattr(response, "text") else str(response)
        parsed = json.loads(response_text)

        # Parse and sanitize category
        raw_cat = str(parsed.get("category", "idea")).lower().strip()
        category: Optional[CategoryType] = (
            raw_cat if raw_cat in ("task", "idea", "reminder", "deadline") else "idea"
        )

        # Priority (1-5)
        raw_priority = parsed.get("priority", 3)
        try:
            priority = max(1, min(5, int(raw_priority)))
        except (ValueError, TypeError):
            priority = 3

        # Est duration
        raw_dur = parsed.get("est_duration_min", 30)
        try:
            est_duration_min = max(5, int(raw_dur))
        except (ValueError, TypeError):
            est_duration_min = 30

        # Topic tag
        raw_topic = parsed.get("topic_tag")
        topic_tag = (
            str(raw_topic).strip().lower().replace("#", "")
            if raw_topic and str(raw_topic).lower() != "null"
            else None
        )

        # Deadline parsing
        deadline = None
        raw_deadline = parsed.get("deadline")
        if raw_deadline and str(raw_deadline).lower() != "null":
            try:
                deadline = datetime.fromisoformat(str(raw_deadline))
            except Exception:
                deadline = dateparser.parse(str(raw_deadline))

        # Preserve earlier rule extractions if LLM did not extract them
        if partial_result:
            if deadline is None and partial_result.deadline:
                deadline = partial_result.deadline
            if not topic_tag and partial_result.topic_tag:
                topic_tag = partial_result.topic_tag

        return ClassificationResult(
            category=category,
            priority=priority,
            est_duration_min=est_duration_min,
            deadline=deadline,
            topic_tag=topic_tag,
            confidence=0.92,
            layer_used="llm",
        )

    except Exception as e:
        logger.warning(f"Gemini LLM classification failed: {e}; falling back to previous layer.")
        if partial_result:
            return partial_result
        return ClassificationResult(
            category=None,
            priority=3,
            est_duration_min=30,
            confidence=0.0,
            layer_used="llm_failed",
        )

