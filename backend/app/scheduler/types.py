from dataclasses import dataclass, field
from datetime import date, time, datetime
from typing import Optional, List, Dict, Tuple


@dataclass
class InboxItem:
    id: int
    raw_text: str
    category: Optional[str] = "task"
    priority: Optional[int] = 3
    est_duration_min: Optional[int] = 30
    deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None
    topic_tag: Optional[str] = None


@dataclass
class RoutineBlockItem:
    id: int
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: time
    end_time: time
    label: Optional[str] = None
    fixed: bool = True


@dataclass
class ExistingSlotItem:
    id: int
    item_id: Optional[int]
    date: date
    start_time: time
    end_time: time


@dataclass
class ScheduledSlotProposal:
    item_id: int
    date: date
    start_time: time
    end_time: time
    auto_generated: bool = True


@dataclass
class ScheduleResult:
    scheduled_slots: List[ScheduledSlotProposal] = field(default_factory=list)
    unplaceable_item_ids: List[int] = field(default_factory=list)
    explanations: Dict[int, str] = field(default_factory=dict)


@dataclass
class SchedulerPrefs:
    preferred_deep_hours: List[str] = field(default_factory=lambda: ["09:00-11:00"])
    break_duration_pref: int = 10
    category_duration_multiplier: Dict[str, float] = field(default_factory=dict)
    weights: Dict[str, float] = field(
        default_factory=lambda: {"deadline": 0.5, "priority": 0.3, "days_in_inbox": 0.2}
    )
    day_start: time = field(default_factory=lambda: time(8, 0))
    day_end: time = field(default_factory=lambda: time(22, 0))

