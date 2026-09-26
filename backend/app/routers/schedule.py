from datetime import date
from typing import List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    ScheduleSlotResponse,
    ScheduleRunRequest,
    ScheduleRunResponse,
)
from app.auth import get_current_active_user
import app.crud as crud

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _user_today(db: Session, user_id: int) -> date:
    tz_name = crud.get_or_create_user_prefs(db, user_id=user_id).timezone
    return datetime.now(timezone.utc).astimezone(ZoneInfo(tz_name)).date()


@router.get("", response_model=List[ScheduleSlotResponse])
def get_schedule(
    date_param: Optional[date] = Query(None, alias="date", description="Date YYYY-MM-DD (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve schedule slots for a given date for the authenticated user."""
    target_date = date_param or _user_today(db, current_user.id)
    slots = crud.get_schedule_slots(db=db, user_id=current_user.id, slot_date=target_date)
    return slots


@router.post("/run", response_model=ScheduleRunResponse)
def run_scheduler(
    request: Optional[ScheduleRunRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Trigger the greedy scheduler for a given date for the authenticated user."""
    target_date = (request.date if request and request.date else _user_today(db, current_user.id))
    now = request.current_time if request and request.current_time else None
    return crud.run_scheduler_for_date(db=db, user_id=current_user.id, target_date=target_date, now=now)

