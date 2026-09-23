from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import ItemCreate, ItemUpdate, ItemComplete, ItemResponse, StatusType
from app.auth import get_current_active_user
import app.crud as crud

router = APIRouter(prefix="/items", tags=["items"])


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    item_in: ItemCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new item owned by the authenticated user.
    Runs fast classification pipeline. If ambiguous, dispatches async LLM fallback.
    """
    item, needs_async_llm = crud.create_item_with_flag(db=db, item_in=item_in, user_id=current_user.id)
    if needs_async_llm:
        background_tasks.add_task(crud.async_classify_item, item_id=item.id)
    return item


@router.get("", response_model=List[ItemResponse])
def list_items(
    status: Optional[StatusType] = Query(None, description="Filter by status (inbox, scheduled, done, skipped)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List items belonging only to the authenticated user."""
    return crud.get_items(db=db, user_id=current_user.id, status=status, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single item by ID. Returns 404 if item belongs to another user."""
    item = crud.get_item(db=db, item_id=item_id, user_id=current_user.id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    item_in: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update item fields. Rejects unauthorized access with 404."""
    updated = crud.update_item(db=db, item_id=item_id, user_id=current_user.id, item_in=item_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete an item owned by current user."""
    deleted = crud.delete_item(db=db, item_id=item_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{item_id}/complete", response_model=ItemResponse)
def complete_item(
    item_id: int,
    complete_in: Optional[ItemComplete] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark user's item as done, with optional actual duration feedback."""
    completed = crud.complete_item(
        db=db,
        item_id=item_id,
        user_id=current_user.id,
        complete_in=complete_in,
    )
    if not completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return completed
