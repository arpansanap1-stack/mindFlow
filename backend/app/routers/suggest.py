from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    NowSuggestionResponse,
    SuggestionActionRequest,
    SuggestionActionResponse,
)
from app.auth import get_current_active_user
from app import crud

router = APIRouter(prefix="/suggest", tags=["suggestion"])


@router.get("/now", response_model=NowSuggestionResponse)
def get_now_suggestion(
    now: Optional[datetime] = Query(
        None,
        description="ISO datetime for context evaluation (defaults to current system time)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    'What should I do now?'
    Returns the top-ranked item or status for the current user's time context.
    """
    return crud.get_now_suggestion(db=db, user_id=current_user.id, now=now)


@router.post("/action", response_model=SuggestionActionResponse)
def record_suggestion_action(
    payload: SuggestionActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record user response to a suggestion (accept or dismiss).
    Scoped strictly to the authenticated user.
    """
    try:
        return crud.record_suggestion_action(
            db=db,
            user_id=current_user.id,
            item_id=payload.item_id,
            action=payload.action,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
