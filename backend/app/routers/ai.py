from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.auth import get_current_active_user
from app.database import get_db
from app.models import User
from app.schemas import ItemCreate, ItemResponse
from app.services.gemini.assistant import chat, confirm_action, local_now, user_timezone
from app.services.gemini.client import GeminiUnavailable
from app.services.gemini.decomposer import decompose
from app.services.gemini.embeddings import backfill_missing_item_embeddings, search_items
from app.services.gemini.insights import generate_insight
from app.services.gemini.schemas import (
    ChatRequest, ChatResponse, DecomposeApplyRequest, DecomposeRequest, DecompositionPreview,
    InterpretationResponse, InterpretRequest, InsightsResponse, PendingAction,
    SearchRequest, SearchResult,
)
from app.services.gemini.task_parser import fallback_interpretation, interpret_task

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/interpret", response_model=InterpretationResponse)
def interpret(request: InterpretRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Interpret text only. This endpoint never writes an item or invokes the scheduler."""
    tz_name = user_timezone(db, current_user.id)
    now = local_now(db, current_user.id)
    try:
        interpretation = interpret_task(request.text, tz_name, now)
        return InterpretationResponse(interpretation=interpretation, source="gemini")
    except GeminiUnavailable:
        return InterpretationResponse(interpretation=fallback_interpretation(request.text, tz_name, now), source="fallback")


@router.post("/decompose", response_model=DecompositionPreview)
def decompose_project(request: DecomposeRequest, current_user: User = Depends(get_current_active_user)):
    """Returns a preview only; clients must explicitly create any proposed tasks."""
    try:
        return decompose(request.text)
    except GeminiUnavailable:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI decomposition is temporarily unavailable. No tasks were created.")


@router.post("/decompose/apply", response_model=list[ItemResponse], status_code=status.HTTP_201_CREATED)
def apply_decomposition(request: DecomposeApplyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Creates the approved decomposition steps directly into the user's backlog."""
    created_items = []
    for step in request.steps:
        item, _ = crud.create_item_with_flag(
            db,
            ItemCreate(
                raw_text=step.title,
                category="study",
                est_duration_min=step.estimated_minutes,
                priority=3,
            ),
            user_id=current_user.id,
        )
        created_items.append(item)
    return created_items


@router.post("/chat", response_model=ChatResponse)
def assistant_chat(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if request.confirmation_token:
        result = confirm_action(request.confirmation_token, db, current_user)
        return ChatResponse(message=("Confirmed." if result.get("ok") else result.get("error", "Confirmation failed.")), actions=[result], source="deterministic_fallback")
    message, actions, source, pending = chat(request.message, db, current_user)
    return ChatResponse(message=message, actions=actions, source=source, pending_action=PendingAction(**pending) if pending else None)


@router.post("/search", response_model=list[SearchResult])
def semantic_search(request: SearchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Index lazily only in response to an explicit search, bounded to limit
    # unnecessary provider calls and private-context transfer.
    try:
        backfill_missing_item_embeddings(db, current_user.id)
    except GeminiUnavailable:
        pass
    results = search_items(db, current_user.id, request.query, request.limit)
    return [SearchResult(item_id=item.id, raw_text=item.raw_text, category=item.category, score=round(score, 5)) for item, score in results]


@router.get("/insights", response_model=InsightsResponse)
@router.post("/insights", response_model=InsightsResponse)
def insights(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    summary, metrics, source = generate_insight(db, current_user.id)
    return InsightsResponse(summary=summary, metrics=metrics, source=source)
