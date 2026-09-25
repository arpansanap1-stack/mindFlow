from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Time,
    Boolean,
    ForeignKey,
    CheckConstraint,
    func,
    text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="USER", server_default="USER")
    status = Column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    must_change_password = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN', 'USER')",
            name="check_user_role",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'DISABLED')",
            name="check_user_status",
        ),
    )

    items = relationship("Item", back_populates="user", cascade="all, delete-orphan")
    routine_blocks = relationship("RoutineBlock", back_populates="user", cascade="all, delete-orphan")
    schedule_slots = relationship("ScheduleSlot", back_populates="user", cascade="all, delete-orphan")
    feedback_logs = relationship("FeedbackLog", back_populates="user", cascade="all, delete-orphan")
    prefs = relationship("UserPrefs", back_populates="user", uselist=False, cascade="all, delete-orphan")
    semantic_embeddings = relationship("SemanticEmbedding", back_populates="user", cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, server_default=text("1"), index=True)
    raw_text = Column(Text, nullable=False)
    category = Column(String(20), nullable=True)
    priority = Column(Integer, nullable=True)
    est_duration_min = Column(Integer, nullable=True)
    deadline = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="inbox", server_default="inbox")
    topic_tag = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "category IN ('task', 'idea', 'reminder', 'deadline', 'study', 'project_idea', 'question', 'note', 'random_thought')",
            name="check_item_category",
        ),
        CheckConstraint(
            "priority BETWEEN 1 AND 5",
            name="check_item_priority",
        ),
        CheckConstraint(
            "status IN ('inbox', 'scheduled', 'done', 'skipped')",
            name="check_item_status",
        ),
    )

    user = relationship("User", back_populates="items")
    schedule_slots = relationship("ScheduleSlot", back_populates="item", cascade="all, delete-orphan")
    feedback_logs = relationship("FeedbackLog", back_populates="item", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        if kwargs.get("user_id") is None:
            kwargs["user_id"] = 1
        super().__init__(**kwargs)


class RoutineBlock(Base):
    __tablename__ = "routine_blocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, server_default=text("1"), index=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    label = Column(String(255), nullable=True)
    fixed = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    __table_args__ = (
        CheckConstraint(
            "day_of_week BETWEEN 0 AND 6",
            name="check_routine_day_of_week",
        ),
    )

    user = relationship("User", back_populates="routine_blocks")

    def __init__(self, **kwargs):
        if kwargs.get("user_id") is None:
            kwargs["user_id"] = 1
        super().__init__(**kwargs)


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, server_default=text("1"), index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=True)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    auto_generated = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    user = relationship("User", back_populates="schedule_slots")
    item = relationship("Item", back_populates="schedule_slots")

    def __init__(self, **kwargs):
        if kwargs.get("user_id") is None:
            kwargs["user_id"] = 1
        super().__init__(**kwargs)


class FeedbackLog(Base):
    __tablename__ = "feedback_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1, server_default=text("1"), index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=True)
    estimated_duration = Column(Integer, nullable=True)
    actual_duration = Column(Integer, nullable=True)
    suggestion_accepted = Column(Boolean, nullable=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())

    user = relationship("User", back_populates="feedback_logs")
    item = relationship("Item", back_populates="feedback_logs")

    def __init__(self, **kwargs):
        if kwargs.get("user_id") is None:
            kwargs["user_id"] = 1
        super().__init__(**kwargs)


class UserPrefs(Base):
    __tablename__ = "user_prefs"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, default=1, server_default=text("1"))
    preferred_deep_hours = Column(Text, nullable=True)         # JSON e.g. ["09:00-11:00"]
    break_duration_pref = Column(Integer, nullable=False, default=10, server_default=text("10"))
    category_duration_multiplier = Column(Text, nullable=True) # JSON e.g. {"study": 1.4}
    timezone = Column(String(64), nullable=False, default="UTC", server_default="UTC")

    user = relationship("User", back_populates="prefs")


class SemanticEmbedding(Base):
    """User-scoped cache of externally generated embeddings.

    PostgreSQL vector extensions are intentionally not required; keeping the
    vector as JSON lets this focused app use semantic search immediately and
    leaves a later pgvector migration as an optimization, not an architecture
    dependency.
    """
    __tablename__ = "semantic_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=False)
    model = Column(String(128), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())

    __table_args__ = (
        CheckConstraint("entity_type IN ('item')", name="check_embedding_entity_type"),
    )

    user = relationship("User", back_populates="semantic_embeddings")
