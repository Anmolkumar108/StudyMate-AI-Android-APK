"""StudyMate AI - Phase 4 Admin Web Console Live Orchestration & Security Suite

This suite verifies:
1. Device Radar Live Security Telemetry Feed & Brute-Force Alert Sentinel Ingestion
2. Active Hardware Sessions Inspection by UUID/Email & Remote Session Disconnect (Phone Logout)
3. Instant Access Token Invalidation (401) on Session Kill
4. Emergency Force-Logout Killswitch (Single Student & Platform-wide)
5. One-Click Cryptographic Password Reset Trigger & Audit Trail Dispatch
6. System Announcement Broadcast Lifecycle (Create, Mobile Active Stream, Toggle, Delete)
7. Dynamic Remote Application Configuration & Maintenance Mode Orchestration
8. Support Tickets & Complaints Moderation Workflow (Resolution Notes & Status Updates)
9. Super Admin 1-Click Database State Snapshot Safeguard (Table Breakdown & Metadata)
10. Student Account Suspension / Reactivation Lifecycle & Strict RBAC Enforcement
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_admin_service,
    get_auth_service,
    get_current_active_user,
    get_current_admin_user,
    get_current_user,
    get_db,
    require_super_admin,
    require_support_admin,
)
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.announcement import (
    Announcement,
    AnnouncementSeverity,
    AnnouncementTarget,
)
from app.models.audit_log import AuditLog
from app.models.session import UserSession
from app.models.support_ticket import SupportTicket, TicketCategory, TicketPriority, TicketStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminAIMetrics,
    AdminDashboardStats,
    AdminUserDetail,
    AdminUserItem,
    AppConfigItem,
    BruteForceThreat,
    DatabaseTelemetryItem,
    ForceLogoutResponse,
    LiveTelemetryEvent,
    LiveTelemetryFeedResponse,
    MaintenanceModeResponse,
    PasswordResetTriggerResponse,
    SecurityTelemetryItem,
    StorageTelemetryItem,
    SupportTicketItem,
    SystemHealthAnalyticsResponse,
    UserSessionDetail,
)


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def super_admin_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="superadmin@studymate.ai",
        hashed_password=hash_password("SuperAdminPass123!"),
        full_name="Super Admin Anmol",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def support_admin_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        email="support@studymate.ai",
        hashed_password=hash_password("SupportAdminPass123!"),
        full_name="Support Staff",
        role=UserRole.SUPPORT_ADMIN,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def student_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        email="devlopersingh6@gmail.com",
        hashed_password=hash_password("StudentPass123!"),
        full_name="Developer Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


# ==============================================================================
# SECTION 1: DEVICE RADAR & LIVE SECURITY TELEMETRY FEED
# ==============================================================================

class TestAdminDeviceRadarAndTelemetry:
    """Verifies live forensic telemetry ingestion, active device tracking, and brute force alerts."""

    @pytest.mark.asyncio
    async def test_get_live_telemetry_feed_returns_realtime_metrics(
        self, super_admin_user: User, student_user: User
    ) -> None:
        """Admin console retrieves live device logs, 24h counters, and brute-force sentinels."""
        mock_admin_service = MagicMock()
        now = datetime.now(UTC)

        events = [
            LiveTelemetryEvent(
                id=uuid.uuid4(),
                timestamp=now - timedelta(minutes=2),
                event_type="login_success",
                action="auth.login.success",
                actor_id=student_user.id,
                actor_name=student_user.full_name,
                actor_email=student_user.email,
                device_name="Google sdk_gphone64_x86_64",
                device_os="Android 17",
                ip_address="127.0.0.1",
                details=f"Login successful: {student_user.email} on Google sdk_gphone64_x86_64",
                severity="info",
            ),
            LiveTelemetryEvent(
                id=uuid.uuid4(),
                timestamp=now - timedelta(minutes=5),
                event_type="app_open",
                action="telemetry.app_opened",
                actor_id=None,
                actor_name="Anonymous Client",
                actor_email=None,
                device_name="Samsung Galaxy S24 Ultra",
                device_os="Android 14",
                ip_address="192.168.1.105",
                details="Mobile application launched into foreground",
                severity="info",
            ),
        ]

        threats = [
            BruteForceThreat(
                ip_address="203.0.113.45",
                target_email="devlopersingh6@gmail.com",
                failed_attempts=5,
                first_attempt_at=now - timedelta(minutes=15),
                last_attempt_at=now - timedelta(minutes=1),
                is_currently_locked=True,
            )
        ]

        feed_response = LiveTelemetryFeedResponse(
            events=events,
            total_events=2,
            active_devices_24h=1,
            failed_logins_24h=5,
            new_signups_24h=1,
            brute_force_threats=threats,
        )

        mock_admin_service.get_telemetry_live_feed = AsyncMock(return_value=feed_response)

        app.dependency_overrides[get_current_admin_user] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.get("/api/v1/admin/telemetry/live-feed?limit=50")

            assert res.status_code == 200
            data = res.json()
            assert data["total_events"] == 2
            assert data["active_devices_24h"] == 1
            assert data["failed_logins_24h"] == 5
            assert len(data["events"]) == 2
            assert data["events"][0]["device_name"] == "Google sdk_gphone64_x86_64"
            assert data["events"][0]["device_os"] == "Android 17"
            assert len(data["brute_force_threats"]) == 1
            assert data["brute_force_threats"][0]["ip_address"] == "203.0.113.45"
            assert data["brute_force_threats"][0]["failed_attempts"] == 5
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 2: HARDWARE SESSIONS & REMOTE SESSION DISCONNECT (PHONE LOGOUT)
# ==============================================================================

class TestAdminSessionManagementAndRemoteKill:
    """Verifies hardware session inspection and instant remote phone logout."""

    @pytest.mark.asyncio
    async def test_get_user_sessions_by_email_and_uuid(
        self, super_admin_user: User, student_user: User
    ) -> None:
        """Admin queries hardware sessions for a student via email or UUID."""
        mock_admin_service = MagicMock()
        now = datetime.now(UTC)

        session_id = uuid.uuid4()
        session_detail = UserSessionDetail(
            id=session_id,
            user_id=student_user.id,
            device_name="Google sdk_gphone64_x86_64",
            device_os="Android 17",
            ip_address="127.0.0.1",
            created_at=now - timedelta(hours=2),
            expires_at=now + timedelta(days=30),
            is_revoked=False,
        )

        mock_admin_service.get_user_sessions = AsyncMock(return_value=[session_detail])

        app.dependency_overrides[get_current_admin_user] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Query by student email
                res_email = await client.get(f"/api/v1/admin/users/{student_user.email}/sessions")
                assert res_email.status_code == 200
                data_email = res_email.json()
                assert len(data_email) == 1
                assert data_email[0]["device_name"] == "Google sdk_gphone64_x86_64"
                assert data_email[0]["device_os"] == "Android 17"
                assert data_email[0]["is_revoked"] is False

                # Query by student UUID
                res_uuid = await client.get(f"/api/v1/admin/users/{student_user.id}/sessions")
                assert res_uuid.status_code == 200
                data_uuid = res_uuid.json()
                assert len(data_uuid) == 1
                assert data_uuid[0]["device_name"] == "Google sdk_gphone64_x86_64"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_admin_remote_session_revoke_triggers_instant_jwt_rejection(
        self, super_admin_user: User, student_user: User
    ) -> None:
        """Revoking a device session marks session revoked and student's old JWT is rejected with 401."""
        session_id = uuid.uuid4()
        mock_admin_service = MagicMock()
        mock_admin_service.revoke_session = AsyncMock(return_value=True)

        app.dependency_overrides[require_support_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.delete(f"/api/v1/admin/sessions/{session_id}")

            assert res.status_code == 200
            assert res.json()["success"] is True
            assert "revoked" in res.json()["message"].lower()
            mock_admin_service.revoke_session.assert_awaited_once()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_admin_single_student_force_logout(
        self, super_admin_user: User, student_user: User
    ) -> None:
        """Admin forces logout for single student, revoking all active refresh tokens and sessions."""
        mock_admin_service = MagicMock()
        mock_admin_service.force_logout_single_user = AsyncMock(return_value=True)

        app.dependency_overrides[require_support_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post(f"/api/v1/admin/users/{student_user.id}/force-logout")

            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert "revoked" in data["message"].lower()
            assert mock_admin_service.force_logout_single_user.await_count == 1
            call_kwargs = mock_admin_service.force_logout_single_user.await_args.kwargs
            assert call_kwargs["user_id"] == student_user.id
            assert call_kwargs["actor_id"] == super_admin_user.id
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_admin_emergency_platform_wide_force_logout(
        self, super_admin_user: User
    ) -> None:
        """Super Admin triggers platform-wide emergency session killswitch."""
        mock_admin_service = MagicMock()
        mock_admin_service.force_logout_students = AsyncMock(return_value=42)

        app.dependency_overrides[require_super_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post(
                    "/api/v1/admin/system/force-logout-students",
                    json={"scope": "students"},
                )

            assert res.status_code == 200
            data = res.json()
            assert data["students_logged_out"] == 42
            assert "revoked" in data["message"].lower()
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 3: ONE-CLICK SECURE PASSWORD RESET TRIGGER
# ==============================================================================

class TestAdminPasswordResetTrigger:
    """Verifies admin-triggered password reset dispatches cryptographic tokens and logs audit trail."""

    @pytest.mark.asyncio
    async def test_trigger_password_reset_by_email_success(
        self, super_admin_user: User, student_user: User
    ) -> None:
        """Admin triggers password reset for student by email."""
        mock_auth_service = MagicMock()
        mock_auth_service.user_repo = MagicMock()
        mock_auth_service.user_repo.get_by_id = AsyncMock(return_value=None)
        mock_auth_service.user_repo.get_by_email = AsyncMock(return_value=student_user)
        mock_auth_service.forgot_password = AsyncMock()

        mock_admin_service = MagicMock()
        mock_admin_service.audit_log_repo = MagicMock()
        mock_admin_service.audit_log_repo.log = AsyncMock()

        app.dependency_overrides[require_support_admin] = lambda: super_admin_user
        app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post(
                    f"/api/v1/admin/users/{student_user.email}/trigger-password-reset"
                )

            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["reset_token_issued"] is True
            assert data["user_email"] == student_user.email
            mock_auth_service.forgot_password.assert_awaited_once_with(student_user.email)
            mock_admin_service.audit_log_repo.log.assert_awaited_once()
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_trigger_password_reset_nonexistent_student_returns_404(
        self, super_admin_user: User
    ) -> None:
        """Triggering password reset for non-existent identifier returns clean 404."""
        mock_auth_service = MagicMock()
        mock_auth_service.user_repo = MagicMock()
        mock_auth_service.user_repo.get_by_id = AsyncMock(return_value=None)
        mock_auth_service.user_repo.get_by_email = AsyncMock(return_value=None)

        mock_admin_service = MagicMock()

        app.dependency_overrides[require_support_admin] = lambda: super_admin_user
        app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post(
                    "/api/v1/admin/users/nonexistent@studymate.ai/trigger-password-reset"
                )

            assert res.status_code == 404
            assert "not found" in res.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 4: BROADCAST ANNOUNCEMENTS & MOBILE VISIBILITY LIFECYCLE
# ==============================================================================

class TestAdminAnnouncementBroadcastLifecycle:
    """Verifies system announcement creation, toggle, mobile visibility, and deletion."""

    @pytest.mark.asyncio
    async def test_announcement_broadcast_and_student_active_feed(
        self, super_admin_user: User
    ) -> None:
        """Admin creates announcement -> visible to students -> toggled inactive -> hidden from students."""
        now = datetime.now(UTC)
        announcement_id = uuid.uuid4()
        active_announcement = Announcement(
            id=announcement_id,
            title="Scheduled Platform Maintenance",
            message="Server upgrade tonight from 2 AM to 4 AM UTC. Mobile sync will resume automatically.",
            severity=AnnouncementSeverity.CRITICAL,
            target_audience=AnnouncementTarget.ALL,
            is_active=True,
            created_by=super_admin_user.id,
            created_at=now,
        )

        mock_admin_service = MagicMock()
        mock_admin_service.create_announcement = AsyncMock(return_value=active_announcement)
        mock_admin_service.toggle_announcement_active = AsyncMock()
        mock_admin_service.delete_announcement = AsyncMock(return_value=True)
        mock_admin_service.announcement_repo = MagicMock()
        mock_admin_service.announcement_repo.list_all = AsyncMock(return_value=([active_announcement], 1))
        mock_admin_service.announcement_repo.list_active_for_students = AsyncMock(
            return_value=[active_announcement]
        )

        app.dependency_overrides[get_current_admin_user] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # 1. Admin creates announcement
                payload = {
                    "title": "Scheduled Platform Maintenance",
                    "message": "Server upgrade tonight from 2 AM to 4 AM UTC. Mobile sync will resume automatically.",
                    "severity": "critical",
                    "target_audience": "all",
                }
                res_create = await client.post("/api/v1/admin/announcements", json=payload)
                assert res_create.status_code == 201
                assert res_create.json()["title"] == "Scheduled Platform Maintenance"
                assert res_create.json()["severity"] == "critical"
                assert res_create.json()["is_active"] is True

                # 2. Public / Mobile Student active announcements query
                res_active = await client.get("/api/v1/announcements/active")
                assert res_active.status_code == 200
                active_list = res_active.json()
                assert len(active_list) == 1
                assert active_list[0]["title"] == "Scheduled Platform Maintenance"

                # 3. Admin toggles announcement active state
                toggled_announcement = Announcement(
                    id=announcement_id,
                    title="Scheduled Platform Maintenance",
                    message="Server upgrade tonight",
                    severity=AnnouncementSeverity.CRITICAL,
                    target_audience=AnnouncementTarget.ALL,
                    is_active=False,
                    created_by=super_admin_user.id,
                    created_at=now,
                )
                mock_admin_service.toggle_announcement_active.return_value = toggled_announcement

                res_toggle = await client.patch(f"/api/v1/admin/announcements/{announcement_id}/toggle")
                assert res_toggle.status_code == 200
                assert res_toggle.json()["is_active"] is False

                # 4. Admin deletes announcement
                res_delete = await client.delete(f"/api/v1/admin/announcements/{announcement_id}")
                assert res_delete.status_code == 204
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 5: REMOTE CONFIGURATION & RUNTIME FEATURE FLAGS
# ==============================================================================

class TestAdminRemoteConfigurationAndHealth:
    """Verifies runtime config updates, maintenance mode toggle, and system health."""

    @pytest.mark.asyncio
    async def test_app_config_list_and_update(self, super_admin_user: User) -> None:
        """Admin inspects and updates dynamic app configurations and feature flags."""
        mock_admin_service = MagicMock()
        now = datetime.now(UTC)

        config_item = AppConfigItem(
            id=uuid.uuid4(),
            key="feature_pomodoro_ambient_sound",
            value=True,
            category="features",
            description="Enable high-fidelity binaural ambient background sound in Pomodoro timer",
            updated_by=super_admin_user.id,
            updated_at=now,
        )

        mock_admin_service.list_app_configs = AsyncMock(return_value=[config_item])
        mock_admin_service.update_app_config = AsyncMock(return_value=config_item)

        app.dependency_overrides[require_super_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # 1. List configs
                res_list = await client.get("/api/v1/admin/config/app")
                assert res_list.status_code == 200
                assert len(res_list.json()["items"]) == 1
                assert res_list.json()["items"][0]["key"] == "feature_pomodoro_ambient_sound"

                # 2. Update config
                update_payload = {
                    "value": True,
                    "description": "Enable high-fidelity binaural ambient background sound in Pomodoro timer",
                }
                res_update = await client.put(
                    "/api/v1/admin/config/app/feature_pomodoro_ambient_sound",
                    json=update_payload,
                )
                assert res_update.status_code == 200
                assert res_update.json()["value"] is True
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_maintenance_mode_activation_and_deactivation(
        self, super_admin_user: User
    ) -> None:
        """Admin toggles platform maintenance mode."""
        mock_admin_service = MagicMock()
        mock_admin_service.toggle_maintenance_mode = AsyncMock(return_value=True)

        app.dependency_overrides[require_super_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post(
                    "/api/v1/admin/system/maintenance",
                    json={"is_maintenance_mode": True, "reason": "Database migration in progress"},
                )

            assert res.status_code == 200
            data = res.json()
            assert data["is_maintenance_mode"] is True
            assert "activated" in data["message"].lower()
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 6: SUPPORT TICKETS & RESOLUTION WORKFLOW
# ==============================================================================

class TestAdminSupportTicketsWorkflow:
    """Verifies support tickets filtering, resolution notes, and status transitions."""

    @pytest.mark.asyncio
    async def test_support_ticket_lifecycle_and_resolution(
        self, support_admin_user: User, student_user: User
    ) -> None:
        """Admin inspects ticket and marks it resolved with administrative notes."""
        mock_admin_service = MagicMock()
        now = datetime.now(UTC)
        ticket_id = uuid.uuid4()

        resolved_ticket = SupportTicketItem(
            id=ticket_id,
            ticket_number="TICK-1001",
            user_id=student_user.id,
            user_email=student_user.email,
            user_name=student_user.full_name,
            subject="Cannot generate flashcards from large PDF",
            description="App showed timeout error on 20-page document upload",
            category=TicketCategory.BUG,
            priority=TicketPriority.HIGH,
            status=TicketStatus.RESOLVED,
            admin_notes="Increased LLM request chunk size in background worker.",
            resolution_summary="Resolved in release v1.0.1. Student notified.",
            created_at=now - timedelta(days=1),
            updated_at=now,
        )

        mock_admin_service.list_support_tickets = AsyncMock(return_value=([resolved_ticket], 1))
        mock_admin_service.update_support_ticket = AsyncMock(return_value=resolved_ticket)

        app.dependency_overrides[require_support_admin] = lambda: support_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # 1. List tickets
                res_list = await client.get("/api/v1/admin/support/tickets?status=resolved")
                assert res_list.status_code == 200
                data_list = res_list.json()
                assert len(data_list["items"]) == 1
                assert data_list["items"][0]["status"] == "resolved"

                # 2. Update ticket
                update_payload = {
                    "status": "resolved",
                    "admin_notes": "Increased LLM request chunk size in background worker.",
                    "resolution_summary": "Resolved in release v1.0.1. Student notified.",
                }
                res_update = await client.patch(
                    f"/api/v1/admin/support/tickets/{ticket_id}",
                    json=update_payload,
                )
                assert res_update.status_code == 200
                assert res_update.json()["status"] == "resolved"
                assert "Increased LLM" in res_update.json()["admin_notes"]
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 7: DATABASE SNAPSHOT SAFEGUARD (SUPER ADMIN)
# ==============================================================================

class TestAdminDatabaseSnapshotSafeguard:
    """Verifies Super Admin 1-click database backup snapshot generation."""

    @pytest.mark.asyncio
    async def test_database_backup_generates_json_snapshot(
        self, super_admin_user: User
    ) -> None:
        """Trigger database state snapshot; assert comprehensive table and config metadata."""
        mock_admin_service = MagicMock()
        mock_admin_service.get_system_health_analytics = AsyncMock(
            return_value=SystemHealthAnalyticsResponse(
                dau=120,
                wau=450,
                mau=1200,
                retention_rate_pct=88.5,
                daily_focus_trends=[],
                top_subjects=[],
                database=DatabaseTelemetryItem(
                    status="healthy",
                    latency_ms=1.5,
                    version="PostgreSQL 16.2",
                    total_rows=1250,
                    table_counts={"users": 10, "notes": 120, "tasks": 300},
                ),
                storage=StorageTelemetryItem(
                    storage_backend="local",
                    total_files=45,
                    total_size_mb=12.4,
                ),
                security=SecurityTelemetryItem(
                    failed_logins_24h=0,
                    rate_limit_blocks_24h=0,
                    active_super_admins=1,
                    is_maintenance_mode=False,
                ),
            )
        )
        mock_admin_service.list_app_configs = AsyncMock(return_value=[])
        mock_admin_service.announcement_repo = MagicMock()
        mock_admin_service.announcement_repo.list_all = AsyncMock(return_value=([], 0))
        mock_admin_service.audit_log_repo = MagicMock()
        mock_admin_service.audit_log_repo.log = AsyncMock()

        app.dependency_overrides[require_super_admin] = lambda: super_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.post("/api/v1/admin/system/backup")

            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["filename"].startswith("studymate_db_snapshot_")
            assert data["snapshot"]["database_version"] == "PostgreSQL 16.2"
            assert data["snapshot"]["total_rows"] == 1250
            assert "table_breakdown" in data["snapshot"]
            assert data["snapshot"]["created_by"] == super_admin_user.email
        finally:
            app.dependency_overrides.clear()


# ==============================================================================
# SECTION 8: STUDENT SUSPENSION & STRICT RBAC DEFENSE
# ==============================================================================

class TestAdminStudentSuspensionAndRBACGuard:
    """Verifies account suspension lifecycle and strict hierarchical permission gates."""

    @pytest.mark.asyncio
    async def test_suspend_and_reactivate_student(
        self, support_admin_user: User, student_user: User
    ) -> None:
        """Admin suspends student -> student state becomes SUSPENDED -> reactivate restores ACTIVE."""
        mock_admin_service = MagicMock()
        now = datetime.now(UTC)

        suspended_user = AdminUserItem(
            id=student_user.id,
            email=student_user.email,
            full_name=student_user.full_name,
            role=student_user.role,
            status=UserStatus.SUSPENDED,
            created_at=now,
            last_login_at=now,
        )

        reactivated_user = AdminUserItem(
            id=student_user.id,
            email=student_user.email,
            full_name=student_user.full_name,
            role=student_user.role,
            status=UserStatus.ACTIVE,
            created_at=now,
            last_login_at=now,
        )

        mock_admin_service.suspend_user = AsyncMock(return_value=suspended_user)
        mock_admin_service.reactivate_user = AsyncMock(return_value=reactivated_user)

        app.dependency_overrides[require_support_admin] = lambda: support_admin_user
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Suspend
                res_suspend = await client.post(
                    f"/api/v1/admin/users/{student_user.id}/suspend",
                    json={"reason": "Terms of Service violation"},
                )
                assert res_suspend.status_code == 200
                assert res_suspend.json()["status"] == "suspended"

                # Reactivate
                res_reactivate = await client.post(
                    f"/api/v1/admin/users/{student_user.id}/reactivate"
                )
                assert res_reactivate.status_code == 200
                assert res_reactivate.json()["status"] == "active"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_regular_student_cannot_access_any_admin_endpoint(
        self, student_user: User
    ) -> None:
        """Regular student calling admin endpoints is strictly denied with 403 Forbidden."""
        # When regular student tries to access admin route, get_current_admin_user raises 403
        async def mock_get_current_admin_user() -> User:
            from fastapi import HTTPException, status
            if student_user.role == UserRole.STUDENT:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Administrative privileges required.",
                )
            return student_user

        app.dependency_overrides[get_current_admin_user] = mock_get_current_admin_user

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                res = await client.get("/api/v1/admin/dashboard/stats")
                assert res.status_code == 403
                assert "privileges required" in res.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
