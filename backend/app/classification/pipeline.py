from datetime import datetime
from typing import Optional
from app.config import settings
from app.classification.types import ClassificationResult
from app.classification.rules import classify_by_rules
from app.classification.embeddings import classify_by_embeddings
from app.classification.llm import classify_by_llm


def classify_text(
    text: str,
    now: Optional[datetime] = None,
    allow_llm: bool = True,
) -> ClassificationResult:
    """
    Main entry point for the swappable 3-layer classification pipeline (SPEC 1.5).
    Layer 1: Rule pass (regex + dateparser + keyword heuristics) - instant, free
    Layer 2: Local embedding pass (all-MiniLM-L6-v2) - offline, free, CPU
    Layer 3: LLM fallback (Gemini free tier) - called only if steps 1-2 leave item unclassified (<20%)
    """
    # --- Layer 1: Rule pass ---
    rule_result = classify_by_rules(text, now=now)
    if rule_result.is_confident():
        return rule_result

    # --- Layer 2: Local embedding pass (Step 6) ---
    embedding_result = classify_by_embeddings(text, partial_result=rule_result)
    if embedding_result.is_confident():
        return embedding_result

    # --- Layer 3: LLM Fallback (Step 9) ---
    if allow_llm and settings.GEMINI_API_KEY:
        llm_result = classify_by_llm(text, partial_result=embedding_result)
        if llm_result.is_confident():
            return llm_result

    return embedding_result
