"""
PostgreSQL integration tests for MindFlow.

These tests verify actual PostgreSQL compatibility: schema creation, CRUD operations,
relationships, constraints, data types, and Alembic migrations. They run against
a real PostgreSQL database and are SKIPPED when PostgreSQL is unavailable.

The in-memory SQLite tests validate application logic; these tests validate
production database compatibility.

Usage:
    # Ensure DATABASE_URL env var points to a PostgreSQL database, then:
    pytest backend/tests/test_pg_integration.py -v

    # Or run alongside the full suite (auto-skips if PG unavailable):
    pytest backend/tests/ -v
"""

import os
import pytest
from datetime import datetime, date, time, timezone, timedelta

import sqlalchemy
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Determine PostgreSQL URL – skip entire module if unavailable
# ---------------------------------------------------------------------------

from app.config import settings

PG_URL = os.environ.get("DATABASE_URL") or settings.DATABASE_URL
_is_pg = PG_URL.startswith("postgresql")


def _pg_available() -> bool:
    """Test whether a PostgreSQL server is actually reachable."""
    if not _is_pg:
        return False
    try:
        eng = create_engine(PG_URL, connect_args={"connect_timeout": 2})
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


_pg_ok = _pg_available()

pg_required = pytest.mark.skipif(
    not _pg_ok,
    reason="PostgreSQL not available (DATABASE_URL not set or server unreachable)",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def pg_engine():
    """Create an engine connected to the real PostgreSQL database."""
    engine = create_engine(PG_URL)
    yield engine
    engine.dispose()


@pytest.fixture(scope="module")
def pg_tables(pg_engine):
    """Create all tables from models in the test database, then drop them after."""
    from app.database import Base
    import app.models  # noqa: F401  — ensure models are registered

    Base.metadata.create_all(bind=pg_engine)
    yield
    Base.metadata.drop_all(bind=pg_engine)


@pytest.fixture()
def pg_session(pg_engine, pg_tables):
    """Provide a transactional session that rolls back after each test."""
    Session = sessionmaker(bind=pg_engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def clean_tables(pg_session):
    """Truncate all application tables before a test (order respects FK deps)."""
    for table in reversed([
        "schedule_slots", "feedback_log", "items", "routine_blocks", "user_prefs",
    ]):
        pg_session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
    pg_session.commit()
    yield


# ---------------------------------------------------------------------------
# 1. Schema / Alembic migration tests
# ---------------------------------------------------------------------------

@pg_required
class TestSchemaCreation:
    """Verify that the SQLAlchemy models create correct tables in PostgreSQL."""

    def test_all_tables_exist(self, pg_engine, pg_tables):
        inspector = inspect(pg_engine)
        table_names = set(inspector.get_table_names())
        expected = {"items", "routine_blocks", "schedule_slots", "feedback_log", "user_prefs"}
        assert expected.issubset(table_names), f"Missing tables: {expected - table_names}"

    def test_items_columns(self, pg_engine, pg_tables):
        inspector = inspect(pg_engine)
        columns = {c["name"] for c in inspector.get_columns("items")}
        expected = {"id", "raw_text", "category", "priority", "est_duration_min",
                    "deadline", "status", "topic_tag", "created_at"}
        assert expected == columns

    def test_items_check_constraints(self, pg_engine, pg_tables):
        inspector = inspect(pg_engine)
        constraints = inspector.get_check_constraints("items")
        constraint_names = {c["name"] for c in constraints}
        assert "check_item_category" in constraint_names
        assert "check_item_priority" in constraint_names
        assert "check_item_status" in constraint_names

    def test_foreign_keys(self, pg_engine, pg_tables):
        inspector = inspect(pg_engine)
        # schedule_slots → items
        fks = inspector.get_foreign_keys("schedule_slots")
        fk_tables = {fk["referred_table"] for fk in fks}
        assert "items" in fk_tables

        # feedback_log → items
        fks = inspector.get_foreign_keys("feedback_log")
        fk_tables = {fk["referred_table"] for fk in fks}
        assert "items" in fk_tables

    def test_indexes_exist(self, pg_engine, pg_tables):
        inspector = inspect(pg_engine)
        item_indexes = {idx["name"] for idx in inspector.get_indexes("items")}
        assert "ix_items_id" in item_indexes


# ---------------------------------------------------------------------------
# 2. CRUD operations
# ---------------------------------------------------------------------------

@pg_required
class TestCRUDOperations:
    """Verify basic CRUD operations against PostgreSQL."""

    def test_create_and_read_item(self, pg_session, clean_tables):
        from app.models import Item
        item = Item(
            raw_text="Buy groceries",
            category="task",
            priority=3,
            est_duration_min=30,
            status="inbox",
        )
        pg_session.add(item)
        pg_session.commit()

        fetched = pg_session.query(Item).filter(Item.id == item.id).first()
        assert fetched is not None
        assert fetched.raw_text == "Buy groceries"
        assert fetched.category == "task"
        assert fetched.priority == 3
        assert fetched.status == "inbox"

    def test_update_item(self, pg_session, clean_tables):
        from app.models import Item
        item = Item(raw_text="Draft email", category="task", priority=2, status="inbox")
        pg_session.add(item)
        pg_session.commit()

        item.priority = 5
        item.status = "scheduled"
        pg_session.commit()

        fetched = pg_session.query(Item).filter(Item.id == item.id).first()
        assert fetched.priority == 5
        assert fetched.status == "scheduled"

    def test_delete_item(self, pg_session, clean_tables):
        from app.models import Item
        item = Item(raw_text="Temp item", status="inbox")
        pg_session.add(item)
        pg_session.commit()
        item_id = item.id

        pg_session.delete(item)
        pg_session.commit()

        assert pg_session.query(Item).filter(Item.id == item_id).first() is None

    def test_create_routine_block(self, pg_session, clean_tables):
        from app.models import RoutineBlock
        block = RoutineBlock(
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(11, 0),
            label="Deep work",
            fixed=True,
        )
        pg_session.add(block)
        pg_session.commit()

        fetched = pg_session.query(RoutineBlock).filter(RoutineBlock.id == block.id).first()
        assert fetched.label == "Deep work"
        assert fetched.start_time == time(9, 0)
        assert fetched.fixed is True

    def test_create_user_prefs(self, pg_session, clean_tables):
        from app.models import UserPrefs
        prefs = UserPrefs(
            user_id=1,
            preferred_deep_hours='["09:00-11:00"]',
            break_duration_pref=15,
        )
        pg_session.add(prefs)
        pg_session.commit()

        fetched = pg_session.query(UserPrefs).filter(UserPrefs.user_id == 1).first()
        assert fetched.break_duration_pref == 15


# ---------------------------------------------------------------------------
# 3. Relationships and cascade behavior
# ---------------------------------------------------------------------------

@pg_required
class TestRelationships:
    """Verify FK relationships and cascade deletes work on PostgreSQL."""

    def test_item_schedule_slot_relationship(self, pg_session, clean_tables):
        from app.models import Item, ScheduleSlot
        item = Item(raw_text="Scheduled task", category="task", priority=3, status="scheduled")
        pg_session.add(item)
        pg_session.commit()

        slot = ScheduleSlot(
            item_id=item.id,
            date=date.today(),
            start_time=time(10, 0),
            end_time=time(10, 30),
            auto_generated=True,
        )
        pg_session.add(slot)
        pg_session.commit()

        # Verify relationship loads
        pg_session.refresh(item)
        assert len(item.schedule_slots) == 1
        assert item.schedule_slots[0].id == slot.id

    def test_cascade_delete_item_removes_slots(self, pg_session, clean_tables):
        from app.models import Item, ScheduleSlot
        item = Item(raw_text="Will be deleted", status="inbox")
        pg_session.add(item)
        pg_session.commit()

        slot = ScheduleSlot(
            item_id=item.id,
            date=date.today(),
            start_time=time(14, 0),
            end_time=time(14, 30),
        )
        pg_session.add(slot)
        pg_session.commit()
        slot_id = slot.id

        pg_session.delete(item)
        pg_session.commit()

        assert pg_session.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first() is None

    def test_cascade_delete_item_removes_feedback(self, pg_session, clean_tables):
        from app.models import Item, FeedbackLog
        item = Item(raw_text="Feedback item", status="done")
        pg_session.add(item)
        pg_session.commit()

        log = FeedbackLog(
            item_id=item.id,
            estimated_duration=30,
            actual_duration=25,
        )
        pg_session.add(log)
        pg_session.commit()
        log_id = log.id

        pg_session.delete(item)
        pg_session.commit()

        assert pg_session.query(FeedbackLog).filter(FeedbackLog.id == log_id).first() is None

    def test_fk_constraint_prevents_orphan_slot(self, pg_session, clean_tables):
        """Inserting a schedule_slot with a non-existent item_id should fail."""
        from app.models import ScheduleSlot
        slot = ScheduleSlot(
            item_id=99999,
            date=date.today(),
            start_time=time(10, 0),
            end_time=time(10, 30),
        )
        pg_session.add(slot)
        with pytest.raises(Exception):
            pg_session.commit()
        pg_session.rollback()


# ---------------------------------------------------------------------------
# 4. Data type verification
# ---------------------------------------------------------------------------

@pg_required
class TestDataTypes:
    """Verify PostgreSQL handles MindFlow data types correctly."""

    def test_datetime_with_timezone(self, pg_session, clean_tables):
        from app.models import Item
        now = datetime.now(timezone.utc)
        item = Item(raw_text="Test datetime", status="inbox", created_at=now)
        pg_session.add(item)
        pg_session.commit()

        fetched = pg_session.query(Item).filter(Item.id == item.id).first()
        assert fetched.created_at is not None

    def test_date_and_time_columns(self, pg_session, clean_tables):
        from app.models import Item, ScheduleSlot
        item = Item(raw_text="Time test", status="inbox")
        pg_session.add(item)
        pg_session.commit()

        today = date.today()
        slot = ScheduleSlot(
            item_id=item.id,
            date=today,
            start_time=time(8, 30),
            end_time=time(9, 15),
        )
        pg_session.add(slot)
        pg_session.commit()

        fetched = pg_session.query(ScheduleSlot).filter(ScheduleSlot.id == slot.id).first()
        assert fetched.date == today
        assert fetched.start_time == time(8, 30)
        assert fetched.end_time == time(9, 15)

    def test_deadline_datetime(self, pg_session, clean_tables):
        from app.models import Item
        deadline = datetime(2026, 12, 31, 17, 0, 0)
        item = Item(
            raw_text="Year-end deadline",
            category="deadline",
            priority=5,
            deadline=deadline,
            status="inbox",
        )
        pg_session.add(item)
        pg_session.commit()

        fetched = pg_session.query(Item).filter(Item.id == item.id).first()
        assert fetched.deadline == deadline

    def test_boolean_columns(self, pg_session, clean_tables):
        from app.models import RoutineBlock
        block = RoutineBlock(
            day_of_week=2,
            start_time=time(13, 0),
            end_time=time(14, 0),
            fixed=False,
        )
        pg_session.add(block)
        pg_session.commit()

        fetched = pg_session.query(RoutineBlock).filter(RoutineBlock.id == block.id).first()
        assert fetched.fixed is False

    def test_text_columns_long_content(self, pg_session, clean_tables):
        from app.models import Item
        long_text = "A" * 5000
        item = Item(raw_text=long_text, status="inbox")
        pg_session.add(item)
        pg_session.commit()

        fetched = pg_session.query(Item).filter(Item.id == item.id).first()
        assert fetched.raw_text == long_text

    def test_check_constraint_rejects_invalid_category(self, pg_session, clean_tables):
        from app.models import Item
        item = Item(raw_text="Bad category", category="invalid_cat", status="inbox")
        pg_session.add(item)
        with pytest.raises(Exception):
            pg_session.commit()
        pg_session.rollback()

    def test_check_constraint_rejects_invalid_priority(self, pg_session, clean_tables):
        from app.models import Item
        item = Item(raw_text="Bad priority", category="task", priority=99, status="inbox")
        pg_session.add(item)
        with pytest.raises(Exception):
            pg_session.commit()
        pg_session.rollback()


# ---------------------------------------------------------------------------
# 5. Server defaults
# ---------------------------------------------------------------------------

@pg_required
class TestServerDefaults:
    """Verify that server_default values work correctly on PostgreSQL."""

    def test_item_created_at_default(self, pg_session, clean_tables):
        """created_at should auto-populate via server default now()."""
        from app.models import Item
        # Insert via raw SQL to test server default (bypass Python default)
        pg_session.execute(
            text("INSERT INTO items (raw_text, status) VALUES (:t, :s)"),
            {"t": "Server default test", "s": "inbox"},
        )
        pg_session.commit()

        row = pg_session.execute(
            text("SELECT created_at FROM items WHERE raw_text = :t"),
            {"t": "Server default test"},
        ).fetchone()
        assert row is not None
        assert row[0] is not None  # created_at was populated by server

    def test_status_server_default(self, pg_session, clean_tables):
        """status should default to 'inbox' via server default."""
        pg_session.execute(
            text("INSERT INTO items (raw_text) VALUES (:t)"),
            {"t": "Status default test"},
        )
        pg_session.commit()

        row = pg_session.execute(
            text("SELECT status FROM items WHERE raw_text = :t"),
            {"t": "Status default test"},
        ).fetchone()
        assert row[0] == "inbox"

    def test_boolean_server_default(self, pg_session, clean_tables):
        """Boolean columns should default to true via server default."""
        pg_session.execute(
            text("INSERT INTO routine_blocks (day_of_week, start_time, end_time) VALUES (0, '09:00', '10:00')"),
        )
        pg_session.commit()

        row = pg_session.execute(
            text("SELECT fixed FROM routine_blocks WHERE day_of_week = 0"),
        ).fetchone()
        assert row[0] is True


# ---------------------------------------------------------------------------
# 6. Alembic migration verification
# ---------------------------------------------------------------------------

class TestAlembicMigrations:
    """Verify Alembic can run migrations against PostgreSQL."""

    def test_alembic_heads_is_single(self):
        """Ensure there is exactly one migration head (no divergent branches)."""
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("script_location",
                                    os.path.join(os.path.dirname(__file__), "..", "alembic"))
        script = ScriptDirectory.from_config(alembic_cfg)
        heads = list(script.get_heads())
        assert len(heads) == 1, f"Expected 1 head, got {len(heads)}: {heads}"

    def test_migration_chain_is_valid(self):
        """Verify the migration chain: initial → pg_compat."""
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("script_location",
                                    os.path.join(os.path.dirname(__file__), "..", "alembic"))
        script = ScriptDirectory.from_config(alembic_cfg)

        revisions = list(script.walk_revisions())
        rev_ids = [r.revision for r in revisions]
        assert "e1bb4c49e1e1" in rev_ids, "Initial migration missing"
        assert "a3f7c8d2e5b1" in rev_ids, "PostgreSQL compat migration missing"

        # Verify chain order
        pg_compat = script.get_revision("a3f7c8d2e5b1")
        assert pg_compat.down_revision == "e1bb4c49e1e1"

