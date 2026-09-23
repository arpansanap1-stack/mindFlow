import json
from unittest.mock import MagicMock, patch
from datetime import datetime
import pytest

from app.classification.types import ClassificationResult
from app.classification.llm import classify_by_llm, LLMClassificationSchema
from app.classification.pipeline import classify_text
from app.models import Item
from app import crud


def test_classify_by_llm_with_mock_client():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "category": "task",
        "priority": 4,
        "est_duration_min": 45,
        "deadline": "2026-10-15T10:00:00",
        "topic_tag": "engineering",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = classify_by_llm(
        text="refactor the payment gateway microservice",
        client=mock_client,
    )

    assert result.category == "task"
    assert result.priority == 4
    assert result.est_duration_min == 45
    assert result.topic_tag == "engineering"
    assert result.deadline is not None
    assert result.confidence > 0.9
    assert result.layer_used == "llm"


def test_classify_by_llm_preserves_partial_deadline():
    partial = ClassificationResult(
        category=None,
        priority=3,
        est_duration_min=30,
        deadline=datetime(2026, 11, 1, 12, 0),
        topic_tag=None,
        confidence=0.2,
        layer_used="rule",
    )

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "category": "reminder",
        "priority": 2,
        "est_duration_min": 15,
        "deadline": None,
        "topic_tag": "health",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = classify_by_llm(
        text="doctor follow-up check",
        partial_result=partial,
        client=mock_client,
    )

    assert result.category == "reminder"
    assert result.priority == 2
    assert result.est_duration_min == 15
    assert result.topic_tag == "health"
    # Preserved rule deadline
    assert result.deadline == datetime(2026, 11, 1, 12, 0)
    assert result.layer_used == "llm"


def test_classify_by_llm_graceful_error_fallback():
    partial = ClassificationResult(
        category=None,
        priority=3,
        est_duration_min=30,
        confidence=0.1,
        layer_used="rule",
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("Quota exceeded or connection error")

    result = classify_by_llm(
        text="ambiguous query",
        partial_result=partial,
        client=mock_client,
    )

    # Does not crash, gracefully falls back to partial
    assert result == partial


def test_classify_by_llm_missing_api_key():
    partial = ClassificationResult(
        category=None,
        priority=3,
        est_duration_min=30,
        confidence=0.1,
        layer_used="rule",
    )

    with patch("app.classification.llm.settings.GEMINI_API_KEY", ""):
        result = classify_by_llm(
            text="some input",
            partial_result=partial,
            api_key="",
        )
        assert result == partial


def test_pipeline_invokes_llm_when_confident():
    mock_llm_result = ClassificationResult(
        category="task",
        priority=4,
        est_duration_min=45,
        topic_tag="research",
        confidence=0.92,
        layer_used="llm",
    )

    with patch("app.classification.pipeline.settings.GEMINI_API_KEY", "test-key"), \
         patch("app.classification.pipeline.classify_by_llm", return_value=mock_llm_result) as mock_llm_fn:
        
        # Text that fails Layer 1 rules & gets low embedding similarity
        result = classify_text("zyxw vuts rqpo", allow_llm=True)
        assert result.category == "task"
        assert result.layer_used == "llm"
        assert mock_llm_fn.called


def test_async_classify_item_background_task(db_session):
    # Create item with no category
    item = Item(
        raw_text="investigate strange memory anomaly in production",
        category=None,
        priority=3,
        est_duration_min=30,
        status="inbox",
    )
    db_session.add(item)
    db_session.commit()
    item_id = item.id

    mock_llm_result = ClassificationResult(
        category="task",
        priority=5,
        est_duration_min=60,
        topic_tag="debugging",
        confidence=0.95,
        layer_used="llm",
    )

    with patch("app.classification.llm.classify_by_llm", return_value=mock_llm_result):
        crud.async_classify_item(item_id=item_id, db=db_session)

    db_session.expire_all()
    updated = db_session.query(Item).filter(Item.id == item_id).first()
    assert updated.category == "task"
    assert updated.priority == 5
    assert updated.est_duration_min == 60
    assert updated.topic_tag == "debugging"
