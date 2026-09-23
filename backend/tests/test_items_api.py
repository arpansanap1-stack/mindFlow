import pytest
from app.models import Item, FeedbackLog


def test_create_item_minimal(client):
    """Test creating an item with only raw_text (zero-friction capture with auto-classification)."""
    response = client.post("/items", json={"raw_text": "buy groceries"})
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["raw_text"] == "buy groceries"
    assert data["status"] == "inbox"
    assert data["category"] == "task"
    assert data["priority"] == 3
    assert data["est_duration_min"] == 30
    assert data["topic_tag"] == "personal"
    assert "created_at" in data

    # Ambiguous raw_text where rules cannot determine category
    amb_res = client.post("/items", json={"raw_text": "xyzzy foobar blip"})
    assert amb_res.status_code == 201
    amb_data = amb_res.json()
    assert amb_data["category"] is None


def test_create_item_full(client):
    """Test creating an item with all fields provided."""
    payload = {
        "raw_text": "Finish quarterly review report",
        "category": "task",
        "priority": 4,
        "est_duration_min": 60,
        "deadline": "2026-10-01T17:00:00",
        "topic_tag": "work",
    }
    response = client.post("/items", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["raw_text"] == payload["raw_text"]
    assert data["category"] == "task"
    assert data["priority"] == 4
    assert data["est_duration_min"] == 60
    assert data["deadline"] == "2026-10-01T17:00:00"
    assert data["status"] == "inbox"
    assert data["topic_tag"] == "work"


def test_create_item_validation(client):
    """Test validation errors on item creation."""
    # Missing raw_text
    response = client.post("/items", json={})
    assert response.status_code == 422

    # Empty raw_text
    response = client.post("/items", json={"raw_text": ""})
    assert response.status_code == 422

    # Invalid priority (> 5)
    response = client.post("/items", json={"raw_text": "test", "priority": 6})
    assert response.status_code == 422

    # Invalid priority (< 1)
    response = client.post("/items", json={"raw_text": "test", "priority": 0})
    assert response.status_code == 422

    # Invalid category
    response = client.post("/items", json={"raw_text": "test", "category": "invalid_cat"})
    assert response.status_code == 422

    # Invalid duration (< 1)
    response = client.post("/items", json={"raw_text": "test", "est_duration_min": 0})
    assert response.status_code == 422


def test_list_items_and_filtering(client):
    """Test listing items and filtering by status."""
    client.post("/items", json={"raw_text": "Inbox item 1"})
    client.post("/items", json={"raw_text": "Inbox item 2"})
    r3 = client.post("/items", json={"raw_text": "Done item"})
    done_id = r3.json()["id"]
    client.post(f"/items/{done_id}/complete")

    # List all
    all_res = client.get("/items")
    assert all_res.status_code == 200
    assert len(all_res.json()) == 3

    # Filter status=inbox
    inbox_res = client.get("/items?status=inbox")
    assert inbox_res.status_code == 200
    inbox_items = inbox_res.json()
    assert len(inbox_items) == 2
    for item in inbox_items:
        assert item["status"] == "inbox"

    # Filter status=done
    done_res = client.get("/items?status=done")
    assert done_res.status_code == 200
    done_items = done_res.json()
    assert len(done_items) == 1
    assert done_items[0]["id"] == done_id
    assert done_items[0]["status"] == "done"


def test_get_item_by_id(client):
    """Test retrieving a single item."""
    create_res = client.post("/items", json={"raw_text": "Check email"})
    item_id = create_res.json()["id"]

    get_res = client.get(f"/items/{item_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == item_id

    # Non-existent item
    not_found_res = client.get("/items/9999")
    assert not_found_res.status_code == 404


def test_update_item(client):
    """Test patching an item."""
    create_res = client.post("/items", json={"raw_text": "Read book"})
    item_id = create_res.json()["id"]

    update_payload = {
        "category": "idea",
        "priority": 3,
        "est_duration_min": 45,
        "topic_tag": "learning",
    }
    patch_res = client.patch(f"/items/{item_id}", json=update_payload)
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["category"] == "idea"
    assert data["priority"] == 3
    assert data["est_duration_min"] == 45
    assert data["topic_tag"] == "learning"
    assert data["raw_text"] == "Read book"

    # Non-existent item patch
    nf_res = client.patch("/items/9999", json={"priority": 2})
    assert nf_res.status_code == 404

    # Validation on patch
    val_res = client.patch(f"/items/{item_id}", json={"priority": 10})
    assert val_res.status_code == 422


def test_delete_item(client):
    """Test deleting an item."""
    create_res = client.post("/items", json={"raw_text": "Delete me"})
    item_id = create_res.json()["id"]

    del_res = client.delete(f"/items/{item_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/items/{item_id}")
    assert get_res.status_code == 404

    # Delete non-existent
    del_nf = client.delete("/items/9999")
    assert del_nf.status_code == 404


def test_complete_item_with_feedback(client, db_session):
    """Test completing an item marks status=done and logs feedback."""
    create_res = client.post(
        "/items",
        json={"raw_text": "Code review", "est_duration_min": 30, "category": "task"}
    )
    item_id = create_res.json()["id"]

    complete_res = client.post(f"/items/{item_id}/complete", json={"actual_duration": 40})
    assert complete_res.status_code == 200
    data = complete_res.json()
    assert data["status"] == "done"

    # Verify feedback_log table entry in database
    log = db_session.query(FeedbackLog).filter(FeedbackLog.item_id == item_id).first()
    assert log is not None
    assert log.estimated_duration == 30
    assert log.actual_duration == 40


def test_complete_nonexistent_item(client):
    """Test completing non-existent item returns 404."""
    res = client.post("/items/9999/complete", json={"actual_duration": 10})
    assert res.status_code == 404

