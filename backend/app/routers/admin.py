import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    UserResponse,
    UserCreate,
    UserCreateResponse,
    UserUpdateStatus,
    UserResetPassword,
    UserResetPasswordResponse,
)
from app.auth import require_admin, hash_password
from app import crud

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=List[UserResponse])
def list_users(
    query: Optional[str] = Query(None, description="Search by email"),
    role: Optional[str] = Query(None, description="Filter by role: ADMIN or USER"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE or DISABLED"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List users for the admin dashboard. Strictly excludes password hashes."""
    return [UserResponse.model_validate(u) for u in crud.list_users(db, query=query, role=role, status=status)]


@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Admin-only user creation.
    Generates a secure temporary password if none is provided.
    Marks account as requiring password change on initial login.
    """
    existing = crud.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    # Use provided password or generate secure temporary password
    raw_password = payload.temporary_password or secrets.token_urlsafe(10) + "!A1"
    hashed = hash_password(raw_password)

    new_user = crud.create_user(
        db=db,
        user_in=payload,
        hashed_password=hashed,
        must_change_password=True,
    )

    resp = UserCreateResponse.model_validate(new_user)
    resp.initial_password = raw_password
    return resp


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    payload: UserUpdateStatus,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Enable or disable a user account. Admins cannot disable themselves."""
    if admin.id == user_id and payload.status == "DISABLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot disable their own account.",
        )

    updated = crud.update_user_status(db, user_id=user_id, status=payload.status)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found.",
        )
    return UserResponse.model_validate(updated)


@router.post("/users/{user_id}/reset-password", response_model=UserResetPasswordResponse)
def reset_user_password(
    user_id: int,
    payload: Optional[UserResetPassword] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Reset user password to a temporary password.
    Requires password change upon their next login.
    """
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found.",
        )

    raw_password = (payload.new_password if payload and payload.new_password else None) or secrets.token_urlsafe(10) + "!A1"
    hashed = hash_password(raw_password)

    crud.update_user_password(
        db=db,
        user_id=user_id,
        password_hash=hashed,
        must_change_password=True,
    )

    return UserResetPasswordResponse(
        status="success",
        user_id=user_id,
        temporary_password=raw_password,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Permanently delete a user account and all their data. Admins cannot delete themselves."""
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account.",
        )

    deleted = crud.delete_user(db, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

