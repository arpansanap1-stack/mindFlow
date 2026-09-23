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
)
from sqlalchemy.orm import relationship
from app.database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
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
            "category IN ('task', 'idea', 'reminder', 'deadline')",
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

    schedule_slots = relationship("ScheduleSlot", back_populates="item", cascade="all, delete-orphan")
    feedback_logs = relationship("FeedbackLog", back_populates="item", cascade="all, delete-orphan")


class RoutineBlock(Base):
    __tablename__ = "routine_blocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    label = Column(String(255), nullable=True)
    fixed = Column(Boolean, nullable=False, default=True, server_default="1")

    __table_args__ = (
        CheckConstraint(
            "day_of_week BETWEEN 0 AND 6",
            name="check_routine_day_of_week",
        ),
    )


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=True)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    auto_generated = Column(Boolean, nullable=False, default=True, server_default="1")

    item = relationship("Item", back_populates="schedule_slots")


class FeedbackLog(Base):
    __tablename__ = "feedback_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=True)
    estimated_duration = Column(Integer, nullable=True)
    actual_duration = Column(Integer, nullable=True)
    suggestion_accepted = Column(Boolean, nullable=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())

    item = relationship("Item", back_populates="feedback_logs")


class UserPrefs(Base):
    __tablename__ = "user_prefs"

    user_id = Column(Integer, primary_key=True, default=1, server_default="1")
    preferred_deep_hours = Column(Text, nullable=True)         # JSON e.g. ["09:00-11:00"]
    break_duration_pref = Column(Integer, nullable=False, default=10, server_default="10")
    category_duration_multiplier = Column(Text, nullable=True) # JSON e.g. {"study": 1.4}

