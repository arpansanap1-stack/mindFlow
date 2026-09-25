import json
from datetime import datetime, timezone, date
from typing import Optional, List, Tuple, Dict
from sqlalchemy.orm import Session, joinedload
from app.models import User, Item, FeedbackLog, RoutineBlock, UserPrefs, ScheduleSlot
from app.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemComplete,
    ItemResponse,
    RoutineBlockCreate,
    RoutineBlockUpdate,
    UserPrefsUpdate,
    UserPrefsResponse,
    ScheduleSlotResponse,
    ScheduleRunResponse,
    FeedbackStatsResponse,
    FeedbackRecalibrateResponse,
    NowSuggestionResponse,
    SuggestionActionResponse,
    RoutineBlockResponse,
    UserCreate,
)
from app.feedback.learning import FeedbackSample, compute_multipliers
from app.config import settings
from app.classification.pipeline import classify_text
from app.scheduler.types import (
    InboxItem,
    RoutineBlockItem,
    ExistingSlotItem,
    SchedulerPrefs,
)
from app.scheduler.algorithm import schedule_day
from app.scheduler.reschedule import (
    SlotWithItemStatus,
    evaluate_reschedule_job,
)
from app.scheduler.suggest import (
    SlotItemContext,
    evaluate_now_suggestion,
)


# --- User Management CRUD ---

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve user by normalized lowercase email."""
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieve user by primary key."""
    return db.query(User).filter(User.id == user_id).first()


def list_users(
    db: Session,
    query: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
) -> List[User]:
    """List users for admin dashboard with optional filtering."""
    q = db.query(User)
    if query:
        term = f"%{query.strip().lower()}%"
        q = q.filter(User.email.ilike(term))
    if role:
        q = q.filter(User.role == role)
    if status:
        q = q.filter(User.status == status)
    return q.order_by(User.created_at.desc(), User.id.desc()).all()


