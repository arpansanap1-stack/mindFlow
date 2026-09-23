import pytest
import sqlite3
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.database as app_db
from app.database import Base, get_db
from app.config import settings
from app.models import User
from app.auth import get_current_user, get_current_active_user, create_access_token
from app.main import app

# Ensure tests don't make real Gemini API calls unless explicitly patched in test
settings.GEMINI_API_KEY = ""

# In-memory SQLite with StaticPool so all threads/sessions share the same memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Point app.database.SessionLocal to TestingSessionLocal for tests
app_db.SessionLocal = TestingSessionLocal
app_db.engine = engine


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create default user (id=1) for existing backward-compatible tests
    default_user = User(
        id=1,
        email="default_test@mindflow.local",
        password_hash="insecure_test_hash",
        role="USER",
        status="ACTIVE",
    )
    db.add(default_user)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    Standard test client with default user authenticated.
    Keeps all existing 70 tests passing without modifications.
    """
    default_user = db_session.query(User).filter(User.id == 1).first()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return default_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def raw_client(db_session):
    """
    Raw test client without auth overrides.
    Used for testing real token authentication and unauthenticated access.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_headers():
    """Fixture providing helper to generate Authorization header for any User model."""
    def _make(user: User) -> dict:
        token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role}
        )
        return {"Authorization": f"Bearer {token}"}
    return _make
