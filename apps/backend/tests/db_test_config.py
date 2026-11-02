"""PostgreSQL integration test configuration and safety guard.

Provides:
- Strict database name validation (refusing any database other than 'studymate_test_db')
- Test database URL resolution from environment or application settings
- Async engine and session factory creation for integration testing
- Safe URL masking preventing credential exposure in logs and error messages
- Programmatic Alembic migration runner for isolated test databases
"""

import os
from pathlib import Path
from typing import Final

from sqlalchemy import pool
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# Strict safety constant: integration tests may ONLY target this exact database name
PERMITTED_TEST_DB_NAME: Final[str] = "studymate_test_db"
RUN_INTEGRATION_ENV_VAR: Final[str] = "RUN_POSTGRES_INTEGRATION"
BACKEND_DIR: Final[Path] = Path(__file__).resolve().parent.parent


class DatabaseSafetyGuardError(RuntimeError):
    """Raised when an attempt is made to use an unauthorized database for testing."""


def is_integration_test_enabled() -> bool:
    """Check if PostgreSQL integration tests are explicitly enabled via environment variable.

    Returns True if RUN_POSTGRES_INTEGRATION is set to '1', 'true', or 'yes'.
    Defaults to False to prevent accidental execution against live databases.
    """
    val = os.environ.get(RUN_INTEGRATION_ENV_VAR, "").strip().lower()
    return val in ("1", "true", "yes")


def get_masked_database_url(url_str: str) -> str:
    """Return a database URL with sensitive credentials masked.

    Example:
        postgresql+asyncpg://studymate_app:***@localhost:5432/studymate_test_db
    """
    try:
        parsed = make_url(url_str)
        return parsed.render_as_string(hide_password=True)
    except Exception:  # noqa: BLE001
        return "[INVALID_OR_UNPARSABLE_DATABASE_URL]"


def validate_test_database_url(url_str: str) -> str:
    """Validate that the given database URL targets strictly the dedicated test database.

    Enforces fail-closed safety rules:
    - URL must not be empty or whitespace.
    - URL must be valid and parseable by SQLAlchemy.
    - Target database name must be explicitly specified.
    - Target database name must be EXACTLY 'studymate_test_db'.
    - Never permits 'studymate_db', 'postgres', or any other database.
    - Error messages mask all credentials.

    Returns:
        The validated database URL string.

    Raises:
        DatabaseSafetyGuardError: If any safety rule is violated.
    """
    if not url_str or not url_str.strip():
        raise DatabaseSafetyGuardError(
            "Safety Guard Rejection: Database URL is empty. Refusing to connect."
        )

    try:
        parsed = make_url(url_str.strip())
    except Exception as exc:
        raise DatabaseSafetyGuardError(
            f"Safety Guard Rejection: Failed to parse database URL: {exc}"
        ) from exc

    database_name = parsed.database
    if not database_name or not database_name.strip():
        raise DatabaseSafetyGuardError(
            "Safety Guard Rejection: Database URL does not specify a target database name. "
            "Refusing to connect."
        )

    clean_db_name = database_name.strip()
    if clean_db_name != PERMITTED_TEST_DB_NAME:
        masked_url = parsed.render_as_string(hide_password=True)
        raise DatabaseSafetyGuardError(
            f"Safety Guard Rejection: Target database '{clean_db_name}' is not permitted for integration testing. "
            f"Integration tests are strictly restricted to '{PERMITTED_TEST_DB_NAME}'. "
            f"Target URL: {masked_url}"
        )

    return url_str.strip()


def resolve_test_database_url() -> str:
    """Resolve the test database URL with safety guard enforcement.

    Priority:
    1. TEST_DATABASE_URL environment variable (validated)
    2. Derived from app settings with database name replaced by 'studymate_test_db' (validated)

    Never returns or falls back to 'studymate_db'.

    Returns:
        The validated test database URL string.

    Raises:
        DatabaseSafetyGuardError: If the resolved URL fails safety checks.
    """
    env_test_url = os.environ.get("TEST_DATABASE_URL")
    if env_test_url and env_test_url.strip():
        return validate_test_database_url(env_test_url.strip())

    # Derive from application settings
    if settings.DATABASE_URL:
        try:
            parsed = make_url(settings.DATABASE_URL)
            derived = parsed.set(database=PERMITTED_TEST_DB_NAME)
            url_str = derived.render_as_string(hide_password=False)
        except Exception as exc:
            raise DatabaseSafetyGuardError(
                f"Safety Guard Rejection: Failed to derive test database URL from settings.DATABASE_URL: {exc}"
            ) from exc
    else:
        # Construct from individual settings parameters
        url_str = (
            f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
            f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{PERMITTED_TEST_DB_NAME}"
        )

    return validate_test_database_url(url_str)


def get_test_async_engine(database_url: str | None = None) -> AsyncEngine:
    """Create a new AsyncEngine connected strictly to the validated test database.

    Uses poolclass=NullPool to prevent connection pooling retention during testing.
    """
    target_url = database_url or resolve_test_database_url()
    validated_url = validate_test_database_url(target_url)

    return create_async_engine(
        validated_url,
        echo=False,
        future=True,
        poolclass=pool.NullPool,
    )


def get_test_session_factory(
    engine: AsyncEngine,
) -> async_sessionmaker[AsyncSession]:
    """Create an async sessionmaker bound to the test engine."""
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


def apply_test_migrations(database_url: str) -> None:
    """Apply Alembic migrations to the target test database using alembic.command.upgrade.

    Guarded: strictly validates that database_url targets 'studymate_test_db'.
    """
    from alembic.config import Config

    from alembic import command

    validated_url = validate_test_database_url(database_url)
    ini_path = BACKEND_DIR / "alembic.ini"
    if not ini_path.is_file():
        raise FileNotFoundError(f"alembic.ini not found at {ini_path}")

    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    alembic_cfg.set_main_option("path_separator", "os")
    alembic_cfg.set_main_option("version_path_separator", "os")
    alembic_cfg.set_main_option("sqlalchemy.url", validated_url.replace("%", "%%"))

    command.upgrade(alembic_cfg, "head")
