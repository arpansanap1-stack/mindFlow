import pytest


def test_create_routine_block(client):
    payload = {
        "day_of_week": 0,  # Monday
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "label": "Morning Standup",
        "fixed": True,
    }
    response = client.post("/routine", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["day_of_week"] == 0
    assert data["start_time"] == "09:00:00"
    assert data["end_time"] == "09:30:00"
    assert data["label"] == "Morning Standup"
    assert data["fixed"] is True


def test_create_routine_block_invalid_time(client):
    # End time before start time
    payload = {
        "day_of_week": 1,
        "start_time": "14:00:00",
        "end_time": "13:00:00",
        "label": "Invalid Range",
    }
    response = client.post("/routine", json=payload)
    assert response.status_code == 422


def test_create_routine_block_invalid_day(client):
    # Day > 6
    payload = {
        "day_of_week": 7,
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "label": "Invalid Day",
    }
    response = client.post("/routine", json=payload)
    assert response.status_code == 422


def test_list_and_filter_routine(client):
    client.post("/routine", json={
        "day_of_week": 0, "start_time": "12:00:00", "end_time": "13:00:00", "label": "Lunch Mon"
    })
    client.post("/routine", json={
        "day_of_week": 1, "start_time": "12:00:00", "end_time": "13:00:00", "label": "Lunch Tue"
    })

    # List all
    all_res = client.get("/routine")
    assert all_res.status_code == 200
    assert len(all_res.json()) >= 2

    # Filter by Monday (day 0)
    mon_res = client.get("/routine?day_of_week=0")
    assert mon_res.status_code == 200
    for block in mon_res.json():
        assert block["day_of_week"] == 0


def test_update_routine_block(client):
    create_res = client.post("/routine", json={
        "day_of_week": 2, "start_time": "10:00:00", "end_time": "11:00:00", "label": "Deep Work"
    })
    block_id = create_res.json()["id"]

    patch_res = client.patch(f"/routine/{block_id}", json={
        "label": "Focus Time",
        "end_time": "11:30:00",
    })
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["label"] == "Focus Time"
    assert data["end_time"] == "11:30:00"


def test_delete_routine_block(client):
    create_res = client.post("/routine", json={
        "day_of_week": 3, "start_time": "15:00:00", "end_time": "16:00:00", "label": "Coffee Break"
    })
    block_id = create_res.json()["id"]

    del_res = client.delete(f"/routine/{block_id}")
    assert del_res.status_code == 204

    # Delete again -> 404
    del_res_again = client.delete(f"/routine/{block_id}")
    assert del_res_again.status_code == 404


def test_user_preferences(client):
    # Get initial default prefs
    get_res = client.get("/prefs")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["user_id"] == 1
    assert data["break_duration_pref"] == 10
    assert "09:00-11:00" in data["preferred_deep_hours"]

    # Update preferences
    patch_res = client.patch("/prefs", json={
        "preferred_deep_hours": ["08:30-10:30", "14:00-16:00"],
        "break_duration_pref": 15,
        "category_duration_multiplier": {"study": 1.3, "task": 1.1},
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["break_duration_pref"] == 15
    assert len(updated["preferred_deep_hours"]) == 2
    assert updated["category_duration_multiplier"]["study"] == 1.3

