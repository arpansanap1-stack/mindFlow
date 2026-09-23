from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import FeedbackStatsResponse, FeedbackRecalibrateResponse
from app import crud

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/stats", response_model=FeedbackStatsResponse)
def get_feedback_stats(db: Session = Depends(get_db)):
    """Get feedback log statistics and current category multipliers."""
    return crud.get_feedback_stats(db)


@router.post("/recalibrate", response_model=FeedbackRecalibrateResponse)
def recalibrate_multipliers(
    min_samples: int = Query(
        default=5,
        ge=1,
        description="Minimum completed items with duration required to calibrate multiplier",
    ),
    db: Session = Depends(get_db),
):
    """
    Compute duration multipliers for categories/topics with >= min_samples entries.
    multiplier = avg(actual_duration / est_duration), clamped between 0.5x and 3.0x.
    Persists updated multipliers to user preferences.
    """
    return crud.recalibrate_multipliers(db, min_samples=min_samples)

