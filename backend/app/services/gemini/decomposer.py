from .client import GeminiClient, GeminiUnavailable
from .prompts import DECOMPOSITION_PROMPT
from .schemas import DecompositionPreview


def decompose(text: str, client: GeminiClient | None = None) -> DecompositionPreview:
    service = client or GeminiClient()
    if not service.available:
        raise GeminiUnavailable("Gemini is not configured")
    preview = service.generate_structured(DECOMPOSITION_PROMPT.format(text=text), DecompositionPreview)
    # Ordering/dependency sanity is a business validation after provider output.
    orders = {step.order for step in preview.steps}
    if len(orders) != len(preview.steps) or any(dep >= step.order or dep < 1 for step in preview.steps for dep in step.depends_on):
        raise GeminiUnavailable("Gemini returned an invalid decomposition")
    return preview
