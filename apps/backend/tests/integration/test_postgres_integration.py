"""PostgreSQL database integration tests.

Tests real PostgreSQL behaviors against 'studymate_test_db':
1. Alembic schema validation (tables, enums, indexes, constraints)
2. Real user & session persistence with PostgreSQL column defaults
3. Case-insensitive email uniqueness enforcement (uq_users_email_lower)
4. PostgreSQL native UUID generation (gen_random_uuid)
5. Foreign-key cascade deletion on user_sessions
6. Concurrent refresh-token rotation with SELECT ... FOR UPDATE row locking
7. Transaction rollback and test-data isolation
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.core.security import hash_password, hash_refresh_token
from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import TokenResponse
from app.services.auth_service import AuthService, InvalidRefreshTokenError

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_alembic_schema_applied(
    test_engine: AsyncEngine, test_db_url: str
) -> None:
    """Verify that Alembic migrations applied the complete schema to studymate_test_db."""

    def inspect_schema(sync_conn):  # type: ignore[no-untyped-def]
        inspector = inspect(sync_conn)
        tables = inspector.get_table_names()
        columns_users = {c["name"]: c for c in inspector.get_columns("users")}
        columns_sessions = {
            c["name"]: c for c in inspector.get_columns("user_sessions")
        }
        indexes_users = {idx["name"]: idx for idx in inspector.get_indexes("users")}
        indexes_sessions = {
            idx["name"]: idx for idx in inspector.get_indexes("user_sessions")
        }
        return tables, columns_users, columns_sessions, indexes_users, indexes_sessions

    async with test_engine.connect() as conn:
        (
            tables,
            col_users,
            col_sessions,
            idx_users,
            idx_sessions,
        ) = await conn.run_sync(inspect_schema)

    # Tables exist
    assert "users" in tables
    assert "user_sessions" in tables
    assert "alembic_version" in tables

    # Key columns in users
    assert "id" in col_users
    assert "email" in col_users
    assert "hashed_password" in col_users
    assert "role" in col_users
    assert "status" in col_users
    assert "token_version" in col_users
    assert "daily_study_goal_minutes" in col_users

    # Key columns in user_sessions
    assert "id" in col_sessions
    assert "user_id" in col_sessions
    assert "refresh_token_hash" in col_sessions
    assert "is_revoked" in col_sessions
    assert "expires_at" in col_sessions

    # Critical indexes
    assert "uq_users_email_lower" in idx_users
    assert "idx_users_email" in idx_users
    assert "idx_users_status_role" in idx_users
    assert "idx_user_sessions_lookup" in idx_sessions


@pytest.mark.asyncio
async def test_user_and_session_persistence(test_db_session: AsyncSession) -> None:
    """Verify creating users and sessions using the actual PostgreSQL schema and types."""
    user = User(
        email="integration_student@studymate.ai",
        hashed_password=hash_password("ValidPass123!"),
        full_name="Postgres Integration Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    test_db_session.add(user)
    await test_db_session.flush()

    assert user.id is not None
    assert user.token_version == 1
    assert user.daily_study_goal_minutes == 120
    assert user.theme_preference == "system"
    assert user.push_notifications_enabled is True

    # Persist session
    now = datetime.now(UTC)
    raw_token = "integration_refresh_token_value_abc_123"
    token_hash = hash_refresh_token(raw_token)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        device_name="Pixel 9 Pro",
        device_os="Android 15",
        ip_address="192.168.1.100",
        expires_at=now + timedelta(days=30),
    )
    test_db_session.add(session)
    await test_db_session.flush()

    assert session.id is not None
    assert session.is_revoked is False
    assert session.created_at is not None

    # Query back
    stmt = select(User).where(User.id == user.id)
    res = await test_db_session.execute(stmt)
    persisted_user = res.scalar_one()
    assert persisted_user.email == "integration_student@studymate.ai"
    assert persisted_user.role == UserRole.STUDENT
    assert persisted_user.status == UserStatus.ACTIVE


@pytest.mark.asyncio
async def test_case_insensitive_email_uniqueness(
    test_db_session: AsyncSession,
) -> None:
    """Verify that uq_users_email_lower enforces case-insensitive email uniqueness in PostgreSQL."""
    user1 = User(
        email="UniqueStudent@StudyMate.AI",
        hashed_password=hash_password("Password123!"),
        full_name="Original Case User",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    test_db_session.add(user1)
    await test_db_session.flush()

    # Attempt to insert identical email in different case
    user2 = User(
        email="uniquestudent@studymate.ai",
        hashed_password=hash_password("AnotherPassword123!"),
        full_name="Duplicate Lowercase User",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    test_db_session.add(user2)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db_session.flush()

    error_str = str(exc_info.value).lower()
    assert "uq_users_email_lower" in error_str or "unique constraint" in error_str


@pytest.mark.asyncio
async def test_database_uuid_generation(test_db_session: AsyncSession) -> None:
    """Verify PostgreSQL server_default gen_random_uuid() generates valid RFC 4122 v4 UUIDs."""
    insert_sql = text(
        "INSERT INTO users (email, hashed_password, full_name, role, status) "
        "VALUES (:email, :password, :name, 'student', 'active') "
        "RETURNING id;"
    )
    result = await test_db_session.execute(
        insert_sql,
        {
            "email": "uuid_gen_test@studymate.ai",
            "password": hash_password("ValidPass123!"),
            "name": "UUID Generation Test User",
        },
    )
    generated_id = result.scalar_one()

    assert generated_id is not None
    parsed_uuid = uuid.UUID(str(generated_id))
    assert parsed_uuid.version == 4


@pytest.mark.asyncio
async def test_foreign_key_cascade_deletion(test_db_session: AsyncSession) -> None:
    """Verify that deleting a user cascades and deletes all associated user_sessions in PostgreSQL."""
    user = User(
        email="cascade_test@studymate.ai",
        hashed_password=hash_password("ValidPass123!"),
        full_name="Cascade Test User",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    test_db_session.add(user)
    await test_db_session.flush()

    now = datetime.now(UTC)
    s1 = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token("token_cascade_1"),
        expires_at=now + timedelta(days=30),
    )
    s2 = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token("token_cascade_2"),
        expires_at=now + timedelta(days=30),
    )
    test_db_session.add_all([s1, s2])
    await test_db_session.flush()

    # Confirm sessions exist
    stmt_check = select(UserSession).where(UserSession.user_id == user.id)
    res_before = await test_db_session.execute(stmt_check)
    assert len(res_before.scalars().all()) == 2

    # Delete the user
    await test_db_session.delete(user)
    await test_db_session.flush()

    # Verify sessions were cascade-deleted by PostgreSQL
    res_after = await test_db_session.execute(stmt_check)
    remaining_sessions = res_after.scalars().all()
    assert len(remaining_sessions) == 0


@pytest.mark.asyncio
async def test_concurrent_refresh_token_rotation(
    test_engine: AsyncEngine,
    test_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verify atomic refresh token rotation under concurrent requests with SELECT ... FOR UPDATE row locking.

    When two requests attempt to rotate the same refresh token concurrently across separate DB sessions:
    - One request acquires the row lock first, rotates the session, and commits.
    - The concurrent request waits on the lock, reads the updated is_revoked=True status, and is rejected.
    - Exactly one new session is created, and exactly one request succeeds.
    """
    raw_refresh_token = "concurrent_rotation_test_token_xyz_789"
    token_hash = hash_refresh_token(raw_refresh_token)
    user_id = uuid.uuid4()

    # Seed user and session in initial transaction
    async with test_db_session_factory() as setup_session:
        user = User(
            id=user_id,
            email="concurrent_refresh@studymate.ai",
            hashed_password=hash_password("ValidPass123!"),
            full_name="Concurrent Test User",
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
        )
        setup_session.add(user)
        session = UserSession(
            user_id=user_id,
            refresh_token_hash=token_hash,
            device_name="Test Device",
            expires_at=datetime.now(UTC) + timedelta(days=30),
        )
        setup_session.add(session)
        await setup_session.commit()

    # Define rotation worker using an independent session
    async def worker(worker_id: int) -> TokenResponse | Exception:
        async with test_db_session_factory() as s:
            auth_service = AuthService(s)
            try:
                return await auth_service.refresh_tokens(
                    refresh_token=raw_refresh_token,
                    ip_address=f"10.0.0.{worker_id}",
                )
            except Exception as e:  # noqa: BLE001
                return e

    # Launch two concurrent rotation requests
    res1, res2 = await asyncio.gather(worker(1), worker(2))

    successes = [r for r in [res1, res2] if isinstance(r, TokenResponse)]
    failures = [r for r in [res1, res2] if isinstance(r, InvalidRefreshTokenError)]

    assert len(successes) == 1, f"Expected exactly 1 success, got: {res1}, {res2}"
    assert len(failures) == 1, (
        f"Expected exactly 1 InvalidRefreshTokenError, got: {res1}, {res2}"
    )
    assert "revoked" in str(failures[0]).lower()

    # Cleanup seeded data
    async with test_db_session_factory() as cleanup_session:
        await cleanup_session.execute(
            text("DELETE FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        )
        await cleanup_session.commit()


@pytest.mark.asyncio
async def test_transaction_rollback_and_isolation(
    test_engine: AsyncEngine,
    test_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """Verify transaction rollback and test-data isolation across independent database sessions."""
    isolated_email = "rollback_isolation_test@studymate.ai"

    # Step 1: In session 1, insert user but roll back
    async with test_db_session_factory() as session1:
        user = User(
            email=isolated_email,
            hashed_password=hash_password("ValidPass123!"),
            full_name="Rollback User",
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
        )
        session1.add(user)
        await session1.flush()
        # Verify user exists in uncommitted session 1
        res = await session1.execute(select(User).where(User.email == isolated_email))
        assert res.scalar_one_or_none() is not None

        # Roll back session 1
        await session1.rollback()

    # Step 2: In independent session 2, verify user was not persisted
    async with test_db_session_factory() as session2:
        res2 = await session2.execute(select(User).where(User.email == isolated_email))
        persisted = res2.scalar_one_or_none()
        assert persisted is None, "Rolled-back user should not exist in database"