def create_user(
    db: Session,
    user_in: UserCreate,
    hashed_password: str,
    must_change_password: bool = True,
) -> User:
    """Create a new user account managed by admin."""
    user = User(
        email=user_in.email.strip().lower(),
        password_hash=hashed_password,
        role=user_in.role,
        status="ACTIVE",
        must_change_password=must_change_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize default user preferences
    get_or_create_user_prefs(db, user_id=user.id)
    return user


def update_user_status(db: Session, user_id: int, status: str) -> Optional[User]:
    """Enable or disable a user account."""
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.status = status
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def update_user_password(
    db: Session,
    user_id: int,
    password_hash: str,
    must_change_password: bool = False,
) -> Optional[User]:
    """Update user password and must_change_password flag."""
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.password_hash = password_hash
    user.must_change_password = must_change_password
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """Delete a user account and cascade delete all their data."""
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def init_admin_user_if_needed(db: Session) -> Optional[User]:
    """Bootstrap initial administrator if no users exist in the database."""
    from app.auth import hash_password

    first_user = db.query(User).first()
    if first_user:
        return first_user

    admin_email = settings.INITIAL_ADMIN_EMAIL.strip().lower()
    admin_password = settings.INITIAL_ADMIN_PASSWORD
    hashed = hash_password(admin_password)

    admin = User(
        email=admin_email,
        password_hash=hashed,
        role="ADMIN",
        status="ACTIVE",
        must_change_password=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    get_or_create_user_prefs(db, user_id=admin.id)
    return admin


# --- Items CRUD (User-Scoped) ---

def create_item_with_flag(
    db: Session,
    item_in: ItemCreate,
    user_id: int = 1,
    allow_sync_llm: bool = False,
) -> Tuple[Item, bool]:
    # Run swappable classification pipeline
    classified = classify_text(item_in.raw_text, allow_llm=allow_sync_llm)

    # User explicit overrides take precedence; otherwise use classified values
    category = item_in.category if item_in.category is not None else classified.category
    priority = item_in.priority if item_in.priority is not None else classified.priority
    est_duration_min = (
        item_in.est_duration_min
        if item_in.est_duration_min is not None
        else classified.est_duration_min
    )
    deadline = item_in.deadline if item_in.deadline is not None else classified.deadline
    topic_tag = item_in.topic_tag if item_in.topic_tag is not None else classified.topic_tag

    item = Item(
        user_id=user_id,
        raw_text=item_in.raw_text,
        category=category,
        priority=priority,
        est_duration_min=est_duration_min,
        deadline=deadline,
        status="inbox",
        topic_tag=topic_tag,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Needs async LLM fallback if category is still undetermined and Gemini API key is configured
    needs_async_llm = (
        not allow_sync_llm
        and item_in.category is None
        and category is None
        and bool(settings.GEMINI_API_KEY)
    )

    return item, needs_async_llm


def create_item(db: Session, item_in: ItemCreate, user_id: int = 1) -> Item:
    item, _ = create_item_with_flag(db, item_in, user_id=user_id)
    return item


def async_classify_item(item_id: int, db: Optional[Session] = None) -> None:
    """Async background task for Layer 3 LLM fallback (SPEC 1.5)."""
    from app.database import SessionLocal
    from app.classification.llm import classify_by_llm

    session = db or SessionLocal()
    should_close = db is None
    try:
        item = session.query(Item).filter(Item.id == item_id).first()
        if not item or item.category is not None:
            return

        result = classify_by_llm(item.raw_text)
        if result.is_confident() and result.category:
            item.category = result.category
            if item.priority is None or item.priority == 3:
                item.priority = result.priority
            if item.est_duration_min is None or item.est_duration_min == 30:
                item.est_duration_min = result.est_duration_min
            if item.deadline is None and result.deadline:
                item.deadline = result.deadline
            if item.topic_tag is None and result.topic_tag:
                item.topic_tag = result.topic_tag
            session.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Async LLM classification failed for item {item_id}: {e}")
    finally:
        if should_close:
            session.close()


def get_items(
    db: Session,
    user_id: int = 1,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Item]:
    query = db.query(Item).filter(Item.user_id == user_id)
    if status is not None:
        query = query.filter(Item.status == status)
    return query.order_by(Item.created_at.desc(), Item.id.desc()).offset(skip).limit(limit).all()


def get_item(db: Session, item_id: int, user_id: int = 1) -> Optional[Item]:
    return db.query(Item).filter(Item.id == item_id, Item.user_id == user_id).first()


def update_item(
    db: Session,
    item_id: int,
    item_in: Optional[ItemUpdate] = None,
    user_id: int = 1,
    **kwargs,
) -> Optional[Item]:
    if item_in is None and "item_in" in kwargs:
        item_in = kwargs["item_in"]
    if "user_id" in kwargs:
        user_id = kwargs["user_id"]

    item = get_item(db, item_id, user_id=user_id)
    if not item or item_in is None:
        return None

    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int, user_id: int = 1) -> bool:
    item = get_item(db, item_id, user_id=user_id)
    if not item:
        return False

    db.delete(item)
    db.commit()
    return True


def complete_item(
    db: Session,
    item_id: int,
    complete_in: Optional[ItemComplete] = None,
    user_id: int = 1,
    **kwargs,
) -> Optional[Item]:
    if "user_id" in kwargs:
        user_id = kwargs["user_id"]

    item = get_item(db, item_id, user_id=user_id)
    if not item:
        return None

    item.status = "done"

    actual_duration = complete_in.actual_duration if complete_in else None

    # If duration info is available (either estimated or actual), log feedback
    if actual_duration is not None or item.est_duration_min is not None:
        feedback = FeedbackLog(
            user_id=user_id,
            item_id=item.id,
            estimated_duration=item.est_duration_min,
            actual_duration=actual_duration,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(feedback)

    db.commit()
    db.refresh(item)
    return item


# --- Routine Blocks CRUD (User-Scoped) ---

def get_routine_blocks(
    db: Session,
    user_id: int = 1,
    day_of_week: Optional[int] = None,
) -> List[RoutineBlock]:
    query = db.query(RoutineBlock).filter(RoutineBlock.user_id == user_id)
    if day_of_week is not None:
        query = query.filter(RoutineBlock.day_of_week == day_of_week)
    return query.order_by(RoutineBlock.day_of_week.asc(), RoutineBlock.start_time.asc()).all()


def get_routine_block(db: Session, block_id: int, user_id: int = 1) -> Optional[RoutineBlock]:
    return db.query(RoutineBlock).filter(RoutineBlock.id == block_id, RoutineBlock.user_id == user_id).first()


def create_routine_block(db: Session, block_in: RoutineBlockCreate, user_id: int = 1) -> RoutineBlock:
    block = RoutineBlock(
        user_id=user_id,
        day_of_week=block_in.day_of_week,
        start_time=block_in.start_time,
        end_time=block_in.end_time,
        label=block_in.label,
        fixed=block_in.fixed,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def update_routine_block(
    db: Session,
    block_id: int,
    block_in: Optional[RoutineBlockUpdate] = None,
    user_id: int = 1,
    **kwargs,
) -> Optional[RoutineBlock]:
    if "user_id" in kwargs:
        user_id = kwargs["user_id"]
    if block_in is None and "block_in" in kwargs:
        block_in = kwargs["block_in"]

    block = get_routine_block(db, block_id, user_id=user_id)
    if not block or block_in is None:
        return None

    update_data = block_in.model_dump(exclude_unset=True)
    new_start = update_data.get("start_time", block.start_time)
    new_end = update_data.get("end_time", block.end_time)
    if new_start >= new_end:
        raise ValueError("end_time must be strictly after start_time")

    for field, value in update_data.items():
        setattr(block, field, value)

    db.commit()
    db.refresh(block)
    return block


def delete_routine_block(db: Session, block_id: int, user_id: int = 1) -> bool:
    block = get_routine_block(db, block_id, user_id=user_id)
    if not block:
        return False

    db.delete(block)
    db.commit()
    return True


# --- User Preferences (User-Scoped) ---

def _user_prefs_to_response(prefs: UserPrefs) -> UserPrefsResponse:
    preferred_deep_hours = []
    if prefs.preferred_deep_hours:
        try:
            preferred_deep_hours = json.loads(prefs.preferred_deep_hours)
        except Exception:
            preferred_deep_hours = []

    category_duration_multiplier = {}
    if prefs.category_duration_multiplier:
        try:
            category_duration_multiplier = json.loads(prefs.category_duration_multiplier)
        except Exception:
            category_duration_multiplier = {}

    return UserPrefsResponse(
        user_id=prefs.user_id,
        preferred_deep_hours=preferred_deep_hours,
        break_duration_pref=prefs.break_duration_pref,
        category_duration_multiplier=category_duration_multiplier,
        timezone=prefs.timezone or "UTC",
    )


def get_or_create_user_prefs(db: Session, user_id: int = 1) -> UserPrefsResponse:
    prefs = db.query(UserPrefs).filter(UserPrefs.user_id == user_id).first()
    if not prefs:
        prefs = UserPrefs(
            user_id=user_id,
            preferred_deep_hours=json.dumps(["09:00-11:00"]),
            break_duration_pref=10,
            category_duration_multiplier=json.dumps({}),
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return _user_prefs_to_response(prefs)


def update_user_prefs(
    db: Session,
    prefs_in: UserPrefsUpdate,
    user_id: int = 1,
) -> UserPrefsResponse:
    prefs = db.query(UserPrefs).filter(UserPrefs.user_id == user_id).first()
    if not prefs:
        prefs = UserPrefs(
            user_id=user_id,
            preferred_deep_hours=json.dumps(["09:00-11:00"]),
            break_duration_pref=10,
            category_duration_multiplier=json.dumps({}),
        )
        db.add(prefs)
        db.flush()

    if prefs_in.preferred_deep_hours is not None:
        prefs.preferred_deep_hours = json.dumps(prefs_in.preferred_deep_hours)
    if prefs_in.break_duration_pref is not None:
        prefs.break_duration_pref = prefs_in.break_duration_pref
    if prefs_in.category_duration_multiplier is not None:
        prefs.category_duration_multiplier = json.dumps(prefs_in.category_duration_multiplier)
    if prefs_in.timezone is not None:
        # ZoneInfo is checked at the API boundary. Persist only the canonical
        # user choice; no request supplied user ID is ever involved.
        prefs.timezone = prefs_in.timezone

    db.commit()
    db.refresh(prefs)
    return _user_prefs_to_response(prefs)


# --- Schedule CRUD & Orchestration (User-Scoped) ---

def get_schedule_slots(db: Session, user_id: int = 1, slot_date: Optional[date] = None) -> List[ScheduleSlot]:
    """Retrieve all slots for a given date, ordered by start time, joined with items."""
    target_date = slot_date or date.today()
    return (
        db.query(ScheduleSlot)
        .options(joinedload(ScheduleSlot.item))
        .filter(ScheduleSlot.user_id == user_id, ScheduleSlot.date == target_date)
        .order_by(ScheduleSlot.start_time.asc())
        .all()
    )


def run_reschedule_job(db: Session, user_id: int = 1, current_date: Optional[date] = None) -> int:
    """
    SPEC 1.6 Reschedule job:
    Any schedule_slots row from a past date whose item is not done -> delete slot,
    item reverts to 'inbox'.
    """
    target_date = current_date or date.today()
    past_slots = (
        db.query(ScheduleSlot)
        .join(Item, ScheduleSlot.item_id == Item.id)
        .filter(
            ScheduleSlot.user_id == user_id,
            ScheduleSlot.date < target_date,
        )
        .all()
    )

    status_list = [
        SlotWithItemStatus(
            slot_id=s.id,
            item_id=s.item_id,
            slot_date=s.date,
            item_status=s.item.status if s.item else "done",
        )
        for s in past_slots
        if s.item_id is not None
    ]

    decision = evaluate_reschedule_job(target_date, status_list)

    if decision.slots_to_delete:
        db.query(ScheduleSlot).filter(
            ScheduleSlot.user_id == user_id,
            ScheduleSlot.id.in_(decision.slots_to_delete)
        ).delete(synchronize_session=False)
    if decision.items_to_revert:
        db.query(Item).filter(
            Item.user_id == user_id,
            Item.id.in_(decision.items_to_revert)
        ).update({"status": "inbox"}, synchronize_session=False)

    db.commit()
    db.expire_all()
    return len(decision.items_to_revert)


def run_scheduler_for_date(db: Session, user_id: int = 1, target_date: Optional[date] = None) -> ScheduleRunResponse:
    """
    Orchestrate scheduler for target_date scoped to user_id:
    1. Reschedule past undone items.
    2. Reset existing auto-generated slots on target_date that are not done.
    3. Gather inputs and execute pure greedy algorithm.
    4. Persist slots and update item statuses.
    """
    t_date = target_date or date.today()

    # 1. Reschedule past undone items
    rescheduled_count = run_reschedule_job(db, user_id=user_id, current_date=t_date)

    # 2. Reset existing auto-generated slots on target_date that are not done
    current_slots = (
        db.query(ScheduleSlot)
        .filter(
            ScheduleSlot.user_id == user_id,
            ScheduleSlot.date == t_date,
            ScheduleSlot.auto_generated == True,
        )
        .all()
    )
    for s in current_slots:
        if s.item and s.item.status != "done":
            s.item.status = "inbox"
        db.delete(s)
    db.commit()
    db.expire_all()

    # 3. Gather inputs for pure scheduler
    inbox_items_db = db.query(Item).filter(Item.user_id == user_id, Item.status == "inbox").all()
    inbox_items = [
        InboxItem(
            id=it.id,
            raw_text=it.raw_text,
            category=it.category,
            priority=it.priority,
            est_duration_min=it.est_duration_min,
            deadline=it.deadline,
            created_at=it.created_at,
            topic_tag=it.topic_tag,
        )
        for it in inbox_items_db
    ]

    routine_db = db.query(RoutineBlock).filter(RoutineBlock.user_id == user_id).all()
    routine_items = [
        RoutineBlockItem(
            id=rb.id,
            day_of_week=rb.day_of_week,
            start_time=rb.start_time,
            end_time=rb.end_time,
            label=rb.label,
            fixed=rb.fixed,
        )
        for rb in routine_db
    ]

    existing_slots_db = db.query(ScheduleSlot).filter(
        ScheduleSlot.user_id == user_id,
        ScheduleSlot.date == t_date
    ).all()
    existing_slots = [
        ExistingSlotItem(
            id=es.id,
            item_id=es.item_id,
            date=es.date,
            start_time=es.start_time,
            end_time=es.end_time,
        )
        for es in existing_slots_db
    ]

    user_prefs_resp = get_or_create_user_prefs(db, user_id=user_id)
    prefs = SchedulerPrefs(
        preferred_deep_hours=user_prefs_resp.preferred_deep_hours,
        break_duration_pref=user_prefs_resp.break_duration_pref,
        category_duration_multiplier=user_prefs_resp.category_duration_multiplier,
    )

    # 4. Call pure schedule_day
    result = schedule_day(
        target_date=t_date,
        inbox_items=inbox_items,
        routine_blocks=routine_items,
        existing_slots=existing_slots,
        prefs=prefs,
    )

    # 5. Save proposed slots & update items
    created_slots: List[ScheduleSlot] = []
    for prop in result.scheduled_slots:
        slot = ScheduleSlot(
            user_id=user_id,
            item_id=prop.item_id,
            date=prop.date,
            start_time=prop.start_time,
            end_time=prop.end_time,
            auto_generated=prop.auto_generated,
        )
        db.add(slot)
        item = db.query(Item).filter(Item.user_id == user_id, Item.id == prop.item_id).first()
        if item:
            item.status = "scheduled"
        created_slots.append(slot)

    db.commit()

    # Re-fetch created slots with item relationship loaded
    persisted_slots = (
        db.query(ScheduleSlot)
        .options(joinedload(ScheduleSlot.item))
        .filter(ScheduleSlot.user_id == user_id, ScheduleSlot.date == t_date)
        .order_by(ScheduleSlot.start_time.asc())
        .all()
    )

    unplaceable_db_items = (
        db.query(Item).filter(Item.user_id == user_id, Item.id.in_(result.unplaceable_item_ids)).all()
        if result.unplaceable_item_ids
        else []
    )

    return ScheduleRunResponse(
        date=t_date,
        scheduled_count=len(created_slots),
        unplaceable_count=len(unplaceable_db_items),
        rescheduled_count=rescheduled_count,
        slots=[ScheduleSlotResponse.model_validate(s) for s in persisted_slots],
        unplaceable_items=[ItemResponse.model_validate(it) for it in unplaceable_db_items],
    )


# --- Feedback & Learning Loop (User-Scoped) ---

def get_feedback_stats(db: Session, user_id: int = 1) -> FeedbackStatsResponse:
    total = db.query(FeedbackLog).filter(FeedbackLog.user_id == user_id).count()
    valid_logs = (
        db.query(FeedbackLog)
        .join(Item, FeedbackLog.item_id == Item.id)
        .filter(
            FeedbackLog.user_id == user_id,
            FeedbackLog.actual_duration > 0,
            FeedbackLog.estimated_duration > 0,
        )
        .all()
    )
    cat_counts: Dict[str, int] = {}
    topic_counts: Dict[str, int] = {}
    for log in valid_logs:
        if log.item and log.item.category:
            cat = log.item.category.lower()
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        if log.item and log.item.topic_tag:
            topic = log.item.topic_tag.lower()
            topic_counts[topic] = topic_counts.get(topic, 0) + 1

    prefs = get_or_create_user_prefs(db, user_id=user_id)
    return FeedbackStatsResponse(
        total_entries=total,
        samples_with_duration=len(valid_logs),
        category_counts=cat_counts,
        topic_counts=topic_counts,
        multipliers=prefs.category_duration_multiplier,
    )


def recalibrate_multipliers(db: Session, user_id: int = 1, min_samples: int = 5) -> FeedbackRecalibrateResponse:
    valid_logs = (
        db.query(FeedbackLog)
        .join(Item, FeedbackLog.item_id == Item.id)
        .filter(
            FeedbackLog.user_id == user_id,
            FeedbackLog.actual_duration > 0,
            FeedbackLog.estimated_duration > 0,
        )
        .all()
    )
    samples = [
        FeedbackSample(
            item_id=log.item_id,
            category=log.item.category if log.item else None,
            topic_tag=log.item.topic_tag if log.item else None,
            estimated=log.estimated_duration,
            actual=log.actual_duration,
        )
        for log in valid_logs
    ]

    cat_counts: Dict[str, int] = {}
    for s in samples:
        if s.category:
            cat_counts[s.category] = cat_counts.get(s.category, 0) + 1

    new_multipliers = compute_multipliers(samples, min_samples=min_samples)

    # Fetch and update user_prefs for user_id
    prefs = db.query(UserPrefs).filter(UserPrefs.user_id == user_id).first()
    if not prefs:
        prefs = UserPrefs(user_id=user_id, category_duration_multiplier=json.dumps({}))
        db.add(prefs)
        db.flush()

    existing_mult: Dict[str, float] = {}
    if prefs.category_duration_multiplier:
        try:
            existing_mult = json.loads(prefs.category_duration_multiplier)
        except Exception:
            existing_mult = {}

    existing_mult.update(new_multipliers)
    prefs.category_duration_multiplier = json.dumps(existing_mult)
    db.commit()
    db.refresh(prefs)

    return FeedbackRecalibrateResponse(
        total_samples=len(samples),
        category_counts=cat_counts,
        multipliers=existing_mult,
        updated_categories=list(new_multipliers.keys()),
    )


# --- "What should I do now?" Suggestion Engine (User-Scoped) ---

def get_now_suggestion(
    db: Session,
    user_id: int = 1,
    now: Optional[datetime] = None,
) -> NowSuggestionResponse:
    if now is None:
        now = datetime.now(timezone.utc)

    target_date = now.date()

    # 1. Gather routine blocks for user
    routine_db = db.query(RoutineBlock).filter(RoutineBlock.user_id == user_id).all()
    routine_items = [
        RoutineBlockItem(
            id=rb.id,
            day_of_week=rb.day_of_week,
            start_time=rb.start_time,
            end_time=rb.end_time,
            label=rb.label,
            fixed=rb.fixed,
        )
        for rb in routine_db
    ]

    # 2. Gather today's slots with item loaded for user
    slots_db = (
        db.query(ScheduleSlot)
        .options(joinedload(ScheduleSlot.item))
        .filter(ScheduleSlot.user_id == user_id, ScheduleSlot.date == target_date)
        .all()
    )
    today_slots = [
        SlotItemContext(
            id=s.id,
            item_id=s.item_id,
            date=s.date,
            start_time=s.start_time,
            end_time=s.end_time,
            item=InboxItem(
                id=s.item.id,
                raw_text=s.item.raw_text,
                category=s.item.category,
                priority=s.item.priority,
                est_duration_min=s.item.est_duration_min,
                deadline=s.item.deadline,
                created_at=s.item.created_at,
                topic_tag=s.item.topic_tag,
            ) if s.item else None,
            is_done=(s.item.status == "done" if s.item else False),
        )
        for s in slots_db
    ]

    # 3. Gather inbox items for user
    inbox_db = db.query(Item).filter(Item.user_id == user_id, Item.status == "inbox").all()
    inbox_items = [
        InboxItem(
            id=it.id,
            raw_text=it.raw_text,
            category=it.category,
            priority=it.priority,
            est_duration_min=it.est_duration_min,
            deadline=it.deadline,
            created_at=it.created_at,
            topic_tag=it.topic_tag,
        )
        for it in inbox_db
    ]

    # 4. User prefs for user
    user_prefs_resp = get_or_create_user_prefs(db, user_id=user_id)
    prefs = SchedulerPrefs(
        preferred_deep_hours=user_prefs_resp.preferred_deep_hours,
        break_duration_pref=user_prefs_resp.break_duration_pref,
        category_duration_multiplier=user_prefs_resp.category_duration_multiplier,
    )

    # 5. Evaluate pure suggestion
    suggestion = evaluate_now_suggestion(
        now=now,
        inbox_items=inbox_items,
        routine_blocks=routine_items,
        today_slots=today_slots,
        prefs=prefs,
    )

    # 6. Fetch full models for response if present
    item_resp = None
    if suggestion.item:
        db_item = db.query(Item).filter(Item.user_id == user_id, Item.id == suggestion.item.id).first()
        if db_item:
            item_resp = ItemResponse.model_validate(db_item)

    slot_resp = None
    if suggestion.slot:
        db_slot = (
            db.query(ScheduleSlot)
            .options(joinedload(ScheduleSlot.item))
            .filter(ScheduleSlot.user_id == user_id, ScheduleSlot.id == suggestion.slot.id)
            .first()
        )
        if db_slot:
            slot_resp = ScheduleSlotResponse.model_validate(db_slot)

    routine_resp = None
    if suggestion.routine_block:
        db_routine = db.query(RoutineBlock).filter(
            RoutineBlock.user_id == user_id,
            RoutineBlock.id == suggestion.routine_block.id
        ).first()
        if db_routine:
            routine_resp = RoutineBlockResponse.model_validate(db_routine)

    return NowSuggestionResponse(
        context_type=suggestion.context_type,
        current_time=suggestion.current_time,
        reason=suggestion.reason,
        item=item_resp,
        slot=slot_resp,
        routine_block=routine_resp,
        free_minutes_remaining=suggestion.free_minutes_remaining,
        effective_duration_min=suggestion.effective_duration_min,
    )


def record_suggestion_action(
    db: Session,
    item_id: int,
    action: str,
    user_id: int = 1,
) -> SuggestionActionResponse:
    item = db.query(Item).filter(Item.user_id == user_id, Item.id == item_id).first()
    if not item:
        raise ValueError(f"Item {item_id} not found")

    accepted = (action == "accept")
    log = FeedbackLog(
        user_id=user_id,
        item_id=item_id,
        estimated_duration=item.est_duration_min,
        suggestion_accepted=accepted,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return SuggestionActionResponse(
        status="recorded",
        item_id=item_id,
        action=action,
    )
