from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class FeedbackSample:
    item_id: int
    category: Optional[str]
    topic_tag: Optional[str]
    estimated: int
    actual: int


def compute_multipliers(
    samples: List[FeedbackSample],
    min_samples: int = 5,
    min_multiplier: float = 0.5,
    max_multiplier: float = 3.0,
) -> Dict[str, float]:
    """
    Pure function for SPEC 1.7 Learning Loop:
    For each topic_tag and category with >= min_samples entries,
    compute avg(actual / estimated) and return duration multipliers.
    """
    category_ratios: Dict[str, List[float]] = {}
    topic_ratios: Dict[str, List[float]] = {}

    for s in samples:
        # Validate positive durations
        if not s.estimated or not s.actual or s.estimated <= 0 or s.actual <= 0:
            continue

        ratio = s.actual / s.estimated

        if s.category:
            cat_key = s.category.lower().strip()
            category_ratios.setdefault(cat_key, []).append(ratio)

        if s.topic_tag:
            topic_key = s.topic_tag.lower().strip()
            topic_ratios.setdefault(topic_key, []).append(ratio)

    multipliers: Dict[str, float] = {}

    # Category multipliers
    for cat, ratios in category_ratios.items():
        if len(ratios) >= min_samples:
            avg_ratio = sum(ratios) / len(ratios)
            clamped = max(min_multiplier, min(max_multiplier, avg_ratio))
            multipliers[cat] = round(clamped, 2)

    # Topic tag multipliers (if topic has enough samples, it can also calibrate)
    for topic, ratios in topic_ratios.items():
        if len(ratios) >= min_samples:
            avg_ratio = sum(ratios) / len(ratios)
            clamped = max(min_multiplier, min(max_multiplier, avg_ratio))
            multipliers[topic] = round(clamped, 2)

    return multipliers

