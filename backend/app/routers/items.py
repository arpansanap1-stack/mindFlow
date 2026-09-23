from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ItemCreate, ItemUpdate, ItemComplete, ItemResponse, StatusType
import app.crud as crud

router = APIRouter(prefix="/items", tags=["items"])


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    item_in: ItemCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create a new item. Only raw_text is required.
    Runs fast swappable classification pipeline (Layer 1 rules + Layer 2 embeddings).
    If still ambiguous, dispatches async Layer 3 Gemini LLM fallback in the background (SPEC 1.5).
    """
    item, needs_async_llm = crud.create_item_with_flag(db=db, item_in=item_in)
    if needs_async_llm:
        background_tasks.add_task(crud.async_classify_item, item_id=item.id)
    return item


@router.get("", response_model=List[ItemResponse])
def list_items(
    status: Optional[StatusType] = Query(None, description="Filter by status (inbox, scheduled, done, skipped)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List items, optionally filtered by status."""
    return crud.get_items(db=db, status=status, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """Get single item by ID."""
    item = crud.get_item(db=db, item_id=item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_in: ItemUpdate, db: Session = Depends(get_db)):
    """Update item fields (e.g. manual override of category, priority, duration, deadline, status)."""
    updated = crud.update_item(db=db, item_id=item_id, item_in=item_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an item by ID."""
    deleted = crud.delete_item(db=db, item_id=item_id)
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
):
    """Mark an item as done, with optional actual_duration for feedback logging."""
    completed = crud.complete_item(db=db, item_id=item_id, complete_in=complete_in)
    if not completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return completed

