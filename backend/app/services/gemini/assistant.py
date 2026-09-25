"""Grounded assistant orchestration and the narrow tool boundary."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import jwt
from sqlalchemy.orm import Session, joinedload

from app import crud
from app.config import settings
from app.models import Item, RoutineBlock, ScheduleSlot, User
from app.schemas import ItemComplete, ItemCreate, ItemUpdate
from app.scheduler.algorithm import minutes_to_time, subtract_intervals, time_to_minutes
from .client import GeminiClient, GeminiUnavailable
from .prompts import ASSISTANT_PROMPT

CONFIRMATION_ACTIONS = {"delete_task"}


def user_timezone(db: Session, user_id: int) -> str:
    return crud.get_or_create_user_prefs(db, user_id=user_id).timezone


def local_now(db: Session, user_id: int) -> datetime:
    return datetime.now(timezone.utc).astimezone(ZoneInfo(user_timezone(db, user_id)))


def _item_payload(item: Item) -> dict[str, Any]:
    return {"id": item.id, "title": item.raw_text, "category": item.category, "priority": item.priority,
            "estimated_minutes": item.est_duration_min, "deadline": item.deadline.isoformat() if item.deadline else None,
            "status": item.status}


def _resolve_item(db: Session, user_id: int, title_or_id: Any) -> Item | None:
    if isinstance(title_or_id, int) or (isinstance(title_or_id, str) and title_or_id.isdigit()):
        return crud.get_item(db, int(title_or_id), user_id=user_id)
    title = str(title_or_id or "").strip().lower()
    if not title:
        return None
    matches = db.query(Item).filter(Item.user_id == user_id, Item.raw_text.ilike(f"%{title}%")).order_by(Item.created_at.desc()).limit(2).all()
    return matches[0] if len(matches) == 1 else None


def find_free_slots(db: Session, user_id: int, target_date: date, minimum_minutes: int = 15) -> list[dict]:
    prefs = crud.get_or_create_user_prefs(db, user_id=user_id)
    free = [(8 * 60, 22 * 60)]
    routine = db.query(RoutineBlock).filter(RoutineBlock.user_id == user_id, RoutineBlock.day_of_week == target_date.weekday(), RoutineBlock.fixed == True).all()
    slots = db.query(ScheduleSlot).filter(ScheduleSlot.user_id == user_id, ScheduleSlot.date == target_date).all()
    blocked = [(time_to_minutes(row.start_time), time_to_minutes(row.end_time)) for row in routine + slots]
    return [{"date": target_date.isoformat(), "start_time": minutes_to_time(start).strftime("%H:%M"), "end_time": minutes_to_time(end).strftime("%H:%M"), "minutes": end - start}
            for start, end in subtract_intervals(free, blocked) if end - start >= minimum_minutes]


def execute_tool(name: str, arguments: dict[str, Any], db: Session, current_user: User, allow_confirmed: bool = False) -> dict[str, Any]:
    """Execute only whitelisted actions, always scoped from the authenticated user."""
    user_id = current_user.id
    # Explicitly discard identity-like arguments. The model/frontend cannot
    # choose the database scope of an AI action.
    arguments = {key: value for key, value in arguments.items() if key not in {"user_id", "owner_id", "account_id"}}
    if name in CONFIRMATION_ACTIONS and not allow_confirmed:
        item = _resolve_item(db, user_id, arguments.get("task"))
        if not item:
            return {"ok": False, "error": "Task was not found or was ambiguous."}
        return {"ok": False, "requires_confirmation": True, "action": name, "arguments": {"task": item.id}, "summary": f"Delete '{item.raw_text}'?"}
    if name == "get_current_time":
        now = local_now(db, user_id)
        return {"ok": True, "time": now.isoformat(), "timezone": user_timezone(db, user_id)}
    if name == "get_today_tasks":
        target = local_now(db, user_id).date()
        rows = db.query(Item).filter(Item.user_id == user_id, Item.status != "done").filter((Item.deadline == None) | (Item.deadline < datetime.combine(target + timedelta(days=1), time.max))).all()
        return {"ok": True, "tasks": [_item_payload(row) for row in rows]}
    if name == "get_upcoming_tasks":
        days = max(1, min(int(arguments.get("days", 7)), 31))
        until = local_now(db, user_id).date() + timedelta(days=days)
        rows = db.query(Item).filter(Item.user_id == user_id, Item.status != "done", Item.deadline != None, Item.deadline < datetime.combine(until + timedelta(days=1), time.min)).order_by(Item.deadline).all()
        return {"ok": True, "tasks": [_item_payload(row) for row in rows]}
    if name == "get_schedule":
        target = date.fromisoformat(arguments.get("date") or local_now(db, user_id).date().isoformat())
        rows = db.query(ScheduleSlot).options(joinedload(ScheduleSlot.item)).filter(ScheduleSlot.user_id == user_id, ScheduleSlot.date == target).all()
        return {"ok": True, "slots": [{"date": row.date.isoformat(), "start_time": row.start_time.isoformat(), "end_time": row.end_time.isoformat(), "task": _item_payload(row.item) if row.item else None} for row in rows]}
    if name == "get_routine":
        rows = db.query(RoutineBlock).filter(RoutineBlock.user_id == user_id).order_by(RoutineBlock.day_of_week, RoutineBlock.start_time).all()
        return {"ok": True, "routine": [{"day_of_week": row.day_of_week, "start_time": row.start_time.isoformat(), "end_time": row.end_time.isoformat(), "label": row.label, "fixed": row.fixed} for row in rows]}
    if name == "get_preferences":
        prefs = crud.get_or_create_user_prefs(db, user_id=user_id)
        return {"ok": True, "timezone": prefs.timezone, "preferred_deep_hours": prefs.preferred_deep_hours, "break_duration_minutes": prefs.break_duration_pref}
    if name == "find_free_slots":
        target = date.fromisoformat(arguments.get("date") or local_now(db, user_id).date().isoformat())
        return {"ok": True, "slots": find_free_slots(db, user_id, target, max(5, min(int(arguments.get("minutes", 15)), 720)))}
    if name == "explain_schedule":
        item = _resolve_item(db, user_id, arguments.get("task"))
        if not item:
            return {"ok": False, "error": "Task was not found or was ambiguous."}
        slot = db.query(ScheduleSlot).filter(ScheduleSlot.user_id == user_id, ScheduleSlot.item_id == item.id).order_by(ScheduleSlot.date).first()
        if not slot:
            return {"ok": True, "scheduled": False, "task": _item_payload(item)}
        return {"ok": True, "scheduled": True, "task": _item_payload(item), "slot": {"date": slot.date.isoformat(), "start_time": slot.start_time.isoformat(), "end_time": slot.end_time.isoformat(), "minutes": time_to_minutes(slot.end_time) - time_to_minutes(slot.start_time), "auto_generated": slot.auto_generated}}
    if name == "search_tasks":
        query = str(arguments.get("query", "")).strip()
        rows = db.query(Item).filter(Item.user_id == user_id, Item.raw_text.ilike(f"%{query}%")).limit(20).all()
        return {"ok": True, "tasks": [_item_payload(row) for row in rows]}
    if name == "create_task":
        text = str(arguments.get("text", "")).strip()
        if not text:
            return {"ok": False, "error": "A task title is required."}
        category = arguments.get("category", "task")
        if category not in {"task", "reminder", "deadline", "study", "project_idea", "question", "note", "random_thought", "idea"}:
            category = "task"
        item, _ = crud.create_item_with_flag(db, ItemCreate(raw_text=text, category=category, priority=arguments.get("priority"), est_duration_min=arguments.get("estimated_minutes")), user_id=user_id)
        return {"ok": True, "task": _item_payload(item)}
    if name in {"complete_task", "delete_task", "reschedule_task"}:
        item = _resolve_item(db, user_id, arguments.get("task"))
        if not item:
            return {"ok": False, "error": "Task was not found or was ambiguous."}
        if name == "complete_task":
            completed = crud.complete_item(db, item.id, ItemComplete(), user_id=user_id)
            return {"ok": True, "task": _item_payload(completed)}
        if name == "delete_task":
            crud.delete_item(db, item.id, user_id=user_id)
            return {"ok": True, "deleted_task_id": item.id}
        target = date.fromisoformat(str(arguments.get("date")))
        start_text = arguments.get("start_time")
        if not start_text:
            return {"ok": False, "error": "An exact start time is needed to reschedule safely."}
        start = time.fromisoformat(str(start_text))
        duration = max(5, min(item.est_duration_min or 30, 720))
        end_min = time_to_minutes(start) + duration
        if end_min >= 24 * 60:
            return {"ok": False, "error": "That task would run past midnight."}
        free = find_free_slots(db, user_id, target, duration)
        if not any(time_to_minutes(time.fromisoformat(slot["start_time"])) <= time_to_minutes(start) and time_to_minutes(time.fromisoformat(slot["end_time"])) >= end_min for slot in free):
            return {"ok": False, "error": "That time conflicts with your real schedule or routine."}
        db.query(ScheduleSlot).filter(ScheduleSlot.user_id == user_id, ScheduleSlot.item_id == item.id).delete(synchronize_session=False)
        db.add(ScheduleSlot(user_id=user_id, item_id=item.id, date=target, start_time=start, end_time=minutes_to_time(end_min), auto_generated=False))
        item.status = "scheduled"
        db.commit()
        return {"ok": True, "task": _item_payload(item), "scheduled_for": f"{target.isoformat()} {start.strftime('%H:%M')}"}
    return {"ok": False, "error": "Unsupported assistant tool."}


def _confirmation_token(user_id: int, action: str, arguments: dict[str, Any]) -> tuple[str, datetime]:
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    token = jwt.encode({"sub": str(user_id), "action": action, "arguments": arguments, "exp": expires}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def confirm_action(token: str, db: Session, current_user: User) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if str(current_user.id) != str(payload.get("sub")) or payload.get("action") not in CONFIRMATION_ACTIONS:
            return {"ok": False, "error": "Confirmation is invalid."}
        return execute_tool(payload["action"], payload.get("arguments", {}), db, current_user, allow_confirmed=True)
    except jwt.PyJWTError:
        return {"ok": False, "error": "Confirmation expired or is invalid."}


def deterministic_reply(message: str, db: Session, current_user: User) -> str:
    lower = message.lower()
    if "what should i do" in lower or "do now" in lower:
        suggestion = crud.get_now_suggestion(db, user_id=current_user.id, now=local_now(db, current_user.id))
        return suggestion.reason + (f" Suggested task: {suggestion.item.raw_text}." if suggestion.item else "")
    if "due" in lower or "this week" in lower or "tomorrow" in lower:
        result = execute_tool("get_upcoming_tasks", {"days": 7}, db, current_user)
        tasks = result.get("tasks", [])
        return "Upcoming tasks: " + (", ".join(task["title"] for task in tasks[:8]) if tasks else "none found.")
    return "Gemini is currently unavailable. You can still create, edit, complete, schedule, and search tasks through MindFlow."


def chat(message: str, db: Session, current_user: User) -> tuple[str, list[dict], str, dict | None]:
    """Gemini tool loop. Provider output is never executed outside execute_tool."""
    service = GeminiClient()
    if not service.available:
        return deterministic_reply(message, db, current_user), [], "deterministic_fallback", None
    try:
        # Tool declarations use plain JSON-compatible schemas supported by the
        # Gemini SDK's FunctionDeclaration conversion.
        from google.genai import types
        declarations = [
            types.FunctionDeclaration(name="get_current_time", description="Get authenticated user's current local time", parameters={"type": "object", "properties": {}}),
            types.FunctionDeclaration(name="get_today_tasks", description="Get current user's unfinished tasks due today", parameters={"type": "object", "properties": {}}),
            types.FunctionDeclaration(name="get_upcoming_tasks", description="Get upcoming tasks", parameters={"type": "object", "properties": {"days": {"type": "integer"}}}),
            types.FunctionDeclaration(name="get_schedule", description="Get schedule for a local date", parameters={"type": "object", "properties": {"date": {"type": "string"}}}),
            types.FunctionDeclaration(name="get_routine", description="Get authenticated user's fixed routine", parameters={"type": "object", "properties": {}}),
            types.FunctionDeclaration(name="get_preferences", description="Get authenticated user's scheduling preferences", parameters={"type": "object", "properties": {}}),
            types.FunctionDeclaration(name="find_free_slots", description="Find actual free schedule slots", parameters={"type": "object", "properties": {"date": {"type": "string"}, "minutes": {"type": "integer"}}}),
            types.FunctionDeclaration(name="explain_schedule", description="Get factual context for why a task has its scheduled slot", parameters={"type": "object", "properties": {"task": {"type": "string"}}, "required": ["task"]}),
            types.FunctionDeclaration(name="search_tasks", description="Find the user's tasks", parameters={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}),
            types.FunctionDeclaration(name="create_task", description="Create one task", parameters={"type": "object", "properties": {"text": {"type": "string"}, "category": {"type": "string"}, "priority": {"type": "integer"}, "estimated_minutes": {"type": "integer"}}, "required": ["text"]}),
            types.FunctionDeclaration(name="complete_task", description="Complete one task", parameters={"type": "object", "properties": {"task": {"type": "string"}}, "required": ["task"]}),
            types.FunctionDeclaration(name="reschedule_task", description="Schedule one task in an exact free slot", parameters={"type": "object", "properties": {"task": {"type": "string"}, "date": {"type": "string"}, "start_time": {"type": "string"}}, "required": ["task", "date", "start_time"]}),
            types.FunctionDeclaration(name="delete_task", description="Delete one task; backend asks confirmation", parameters={"type": "object", "properties": {"task": {"type": "string"}}, "required": ["task"]}),
        ]
        contents: Any = [ASSISTANT_PROMPT, f"User request: {message}"]
        actions: list[dict] = []
        for _ in range(4):
            response = service.generate_with_tools(contents, [types.Tool(function_declarations=declarations)])
            calls = getattr(response, "function_calls", None) or []
            if not calls:
                return (getattr(response, "text", None) or "I couldn't form a grounded response."), actions, "gemini", None
            parts = []
            pending = None
            for call in calls:
                args = dict(getattr(call, "args", {}) or {})
                result = execute_tool(call.name, args, db, current_user)
                if result.get("requires_confirmation"):
                    token, expires = _confirmation_token(current_user.id, result["action"], result["arguments"])
                    pending = {"token": token, "summary": result["summary"], "expires_at": expires}
                    return result["summary"], actions, "gemini", pending
                actions.append({"tool": call.name, "result": result})
                parts.append(types.Part.from_function_response(name=call.name, response={"result": result}))
            contents.append(types.Content(role="tool", parts=parts))
        return "I completed the available safe actions.", actions, "gemini", None
    except GeminiUnavailable:
        return deterministic_reply(message, db, current_user), [], "deterministic_fallback", None
