from datetime import date, time, timedelta
import pytest
from app.models import Item, ScheduleSlot, RoutineBlock


def test_schedule_run_api(client, db_session):
    # 1. Create inbox items
    r1 = client.post("/items", json={"raw_text": "High priority task", "priority": 5, "est_duration_min": 60})
    item1_id = r1.json()["id"]

    r2 = client.post("/items", json={"raw_text": "Quick chore", "priority": 2, "est_duration_min": 15})
    item2_id = r2.json()["id"]

    # 2. Create routine block on Thursday (day 3)
    target_date = date(2026, 9, 24)  # Thursday
    client.post("/routine", json={
        "day_of_week": target_date.weekday(),
        "start_time": "12:00:00",
        "end_time": "13:00:00",
        "label": "Lunch Break",
        "fixed": True,
    })

    # 3. Trigger scheduler
    run_res = client.post("/schedule/run", json={"date": target_date.isoformat()})
    assert run_res.status_code == 200
    data = run_res.json()
    assert data["date"] == target_date.isoformat()
    assert data["scheduled_count"] == 2
    assert len(data["slots"]) == 2

    # Verify item status was updated to 'scheduled'
    item1 = client.get(f"/items/{item1_id}").json()
    assert item1["status"] == "scheduled"

    item2 = client.get(f"/items/{item2_id}").json()
    assert item2["status"] == "scheduled"

    # 4. Fetch schedule via GET
    get_res = client.get(f"/schedule?date={target_date.isoformat()}")
    assert get_res.status_code == 200
    slots = get_res.json()
    assert len(slots) == 2
    assert slots[0]["item"] is not None
    assert slots[0]["item"]["id"] in [item1_id, item2_id]


def test_schedule_reschedules_past_undone_slots(client, db_session):
    today = date(2026, 9, 24)
    yesterday = today - timedelta(days=1)

    # Create item
    item_res = client.post("/items", json={"raw_text": "Missed task", "est_duration_min": 30})
    item_id = item_res.json()["id"]

    # Manually place in a past schedule slot with status 'scheduled'
    slot = ScheduleSlot(
        item_id=item_id,
        date=yesterday,
        start_time=time(10, 0),
        end_time=time(10, 30),
        auto_generated=True,
    )
    db_session.add(slot)
    db_session.query(Item).filter(Item.id == item_id).update({"status": "scheduled"})
    db_session.commit()

    # Verify item was scheduled
    assert client.get(f"/items/{item_id}").json()["status"] == "scheduled"

    # Run scheduler for today
    run_res = client.post("/schedule/run", json={"date": today.isoformat()})
    assert run_res.status_code == 200
    data = run_res.json()

    # The past slot should be deleted, item reverted to inbox, and rescheduled for today
    past_slots = client.get(f"/schedule?date={yesterday.isoformat()}").json()
    assert len(past_slots) == 0

    today_slots = client.get(f"/schedule?date={today.isoformat()}").json()
    assert any(s["item_id"] == item_id for s in today_slots)
