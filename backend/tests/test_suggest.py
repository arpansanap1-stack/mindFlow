import pytest
from datetime import datetime, date, time, timezone
from app.scheduler.types import InboxItem, RoutineBlockItem, SchedulerPrefs
from app.scheduler.suggest import (
    SlotItemContext,
    evaluate_now_suggestion,
)


# --- Unit Tests for Pure evaluate_now_suggestion() ---

def test_suggest_in_routine_block():
    # 2026-09-28 is a Monday (weekday=0)
    now = datetime(2026, 9, 28, 12, 30, 0)
    routine_blocks = [
        RoutineBlockItem(
            id=1,
            day_of_week=0,
            start_time=time(12, 0),
            end_time=time(13, 0),
            label="Lunch & Walk",
            fixed=True,
        )
    ]
    prefs = SchedulerPrefs()

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[],
        routine_blocks=routine_blocks,
        today_slots=[],
        prefs=prefs,
    )

    assert sugg.context_type == "routine"
    assert sugg.routine_block is not None
    assert sugg.routine_block.label == "Lunch & Walk"
    assert sugg.free_minutes_remaining == 30
    assert "Lunch & Walk" in sugg.reason


def test_suggest_in_scheduled_slot():
    now = datetime(2026, 9, 28, 10, 15, 0)
    item = InboxItem(
        id=42,
        raw_text="Finish Q3 budget presentation",
        category="task",
        priority=4,
        est_duration_min=60,
    )
    today_slots = [
        SlotItemContext(
            id=101,
            item_id=42,
            date=date(2026, 9, 28),
            start_time=time(10, 0),
            end_time=time(11, 0),
            item=item,
            is_done=False,
        )
    ]
    prefs = SchedulerPrefs()

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[item],
        routine_blocks=[],
        today_slots=today_slots,
        prefs=prefs,
    )

    assert sugg.context_type == "scheduled_slot"
    assert sugg.item is not None
    assert sugg.item.id == 42
    assert sugg.slot is not None
    assert sugg.slot.id == 101
    assert sugg.free_minutes_remaining == 45
    assert "Finish Q3 budget presentation" in sugg.reason


def test_suggest_in_deep_work_window():
    # 09:30 on a Wednesday (weekday=2), preferred deep hours is 09:00-11:00
    now = datetime(2026, 9, 30, 9, 30, 0)
    # Item 1: quick chore, priority 1
    quick_item = InboxItem(
        id=1,
        raw_text="Empty dishwasher",
        category="task",
        priority=1,
        est_duration_min=10,
    )
    # Item 2: high priority deep task
    deep_item = InboxItem(
        id=2,
        raw_text="Design distributed consensus engine",
        category="task",
        priority=5,
        est_duration_min=60,
    )
    prefs = SchedulerPrefs(preferred_deep_hours=["09:00-11:00"])

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[quick_item, deep_item],
        routine_blocks=[],
        today_slots=[],
        prefs=prefs,
    )

    assert sugg.context_type == "deep_work"
    assert sugg.item is not None
    assert sugg.item.id == 2  # High priority deep task is chosen
    assert "deep work" in sugg.reason.lower()


def test_suggest_in_free_gap_prefers_fitting_item():
    # 13:30 with an upcoming meeting at 14:00 (30m gap)
    now = datetime(2026, 9, 28, 13, 30, 0)
    routine_blocks = [
        RoutineBlockItem(
            id=1,
            day_of_week=0,
            start_time=time(14, 0),
            end_time=time(15, 0),
            label="Client Sync",
            fixed=True,
        )
    ]
    # Long task (60 min) vs. Fitting task (20 min)
    long_task = InboxItem(
        id=1,
        raw_text="Write full chapter for documentation",
        category="task",
        priority=4,
        est_duration_min=60,
    )
    fitting_task = InboxItem(
        id=2,
        raw_text="Review pull request #45",
        category="task",
        priority=4,
        est_duration_min=20,
    )
    prefs = SchedulerPrefs()

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[long_task, fitting_task],
        routine_blocks=routine_blocks,
        today_slots=[],
        prefs=prefs,
    )

    assert sugg.context_type == "free_gap"
    assert sugg.item is not None
    assert sugg.item.id == 2  # The 20m task fits within the 30m gap
    assert sugg.free_minutes_remaining == 30


def test_suggest_off_hours():
    # 23:30 (past 22:00 day_end)
    now = datetime(2026, 9, 28, 23, 30, 0)
    prefs = SchedulerPrefs()

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[],
        routine_blocks=[],
        today_slots=[],
        prefs=prefs,
    )

    assert sugg.context_type == "off_hours"
    assert "Outside" in sugg.reason or "hours" in sugg.reason.lower()


def test_suggest_empty_inbox_clear():
    # 14:00 on Monday, no items
    now = datetime(2026, 9, 28, 14, 0, 0)
    prefs = SchedulerPrefs()

    sugg = evaluate_now_suggestion(
        now=now,
        inbox_items=[],
        routine_blocks=[],
        today_slots=[],
        prefs=prefs,
    )

    assert sugg.context_type == "clear"
    assert sugg.item is None


# --- Integration Tests for /suggest Endpoints ---

def test_get_suggest_now_api(client):
    # Create an inbox item
    res = client.post(
        "/items",
        json={"raw_text": "Urgent production bug hotfix", "priority": 5, "est_duration_min": 25},
    )
    assert res.status_code == 201
    item_id = res.json()["id"]

    # Call /suggest/now
    suggest_res = client.get("/suggest/now")
    assert suggest_res.status_code == 200
    data = suggest_res.json()
    assert "context_type" in data
    assert "reason" in data
    assert "current_time" in data


def test_get_suggest_now_time_travel(client):
    # Add a fixed routine block on Monday (0) from 12:00 to 13:00
    r_res = client.post(
        "/routine",
        json={
            "day_of_week": 0,
            "start_time": "12:00:00",
            "end_time": "13:00:00",
            "label": "Weekly Team Lunch",
            "fixed": True,
        },
    )
    assert r_res.status_code == 201

    # Query /suggest/now during that routine block (Monday 2026-09-28 12:30:00)
    suggest_res = client.get("/suggest/now?now=2026-09-28T12:30:00")
    assert suggest_res.status_code == 200
    data = suggest_res.json()
    assert data["context_type"] == "routine"
    assert data["routine_block"] is not None
    assert data["routine_block"]["label"] == "Weekly Team Lunch"
    assert data["free_minutes_remaining"] == 30


def test_suggest_action_accept_and_dismiss(client, db_session):
    from app.models import FeedbackLog

    # Create an item
    res = client.post(
        "/items",
        json={"raw_text": "Write release notes", "priority": 3, "est_duration_min": 30},
    )
    item_id = res.json()["id"]

    # Accept suggestion
    accept_res = client.post(
        "/suggest/action",
        json={"item_id": item_id, "action": "accept"},
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["action"] == "accept"

    # Verify log entry
    log_accept = (
        db_session.query(FeedbackLog)
        .filter(FeedbackLog.item_id == item_id, FeedbackLog.suggestion_accepted == True)
        .first()
    )
    assert log_accept is not None

    # Dismiss suggestion
    dismiss_res = client.post(
        "/suggest/action",
        json={"item_id": item_id, "action": "dismiss"},
    )
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["action"] == "dismiss"

    # Verify log entry
    log_dismiss = (
        db_session.query(FeedbackLog)
        .filter(FeedbackLog.item_id == item_id, FeedbackLog.suggestion_accepted == False)
        .first()
    )
    assert log_dismiss is not None

