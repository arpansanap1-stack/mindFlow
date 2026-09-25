from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


AIIntent = Literal["task", "reminder", "deadline", "study", "project_idea", "question", "note", "random_thought"]
PriorityName = Literal["low", "medium", "high", "urgent"]
EnergyLevel = Literal["low", "medium", "high"]


class TaskInterpretation(BaseModel):
    """Strict, deliberately small contract accepted from Gemini."""
    model_config = ConfigDict(extra="forbid")

    intent: AIIntent
    title: str = Field(min_length=1, max_length=240)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: AIIntent
    priority: PriorityName = "medium"
    estimated_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    deadline: Optional[str] = Field(default=None, max_length=64)
    preferred_time: Optional[str] = Field(default=None, max_length=40)
    recurrence: Optional[str] = Field(default=None, max_length=100)
    energy_level: Optional[EnergyLevel] = None
    actionable: bool
    project_candidate: bool = False
    confidence: float = Field(ge=0, le=1)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return " ".join(value.split())


class NormalizedTaskInterpretation(TaskInterpretation):
    deadline: Optional[datetime] = None


class InterpretationResponse(BaseModel):
    interpretation: NormalizedTaskInterpretation
    source: Literal["gemini", "fallback"]


class InterpretRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class DecompositionStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=240)
    estimated_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    depends_on: list[int] = Field(default_factory=list)
    order: int = Field(ge=1, le=50)


class DecompositionPreview(BaseModel):
    project_title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1, max_length=1000)
    steps: list[DecompositionStep] = Field(min_length=1, max_length=20)


class DecomposeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    confirmation_token: Optional[str] = None


class PendingAction(BaseModel):
    token: str
    summary: str
    expires_at: datetime


class ChatResponse(BaseModel):
    message: str
    actions: list[dict[str, Any]] = Field(default_factory=list)
    pending_action: Optional[PendingAction] = None
    source: Literal["gemini", "deterministic_fallback"]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)


class SearchResult(BaseModel):
    item_id: int
    raw_text: str
    category: Optional[str]
    score: float


class InsightsResponse(BaseModel):
    summary: str
    metrics: dict[str, Any]
    source: Literal["gemini", "deterministic_fallback"]
