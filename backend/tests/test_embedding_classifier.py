import pytest
from app.classification.embeddings import classify_by_embeddings, get_model
from app.classification.pipeline import classify_text
from app.classification.types import ClassificationResult


def test_model_availability():
    """Verify SentenceTransformer model loads properly."""
    model = get_model()
    assert model is not None


def test_classify_by_embeddings_idea():
    """Verify semantic idea capture without explicit rule keywords."""
    text = "A mobile application concept for trading vintage vinyl records with collectors"
    result = classify_by_embeddings(text)
    assert result.category == "idea"
    assert result.confidence >= 0.7
    assert result.layer_used == "embedding"


def test_classify_by_embeddings_task():
    """Verify semantic task capture without direct rule keywords."""
    text = "Plumbing issue under the bathroom sink needs fixing"
    result = classify_by_embeddings(text)
    assert result.category == "task"
    assert result.confidence >= 0.7
    assert result.layer_used == "embedding"


def test_classify_by_embeddings_deadline():
    """Verify semantic deadline capture."""
    text = "Scholarship committee submission window closing at the end of this week"
    result = classify_by_embeddings(text)
    assert result.category == "deadline"
    assert result.confidence >= 0.7
    assert result.layer_used == "embedding"


def test_classify_by_embeddings_reminder():
    """Verify semantic reminder capture."""
    text = "Keep an eye on the water boiling in the kitchen"
    result = classify_by_embeddings(text)
    assert result.category == "reminder"
    assert result.confidence >= 0.7
    assert result.layer_used == "embedding"


def test_pipeline_swappable_layer_behavior():
    # 1. Clear rule match -> layer_used should be "rule"
    rule_res = classify_text("buy milk and eggs")
    assert rule_res.category == "task"
    assert rule_res.layer_used == "rule"

    # 2. Semantic thought with no explicit rule verbs -> layer_used should be "embedding"
    embed_res = classify_text("Novel approach to decentralizing social media feeds")
    assert embed_res.category == "idea"
    assert embed_res.layer_used == "embedding"
    assert embed_res.is_confident() is True


def test_embedding_preserves_partial_rule_extractions():
    # Input has an explicit duration and topic tag, but an obscure verb that rules don't know
    partial = ClassificationResult(
        est_duration_min=40,
        topic_tag="audio",
        priority=3,
        confidence=0.2,
        layer_used="rule",
    )
    res = classify_by_embeddings("A prototype synthesizer built with WebAudio APIs", partial_result=partial)
    assert res.category == "idea"
    assert res.est_duration_min == 40
    assert res.topic_tag == "audio"

