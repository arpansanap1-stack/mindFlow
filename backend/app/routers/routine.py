from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    RoutineBlockCreate,
    RoutineBlockUpdate,
    RoutineBlockResponse,
    UserPrefsUpdate,
    UserPrefsResponse,
)
import app.crud as crud

router = APIRouter(tags=["routine"])


@router.get("/routine", response_model=List[RoutineBlockResponse])
def get_routine(
    day_of_week: Optional[int] = Query(None, ge=0, le=6, description="Filter by day (0=Monday, 6=Sunday)"),
    db: Session = Depends(get_db),
):
    """Retrieve recurring routine blocks, optionally filtered by day of week."""
    return crud.get_routine_blocks(db=db, day_of_week=day_of_week)


@router.post("/routine", response_model=RoutineBlockResponse, status_code=status.HTTP_201_CREATED)
def add_routine_block(
    block_in: RoutineBlockCreate,
    db: Session = Depends(get_db),
):
    """Add a new fixed routine block."""
    return crud.create_routine_block(db=db, block_in=block_in)


@router.patch("/routine/{block_id}", response_model=RoutineBlockResponse)
def update_routine_block(
    block_id: int,
    block_in: RoutineBlockUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing routine block."""
    try:
        updated = crud.update_routine_block(db=db, block_id=block_id, block_in=block_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Routine block {block_id} not found",
        )
    return updated


@router.delete("/routine/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine_block(
    block_id: int,
    db: Session = Depends(get_db),
):
    """Delete a routine block."""
    deleted = crud.delete_routine_block(db=db, block_id=block_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Routine block {block_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/prefs", response_model=UserPrefsResponse)
def get_user_preferences(db: Session = Depends(get_db)):
    """Retrieve user preferences (deep hours, break duration, category multipliers)."""
    return crud.get_or_create_user_prefs(db=db, user_id=1)


@router.patch("/prefs", response_model=UserPrefsResponse)
def update_user_preferences(
    prefs_in: UserPrefsUpdate,
    db: Session = Depends(get_db),
):
    """Update user preferences (preferred deep work windows and break duration)."""
    return crud.update_user_prefs(db=db, prefs_in=prefs_in, user_id=1)

