from datetime import datetime, timezone

from app.models import Item, User
from app.services.gemini.assistant import confirm_action, execute_tool
from app.services.gemini.client import GeminiUnavailable
from app.services.gemini.schemas import TaskInterpretation
from app.services.gemini.task_parser import interpret_task


class _StructuredClient:
    available = True

    def generate_structured(self, prompt, schema):
        return TaskInterpretation(
            intent="task", title="Finish DBMS assignment", category="study",
            priority="high", estimated_minutes=90, deadline="2026-09-26T18:00:00",
            actionable=True, confidence=0.94,
        )


def test_task_interpretation_normalizes_local_deadline():
    result = interpret_task(
        "I really need to finish my DBMS assignment before Friday",
        "Asia/Kolkata",
        now=datetime(2026, 9, 23, 10, tzinfo=timezone.utc),
        client=_StructuredClient(),
    )
    assert result.category == "study"
    assert result.estimated_minutes == 90
    # Scheduler's persisted datetime is a user-local wall clock, not server UTC.
    assert result.deadline == datetime(2026, 9, 26, 18, 0)


def test_ai_tool_cannot_access_another_users_task(db_session):
    owner = User(email="owner-ai@mindflow.local", password_hash="hash", role="USER", status="ACTIVE")
    intruder = User(email="intruder-ai@mindflow.local", password_hash="hash", role="USER", status="ACTIVE")
    db_session.add_all([owner, intruder])
    db_session.commit()
    private_item = Item(user_id=owner.id, raw_text="private DBMS task", category="task", status="inbox")
    db_session.add(private_item)
    db_session.commit()

    result = execute_tool("complete_task", {"task": private_item.id, "user_id": owner.id}, db_session, intruder)
    assert result["ok"] is False
    db_session.refresh(private_item)
    assert private_item.status == "inbox"


def test_delete_requires_user_bound_confirmation(db_session):
    user = User(email="confirm-ai@mindflow.local", password_hash="hash", role="USER", status="ACTIVE")
    db_session.add(user)
    db_session.commit()
    item = Item(user_id=user.id, raw_text="remove me", category="task", status="inbox")
    db_session.add(item)
    db_session.commit()

    pending = execute_tool("delete_task", {"task": item.id}, db_session, user)
    assert pending["requires_confirmation"] is True
    # A direct destructive dispatch remains a preview until confirmation.
    assert db_session.get(Item, item.id) is not None


def test_interpret_endpoint_falls_back_without_gemini(client, monkeypatch):
    from app.routers import ai
    from app.services.gemini.schemas import NormalizedTaskInterpretation

    def unavailable(*args, **kwargs):
        raise GeminiUnavailable("offline")

    monkeypatch.setattr(ai, "interpret_task", unavailable)
    monkeypatch.setattr(ai, "fallback_interpretation", lambda *args: NormalizedTaskInterpretation(
        intent="random_thought", title="A thought", category="random_thought",
        actionable=False, confidence=0.1,
    ))
    response = client.post("/ai/interpret", json={"text": "A thought"})
    assert response.status_code == 200
    assert response.json()["source"] == "fallback"
    assert response.json()["interpretation"]["category"] == "random_thought"
