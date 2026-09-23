from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import items, routine, schedule, feedback, suggest

app = FastAPI(
    title="MindFlow API",
    description="Personal task and thought management system backend",
    version="0.1.0",
)

# Setup CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(items.router)
app.include_router(routine.router)
app.include_router(schedule.router)
app.include_router(feedback.router)
app.include_router(suggest.router)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "app": "MindFlow", "version": "0.1.0"}
