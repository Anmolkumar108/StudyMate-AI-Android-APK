import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_admin_service,
    get_auth_service,
    get_current_admin_user,
    get_db,
    require_support_admin,
)
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    BruteForceThreat,
    LiveTelemetryEvent,
    LiveTelemetryFeedResponse,
    UserSessionDetail,
)


@pytest.fixture
def admin_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="admin@studymate.ai",
        hashed_password=hash_password("AdminPass123!"),
        full_name="Admin Radar",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )


@pytest.fixture
def mock_admin_service() -> MagicMock:
    service = MagicMock()
    service.audit_log_repo = MagicMock()
    service.audit_log_repo.log = AsyncMock()
    return service


@pytest.fixture
def mock_auth_service() -> MagicMock:
    service = MagicMock()
    service.user_repo = MagicMock()
    service.user_repo.get_by_id = AsyncMock()
    service.forgot_password = AsyncMock()
    return service


@pytest.fixture
def mock_db() -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_device_ping_endpoint(mock_db: AsyncMock) -> None:
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/telemetry/device-ping",
                json={
                    "device_name": "Xiaomi Redmi Note 12",
                    "device_os": "Android 14",
                    "app_version": "1.0.0",
                    "is_first_launch": True,
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "recorded"
            assert data["action"] == "telemetry.first_launch"
            assert "timestamp" in data
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_live_telemetry_feed(
    admin_user: User, mock_admin_service: MagicMock
) -> None:
    mock_feed = LiveTelemetryFeedResponse(
        events=[
            LiveTelemetryEvent(
                id=uuid.uuid4(),
                timestamp=datetime.now(UTC),
                event_type="login_success",
                action="auth.student_login_success",
                actor_name="Anmol Singh",
                actor_email="student@studymate.ai",
                device_name="Xiaomi Redmi Note 12",
                device_os="Android 14",
                ip_address="192.168.1.5",
                details="Login successful",
                severity="info",
            ),
            LiveTelemetryEvent(
                id=uuid.uuid4(),
                timestamp=datetime.now(UTC),
                event_type="login_failed",
                action="auth.student_login_failed",
                actor_name=None,
                actor_email="target@studymate.ai",
                device_name="Samsung Galaxy S23",
                device_os="Android 14",
                ip_address="182.72.10.4",
                details="Failed login attempt",
                severity="critical",
            ),
        ],
        total_events=2,
        active_devices_24h=14,
        failed_logins_24h=3,
        new_signups_24h=5,
        brute_force_threats=[
            BruteForceThreat(
                ip_address="182.72.10.4",
                target_email="target@studymate.ai",
                failed_attempts=4,
                first_attempt_at=datetime.now(UTC) - timedelta(hours=2),
                last_attempt_at=datetime.now(UTC),
            )
        ],
    )
    mock_admin_service.get_telemetry_live_feed = AsyncMock(return_value=mock_feed)

    app.dependency_overrides[get_current_admin_user] = lambda: admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/admin/telemetry/live-feed")
            assert res.status_code == 200
            data = res.json()
            assert data["total_events"] == 2
            assert data["active_devices_24h"] == 14
            assert data["failed_logins_24h"] == 3
            assert data["new_signups_24h"] == 5
            assert len(data["brute_force_threats"]) == 1
            assert data["brute_force_threats"][0]["failed_attempts"] == 4
            assert data["events"][0]["device_name"] == "Xiaomi Redmi Note 12"
    finally:
        app.dependency_overrides.pop(get_current_admin_user, None)
        app.dependency_overrides.pop(get_admin_service, None)


@pytest.mark.asyncio
async def test_get_user_sessions(
    admin_user: User, mock_admin_service: MagicMock
) -> None:
    target_user_id = uuid.uuid4()
    mock_sessions = [
        UserSessionDetail(
            id=uuid.uuid4(),
            user_id=target_user_id,
            device_name="Xiaomi Redmi Note 12",
            device_os="Android 14",
            ip_address="127.0.0.1",
            created_at=datetime.now(UTC),
            expires_at=datetime.now(UTC) + timedelta(days=30),
            is_revoked=False,
        )
    ]
    mock_admin_service.get_user_sessions = AsyncMock(return_value=mock_sessions)

    app.dependency_overrides[get_current_admin_user] = lambda: admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get(f"/api/v1/admin/users/{target_user_id}/sessions")
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 1
            assert data[0]["device_name"] == "Xiaomi Redmi Note 12"
            assert data[0]["is_revoked"] is False
    finally:
        app.dependency_overrides.pop(get_current_admin_user, None)
        app.dependency_overrides.pop(get_admin_service, None)


@pytest.mark.asyncio
async def test_revoke_user_session(
    admin_user: User, mock_admin_service: MagicMock
) -> None:
    session_id = uuid.uuid4()
    mock_admin_service.revoke_session = AsyncMock(return_value=True)

    app.dependency_overrides[require_support_admin] = lambda: admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.delete(f"/api/v1/admin/sessions/{session_id}")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert "revoked" in data["message"].lower()
    finally:
        app.dependency_overrides.pop(require_support_admin, None)
        app.dependency_overrides.pop(get_admin_service, None)


@pytest.mark.asyncio
async def test_trigger_password_reset(
    admin_user: User, mock_admin_service: MagicMock, mock_auth_service: MagicMock
) -> None:
    student_id = uuid.uuid4()
    mock_student = User(
        id=student_id,
        email="student@studymate.ai",
        full_name="Target Student",
        hashed_password="hash",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )
    mock_auth_service.user_repo.get_by_id = AsyncMock(return_value=mock_student)

    app.dependency_overrides[require_support_admin] = lambda: admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(f"/api/v1/admin/users/{student_id}/trigger-password-reset")
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["user_email"] == "student@studymate.ai"
            assert data["reset_token_issued"] is True
            mock_auth_service.forgot_password.assert_awaited_once_with("student@studymate.ai")
    finally:
        app.dependency_overrides.pop(require_support_admin, None)
        app.dependency_overrides.pop(get_admin_service, None)
        app.dependency_overrides.pop(get_auth_service, None)

