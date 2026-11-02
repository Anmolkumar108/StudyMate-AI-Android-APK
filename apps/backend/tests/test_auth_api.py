import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_auth_service, get_current_active_user, get_current_user
from app.main import app
from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import TokenResponse
from app.services.auth_service import (
    AccountPendingVerificationError,
    AccountSuspendedError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    SessionNotFoundError,
)


@pytest.fixture
def mock_auth_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="student@test.com",
        hashed_password="argon2id$hashed",
        full_name="Active Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        daily_study_goal_minutes=120,
        theme_preference="system",
        push_notifications_enabled=True,
        token_version=1,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
async def api_client(
    mock_auth_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_register_success(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    mock_auth_service.register.return_value = test_user

    payload = {
        "email": "student@test.com",
        "password": "SecurePassword123!",
        "full_name": "Active Student",
    }
    response = await api_client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "student@test.com"
    assert data["role"] == "student"
    assert data["status"] == "active"
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_api_register_duplicate_email(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    mock_auth_service.register.side_effect = EmailAlreadyRegisteredError(
        "An account with this email already exists."
    )

    payload = {
        "email": "duplicate@test.com",
        "password": "SecurePassword123!",
        "full_name": "Duplicate Student",
    }
    response = await api_client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_api_register_role_escalation_rejected(
    api_client: AsyncClient,
) -> None:
    payload = {
        "email": "hacker@test.com",
        "password": "SecurePassword123!",
        "full_name": "Hacker",
        "role": "super_admin",
    }
    response = await api_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_api_register_password_policy_rejected(
    api_client: AsyncClient,
) -> None:
    payload = {
        "email": "student@test.com",
        "password": "short",
        "full_name": "Student",
    }
    response = await api_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_api_login_success(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    tokens = TokenResponse(
        access_token="acc_token_123",
        refresh_token="ref_token_123",
        token_type="bearer",
        expires_in=900,
    )
    mock_auth_service.login.return_value = (tokens, test_user)

    payload = {
        "email": "student@test.com",
        "password": "SecurePassword123!",
        "device_name": "Pixel 9",
        "device_os": "Android 15",
    }
    response = await api_client.post("/api/v1/auth/login", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "acc_token_123"
    assert data["refresh_token"] == "ref_token_123"
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 900


@pytest.mark.asyncio
async def test_api_login_invalid_credentials(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    mock_auth_service.login.side_effect = InvalidCredentialsError(
        "Invalid email or password."
    )

    payload = {
        "email": "wrong@test.com",
        "password": "WrongPassword123!",
    }
    response = await api_client.post("/api/v1/auth/login", json=payload)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


@pytest.mark.asyncio
async def test_api_login_suspended_account(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    mock_auth_service.login.side_effect = AccountSuspendedError(
        "Account is suspended. Please contact support."
    )

    payload = {
        "email": "suspended@test.com",
        "password": "Password123!",
    }
    response = await api_client.post("/api/v1/auth/login", json=payload)

    assert response.status_code == 403
    assert "suspended" in response.json()["detail"]


@pytest.mark.asyncio
async def test_api_refresh_success(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    tokens = TokenResponse(
        access_token="new_acc_123",
        refresh_token="new_ref_123",
        token_type="bearer",
        expires_in=900,
    )
    mock_auth_service.refresh_tokens.return_value = tokens

    payload = {"refresh_token": "valid_refresh_token"}
    response = await api_client.post("/api/v1/auth/refresh", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new_acc_123"
    assert data["refresh_token"] == "new_ref_123"


@pytest.mark.asyncio
async def test_api_refresh_invalid_or_expired(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    mock_auth_service.refresh_tokens.side_effect = InvalidRefreshTokenError(
        "Invalid, expired, or revoked refresh token."
    )

    payload = {"refresh_token": "invalid_refresh_token"}
    response = await api_client.post("/api/v1/auth/refresh", json=payload)

    assert response.status_code == 401
    assert "Invalid, expired, or revoked" in response.json()["detail"]


@pytest.mark.asyncio
async def test_api_refresh_pending_verification_rejected(
    api_client: AsyncClient, mock_auth_service: AsyncMock
) -> None:
    mock_auth_service.refresh_tokens.side_effect = AccountPendingVerificationError(
        "Account verification is pending. Please verify your email."
    )

    payload = {"refresh_token": "some_token"}
    response = await api_client.post("/api/v1/auth/refresh", json=payload)

    assert response.status_code == 403
    assert "verification is pending" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_api_me_without_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_api_me_with_authenticated_user(
    api_client: AsyncClient, test_user: User
) -> None:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    response = await api_client.get("/api/v1/auth/me")

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "student@test.com"
    assert data["role"] == "student"
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_api_logout_current_session(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    app.dependency_overrides[get_current_user] = lambda: test_user
    mock_auth_service.logout.return_value = None

    payload = {"refresh_token": "my_session_token"}
    response = await api_client.post("/api/v1/auth/logout", json=payload)

    assert response.status_code == 200
    assert "Successfully logged out" in response.json()["message"]
    mock_auth_service.logout.assert_awaited_once_with(test_user.id, "my_session_token")


@pytest.mark.asyncio
async def test_api_logout_missing_refresh_token_rejected(
    api_client: AsyncClient, test_user: User
) -> None:
    app.dependency_overrides[get_current_user] = lambda: test_user
    # Empty JSON body missing required refresh_token field
    response = await api_client.post("/api/v1/auth/logout", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_api_logout_empty_refresh_token_rejected(
    api_client: AsyncClient, test_user: User
) -> None:
    app.dependency_overrides[get_current_user] = lambda: test_user
    # Empty string refresh_token fails min_length=1
    response = await api_client.post("/api/v1/auth/logout", json={"refresh_token": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_api_logout_all_devices(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    app.dependency_overrides[get_current_user] = lambda: test_user
    mock_auth_service.logout_all.return_value = 2

    response = await api_client.post("/api/v1/auth/logout-all")

    assert response.status_code == 200
    assert "logged out from all devices" in response.json()["message"]
    mock_auth_service.logout_all.assert_awaited_once_with(test_user.id)


@pytest.mark.asyncio
async def test_api_list_sessions(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    session_id = uuid.uuid4()
    now = datetime.now(UTC)
    mock_sessions = [
        UserSession(
            id=session_id,
            user_id=test_user.id,
            refresh_token_hash="hash",
            device_name="Pixel 9",
            device_os="Android 15",
            ip_address="127.0.0.1",
            is_revoked=False,
            created_at=now,
            expires_at=now + timedelta(days=30),
        )
    ]
    mock_auth_service.list_sessions.return_value = mock_sessions

    response = await api_client.get("/api/v1/auth/sessions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(session_id)
    assert data[0]["device_name"] == "Pixel 9"


@pytest.mark.asyncio
async def test_api_revoke_session_success(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    mock_auth_service.revoke_session.return_value = None
    target_id = uuid.uuid4()

    response = await api_client.delete(f"/api/v1/auth/sessions/{target_id}")

    assert response.status_code == 200
    assert "successfully revoked" in response.json()["message"]
    mock_auth_service.revoke_session.assert_awaited_once_with(test_user.id, target_id)


@pytest.mark.asyncio
async def test_api_revoke_session_not_found_or_idor(
    api_client: AsyncClient, mock_auth_service: AsyncMock, test_user: User
) -> None:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    mock_auth_service.revoke_session.side_effect = SessionNotFoundError(
        "Session not found."
    )
    target_id = uuid.uuid4()

    response = await api_client.delete(f"/api/v1/auth/sessions/{target_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found."
