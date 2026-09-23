import pytest
from app.models import User
from app.auth import hash_password


@pytest.fixture
def users_a_and_b(db_session):
    user_a = User(
        email="user_a@mindflow.local",
        password_hash=hash_password("PassA123!"),
        role="USER",
        status="ACTIVE",
    )
    user_b = User(
        email="user_b@mindflow.local",
        password_hash=hash_password("PassB123!"),
        role="USER",
        status="ACTIVE",
    )
    db_session.add(user_a)
    db_session.add(user_b)
    db_session.commit()
    return user_a, user_b


def test_items_isolation_between_users(raw_client, users_a_and_b, auth_headers):
    user_a, user_b = users_a_and_b
    headers_a = auth_headers(user_a)
    headers_b = auth_headers(user_b)

    # 1. User A creates item
    res_a = raw_client.post("/items", json={"raw_text": "User A confidential task"}, headers=headers_a)
    assert res_a.status_code == 201
    item_a_id = res_a.json()["id"]

    # 2. User B creates item
    res_b = raw_client.post("/items", json={"raw_text": "User B secret idea"}, headers=headers_b)
    assert res_b.status_code == 201
    item_b_id = res_b.json()["id"]

    # 3. User A lists items -> only User A's item is present
    list_a = raw_client.get("/items", headers=headers_a)
    assert list_a.status_code == 200
    ids_a = [it["id"] for it in list_a.json()]
    assert item_a_id in ids_a
    assert item_b_id not in ids_a

    # 4. User B lists items -> only User B's item is present
    list_b = raw_client.get("/items", headers=headers_b)
    assert list_b.status_code == 200
    ids_b = [it["id"] for it in list_b.json()]
    assert item_b_id in ids_b
    assert item_a_id not in ids_b

    # 5. User B tries to GET User A's item by ID -> 404
    get_cross = raw_client.get(f"/items/{item_a_id}", headers=headers_b)
    assert get_cross.status_code == 404

    # 6. User B tries to PATCH User A's item -> 404
    patch_cross = raw_client.patch(f"/items/{item_a_id}", json={"priority": 5}, headers=headers_b)
    assert patch_cross.status_code == 404

    # 7. User B tries to DELETE User A's item -> 404
    del_cross = raw_client.delete(f"/items/{item_a_id}", headers=headers_b)
    assert del_cross.status_code == 404

    # 8. User B tries to complete User A's item -> 404
    complete_cross = raw_client.post(f"/items/{item_a_id}/complete", json={"actual_duration": 20}, headers=headers_b)
    assert complete_cross.status_code == 404

    # 9. Verify User A's item is still intact and inbox
    verify_a = raw_client.get(f"/items/{item_a_id}", headers=headers_a)
    assert verify_a.status_code == 200
    assert verify_a.json()["status"] == "inbox"


def test_routine_and_prefs_isolation(raw_client, users_a_and_b, auth_headers):
    user_a, user_b = users_a_and_b
    headers_a = auth_headers(user_a)
    headers_b = auth_headers(user_b)

    # 1. User A creates routine block
    block_a_res = raw_client.post(
        "/routine",
        json={"day_of_week": 1, "start_time": "09:00:00", "end_time": "10:30:00", "label": "User A Standup"},
        headers=headers_a,
    )
    assert block_a_res.status_code == 201
    block_a_id = block_a_res.json()["id"]

    # 2. User B lists routine blocks -> block A should NOT be present
    list_b = raw_client.get("/routine", headers=headers_b)
    assert list_b.status_code == 200
    assert all(b["id"] != block_a_id for b in list_b.json())

    # 3. User B tries to delete User A's routine block -> 404
    del_cross = raw_client.delete(f"/routine/{block_a_id}", headers=headers_b)
    assert del_cross.status_code == 404

    # 4. Preferences isolation
    raw_client.patch("/prefs", json={"preferred_deep_hours": ["08:00-10:00"], "break_duration_pref": 15}, headers=headers_a)
    raw_client.patch("/prefs", json={"preferred_deep_hours": ["14:00-16:00"], "break_duration_pref": 25}, headers=headers_b)

    prefs_a = raw_client.get("/prefs", headers=headers_a).json()
    prefs_b = raw_client.get("/prefs", headers=headers_b).json()

    assert prefs_a["preferred_deep_hours"] == ["08:00-10:00"]
    assert prefs_a["break_duration_pref"] == 15
    assert prefs_b["preferred_deep_hours"] == ["14:00-16:00"]
    assert prefs_b["break_duration_pref"] == 25


def test_schedule_isolation(raw_client, users_a_and_b, auth_headers):
    user_a, user_b = users_a_and_b
    headers_a = auth_headers(user_a)
    headers_b = auth_headers(user_b)

    # User A creates a task
    raw_client.post("/items", json={"raw_text": "A's project plan", "est_duration_min": 60, "priority": 5}, headers=headers_a)

    # Run scheduler for User A
    run_a = raw_client.post("/schedule/run", json={"date": "2026-10-15"}, headers=headers_a)
    assert run_a.status_code == 200
    slots_a = raw_client.get("/schedule?date=2026-10-15", headers=headers_a).json()
    assert len(slots_a) > 0

    # User B checks schedule for same date -> should have 0 slots
    slots_b = raw_client.get("/schedule?date=2026-10-15", headers=headers_b).json()
    assert len(slots_b) == 0

