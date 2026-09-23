import pytest
from app.crud import (
    create_item,
    get_item,
    get_items,
    update_item,
    delete_item,
    complete_item,
)
from app.schemas import ItemCreate, ItemUpdate, ItemComplete
from app.models import FeedbackLog


def test_crud_create_and_get(db_session):
    item_in = ItemCreate(raw_text="Test item", category="task", priority=3)
    created = create_item(db_session, item_in)
    assert created.id is not None
    assert created.raw_text == "Test item"
    assert created.status == "inbox"

    fetched = get_item(db_session, created.id)
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.raw_text == "Test item"


def test_crud_update(db_session):
    item_in = ItemCreate(raw_text="Old text")
    item = create_item(db_session, item_in)

    update_in = ItemUpdate(raw_text="Updated text", priority=5)
    updated = update_item(db_session, item.id, update_in)
    assert updated.raw_text == "Updated text"
    assert updated.priority == 5


def test_crud_delete(db_session):
    item_in = ItemCreate(raw_text="To be deleted")
    item = create_item(db_session, item_in)

    success = delete_item(db_session, item.id)
    assert success is True

    assert get_item(db_session, item.id) is None
    assert delete_item(db_session, 99999) is False


def test_crud_complete_with_feedback(db_session):
    item_in = ItemCreate(raw_text="Task to complete", est_duration_min=25)
    item = create_item(db_session, item_in)

    completed = complete_item(db_session, item.id, ItemComplete(actual_duration=30))
    assert completed.status == "done"

    logs = db_session.query(FeedbackLog).filter(FeedbackLog.item_id == item.id).all()
    assert len(logs) == 1
    assert logs[0].estimated_duration == 25
    assert logs[0].actual_duration == 30

