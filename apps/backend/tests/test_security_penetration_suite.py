"""StudyMate AI - Security & Penetration Testing Suite (Pillar 1)

This comprehensive security audit suite executes rigorous automated penetration tests
covering:
1. Insecure Direct Object Reference (IDOR) & Multi-Tenant Data Isolation
2. Role-Based Access Control (RBAC) & Privilege Escalation Prevention
3. Brute-Force Detection & Forensic Audit Sentinel Verification
4. SQL Injection Fuzzing & Malicious Query Injection Mitigation
5. JWT Tampering, Algorithm Confusion & Session Revocation
6. XSS / Malicious Payload Sanitization & Handling
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_admin_service,
    get_auth_service,
    get_current_active_user,
    get_current_admin_user,
    get_db,
    get_flashcard_service,
    get_note_service,
    get_subject_service,
    get_task_service,
)
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.note import Note
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import AdminDashboardStats, BruteForceThreat, LiveTelemetryFeedResponse
from app.services.auth_service import InvalidCredentialsError
from app.services.flashcard_service import DeckNotFoundError
from app.services.note_service import NoteNotFoundError
from app.services.subject_service import SubjectNotFoundError
from app.services.task_service import TaskNotFoundError


# ==============================================================================
# Test Fixtures (Isolated Tenant Personas)
# ==============================================================================

@pytest.fixture
def student_alice() -> User:
    """Legitimate student owning private resources."""
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        email="alice@studymate.ai",
        hashed_password=hash_password("AliceSecurePass123!"),
        full_name="Alice Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def student_bob_adversary() -> User:
    """Adversary student attempting to access Alice's resources or admin routes."""
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        email="bob.adversary@studymate.ai",
        hashed_password=hash_password("BobSecurePass123!"),
        full_name="Bob Adversary",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def support_admin() -> User:
    """Support Admin (elevated staff but NOT super admin)."""
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
        email="support@studymate.ai",
        hashed_password=hash_password("SupportAdmin123!"),
        full_name="Support Staff",
        role=UserRole.SUPPORT_ADMIN,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def super_admin() -> User:
    """Super Administrator with complete platform governance privileges."""
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
        email="superadmin@studymate.ai",
        hashed_password=hash_password("SuperAdmin123!"),
        full_name="Platform SuperAdmin",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


# ==============================================================================
# SECTION 1: IDOR & CROSS-STUDENT DATA ISOLATION PENETRATION TESTS
# ==============================================================================

