import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_admin_service,
    get_auth_service,
    get_current_active_user,
    get_current_admin_user,
    require_super_admin,
    require_support_admin,
)
from app.core.security import hash_password
from app.main import app
from app.models.announcement import (
    Announcement,
    AnnouncementSeverity,
    AnnouncementTarget,
)
from app.models.audit_log import AuditLog
from app.models.support_ticket import TicketCategory, TicketPriority, TicketStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminAIMetrics,
    AdminDashboardStats,
    AdminUserDetail,
    AdminUserItem,
    AppConfigItem,
    DailyStudyTrendItem,
    DatabaseTelemetryItem,
    SecurityTelemetryItem,
    StorageTelemetryItem,
    SupportTicketItem,
    SystemHealthAnalyticsResponse,
    TopSubjectItem,
)


@pytest.fixture
def super_admin_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="superadmin@studymate.ai",
        hashed_password=hash_password("SuperAdminPass123!"),
        full_name="Super Admin",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )


@pytest.fixture
def student_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="student@studymate.ai",
        hashed_password=hash_password("StudentPass123!"),
        full_name="Regular Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )


@pytest.fixture
def mock_admin_service() -> MagicMock:
    service = MagicMock()
    service.get_dashboard_stats = AsyncMock()
    service.list_users = AsyncMock()
    service.get_user_detail = AsyncMock()
    service.suspend_user = AsyncMock()
    service.reactivate_user = AsyncMock()
    service.get_ai_metrics = MagicMock()
    service.update_ai_config = AsyncMock()
    service.create_announcement = AsyncMock()
    service.toggle_announcement_active = AsyncMock()
    service.delete_announcement = AsyncMock()
    service.request_student_password_reset = AsyncMock()
    service.list_audit_logs = AsyncMock()
    service.get_system_health_analytics = AsyncMock()
    service.toggle_maintenance_mode = AsyncMock()
    service.force_logout_students = AsyncMock()
    service.list_support_tickets = AsyncMock()
    service.update_support_ticket = AsyncMock()
    service.list_app_configs = AsyncMock()
    service.update_app_config = AsyncMock()
    service.audit_log_repo = MagicMock()
    service.audit_log_repo.log = AsyncMock()
    service.announcement_repo = MagicMock()
    service.announcement_repo.list_all = AsyncMock()
    service.announcement_repo.list_active_for_students = AsyncMock()
    return service


@pytest.fixture
async def admin_client(
    super_admin_user: User,
    mock_admin_service: MagicMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: super_admin_user
    app.dependency_overrides[get_current_admin_user] = lambda: super_admin_user
    app.dependency_overrides[require_super_admin] = lambda: super_admin_user
    app.dependency_overrides[require_support_admin] = lambda: super_admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_login_success(super_admin_user: User, mock_admin_service: MagicMock) -> None:
    mock_auth = MagicMock()
    mock_auth.user_repo = MagicMock()
    mock_auth.user_repo.get_by_email = AsyncMock(return_value=super_admin_user)
    mock_auth.session = MagicMock()
    mock_auth.session.flush = AsyncMock()

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/admin/auth/login",
            json={
                "email": "superadmin@studymate.ai",
                "password": "SuperAdminPass123!",
                "security_pin": "979831",
            },
        )
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["role"] == "super_admin"


