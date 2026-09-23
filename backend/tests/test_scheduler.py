from datetime import date, time, datetime, timezone, timedelta
import pytest

from app.scheduler.types import (
    InboxItem,
    RoutineBlockItem,
    ExistingSlotItem,
    SchedulerPrefs,
)
from app.scheduler.algorithm import (
    time_to_minutes,
    minutes_to_time,
    subtract_intervals,
    compute_urgency_score,
    schedule_day,
)
from app.scheduler.reschedule import (
    SlotWithItemStatus,
    evaluate_reschedule_job,
)


REF_DATE = date(2026, 9, 24)  # Thursday
REF_NOW = datetime(2026, 9, 24, 8, 0, 0, tzinfo=timezone.utc)


def test_time_conversions():
    assert time_to_minutes(time(9, 30)) == 570
    assert minutes_to_time(570) == time(9, 30)
    assert minutes_to_time(0) == time(0, 0)


def test_subtract_intervals():
    base = [(480, 1320)]  # 08:00 to 22:00 (840 minutes)
    blocks = [(720, 780)]  # 12:00 to 13:00 (lunch)

    free = subtract_intervals(base, blocks)
    assert len(free) == 2
    assert free[0] == (480, 720)   # 08:00 to 12:00
    assert free[1] == (780, 1320)  # 13:00 to 22:00


def test_urgency_score():
    prefs = SchedulerPrefs()

    # Item with deadline today vs item with no deadline
    item_urgent = InboxItem(
        id=1,
        raw_text="Tax deadline",
        priority=5,
        deadline=datetime(2026, 9, 24, 17, 0, 0),
        created_at=REF_NOW,
    )
    score_urgent = compute_urgency_score(item_urgent, REF_DATE, prefs, REF_NOW)

    item_someday = InboxItem(
        id=2,
        raw_text="Read book",
        priority=2,
        deadline=None,
        created_at=REF_NOW,
    )
    score_someday = compute_urgency_score(item_someday, REF_DATE, prefs, REF_NOW)

    assert score_urgent > score_someday
    # Priority 5 (0.3*1.0) + deadline today (0.5*1.0) = 0.8
    assert score_urgent >= 0.8


def test_greedy_placement_order_and_deep_hours():
    # Target date: Thursday (weekday 3)
    target_date = date(2026, 9, 24)
    prefs = SchedulerPrefs(
        preferred_deep_hours=["09:00-11:00"],
        break_duration_pref=10,
        day_start=time(8, 0),
        day_end=time(18, 0),
    )

    routine = [
        RoutineBlockItem(
            id=1,
            day_of_week=3,  # Thursday
            start_time=time(12, 0),
            end_time=time(13, 0),
            label="Lunch",
            fixed=True,
        )
    ]

    # Two items: one high priority focus task, one low priority
    items = [
        InboxItem(
            id=1,
            raw_text="Routine chore",
            priority=2,
            est_duration_min=30,
            deadline=None,
            created_at=REF_NOW,
        ),
        InboxItem(
            id=2,
            raw_text="Write core algorithm",
            priority=5,
            est_duration_min=60,
            deadline=datetime(2026, 9, 24, 17, 0),
            created_at=REF_NOW,
        ),
    ]

    result = schedule_day(target_date, items, routine, [], prefs, REF_NOW)

    assert len(result.scheduled_slots) == 2
    assert len(result.unplaceable_item_ids) == 0

    # High priority focus item (id 2) should prefer preferred_deep_hours (09:00-11:00)
    slot_deep = next(s for s in result.scheduled_slots if s.item_id == 2)
    assert slot_deep.start_time == time(9, 0)
    assert slot_deep.end_time == time(10, 0)


def test_break_duration_insertion():
    # If a deep task > 45min is scheduled, a break buffer must follow it
    target_date = date(2026, 9, 24)
    prefs = SchedulerPrefs(
        preferred_deep_hours=[],  # No specific deep hours
        break_duration_pref=15,    # 15 min break
        day_start=time(9, 0),
        day_end=time(18, 0),
    )

    items = [
        InboxItem(
            id=1,
            raw_text="Deep task 1",
            priority=5,
            est_duration_min=60,  # > 45 min
            created_at=REF_NOW,
        ),
        InboxItem(
            id=2,
            raw_text="Task 2",
            priority=4,
            est_duration_min=30,
            created_at=REF_NOW,
        ),
    ]

    result = schedule_day(target_date, items, [], [], prefs, REF_NOW)
    assert len(result.scheduled_slots) == 2

    slot1 = next(s for s in result.scheduled_slots if s.item_id == 1)
    slot2 = next(s for s in result.scheduled_slots if s.item_id == 2)

    # Slot 1: 09:00 to 10:00
    assert slot1.start_time == time(9, 0)
    assert slot1.end_time == time(10, 0)

    # Slot 2 must NOT start immediately at 10:00 because of 15m break buffer
    # It must start at 10:15 or later!
    assert slot2.start_time >= time(10, 15)


def test_unplaceable_items():
    # Day with only 1 hour free
    target_date = date(2026, 9, 24)
    prefs = SchedulerPrefs(
        day_start=time(9, 0),
        day_end=time(10, 0),  # Only 60 min total
    )

    items = [
        InboxItem(id=1, raw_text="Task 1", priority=5, est_duration_min=45),
        InboxItem(id=2, raw_text="Task 2", priority=3, est_duration_min=45),
    ]

    result = schedule_day(target_date, items, [], [], prefs, REF_NOW)

    # Only 1 task can fit into 60 minutes
    assert len(result.scheduled_slots) == 1
    assert len(result.unplaceable_item_ids) == 1
    assert result.unplaceable_item_ids[0] == 2
    assert 2 in result.explanations


def test_category_multiplier_application():
    target_date = date(2026, 9, 24)
    prefs = SchedulerPrefs(
        category_duration_multiplier={"study": 1.5},
        day_start=time(9, 0),
        day_end=time(12, 0),
    )

    item = InboxItem(
        id=1,
        raw_text="Study linear algebra",
        category="study",
        est_duration_min=60,  # Multiplied by 1.5 -> 90 mins
    )

    result = schedule_day(target_date, [item], [], [], prefs, REF_NOW)
    assert len(result.scheduled_slots) == 1
    slot = result.scheduled_slots[0]
    # 09:00 + 90 min = 10:30
    assert slot.start_time == time(9, 0)
    assert slot.end_time == time(10, 30)


def test_reschedule_job_evaluation():
    today = date(2026, 9, 24)
    yesterday = date(2026, 9, 23)
    tomorrow = date(2026, 9, 25)

    slots = [
        # Past slot, item was not completed (scheduled) -> MUST delete and revert
        SlotWithItemStatus(slot_id=101, item_id=1, slot_date=yesterday, item_status="scheduled"),
        # Past slot, item was completed ('done') -> KEEP
        SlotWithItemStatus(slot_id=102, item_id=2, slot_date=yesterday, item_status="done"),
        # Today's slot, item scheduled -> KEEP
        SlotWithItemStatus(slot_id=103, item_id=3, slot_date=today, item_status="scheduled"),
        # Future slot -> KEEP
        SlotWithItemStatus(slot_id=104, item_id=4, slot_date=tomorrow, item_status="scheduled"),
    ]

    decision = evaluate_reschedule_job(today, slots)

    assert decision.slots_to_delete == [101]
    assert decision.items_to_revert == [1]

