import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_auth_service
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.models.verification_token import TokenType, VerificationToken
from app.schemas.auth import (
    GoogleAuthRequest,
    TokenResponse,
)
from app.services.auth_service import (
    AuthService,
    InvalidVerificationTokenError,
    ResendRateLimitError,
)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = lambda x: None
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_email_verification_success(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="student@univ.edu",
        hashed_password="hash",
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.PENDING_VERIFICATION,
        token_version=1,
    )

    valid_token_record = VerificationToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=service._hash_token("test_secret_token_12345"),
        token_type=TokenType.EMAIL_VERIFICATION.value,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
        used_at=None,
    )

    service.token_repo.get_valid_token = AsyncMock(return_value=valid_token_record)  # type: ignore[method-assign]
    service.user_repo.get_by_id = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.token_repo.mark_as_used = AsyncMock()  # type: ignore[method-assign]

    verified_user = await service.verify_email("test_secret_token_12345")

    assert verified_user.status == UserStatus.ACTIVE
    service.token_repo.mark_as_used.assert_awaited_once_with(valid_token_record.id)
    mock_session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_email_verification_invalid_token_fails(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    service.token_repo.get_valid_token = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(InvalidVerificationTokenError):
        await service.verify_email("invalid_or_expired_token")


@pytest.mark.asyncio
async def test_resend_verification_cooldown_enforced(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="pending@univ.edu",
        hashed_password="hash",
        full_name="Pending",
        role=UserRole.STUDENT,
        status=UserStatus.PENDING_VERIFICATION,
        token_version=1,
    )

    recent_token = VerificationToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash="hash",
        token_type=TokenType.EMAIL_VERIFICATION.value,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
        created_at=datetime.now(UTC) - timedelta(seconds=20),  # 20s ago < 60s cooldown
    )

    service.user_repo.get_by_email = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.token_repo.get_latest_for_user = AsyncMock(return_value=recent_token)  # type: ignore[method-assign]

    with pytest.raises(ResendRateLimitError):
        await service.resend_verification("pending@univ.edu")


