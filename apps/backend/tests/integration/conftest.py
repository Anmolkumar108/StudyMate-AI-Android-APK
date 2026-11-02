"""Fixtures for PostgreSQL integration tests.

These fixtures strictly connect to the validated 'studymate_test_db' database.
Each test gets an isolated AsyncSession bound to a transaction that automatically
rolls back on test completion, ensuring complete test-data isolation.
"""

from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)

from app.repositories.session_repo import SessionRepository
from app.repositories.user_repo import UserRepository
from app.services.auth_service import AuthService
from tests.db_test_config import (
    get_test_async_engine,
    get_test_session_factory,
    resolve_test_database_url,
)


@pytest.fixture
def test_db_url() -> str:
    """Resolve and validate the test database URL (enforcing studymate_test_db guard)."""
    return resolve_test_database_url()


@pytest.fixture
async def test_engine(test_db_url: str) -> AsyncGenerator[AsyncEngine, None]:
    """Create an AsyncEngine for the test function."""
    engine = get_test_async_engine(test_db_url)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
def test_db_session_factory(
    test_engine: AsyncEngine,
) -> async_sessionmaker[AsyncSession]:
    """Provide a session factory bound to the test engine."""
    return get_test_session_factory(test_engine)


@pytest.fixture
async def test_db_session(
    test_engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated database session for a single test.

    Wraps the test inside a database connection and transaction.
    Automatically rolls back the transaction upon test completion to guarantee
    zero persistent state mutation between tests.
    """
    async with (
        test_engine.connect() as connection,
        connection.begin() as transaction,
    ):
        session_factory = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        async with session_factory() as session:
            yield session
            await transaction.rollback()


@pytest.fixture
def test_user_repo(test_db_session: AsyncSession) -> UserRepository:
    """Provide a UserRepository bound to the test session."""
    return UserRepository(test_db_session)


@pytest.fixture
def test_session_repo(test_db_session: AsyncSession) -> SessionRepository:
    """Provide a SessionRepository bound to the test session."""
    return SessionRepository(test_db_session)


@pytest.fixture
def test_auth_service(
    test_db_session: AsyncSession,
) -> AuthService:
    """Provide an AuthService bound to the real database test session."""
    return AuthService(session=test_db_session)
