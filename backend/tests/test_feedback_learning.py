import pytest
from datetime import date, time
from app.feedback.learning import FeedbackSample, compute_multipliers


# --- Unit Tests for Pure compute_multipliers() ---

def test_compute_multipliers_empty():
    res = compute_multipliers([])
    assert res == {}


def test_compute_multipliers_under_min_samples():
    samples = [
        FeedbackSample(item_id=1, category="task", topic_tag=None, estimated=30, actual=45),
        FeedbackSample(item_id=2, category="task", topic_tag=None, estimated=30, actual=45),
        FeedbackSample(item_id=3, category="task", topic_tag=None, estimated=30, actual=45),
        FeedbackSample(item_id=4, category="task", topic_tag=None, estimated=30, actual=45),
    ]
    # Default min_samples is 5, with 4 it should return empty
    res = compute_multipliers(samples, min_samples=5)
    assert res == {}


def test_compute_multipliers_exact_min_samples():
    samples = [
        FeedbackSample(item_id=1, category="task", topic_tag="coding", estimated=30, actual=45),
        FeedbackSample(item_id=2, category="task", topic_tag="coding", estimated=30, actual=45),
        FeedbackSample(item_id=3, category="task", topic_tag="coding", estimated=30, actual=45),
        FeedbackSample(item_id=4, category="task", topic_tag="coding", estimated=30, actual=45),
        FeedbackSample(item_id=5, category="task", topic_tag="coding", estimated=30, actual=45),
    ]
    res = compute_multipliers(samples, min_samples=5)
    assert "task" in res
    assert res["task"] == 1.5
    assert "coding" in res
    assert res["coding"] == 1.5


def test_compute_multipliers_clamping_upper_and_lower():
    # Test upper clamp (ratio 4.0 -> clamped to 3.0)
    samples_high = [
        FeedbackSample(item_id=i, category="deadline", topic_tag=None, estimated=10, actual=40)
        for i in range(5)
    ]
    res_high = compute_multipliers(samples_high, min_samples=5)
    assert res_high["deadline"] == 3.0

    # Test lower clamp (ratio 0.2 -> clamped to 0.5)
    samples_low = [
        FeedbackSample(item_id=i, category="idea", topic_tag=None, estimated=100, actual=20)
        for i in range(5)
    ]
    res_low = compute_multipliers(samples_low, min_samples=5)
    assert res_low["idea"] == 0.5


def test_compute_multipliers_ignores_invalid_values():
    samples = [
        FeedbackSample(item_id=1, category="task", topic_tag=None, estimated=0, actual=30),
        FeedbackSample(item_id=2, category="task", topic_tag=None, estimated=30, actual=-5),
        FeedbackSample(item_id=3, category="task", topic_tag=None, estimated=-10, actual=-10),
    ]
    res = compute_multipliers(samples, min_samples=1)
    assert res == {}


# --- Integration Tests with API Client ---

def test_feedback_stats_and_recalibrate_api(client):
    # Initial stats
    resp = client.get("/feedback/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_entries" in data
    assert "samples_with_duration" in data
    assert "category_counts" in data
    assert "multipliers" in data

    # Create 5 items with category 'task' and complete them with actual duration
    for i in range(5):
        create_resp = client.post(
            "/items",
            json={
                "raw_text": f"Study machine learning chapter {i}",
                "category": "task",
                "topic_tag": "study",
                "est_duration_min": 30,
            },
        )
        assert create_resp.status_code == 201
        item_id = create_resp.json()["id"]

        # Complete item with 45m actual duration (ratio = 1.5)
        comp_resp = client.post(
            f"/items/{item_id}/complete",
            json={"actual_duration": 45},
        )
        assert comp_resp.status_code == 200

    # Verify stats reflect new entries
    stats_resp = client.get("/feedback/stats")
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()
    assert stats_data["category_counts"].get("task", 0) >= 5
    assert stats_data["topic_counts"].get("study", 0) >= 5

    # Run recalibrate endpoint
    recal_resp = client.post("/feedback/recalibrate?min_samples=5")
    assert recal_resp.status_code == 200
    recal_data = recal_resp.json()
    assert recal_data["total_samples"] >= 5
    assert "task" in recal_data["multipliers"]
    assert recal_data["multipliers"]["task"] == 1.5
    assert "study" in recal_data["multipliers"]
    assert recal_data["multipliers"]["study"] == 1.5


def test_recalibrated_multiplier_applied_in_scheduler(client):
    # Ensure 'task' multiplier is set to 2.0 via user_prefs
    patch_pref_resp = client.patch(
        "/prefs",
        json={"category_duration_multiplier": {"task": 2.0}},
    )
    assert patch_pref_resp.status_code == 200

    # Create an item in inbox with est_duration_min = 30
    item_resp = client.post(
        "/items",
        json={
            "raw_text": "Finish task documentation report",
            "category": "task",
            "est_duration_min": 30,
            "priority": 5,
        },
    )
    assert item_resp.status_code == 201
    item_id = item_resp.json()["id"]

    # Run scheduler for tomorrow
    sched_resp = client.post("/schedule/run", json={"date": "2026-10-01"})
    assert sched_resp.status_code == 200
    sched_data = sched_resp.json()

    # Find the scheduled slot for our item
    scheduled_slot = next(
        (s for s in sched_data["slots"] if s["item_id"] == item_id),
        None,
    )
    assert scheduled_slot is not None
    # 30 min * 2.0 = 60 min
    start_h, start_m = [int(x) for x in scheduled_slot["start_time"].split(":")[:2]]
    end_h, end_m = [int(x) for x in scheduled_slot["end_time"].split(":")[:2]]
    duration_min = (end_h * 60 + end_m) - (start_h * 60 + start_m)
    assert duration_min == 60
