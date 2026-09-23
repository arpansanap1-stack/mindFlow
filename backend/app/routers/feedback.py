from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import FeedbackStatsResponse, FeedbackRecalibrateResponse
from app.auth import get_current_active_user
from app import crud

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/stats", response_model=FeedbackStatsResponse)
def get_feedback_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get feedback log statistics and duration multipliers for the authenticated user."""
    return crud.get_feedback_stats(db, user_id=current_user.id)


@router.post("/recalibrate", response_model=FeedbackRecalibrateResponse)
def recalibrate_multipliers(
    min_samples: int = Query(
        default=5,
        ge=1,
        description="Minimum completed items with duration required to calibrate multiplier",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Compute duration multipliers for categories/topics with >= min_samples entries for the user.
    Persists updated multipliers to the user's preferences.
    """
    return crud.recalibrate_multipliers(db, user_id=current_user.id, min_samples=min_samples)
