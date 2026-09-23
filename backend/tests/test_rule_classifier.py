from datetime import datetime, timezone
import pytest

from app.classification.rules import (
    classify_by_rules,
    extract_duration,
    extract_deadline_and_date,
    extract_topic_tag,
    extract_priority,
)
from app.classification.pipeline import classify_text


# Fixed reference time for deterministic testing: Wednesday, 2026-09-23 10:00:00 UTC
REF_TIME = datetime(2026, 9, 23, 10, 0, 0, tzinfo=timezone.utc)


def test_category_tasks():
    res1 = classify_by_rules("buy groceries", now=REF_TIME)
    assert res1.category == "task"

    res2 = classify_by_rules("submit quarterly tax return", now=REF_TIME)
    assert res2.category == "task"

    res3 = classify_by_rules("fix login authentication bug", now=REF_TIME)
    assert res3.category == "task"


def test_category_ideas():
    res1 = classify_by_rules("explore vector embeddings for local search", now=REF_TIME)
    assert res1.category == "idea"

    res2 = classify_by_rules("read about CRDT algorithms in distributed systems", now=REF_TIME)
    assert res2.category == "idea"

    res3 = classify_by_rules("research new mechanical keyboards", now=REF_TIME)
    assert res3.category == "idea"


def test_category_reminders():
    res1 = classify_by_rules("remind me to water the houseplants", now=REF_TIME)
    assert res1.category == "reminder"

    res2 = classify_by_rules("don't forget to lock the garage door", now=REF_TIME)
    assert res2.category == "reminder"

    res3 = classify_by_rules("remember to call mom tonight", now=REF_TIME)
    assert res3.category == "reminder"


def test_category_deadlines():
    res1 = classify_by_rules("tax filing deadline next week", now=REF_TIME)
    assert res1.category == "deadline"

    res2 = classify_by_rules("assignment due date tomorrow", now=REF_TIME)
    assert res2.category == "deadline"


def test_duration_parsing():
    # Minutes
    dur1, _ = extract_duration("workout for 45 mins at the gym")
    assert dur1 == 45

    # Hours
    dur2, _ = extract_duration("code review session for 2 hours")
    assert dur2 == 120

    # Hours and minutes
    dur3, _ = extract_duration("study session for 1 hour and 30 mins")
    assert dur3 == 90

    # Half an hour
    dur4, _ = extract_duration("half an hour walking")
    assert dur4 == 30

    # Full classify result with duration
    res = classify_by_rules("clean the kitchen for 35 minutes", now=REF_TIME)
    assert res.est_duration_min == 35


def test_default_durations():
    # If no explicit duration is given, defaults apply per category
    res_task = classify_by_rules("fix broken shelf", now=REF_TIME)
    assert res_task.est_duration_min == 30

    res_idea = classify_by_rules("think about next project architecture", now=REF_TIME)
    assert res_idea.est_duration_min == 15

    res_rem = classify_by_rules("remind me to turn off stove", now=REF_TIME)
    assert res_rem.est_duration_min == 5


def test_deadline_parsing():
    # By Friday 5pm
    deadline, _ = extract_deadline_and_date("submit project report by Friday 5pm", now=REF_TIME)
    assert deadline is not None
    assert deadline.weekday() == 4  # Friday
    assert deadline.hour == 17

    # Due tomorrow
    deadline2, _ = extract_deadline_and_date("finish homework due tomorrow", now=REF_TIME)
    assert deadline2 is not None
    assert deadline2.day == 24  # Sept 24


def test_priority_keywords():
    res_urgent = classify_by_rules("fix critical prod outage asap", now=REF_TIME)
    assert res_urgent.priority == 5

    res_important = classify_by_rules("prepare important client presentation", now=REF_TIME)
    assert res_important.priority == 4

    res_low = classify_by_rules("clean attic someday when free", now=REF_TIME)
    assert res_low.priority == 2

    res_default = classify_by_rules("buy milk", now=REF_TIME)
    assert res_default.priority == 3


def test_topic_tag_extraction():
    # Explicit hashtag
    tag1 = extract_topic_tag("refactor auth middleware #dev")
    assert tag1 == "dev"

    # Health keyword
    tag2 = extract_topic_tag("visit dentist for checkup")
    assert tag2 == "health"

    # Finance keyword
    tag3 = extract_topic_tag("pay electricity bill online")
    assert tag3 == "finance"

    # Work keyword
    tag4 = extract_topic_tag("prepare quarterly slide deck for meeting")
    assert tag4 == "work"


def test_pipeline_integration():
    # Full capture text
    item_text = "submit annual tax return by Friday 5pm for 45 mins #finance urgent"
    res = classify_text(item_text, now=REF_TIME)

    assert res.category == "task"
    assert res.priority == 5
    assert res.est_duration_min == 45
    assert res.deadline is not None
    assert res.deadline.weekday() == 4
    assert res.topic_tag == "finance"
    assert res.is_confident() is True


def test_ambiguous_text_leaves_for_next_layers():
    # Input with no known verbs, dates, or keywords
    res = classify_by_rules("banana cucumber lavender whisper", now=REF_TIME)
    assert res.category is None
    assert res.confidence < 0.7
    assert res.is_confident() is False

