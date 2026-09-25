"""Small, timeout-bounded Gemini adapter; routers and models never import google-genai."""
from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any, Optional, Type

from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiUnavailable(RuntimeError):
    pass


class GeminiClient:
    def __init__(self, api_key: Optional[str] = None, client: Any = None, model: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self._client = client
        self.model = model or settings.GEMINI_MODEL

    @property
    def available(self) -> bool:
        return bool(self.api_key or self._client is not None) and bool(self.model)

    def _client_or_raise(self):
        if self._client is not None:
            return self._client
        if not self.api_key:
            raise GeminiUnavailable("Gemini is not configured")
        try:
            from google import genai
            return genai.Client(api_key=self.api_key)
        except Exception as exc:  # Import/config errors are treated as an outage.
            raise GeminiUnavailable("Gemini client could not be initialized") from exc

    def _call(self, fn):
        # google-genai currently exposes a synchronous client. Isolating the
        # bounded call prevents a provider outage from tying up an API request.
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(fn)
        try:
            return future.result(timeout=settings.GEMINI_TIMEOUT_SECONDS)
        except FuturesTimeout as exc:
            future.cancel()
            # Do not wait for a wedged network worker during request teardown.
            executor.shutdown(wait=False, cancel_futures=True)
            raise GeminiUnavailable("Gemini request timed out") from exc
        except Exception as exc:
            raise GeminiUnavailable("Gemini request failed") from exc
        finally:
            if future.done():
                executor.shutdown(wait=False, cancel_futures=True)

    def generate_structured(self, prompt: str, schema: Type[BaseModel]) -> BaseModel:
        client = self._client_or_raise()
        try:
            from google.genai import types
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=schema.model_json_schema(),
                temperature=0.1,
            )
            response = self._call(lambda: client.models.generate_content(model=self.model, contents=prompt, config=config))
            raw = response.text if getattr(response, "text", None) else ""
            return schema.model_validate(json.loads(raw))
        except GeminiUnavailable:
            raise
        except Exception as exc:
            raise GeminiUnavailable("Gemini returned invalid structured output") from exc

    def generate_with_tools(self, contents: Any, tools: list[Any]) -> Any:
        client = self._client_or_raise()
        try:
            from google.genai import types
            config = types.GenerateContentConfig(tools=tools, system_instruction=None, temperature=0.2)
            return self._call(lambda: client.models.generate_content(model=self.model, contents=contents, config=config))
        except GeminiUnavailable:
            raise
        except Exception as exc:
            raise GeminiUnavailable("Gemini tool request failed") from exc
