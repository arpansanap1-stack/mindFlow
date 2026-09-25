"""Embedding storage and search, deliberately independent from ORM routers."""
from __future__ import annotations

import json
import math
from typing import Iterable

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Item, SemanticEmbedding
from .client import GeminiClient, GeminiUnavailable


def _embed(text: str, client: GeminiClient | None = None) -> list[float]:
    service = client or GeminiClient()
    raw_client = service._client_or_raise()
    try:
        response = service._call(lambda: raw_client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=text,
        ))
        # SDK has used both `.embeddings[0].values` and `.embedding.values`.
        values = getattr(getattr(response, "embedding", None), "values", None)
        if values is None and getattr(response, "embeddings", None):
            values = getattr(response.embeddings[0], "values", None)
        vector = [float(v) for v in (values or [])]
        if not vector:
            raise ValueError("empty embedding")
        return vector
    except GeminiUnavailable:
        raise
    except Exception as exc:
        raise GeminiUnavailable("Gemini embedding request failed") from exc


def upsert_item_embedding(db: Session, item: Item, client: GeminiClient | None = None) -> SemanticEmbedding:
    vector = _embed(item.raw_text, client)
    record = db.query(SemanticEmbedding).filter(
        SemanticEmbedding.user_id == item.user_id,
        SemanticEmbedding.entity_type == "item",
        SemanticEmbedding.entity_id == item.id,
    ).first()
    if not record:
        record = SemanticEmbedding(user_id=item.user_id, entity_type="item", entity_id=item.id,
                                   content=item.raw_text, embedding_json="[]", model=settings.GEMINI_EMBEDDING_MODEL)
        db.add(record)
    record.content = item.raw_text
    record.embedding_json = json.dumps(vector)
    record.model = settings.GEMINI_EMBEDDING_MODEL
    db.commit()
    db.refresh(record)
    return record


def backfill_missing_item_embeddings(db: Session, user_id: int, limit: int = 50) -> int:
    """Lazy, bounded indexing for pre-existing captures after a user searches."""
    existing_ids = {row[0] for row in db.query(SemanticEmbedding.entity_id).filter(
        SemanticEmbedding.user_id == user_id, SemanticEmbedding.entity_type == "item"
    ).all()}
    missing = db.query(Item).filter(Item.user_id == user_id).order_by(Item.created_at.desc()).all()
    created = 0
    for item in missing:
        if item.id in existing_ids:
            continue
        upsert_item_embedding(db, item)
        created += 1
        if created >= limit:
            break
    return created


def _cosine(a: Iterable[float], b: Iterable[float]) -> float:
    left, right = list(a), list(b)
    if not left or len(left) != len(right):
        return 0.0
    denom = math.sqrt(sum(x * x for x in left)) * math.sqrt(sum(x * x for x in right))
    return sum(x * y for x, y in zip(left, right)) / denom if denom else 0.0


def search_items(db: Session, user_id: int, query: str, limit: int, client: GeminiClient | None = None) -> list[tuple[Item, float]]:
    """Search only the current user's records; absent/outage embedding falls back to text match."""
    items = db.query(Item).filter(Item.user_id == user_id).all()
    try:
        query_vector = _embed(query, client)
        rows = db.query(SemanticEmbedding).filter(
            SemanticEmbedding.user_id == user_id,
            SemanticEmbedding.entity_type == "item",
        ).all()
        by_id = {row.entity_id: row for row in rows}
        ranked = []
        for item in items:
            row = by_id.get(item.id)
            if not row:
                continue
            try:
                ranked.append((item, _cosine(query_vector, json.loads(row.embedding_json))))
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
        if ranked:
            return sorted(ranked, key=lambda result: result[1], reverse=True)[:limit]
    except GeminiUnavailable:
        pass

    terms = {word.lower() for word in query.split() if len(word) > 1}
    ranked = [(item, float(sum(term in item.raw_text.lower() for term in terms)) / max(1, len(terms))) for item in items]
    return sorted((row for row in ranked if row[1] > 0), key=lambda result: result[1], reverse=True)[:limit]