@pytest.mark.asyncio
async def test_admin_login_invalid_security_pin(super_admin_user: User, mock_admin_service: MagicMock) -> None:
    mock_auth = MagicMock()
    mock_auth.user_repo = MagicMock()
    mock_auth.user_repo.get_by_email = AsyncMock(return_value=super_admin_user)

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/admin/auth/login",
            json={
                "email": "superadmin@studymate.ai",
                "password": "SuperAdminPass123!",
                "security_pin": "000000",  # Incorrect PIN
            },
        )
    app.dependency_overrides.clear()

    assert resp.status_code == 401
    assert "credentials or master security passkey" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_login_forbidden_for_student(student_user: User, mock_admin_service: MagicMock) -> None:
    mock_auth = MagicMock()
    mock_auth.user_repo = MagicMock()
    mock_auth.user_repo.get_by_email = AsyncMock(return_value=student_user)

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/admin/auth/login",
            json={"email": "student@studymate.ai", "password": "StudentPass123!", "security_pin": "979831"},
        )
    app.dependency_overrides.clear()

    assert resp.status_code == 403
    assert "administrative access privileges" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_login_invalid_password(super_admin_user: User, mock_admin_service: MagicMock) -> None:
    mock_auth = MagicMock()
    mock_auth.user_repo = MagicMock()
    mock_auth.user_repo.get_by_email = AsyncMock(return_value=super_admin_user)

    app.dependency_overrides[get_auth_service] = lambda: mock_auth
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/admin/auth/login",
            json={"email": "superadmin@studymate.ai", "password": "WrongPassword123!", "security_pin": "979831"},
        )
    app.dependency_overrides.clear()

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_admin_profile(admin_client: AsyncClient, super_admin_user: User) -> None:
    resp = await admin_client.get("/api/v1/admin/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(super_admin_user.id)
    assert data["role"] == "super_admin"


@pytest.mark.asyncio
async def test_get_dashboard_stats(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_admin_service.get_dashboard_stats.return_value = AdminDashboardStats(
        total_students=120,
        active_students=110,
        suspended_students=5,
        pending_verification_students=5,
        total_focus_hours=345.5,
        total_notes=890,
        total_flashcard_decks=150,
        total_documents=60,
        total_quizzes=45,
        active_announcements_count=2,
        system_status="operational",
    )

    resp = await admin_client.get("/api/v1/admin/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_students"] == 120
    assert data["total_focus_hours"] == 345.5
    assert data["system_status"] == "operational"


@pytest.mark.asyncio
async def test_list_students(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    mock_admin_service.list_users.return_value = (
        [AdminUserItem.model_validate(student_user)],
        1,
    )

    resp = await admin_client.get("/api/v1/admin/users?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["email"] == student_user.email


@pytest.mark.asyncio
async def test_get_student_detail(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    mock_admin_service.get_user_detail.return_value = AdminUserDetail(
        id=student_user.id,
        email=student_user.email,
        full_name=student_user.full_name,
        role=student_user.role,
        status=student_user.status,
        created_at=student_user.created_at or datetime.now(UTC),
        subjects_count=5,
        tasks_count=12,
        notes_count=20,
        flashcards_count=4,
        documents_count=3,
        study_sessions_count=15,
        total_focus_minutes=450,
        current_streak_days=7,
    )

    resp = await admin_client.get(f"/api/v1/admin/users/{student_user.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == student_user.email
    assert data["subjects_count"] == 5
    assert data["current_streak_days"] == 7


@pytest.mark.asyncio
async def test_suspend_student(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    student_user.status = UserStatus.SUSPENDED
    mock_admin_service.suspend_user.return_value = student_user

    resp = await admin_client.post(
        f"/api/v1/admin/users/{student_user.id}/suspend",
        json={"reason": "Violation of academic terms"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "suspended"


@pytest.mark.asyncio
async def test_suspend_super_admin_rejected(
    admin_client: AsyncClient, mock_admin_service: MagicMock, super_admin_user: User
) -> None:
    mock_admin_service.suspend_user.side_effect = ValueError(
        "Super Admin accounts cannot be suspended."
    )

    resp = await admin_client.post(
        f"/api/v1/admin/users/{super_admin_user.id}/suspend",
        json={"reason": "Test fail"},
    )
    assert resp.status_code == 400
    assert "Super Admin accounts cannot be suspended" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_reactivate_student(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    student_user.status = UserStatus.ACTIVE
    mock_admin_service.reactivate_user.return_value = student_user

    resp = await admin_client.post(f"/api/v1/admin/users/{student_user.id}/reactivate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_get_ai_metrics(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_admin_service.get_ai_metrics.return_value = AdminAIMetrics(
        primary_provider="gemini",
        active_model_name="gemini-3.1-flash-lite",
        daily_budget_limit_usd=10.0,
        estimated_today_cost_usd=0.08,
        available_models=["gemini-3.1-flash-lite", "gpt-4o-mini"],
    )

    resp = await admin_client.get("/api/v1/admin/ai/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_model_name"] == "gemini-3.1-flash-lite"
    assert data["daily_budget_limit_usd"] == 10.0


@pytest.mark.asyncio
async def test_update_ai_config(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_admin_service.update_ai_config.return_value = AdminAIMetrics(
        primary_provider="gemini",
        active_model_name="gemini-3.8-flash",
        daily_budget_limit_usd=25.0,
        estimated_today_cost_usd=0.08,
        available_models=["gemini-3.1-flash-lite", "gemini-3.8-flash"],
    )

    resp = await admin_client.post(
        "/api/v1/admin/ai/config",
        json={"model_name": "gemini-3.8-flash", "daily_budget_limit_usd": 25.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_model_name"] == "gemini-3.8-flash"
    assert data["daily_budget_limit_usd"] == 25.0


@pytest.mark.asyncio
async def test_create_and_delete_announcement(
    admin_client: AsyncClient, mock_admin_service: MagicMock, super_admin_user: User
) -> None:
    announcement_id = uuid.uuid4()
    mock_announcement = Announcement(
        id=announcement_id,
        title="Scheduled Maintenance",
        message="System updates on Sunday at 2 AM UTC",
        severity=AnnouncementSeverity.WARNING,
        target_audience=AnnouncementTarget.ALL,
        is_active=True,
        created_by=super_admin_user.id,
        created_at=datetime.now(UTC),
    )
    mock_admin_service.create_announcement.return_value = mock_announcement
    mock_admin_service.delete_announcement.return_value = True

    # 1. Create
    resp = await admin_client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Scheduled Maintenance",
            "message": "System updates on Sunday at 2 AM UTC",
            "severity": "warning",
            "target_audience": "all",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Scheduled Maintenance"

    # 2. Toggle active status
    mock_announcement.is_active = False
    mock_admin_service.toggle_announcement_active.return_value = mock_announcement
    toggle_resp = await admin_client.patch(
        f"/api/v1/admin/announcements/{announcement_id}/toggle"
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # 3. Delete
    del_resp = await admin_client.delete(f"/api/v1/admin/announcements/{announcement_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_trigger_student_password_reset(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    mock_admin_service.request_student_password_reset.return_value = {
        "success": True,
        "message": f"Password recovery initiated for {student_user.email}. Active sessions invalidated.",
        "email": student_user.email,
        "temporary_token": "SM-TEST1234",
    }

    resp = await admin_client.post(
        f"/api/v1/admin/users/{student_user.id}/reset-password"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["email"] == student_user.email
    assert "temporary_token" in data


@pytest.mark.asyncio
async def test_public_active_announcements(mock_admin_service: MagicMock) -> None:
    announcement_id = uuid.uuid4()
    mock_announcement = Announcement(
        id=announcement_id,
        title="Exam Focus Challenge",
        message="Log 2 hours of study today for 50 bonus XP!",
        severity=AnnouncementSeverity.INFO,
        target_audience=AnnouncementTarget.ALL,
        is_active=True,
        created_at=datetime.now(UTC),
    )
    mock_admin_service.announcement_repo.list_active_for_students.return_value = [
        mock_announcement
    ]

    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/announcements/active")
    app.dependency_overrides.clear()

    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "Exam Focus Challenge"


@pytest.mark.asyncio
async def test_list_audit_logs(
    admin_client: AsyncClient, mock_admin_service: MagicMock, super_admin_user: User
) -> None:
    mock_log = AuditLog(
        id=uuid.uuid4(),
        actor_id=super_admin_user.id,
        action="user_suspended",
        target_type="user",
        target_id=str(uuid.uuid4()),
        details="User suspended for policy violation",
        ip_address="127.0.0.1",
        created_at=datetime.now(UTC),
    )
    mock_log.actor = super_admin_user
    mock_admin_service.list_audit_logs.return_value = ([mock_log], 1)

    resp = await admin_client.get("/api/v1/admin/audit-logs?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["action"] == "user_suspended"
    assert data["items"][0]["actor_name"] == super_admin_user.full_name


@pytest.mark.asyncio
async def test_get_system_health_analytics(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_analytics = SystemHealthAnalyticsResponse(
        dau=14,
        wau=48,
        mau=120,
        retention_rate_pct=78.5,
        daily_focus_trends=[
            DailyStudyTrendItem(
                date="2026-11-07",
                focus_minutes=180,
                sessions_count=6,
                unique_students=4,
            )
        ],
        top_subjects=[
            TopSubjectItem(
                name="Computer Science",
                code="CS101",
                student_count=25,
                color="#8B5CF6",
            )
        ],
        database=DatabaseTelemetryItem(
            status="Healthy",
            latency_ms=1.45,
            version="PostgreSQL 16.2",
            total_rows=1540,
        ),
        storage=StorageTelemetryItem(
            total_files=38,
            total_size_mb=45.2,
            storage_backend="Local Disk (Async Filesystem)",
        ),
        security=SecurityTelemetryItem(
            failed_logins_24h=2,
            rate_limit_blocks_24h=0,
            active_super_admins=2,
            is_maintenance_mode=False,
        ),
    )
    mock_admin_service.get_system_health_analytics.return_value = mock_analytics

    resp = await admin_client.get("/api/v1/admin/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dau"] == 14
    assert data["wau"] == 48
    assert data["database"]["status"] == "Healthy"
    assert data["storage"]["total_files"] == 38
    assert data["security"]["is_maintenance_mode"] is False


@pytest.mark.asyncio
async def test_toggle_maintenance_mode(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_admin_service.toggle_maintenance_mode.return_value = True

    resp = await admin_client.post(
        "/api/v1/admin/system/maintenance",
        json={"is_maintenance_mode": True, "reason": "Database indexing maintenance"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_maintenance_mode"] is True
    assert "activated" in data["message"]


@pytest.mark.asyncio
async def test_force_logout_students(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_admin_service.force_logout_students.return_value = 85

    resp = await admin_client.post("/api/v1/admin/system/force-logout-students")
    assert resp.status_code == 200
    data = resp.json()
    assert data["students_logged_out"] == 85
    assert "85 users" in data["message"]


@pytest.mark.asyncio
async def test_list_support_tickets(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    ticket_id = uuid.uuid4()
    mock_ticket = SupportTicketItem(
        id=ticket_id,
        ticket_number="TICK-1001",
        user_id=student_user.id,
        user_email=student_user.email,
        user_name=student_user.full_name,
        subject="LaTeX rendering issue",
        category=TicketCategory.BUG,
        priority=TicketPriority.HIGH,
        status=TicketStatus.OPEN,
        description="KaTeX formatting error on mobile screen",
        admin_notes=None,
        assigned_to=None,
        resolution_summary=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        resolved_at=None,
    )
    mock_admin_service.list_support_tickets.return_value = ([mock_ticket], 1)

    resp = await admin_client.get("/api/v1/admin/support/tickets?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["ticket_number"] == "TICK-1001"
    assert data["items"][0]["category"] == "bug"


@pytest.mark.asyncio
async def test_update_support_ticket(
    admin_client: AsyncClient, mock_admin_service: MagicMock, student_user: User
) -> None:
    ticket_id = uuid.uuid4()
    mock_updated = SupportTicketItem(
        id=ticket_id,
        ticket_number="TICK-1001",
        user_id=student_user.id,
        user_email=student_user.email,
        user_name=student_user.full_name,
        subject="LaTeX rendering issue",
        category=TicketCategory.BUG,
        priority=TicketPriority.URGENT,
        status=TicketStatus.RESOLVED,
        description="KaTeX formatting error on mobile screen",
        admin_notes="Resolved via client patch v1.2",
        assigned_to=None,
        resolution_summary="Fixed Katex regex",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        resolved_at=datetime.now(UTC),
    )
    mock_admin_service.update_support_ticket.return_value = mock_updated

    resp = await admin_client.patch(
        f"/api/v1/admin/support/tickets/{ticket_id}",
        json={
            "status": "resolved",
            "priority": "urgent",
            "admin_notes": "Resolved via client patch v1.2",
            "resolution_summary": "Fixed Katex regex",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "resolved"
    assert data["priority"] == "urgent"
    assert data["admin_notes"] == "Resolved via client patch v1.2"


@pytest.mark.asyncio
async def test_list_app_configs(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_configs = [
        AppConfigItem(
            id=uuid.uuid4(),
            key="min_app_version",
            value={"version": "1.0.0", "force_update": False},
            category="versions",
            description="Minimum app version",
            is_secret=False,
            updated_at=datetime.now(UTC),
        )
    ]
    mock_admin_service.list_app_configs.return_value = mock_configs

    resp = await admin_client.get("/api/v1/admin/config/app")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["key"] == "min_app_version"


@pytest.mark.asyncio
async def test_update_app_config(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_item = AppConfigItem(
        id=uuid.uuid4(),
        key="feature_flags",
        value={"ai_chat_enabled": True, "pomodoro_timer_enabled": True},
        category="features",
        description="Dynamic flags",
        is_secret=False,
        updated_at=datetime.now(UTC),
    )
    mock_admin_service.update_app_config.return_value = mock_item

    resp = await admin_client.put(
        "/api/v1/admin/config/app/feature_flags",
        json={
            "value": {"ai_chat_enabled": True, "pomodoro_timer_enabled": True},
            "description": "Dynamic flags",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["key"] == "feature_flags"
    assert data["value"]["ai_chat_enabled"] is True


@pytest.mark.asyncio
async def test_trigger_database_backup(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    mock_analytics = SystemHealthAnalyticsResponse(
        database=DatabaseTelemetryItem(
            status="Healthy",
            latency_ms=1.2,
            version="PostgreSQL 16.2",
            total_rows=1200,
        ),
        storage=StorageTelemetryItem(
            storage_backend="Local Disk",
            total_files=20,
            total_size_mb=4.5,
        ),
        security=SecurityTelemetryItem(
            is_maintenance_mode=False,
            active_super_admins=2,
            rate_limit_blocks_24h=0,
            failed_logins_24h=0,
        ),
        dau=10,
        wau=30,
        mau=100,
        retention_rate_pct=80.0,
        daily_focus_trends=[],
        top_subjects=[],
    )
    mock_admin_service.get_system_health_analytics.return_value = mock_analytics
    mock_admin_service.list_app_configs.return_value = []
    mock_admin_service.announcement_repo.list_all.return_value = []

    resp = await admin_client.post("/api/v1/admin/system/backup")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "studymate_db_snapshot_" in data["filename"]
    assert data["snapshot"]["total_rows"] == 1200
    assert mock_admin_service.audit_log_repo.log.called



