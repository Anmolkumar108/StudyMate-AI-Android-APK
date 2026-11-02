"""Unit tests for the PostgreSQL integration test configuration and safety guard.

These tests run completely offline and verify:
- Strict database name validation (only 'studymate_test_db' is permitted)
- Fail-closed rejection of production/development databases ('studymate_db', 'postgres')
- Rejection of malformed or incomplete database URLs
- Credential masking in error messages and logs
- Resolution order for test database configuration
- Integration test enable/disable environment flag
"""

import pytest
from sqlalchemy.engine import make_url

from app.core.config import settings
from tests.db_test_config import (
    PERMITTED_TEST_DB_NAME,
    RUN_INTEGRATION_ENV_VAR,
    DatabaseSafetyGuardError,
    get_masked_database_url,
    is_integration_test_enabled,
    resolve_test_database_url,
    validate_test_database_url,
)


class TestDatabaseSafetyGuard:
    """Test suite for validate_test_database_url safety guard."""

    def test_accepts_valid_test_db_url(self) -> None:
        valid_url = (
            "postgresql+asyncpg://studymate_app:secret@localhost:5432/studymate_test_db"
        )
        result = validate_test_database_url(valid_url)
        assert result == valid_url

    def test_accepts_valid_test_db_url_with_query_params(self) -> None:
        valid_url = "postgresql+asyncpg://studymate_app:secret@localhost:5432/studymate_test_db?ssl=disable"
        result = validate_test_database_url(valid_url)
        assert result == valid_url

    def test_rejects_studymate_db_dev_database(self) -> None:
        unsafe_url = (
            "postgresql+asyncpg://studymate_app:secret@localhost:5432/studymate_db"
        )
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url(unsafe_url)
        assert "not permitted for integration testing" in str(exc_info.value)
        assert PERMITTED_TEST_DB_NAME in str(exc_info.value)

    def test_rejects_postgres_system_database(self) -> None:
        unsafe_url = "postgresql+asyncpg://postgres:secret@localhost:5432/postgres"
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url(unsafe_url)
        assert "not permitted for integration testing" in str(exc_info.value)

    def test_rejects_partial_or_similar_database_name(self) -> None:
        unsafe_names = [
            "studymate_test",
            "studymate_test_db_backup",
            "test_db",
            "studymate",
            "production_db",
        ]
        for name in unsafe_names:
            url = f"postgresql+asyncpg://studymate_app:secret@localhost:5432/{name}"
            with pytest.raises(DatabaseSafetyGuardError) as exc_info:
                validate_test_database_url(url)
            assert f"'{name}' is not permitted" in str(exc_info.value)

    def test_rejects_empty_string(self) -> None:
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url("")
        assert "Database URL is empty" in str(exc_info.value)

    def test_rejects_whitespace_string(self) -> None:
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url("   \t\n  ")
        assert "Database URL is empty" in str(exc_info.value)

    def test_rejects_url_without_database_name(self) -> None:
        urls_without_db = [
            "postgresql+asyncpg://studymate_app:secret@localhost:5432/",
            "postgresql+asyncpg://studymate_app:secret@localhost:5432",
        ]
        for url in urls_without_db:
            with pytest.raises(DatabaseSafetyGuardError) as exc_info:
                validate_test_database_url(url)
            assert "does not specify a target database name" in str(exc_info.value)

    def test_rejects_malformed_url(self) -> None:
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url("not a valid url :///")
        assert "Failed to parse database URL" in str(exc_info.value)

    def test_masks_password_in_safety_guard_error_message(self) -> None:
        sensitive_password = "SuperSecretPlainTextPassword999!"
        unsafe_url = f"postgresql+asyncpg://studymate_app:{sensitive_password}@localhost:5432/studymate_db"
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            validate_test_database_url(unsafe_url)

        error_message = str(exc_info.value)
        # Assert the plain password is NEVER in the error message
        assert sensitive_password not in error_message
        # Assert the password was replaced with '***'
        assert "***" in error_message
        assert "studymate_db" in error_message


class TestDatabaseUrlMasking:
    """Test suite for get_masked_database_url."""

    def test_masks_credentials_properly(self) -> None:
        url = "postgresql+asyncpg://myuser:super_secret_password_123@myhost:5432/studymate_test_db"
        masked = get_masked_database_url(url)
        assert "super_secret_password_123" not in masked
        assert "***" in masked
        assert "myuser" in masked
        assert "myhost:5432" in masked
        assert "studymate_test_db" in masked

    def test_masked_handles_invalid_url_safely(self) -> None:
        masked = get_masked_database_url("invalid url ::::")
        assert masked == "[INVALID_OR_UNPARSABLE_DATABASE_URL]"


class TestResolveTestDatabaseUrl:
    """Test suite for resolve_test_database_url."""

    def test_resolve_default_targets_studymate_test_db(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
        resolved = resolve_test_database_url()
        parsed = make_url(resolved)
        assert parsed.database == PERMITTED_TEST_DB_NAME
        assert parsed.username == settings.POSTGRES_USER
        assert parsed.port == settings.POSTGRES_PORT
        assert parsed.host == settings.POSTGRES_SERVER

    def test_resolve_prefers_valid_env_var(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        custom_url = "postgresql+asyncpg://custom_user:custom_pass@127.0.0.1:5433/studymate_test_db"
        monkeypatch.setenv("TEST_DATABASE_URL", custom_url)
        resolved = resolve_test_database_url()
        assert resolved == custom_url

    def test_resolve_rejects_unsafe_env_var(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        unsafe_url = (
            "postgresql+asyncpg://custom_user:custom_pass@127.0.0.1:5433/studymate_db"
        )
        monkeypatch.setenv("TEST_DATABASE_URL", unsafe_url)
        with pytest.raises(DatabaseSafetyGuardError) as exc_info:
            resolve_test_database_url()
        assert "not permitted for integration testing" in str(exc_info.value)


class TestIntegrationTestFlag:
    """Test suite for is_integration_test_enabled flag."""

    def test_disabled_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv(RUN_INTEGRATION_ENV_VAR, raising=False)
        assert is_integration_test_enabled() is False

    @pytest.mark.parametrize("value", ["1", "true", "True", "TRUE", "yes", "YES"])
    def test_enabled_values(self, monkeypatch: pytest.MonkeyPatch, value: str) -> None:
        monkeypatch.setenv(RUN_INTEGRATION_ENV_VAR, value)
        assert is_integration_test_enabled() is True

    @pytest.mark.parametrize("value", ["0", "false", "no", "anything_else", ""])
    def test_disabled_values(self, monkeypatch: pytest.MonkeyPatch, value: str) -> None:
        monkeypatch.setenv(RUN_INTEGRATION_ENV_VAR, value)
        assert is_integration_test_enabled() is False
