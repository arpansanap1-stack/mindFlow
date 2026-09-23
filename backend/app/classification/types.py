from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Literal

CategoryType = Literal["task", "idea", "reminder", "deadline"]


@dataclass
class ClassificationResult:
    category: Optional[CategoryType] = None
    priority: Optional[int] = None
    est_duration_min: Optional[int] = None
    deadline: Optional[datetime] = None
    topic_tag: Optional[str] = None
    confidence: float = 0.0
    layer_used: str = "rule"

    def is_confident(self) -> bool:
        """
        Check if the current layer is confident enough to terminate the pipeline early.
        A result is confident if category is determined with confidence >= 0.7.
        """
        return self.category is not None and self.confidence >= 0.7

