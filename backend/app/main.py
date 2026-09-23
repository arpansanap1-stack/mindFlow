import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import SessionLocal
from app.routers import auth, admin, items, routine, schedule, feedback, suggest
from app import crud

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure initial admin user exists if users table is empty
    try:
        db = SessionLocal()
        try:
            admin_user = crud.init_admin_user_if_needed(db)
            if admin_user:
                logger.info(f"Admin account verified/bootstrapped: {admin_user.email}")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Could not run initial admin bootstrap on startup: {e}")
    yield


app = FastAPI(
    title="MindFlow API",
    description="Personal task and thought management system backend with multi-user isolation",
    version="0.2.0",
    lifespan=lifespan,
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
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(items.router)
app.include_router(routine.router)
app.include_router(schedule.router)
app.include_router(feedback.router)
app.include_router(suggest.router)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "app": "MindFlow", "version": "0.2.0"}
