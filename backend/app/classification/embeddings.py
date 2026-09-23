import logging
from typing import Optional, Dict, List
import numpy as np

from app.classification.types import ClassificationResult, CategoryType
from app.classification.labeled_examples import LABELED_EXAMPLES

logger = logging.getLogger(__name__)

# Cache variables for lazy loading
_model = None
_example_embeddings = None
_example_data = None


def get_model():
    """Lazily load SentenceTransformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer model: {e}")
            _model = False
    return _model if _model is not False else None


def get_example_embeddings():
    """Pre-compute and cache normalized embeddings for labeled examples."""
    global _example_embeddings, _example_data
    if _example_embeddings is None:
        model = get_model()
        if model is None:
            return None, None

        texts = [ex["text"] for ex in LABELED_EXAMPLES]
        _example_embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        _example_data = LABELED_EXAMPLES

    return _example_embeddings, _example_data


def classify_by_embeddings(
    text: str,
    partial_result: Optional[ClassificationResult] = None,
    similarity_threshold: float = 0.25,
) -> ClassificationResult:
    """
    SPEC 1.5 Layer 2: Local embedding pass.
    Embeds input with all-MiniLM-L6-v2, compares via cosine similarity to labeled example set,
    and fills in category/priority when rule pass is unsure.
    """
    model = get_model()
    embeddings, example_data = get_example_embeddings()

    if model is None or embeddings is None or example_data is None:
        return partial_result or ClassificationResult(layer_used="embedding", confidence=0.0)

    # Encode query text with unit normalization
    query_vec = model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]

    # Compute cosine similarities via dot product: shape (N,)
    similarities = np.dot(embeddings, query_vec)

    # Find top nearest neighbor index and score
    top_indices = np.argsort(similarities)[::-1]
    top_1_idx = top_indices[0]
    best_score = float(similarities[top_1_idx])
    best_cat = example_data[top_1_idx]["category"]
    best_example = example_data[top_1_idx]

    # If the score meets similarity threshold
    if best_score >= similarity_threshold:
        # Use priority from nearest example or keep rule priority if specified
        priority = (
            partial_result.priority
            if partial_result and partial_result.priority is not None and partial_result.priority != 3
            else best_example.get("priority", 3)
        )

        # Duration defaults if not extracted by rules
        duration_defaults = {"task": 30, "idea": 15, "reminder": 5, "deadline": 45}
        est_duration = (
            partial_result.est_duration_min
            if partial_result and partial_result.est_duration_min is not None
            else duration_defaults.get(best_cat, 30)
        )

        deadline = partial_result.deadline if partial_result else None
        topic_tag = partial_result.topic_tag if partial_result else None

        # Scale confidence between 0.70 and 0.95
        confidence = min(0.95, max(0.70, 0.70 + (best_score - similarity_threshold) * 0.8))

        return ClassificationResult(
            category=best_cat,
            priority=priority,
            est_duration_min=est_duration,
            deadline=deadline,
            topic_tag=topic_tag,
            confidence=confidence,
            layer_used="embedding",
        )

    # If below threshold, return partial result with low confidence
    if partial_result:
        return partial_result

    return ClassificationResult(
        category=None,
        priority=3,
        est_duration_min=None,
        deadline=None,
        topic_tag=None,
        confidence=best_score,
        layer_used="embedding",
    )

