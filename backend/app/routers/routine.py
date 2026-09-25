from typing import List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    RoutineBlockCreate,
    RoutineBlockUpdate,
    RoutineBlockResponse,
    UserPrefsUpdate,
    UserPrefsResponse,
)
from app.auth import get_current_active_user
import app.crud as crud

router = APIRouter(tags=["routine"])


@router.get("/routine", response_model=List[RoutineBlockResponse])
def get_routine(
    day_of_week: Optional[int] = Query(None, ge=0, le=6, description="Filter by day (0=Monday, 6=Sunday)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve recurring routine blocks for the authenticated user."""
    return crud.get_routine_blocks(db=db, user_id=current_user.id, day_of_week=day_of_week)


@router.post("/routine", response_model=RoutineBlockResponse, status_code=status.HTTP_201_CREATED)
def add_routine_block(
    block_in: RoutineBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Add a new fixed routine block for the authenticated user."""
    return crud.create_routine_block(db=db, block_in=block_in, user_id=current_user.id)


@router.patch("/routine/{block_id}", response_model=RoutineBlockResponse)
def update_routine_block(
    block_id: int,
    block_in: RoutineBlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update an existing routine block owned by the user."""
    try:
        updated = crud.update_routine_block(
            db=db,
            block_id=block_id,
            user_id=current_user.id,
            block_in=block_in,
        )
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
    current_user: User = Depends(get_current_active_user),
):
    """Delete a routine block owned by the user."""
    deleted = crud.delete_routine_block(db=db, block_id=block_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Routine block {block_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/prefs", response_model=UserPrefsResponse)
def get_user_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve user preferences for the authenticated user."""
    return crud.get_or_create_user_prefs(db=db, user_id=current_user.id)


@router.patch("/prefs", response_model=UserPrefsResponse)
def update_user_preferences(
    prefs_in: UserPrefsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update user preferences for the authenticated user."""
    if prefs_in.timezone is not None:
        try:
            ZoneInfo(prefs_in.timezone)
        except ZoneInfoNotFoundError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="timezone must be a valid IANA timezone")
    return crud.update_user_prefs(db=db, prefs_in=prefs_in, user_id=current_user.id)