@pytest.mark.asyncio
async def test_google_auth_new_user_provisioning(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    service.user_repo.get_by_email = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.user_repo.create = AsyncMock(side_effect=lambda u: u)  # type: ignore[method-assign]
    service.user_repo.update_last_login = AsyncMock()  # type: ignore[method-assign]
    service.session_repo.create_session = AsyncMock()  # type: ignore[method-assign]

    payload = GoogleAuthRequest(
        id_token="test_google_token_new_student",
        device_name="Pixel 9 Pro",
        device_os="Android 15",
    )

    tokens, user = await service.google_authenticate(payload, ip_address="192.168.1.10")

    assert user.email == "new_student@example.com"
    assert user.role == UserRole.STUDENT
    assert user.status == UserStatus.ACTIVE
    assert tokens.access_token is not None
    assert tokens.refresh_token is not None
    service.user_repo.create.assert_awaited_once()
    service.session_repo.create_session.assert_awaited_once()


@pytest.mark.asyncio
async def test_google_auth_existing_user(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    existing_user = User(
        id=uuid.uuid4(),
        email="existing@example.com",
        hashed_password="hash",
        full_name="Existing Student",
        role=UserRole.STUDENT,
        status=UserStatus.PENDING_VERIFICATION,  # Google sign-in should automatically activate
        token_version=1,
    )

    service.user_repo.get_by_email = AsyncMock(return_value=existing_user)  # type: ignore[method-assign]
    service.user_repo.create = AsyncMock()  # type: ignore[method-assign]
    service.user_repo.update_last_login = AsyncMock()  # type: ignore[method-assign]
    service.session_repo.create_session = AsyncMock()  # type: ignore[method-assign]

    payload = GoogleAuthRequest(
        id_token="test_google_token_existing",
        device_name="Pixel 9 Pro",
    )

    tokens, user = await service.google_authenticate(payload)

    assert user.status == UserStatus.ACTIVE
    assert tokens.access_token is not None
    service.user_repo.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_password_reset_flow(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="reset@univ.edu",
        hashed_password="old_argon2_hash",
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )

    valid_token_record = VerificationToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=service._hash_token("reset_secret_token_abc"),
        token_type=TokenType.PASSWORD_RESET.value,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
        used_at=None,
    )

    service.token_repo.get_valid_token = AsyncMock(return_value=valid_token_record)  # type: ignore[method-assign]
    service.user_repo.get_by_id = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.session_repo.revoke_all_user_sessions = AsyncMock()  # type: ignore[method-assign]
    service.token_repo.mark_as_used = AsyncMock()  # type: ignore[method-assign]

    await service.reset_password("reset_secret_token_abc", "NewSecurePassword456!")

    assert user.token_version == 2
    service.session_repo.revoke_all_user_sessions.assert_awaited_once_with(user_id)
    service.token_repo.mark_as_used.assert_awaited_once_with(valid_token_record.id)


@pytest.mark.asyncio
async def test_api_verify_email_endpoint() -> None:
    mock_auth = AsyncMock()
    verified_user = User(
        id=uuid.uuid4(),
        email="verified@univ.edu",
        hashed_password="hash",
        full_name="Verified Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    mock_auth.verify_email.return_value = verified_user

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # JSON API
        resp = await client.post(
            "/api/v1/auth/verify-email", json={"token": "valid_token_12345"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["verified"] is True
        assert data["email"] == "verified@univ.edu"

        # Web fallback HTML
        html_resp = await client.get("/api/v1/auth/verify-email?token=valid_token_12345")
        assert html_resp.status_code == 200
        assert "Email Verified!" in html_resp.text
        assert "studymate://verify-email" in html_resp.text

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_google_auth_endpoint() -> None:
    mock_auth = AsyncMock()
    tokens = TokenResponse(
        access_token="google_access_jwt",
        refresh_token="google_refresh_jwt",
        token_type="bearer",
        expires_in=900,
    )
    user = User(
        id=uuid.uuid4(),
        email="google@univ.edu",
        hashed_password="hash",
        full_name="Google Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    mock_auth.google_authenticate.return_value = (tokens, user)

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/auth/google", json={"id_token": "test_google_token_sample"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] == "google_access_jwt"
        assert data["refresh_token"] == "google_refresh_jwt"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_forgot_password_otp_endpoints() -> None:
    mock_auth = AsyncMock()
    mock_auth.request_password_reset_otp.return_value = (
        "student@univ.edu",
        "A 6-digit verification code has been sent to your email.",
    )
    mock_auth.reset_password_with_otp = AsyncMock()

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Request OTP
        req_resp = await client.post(
            "/api/v1/auth/forgot-password-otp",
            json={"email": "student@univ.edu"},
        )
        assert req_resp.status_code == 200
        req_data = req_resp.json()
        assert req_data["success"] is True
        assert req_data["email"] == "student@univ.edu"
        assert "dev_otp" not in req_data

        # 2. Reset with OTP
        reset_resp = await client.post(
            "/api/v1/auth/reset-password-otp",
            json={
                "email": "student@univ.edu",
                "otp": "123456",
                "new_password": "NewSecurePassword123!",
            },
        )
        assert reset_resp.status_code == 200
        reset_data = reset_resp.json()
        assert "successfully" in reset_data["message"].lower()

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_update_user_preferences(mock_session: AsyncMock) -> None:
    from datetime import time

    from app.schemas.user import UserPreferencesUpdate

    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="student@univ.edu",
        hashed_password="hash",
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        push_notifications_enabled=True,
        daily_study_goal_minutes=60,
    )
    service.user_repo.get_by_id = AsyncMock(return_value=user)

    payload = UserPreferencesUpdate(
        push_notifications_enabled=False,
        quiet_hours_start=time(22, 0),
        quiet_hours_end=time(7, 0),
        daily_study_goal_minutes=90,
    )
    updated = await service.update_preferences(user_id, payload)
    assert updated.push_notifications_enabled is False
    assert updated.quiet_hours_start == time(22, 0)
    assert updated.quiet_hours_end == time(7, 0)
    assert updated.daily_study_goal_minutes == 90
    mock_session.commit.assert_awaited_once()
