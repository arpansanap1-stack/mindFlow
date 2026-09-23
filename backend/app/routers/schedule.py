from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    ScheduleSlotResponse,
    ScheduleRunRequest,
    ScheduleRunResponse,
)
import app.crud as crud

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=List[ScheduleSlotResponse])
def get_schedule(
    date_param: Optional[date] = Query(None, alias="date", description="Date YYYY-MM-DD (defaults to today)"),
    db: Session = Depends(get_db),
):
    """Retrieve schedule slots for a given date."""
    target_date = date_param or date.today()
    slots = crud.get_schedule_slots(db=db, slot_date=target_date)
    return slots


@router.post("/run", response_model=ScheduleRunResponse)
def run_scheduler(
    request: Optional[ScheduleRunRequest] = None,
    db: Session = Depends(get_db),
):
    """Trigger the greedy scheduler for a given date (defaults to today). Also runs daily reschedule job."""
    target_date = (request.date if request and request.date else date.today())
    return crud.run_scheduler_for_date(db=db, target_date=target_date)