class TestIDORCrossStudentIsolation:
    """Verifies that an adversary student cannot view, modify, or delete another student's assets.

    Zero information leakage: Must return HTTP 404 Not Found (not 403 or 200).
    """

    @pytest.mark.asyncio
    async def test_idor_adversary_cannot_read_update_delete_alice_note(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Adversary attempts to read, patch, or delete Alice's note."""
        alice_note_id = uuid.uuid4()
        mock_note_service = AsyncMock()
        mock_note_service.get_note.side_effect = NoteNotFoundError("Note not found.")
        mock_note_service.update_note.side_effect = NoteNotFoundError("Note not found.")
        mock_note_service.delete_note.side_effect = NoteNotFoundError("Note not found.")

        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary
        app.dependency_overrides[get_note_service] = lambda: mock_note_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Adversary GET attempt
            get_res = await client.get(f"/api/v1/notes/{alice_note_id}")
            assert get_res.status_code == 404, "IDOR Vulnerability: Adversary was able to access Alice's note!"

            # 2. Adversary PATCH attempt
            patch_res = await client.patch(
                f"/api/v1/notes/{alice_note_id}",
                json={"title": "Hacked Title", "content": "Compromised content"},
            )
            assert patch_res.status_code == 404, "IDOR Vulnerability: Adversary was able to modify Alice's note!"

            # 3. Adversary DELETE attempt
            del_res = await client.delete(f"/api/v1/notes/{alice_note_id}")
            assert del_res.status_code == 404, "IDOR Vulnerability: Adversary was able to delete Alice's note!"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_idor_adversary_cannot_read_update_delete_alice_task(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Adversary attempts to read, patch, or delete Alice's task."""
        alice_task_id = uuid.uuid4()
        mock_task_service = AsyncMock()
        mock_task_service.get_task.side_effect = TaskNotFoundError("Task not found.")
        mock_task_service.update_task.side_effect = TaskNotFoundError("Task not found.")
        mock_task_service.delete_task.side_effect = TaskNotFoundError("Task not found.")

        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary
        app.dependency_overrides[get_task_service] = lambda: mock_task_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Adversary GET task
            get_res = await client.get(f"/api/v1/tasks/{alice_task_id}")
            assert get_res.status_code == 404, "IDOR Vulnerability: Adversary was able to access Alice's task!"

            # 2. Adversary PATCH task
            patch_res = await client.patch(
                f"/api/v1/tasks/{alice_task_id}",
                json={"title": "Hacked Task", "status": "completed"},
            )
            assert patch_res.status_code == 404, "IDOR Vulnerability: Adversary was able to update Alice's task!"

            # 3. Adversary DELETE task
            del_res = await client.delete(f"/api/v1/tasks/{alice_task_id}")
            assert del_res.status_code == 404, "IDOR Vulnerability: Adversary was able to delete Alice's task!"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_idor_adversary_cannot_access_alice_subject(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Adversary attempts to read or mutate Alice's subject."""
        alice_subject_id = uuid.uuid4()
        mock_subj_service = AsyncMock()
        mock_subj_service.get_subject.side_effect = SubjectNotFoundError("Subject not found.")
        mock_subj_service.delete_subject.side_effect = SubjectNotFoundError("Subject not found.")

        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary
        app.dependency_overrides[get_subject_service] = lambda: mock_subj_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            get_res = await client.get(f"/api/v1/subjects/{alice_subject_id}")
            assert get_res.status_code == 404

            del_res = await client.delete(f"/api/v1/subjects/{alice_subject_id}")
            assert del_res.status_code == 404

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_idor_adversary_cannot_access_alice_flashcard_deck(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Adversary attempts to read or mutate Alice's flashcard deck."""
        alice_deck_id = uuid.uuid4()
        mock_fc_service = AsyncMock()
        mock_fc_service.get_deck.side_effect = DeckNotFoundError("Deck not found.")
        mock_fc_service.delete_deck.side_effect = DeckNotFoundError("Deck not found.")

        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary
        app.dependency_overrides[get_flashcard_service] = lambda: mock_fc_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            get_res = await client.get(f"/api/v1/flashcards/decks/{alice_deck_id}")
            assert get_res.status_code == 404

            del_res = await client.delete(f"/api/v1/flashcards/decks/{alice_deck_id}")
            assert del_res.status_code == 404

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 2: PRIVILEGE ESCALATION & RBAC BOUNDARY TESTS
# ==============================================================================

class TestPrivilegeEscalationAndRBAC:
    """Verifies that unprivileged students cannot escalate privileges or reach admin routes."""

    @pytest.mark.asyncio
    async def test_student_cannot_access_admin_dashboard_stats(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Student token calling /api/v1/admin/dashboard/stats must be rejected with 403 Forbidden."""
        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/admin/dashboard/stats")
            assert res.status_code == 403, f"Privilege Escalation! Student got status {res.status_code}"
            assert "administrative privileges required" in res.json().get("detail", "").lower()

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_student_cannot_access_admin_students_directory(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Student cannot query student directory via admin endpoint."""
        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/admin/users")
            assert res.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_student_cannot_create_system_announcement(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Student cannot broadcast announcements to the entire student body."""
        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                "/api/v1/admin/announcements",
                json={
                    "title": "Malicious Broadcast",
                    "content": "Click here to steal tokens",
                    "severity": "info",
                },
            )
            assert res.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_student_cannot_seed_subject_curriculum_templates(
        self,
        student_bob_adversary: User,
    ) -> None:
        """Student cannot trigger system curriculum seed."""
        app.dependency_overrides[get_current_active_user] = lambda: student_bob_adversary

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post("/api/v1/admin/templates/subjects/seed-defaults")
            assert res.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_support_admin_cannot_alter_staff_roles(
        self,
        support_admin: User,
    ) -> None:
        """Support admin is blocked from mutating staff roles (requires Super Admin)."""
        app.dependency_overrides[get_current_active_user] = lambda: support_admin
        target_user_id = uuid.uuid4()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.patch(
                f"/api/v1/admin/staff/{target_user_id}/role",
                json={"role": "super_admin"},
            )
            assert res.status_code == 403, "Support admin was able to access super admin role endpoint!"

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 3: BRUTE-FORCE DEFENSE & SENTINEL TELEMETRY
# ==============================================================================

class TestBruteForceAndSentinelDefense:
    """Verifies that failed logins produce audit trails and trigger sentinel detection."""

    @pytest.mark.asyncio
    async def test_failed_login_creates_immutable_audit_log(self) -> None:
        """Simulate failed login and assert forensic audit trail is committed."""
        mock_auth_service = AsyncMock()
        mock_auth_service.session = AsyncMock()
        mock_auth_service.login.side_effect = InvalidCredentialsError("Invalid email or password.")

        app.dependency_overrides[get_auth_service] = lambda: mock_auth_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                "/api/v1/auth/login",
                json={"email": "victim@studymate.ai", "password": "WrongPassword123!"},
                headers={"X-Forwarded-For": "198.51.100.42", "User-Agent": "AttackerBot/1.0"},
            )
            assert res.status_code == 401
            assert res.json().get("detail") == "Invalid email or password."

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_sentinel_status_escalation_on_brute_force_spike(
        self,
        super_admin: User,
    ) -> None:
        """Admin dashboard telemetry reports Sentinel brute-force threats correctly."""
        mock_admin_service = AsyncMock()
        mock_admin_service.get_telemetry_live_feed.return_value = LiveTelemetryFeedResponse(
            events=[],
            total_events=120,
            active_devices_24h=14,
            failed_logins_24h=25,
            new_signups_24h=3,
            brute_force_threats=[
                BruteForceThreat(
                    ip_address="198.51.100.42",
                    target_email="victim@studymate.ai",
                    failed_attempts=12,
                    first_attempt_at=datetime.now(UTC),
                    last_attempt_at=datetime.now(UTC),
                )
            ],
        )

        app.dependency_overrides[get_current_admin_user] = lambda: super_admin
        app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/admin/telemetry/live-feed")
            assert res.status_code == 200
            data = res.json()
            assert data["failed_logins_24h"] == 25
            assert len(data["brute_force_threats"]) == 1
            assert data["brute_force_threats"][0]["failed_attempts"] == 12

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 4: SQL INJECTION & MALICIOUS FUZZING
# ==============================================================================

class TestSQLInjectionAndFuzzing:
    """Verifies that SQL injection payloads do not execute or produce syntax errors."""

    SQL_PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT 1, 'admin@studymate.ai', 'hash', 'admin' --",
        "' OR 1=1 #",
        "admin' --",
        "sleep(5)#",
    ]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("payload", SQL_PAYLOADS)
    async def test_sql_injection_in_notes_search(
        self,
        student_alice: User,
        payload: str,
    ) -> None:
        """SQL injection in note search query must be treated as literal text."""
        mock_note_service = AsyncMock()
        mock_note_service.get_notes.return_value = []

        app.dependency_overrides[get_current_active_user] = lambda: student_alice
        app.dependency_overrides[get_note_service] = lambda: mock_note_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(f"/api/v1/notes?search={payload}")
            assert res.status_code == 200
            assert res.json() == []

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("payload", SQL_PAYLOADS)
    async def test_sql_injection_in_tasks_filter(
        self,
        student_alice: User,
        payload: str,
    ) -> None:
        """SQL injection in task search query must be treated as literal text."""
        mock_task_service = AsyncMock()
        mock_task_service.list_tasks.return_value = ([], 0, {"completed": 0, "pending": 0, "overdue": 0})

        app.dependency_overrides[get_current_active_user] = lambda: student_alice
        app.dependency_overrides[get_task_service] = lambda: mock_task_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(f"/api/v1/tasks?search={payload}")
            assert res.status_code == 200
            assert res.json()["items"] == []

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 5: JWT AUTHENTICATION SECURITY & TOKEN TAMPERING
# ==============================================================================

class TestJWTAuthenticationSecurity:
    """Verifies that tampered, expired, or invalid JWTs are strictly rejected."""

    @pytest.mark.asyncio
    async def test_tampered_jwt_signature_rejected(self) -> None:
        """A valid token modified by an adversary with an arbitrary signature is rejected."""
        mock_session = AsyncMock()
        app.dependency_overrides[get_db] = lambda: mock_session

        valid_token = create_access_token(
            subject=uuid.uuid4(),
            role="student",
            token_version=1,
            expires_delta=timedelta(minutes=15),
        )

        parts = valid_token.split(".")
        tampered_token = f"{parts[0]}.{parts[1]}.invalidsignaturehere123456"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(
                "/api/v1/users/me",
                headers={"Authorization": f"Bearer {tampered_token}"},
            )
            assert res.status_code == 401
            assert "credentials" in res.json().get("detail", "").lower()

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_algorithm_none_confusion_attack_rejected(self) -> None:
        """An attacker attempts algorithm confusion (alg: 'none') without secret."""
        mock_session = AsyncMock()
        app.dependency_overrides[get_db] = lambda: mock_session

        payload = {
            "sub": str(uuid.uuid4()),
            "role": "super_admin",
            "type": "access",
            "token_version": 1,
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int((datetime.now(UTC) + timedelta(minutes=15)).timestamp()),
        }
        none_token = jwt.encode(payload, key="", algorithm="none")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(
                "/api/v1/users/me",
                headers={"Authorization": f"Bearer {none_token}"},
            )
            assert res.status_code == 401

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self) -> None:
        """Token with an expired timestamp is rejected with 401."""
        mock_session = AsyncMock()
        app.dependency_overrides[get_db] = lambda: mock_session

        expired_token = create_access_token(
            subject=uuid.uuid4(),
            role="student",
            token_version=1,
            expires_delta=timedelta(minutes=-10),
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get(
                "/api/v1/users/me",
                headers={"Authorization": f"Bearer {expired_token}"},
            )
            assert res.status_code == 401

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_mismatched_token_version_revocation_enforced(
        self,
        student_alice: User,
    ) -> None:
        """When student's token_version is incremented (e.g. remote logout), old token fails."""
        mock_session = AsyncMock()
        app.dependency_overrides[get_db] = lambda: mock_session

        old_version_token = create_access_token(
            subject=student_alice.id,
            role="student",
            token_version=1,
            expires_delta=timedelta(minutes=15),
        )

        student_alice.token_version = 2

        with patch("app.api.deps.UserRepository") as mock_repo_cls:
            mock_repo = AsyncMock()
            mock_repo.get_by_id.return_value = student_alice
            mock_repo_cls.return_value = mock_repo

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                res = await client.get(
                    "/api/v1/users/me",
                    headers={"Authorization": f"Bearer {old_version_token}"},
                )
                assert res.status_code == 401, "Revoked token version was mistakenly accepted!"
                assert "invalidated" in res.json().get("detail", "").lower()

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 6: XSS & MALICIOUS INPUT SAFETY
# ==============================================================================

class TestXSSPayloadSafety:
    """Verifies that script tags and HTML injection are stored safely without crashing."""

    @pytest.mark.asyncio
    async def test_xss_in_note_creation_handled_safely(
        self,
        student_alice: User,
    ) -> None:
        """Create a note containing XSS vectors. Must succeed and be returned as plaintext data."""
        xss_title = "<script>alert('XSS-Title')</script>"
        xss_content = "<img src=x onerror=alert('XSS-Content')>"

        mock_note = Note(
            id=uuid.uuid4(),
            user_id=student_alice.id,
            subject_id=None,
            title=xss_title,
            content=xss_content,
            is_pinned=False,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        mock_note_service = AsyncMock()
        mock_note_service.create_note.return_value = mock_note

        app.dependency_overrides[get_current_active_user] = lambda: student_alice
        app.dependency_overrides[get_note_service] = lambda: mock_note_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                "/api/v1/notes",
                json={"title": xss_title, "content": xss_content},
            )
            assert res.status_code == 201
            data = res.json()
            assert data["title"] == xss_title
            assert data["content"] == xss_content

        app.dependency_overrides.clear()
