import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.session import SessionResponse
from app.schemas.user import UserResponse


def test_register_request_email_normalization() -> None:
    req = RegisterRequest(
        email="   Student.Name@EXAMPLE.COM   ",
        password="ValidPassword123!",
        full_name="Jane Doe",
    )
    assert req.email == "student.name@example.com"
    assert req.full_name == "Jane Doe"


def test_register_request_password_whitespace_preserved() -> None:
    req = RegisterRequest(
        email="user@test.com",
        password="  leading and trailing spaces  ",
        full_name="Space User",
    )
    # Password must NOT be trimmed
    assert req.password == "  leading and trailing spaces  "


def test_register_request_rejects_extra_fields_and_role_escalation() -> None:
    # Attempting to supply role='super_admin' or 'admin' must be rejected by extra="forbid"
    with pytest.raises(ValidationError) as exc_info:
        RegisterRequest(
            email="hacker@test.com",
            password="Password123!",
            full_name="Hacker",
            role="super_admin",  # type: ignore[call-arg]
        )
    assert "extra_forbidden" in str(exc_info.value)


def test_register_request_password_length_bounds() -> None:
    # Too short (< 8 chars)
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="short@test.com",
            password="short",
            full_name="Short User",
        )

    # Too long (> 128 chars)
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="long@test.com",
            password="a" * 129,
            full_name="Long User",
        )


def test_login_request_email_normalization() -> None:
    req = LoginRequest(
        email="  USER@DOMAIN.ORG  ",
        password="MySecretPassword123!",
        device_name="Pixel 9",
        device_os="Android 15",
    )
    assert req.email == "user@domain.org"
    assert req.device_name == "Pixel 9"
    assert req.device_os == "Android 15"


def test_login_request_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError) as exc_info:
        LoginRequest(
            email="user@test.com",
            password="Password123!",
            unexpected_field="injection_attempt",  # type: ignore[call-arg]
        )
    assert "extra_forbidden" in str(exc_info.value)


def test_refresh_token_request_validation() -> None:
    req = RefreshTokenRequest(refresh_token="valid_token_string")
    assert req.refresh_token == "valid_token_string"

    with pytest.raises(ValidationError):
        RefreshTokenRequest(refresh_token="")


def test_token_response_defaults() -> None:
    tokens = TokenResponse(
        access_token="jwt_acc",
        refresh_token="ref_tok",
    )
    assert tokens.token_type == "bearer"
    assert tokens.expires_in == 900


def test_logout_request_validation() -> None:
    # Valid non-empty token
    req = LogoutRequest(refresh_token="valid_session_token_123")
    assert req.refresh_token == "valid_session_token_123"

    # Missing refresh_token must be rejected
    with pytest.raises(ValidationError):
        LogoutRequest()  # type: ignore[call-arg]

    # Empty refresh_token must be rejected
    with pytest.raises(ValidationError):
        LogoutRequest(refresh_token="")

    # Extra fields must be rejected
    with pytest.raises(ValidationError) as exc_info:
        LogoutRequest(
            refresh_token="valid_token",
            extra_field="malicious",  # type: ignore[call-arg]
        )
    assert "extra_forbidden" in str(exc_info.value)


def test_user_response_safe_serialization() -> None:
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    class FakeUser:
        id = user_id
        email = "student@test.com"
        hashed_password = "argon2id$hashedpasswordthatmustneverappear"
        full_name = "Student Person"
        avatar_url = None
        role = "student"
        status = "active"
        institution = "MIT"
        major = "CS"
        graduation_year = 2027
        daily_study_goal_minutes = 120
        theme_preference = "system"
        push_notifications_enabled = True
        quiet_hours_start = None
        quiet_hours_end = None
        token_version = 1
        created_at = now
        updated_at = now
        last_login_at = None

    response = UserResponse.model_validate(FakeUser())
    dump = response.model_dump()

    # Must contain safe public fields
    assert dump["id"] == user_id
    assert dump["email"] == "student@test.com"
    assert dump["full_name"] == "Student Person"
    assert dump["role"] == "student"
    assert dump["status"] == "active"
    assert dump["daily_study_goal_minutes"] == 120

    # Must NOT expose sensitive fields
    assert "hashed_password" not in dump
    assert "token_version" not in dump


def test_session_response_safe_serialization() -> None:
    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    class FakeSession:
        id = session_id
        user_id = uuid.uuid4()
        refresh_token_hash = "64charshashthatmustnotexposeplaintexttokens"
        device_name = "Samsung Galaxy"
        device_os = "Android 14"
        ip_address = "192.168.1.10"
        is_revoked = False
        created_at = now
        expires_at = now
        rotated_at = None

    response = SessionResponse.model_validate(FakeSession())
    dump = response.model_dump()

    assert dump["id"] == session_id
    assert dump["device_name"] == "Samsung Galaxy"
    assert dump["is_revoked"] is False

    # Must NOT expose refresh_token_hash or user_id in session DTO
    assert "refresh_token_hash" not in dump
    assert "user_id" not in dump
