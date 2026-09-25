"""The only package permitted to communicate with Gemini."""

# Keep this package initializer import-free: the legacy classification fallback
# imports the client, while task_parser imports the legacy deterministic layer.
