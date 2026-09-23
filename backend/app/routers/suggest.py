from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    NowSuggestionResponse,
    SuggestionActionRequest,
    SuggestionActionResponse,
)
from app import crud

router = APIRouter(prefix="/suggest", tags=["suggestion"])


@router.get("/now", response_model=NowSuggestionResponse)
def get_now_suggestion(
    now: Optional[datetime] = Query(
        None,
        description="ISO datetime for context evaluation (defaults to current system time)",
    ),
    db: Session = Depends(get_db),
):
    """
    'What should I do now?' (SPEC 1.8 & 1.9 Step 8)
    Returns the top-ranked item or status for the current time context:
    - Routine block in progress -> routine advisory
    - Active scheduled slot -> scheduled item
    - Preferred deep work window -> high priority focus task
    - Free gap -> best-fit task sized for available gap before next event
    - Off hours -> light task / wind down
    - Clear -> caught up
    """
    return crud.get_now_suggestion(db=db, now=now)


@router.post("/action", response_model=SuggestionActionResponse)
def record_suggestion_action(
    payload: SuggestionActionRequest,
    db: Session = Depends(get_db),
):
    """
    Record user response to a suggestion (accept or dismiss).
    Logs to feedback_log table with suggestion_accepted flag.
    """
    try:
        return crud.record_suggestion_action(
            db=db,
            item_id=payload.item_id,
            action=payload.action,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

