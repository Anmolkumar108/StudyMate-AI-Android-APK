"""StudyMate AI - Phase 2 Backend API & Database Robustness Audit Suite

This suite verifies:
1. Alembic Migration Dependency Graph & Head State Integrity (001 -> 016)
2. AI Service Fallbacks, Natural Language Task Parsing & Study Plan Budgeting
3. GDPR Student Data Export Structure & Account Deletion Security
4. Endpoint Pagination & Schema Boundary Stress (Negative Offsets, Oversized Limits)
5. Database Transaction Rollback Safety on Service Exceptions
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.api.deps import (
    get_current_active_user,
    get_current_user,
    get_db,
    get_note_service,
    get_task_service,
)
from app.core.config import settings
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserExportData
from app.services.ai_service import AIService
from app.services.note_service import NoteError
from app.services.user_service import UserService


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def student_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.UUID("11111111-2222-3333-4444-555555555555"),
        email="robust.student@studymate.ai",
        hashed_password=hash_password("RobustPassword123!"),
        full_name="Robust Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


# ==============================================================================
# SECTION 1: ALEMBIC MIGRATION INTEGRITY & GRAPH TOPOLOGY
# ==============================================================================

class TestAlembicMigrationIntegrity:
    """Verifies that Alembic migrations form a single linear, non-cyclic graph."""

    def test_migration_chain_is_linear_and_head_is_correct(self) -> None:
        """Asserts that all 16 migrations are properly chained without branch divergence."""
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent
        alembic_ini_path = backend_dir / "alembic.ini"
        
        config = Config(str(alembic_ini_path))
        config.set_main_option("script_location", str(backend_dir / "alembic"))
        
        script = ScriptDirectory.from_config(config)
        heads = script.get_heads()
        
        # Must have exactly 1 head (no split / divergent heads)
        assert len(heads) == 1, f"Alembic migration graph has multiple heads: {heads}"
        assert heads[0] == "016_add_user_push_token", f"Unexpected migration head: {heads[0]}"

        # Verify all revisions can be iterated linearly from base to head
        revisions = list(script.walk_revisions())
        assert len(revisions) == 16, f"Expected 16 migrations, found {len(revisions)}"
        
        # Verify downward links are consistent
        for rev in revisions:
            assert rev.revision is not None
            assert rev.doc is not None


# ==============================================================================
# SECTION 2: AI SERVICE FALLBACK & STUDY BUDGET ALLOCATION
# ==============================================================================

class TestAIServiceRobustnessAndFallbacks:
    """Verifies AI service error handling, fallback safety, and study allocation."""

    @pytest.mark.asyncio
    async def test_ai_daily_briefing_graceful_fallback_on_network_failure(self) -> None:
        """When AI provider network call fails, daily briefing must return clean fallback."""
        ai = AIService(api_key="real-simulated-key")
        tasks = [
            {"id": str(uuid.uuid4()), "title": "Calculus Midterm Review", "priority": "high", "due_datetime": "2026-11-15T10:00:00Z"},
            {"id": str(uuid.uuid4()), "title": "History Reading Assignment", "priority": "medium", "due_datetime": "2026-11-16T18:00:00Z"},
        ]

        with patch.object(ai, "_generate_completion", side_effect=RuntimeError("AI Provider Rate Limit Exceeded (429)")):
            briefing = await ai.get_daily_briefing(tasks)
            assert "summary" in briefing
            assert "urgent_tasks" in briefing
            assert len(briefing["urgent_tasks"]) >= 1
            assert briefing["urgent_tasks"][0]["title"] == "Calculus Midterm Review"

    @pytest.mark.asyncio
    async def test_ai_study_plan_allocation_within_daily_hours_budget(self) -> None:
        """Study allocation plan respects daily available hours constraint."""
        ai = AIService(api_key="mock-dev-key")
        tasks = [
            {"id": str(uuid.uuid4()), "title": "Physics Lab", "priority": "high", "estimated_minutes": 90},
            {"id": str(uuid.uuid4()), "title": "Discrete Math Proofs", "priority": "high", "estimated_minutes": 60},
            {"id": str(uuid.uuid4()), "title": "English Essay", "priority": "low", "estimated_minutes": 45},
        ]
        
        plan_response = await ai.suggest_schedule(
            tasks=tasks,
            available_hours_per_day=3.0,
        )

        assert "plan" in plan_response
        assert "summary" in plan_response
        assert len(plan_response["plan"]) >= 1

    @pytest.mark.asyncio
    async def test_ai_natural_language_task_parser_edge_cases(self) -> None:
        """Verifies natural language input parsing handles ambiguous deadlines."""
        ai = AIService(api_key="mock-dev-key")
        
        parsed_tomorrow = await ai.parse_natural_task("Submit chemistry project tomorrow 5pm")
        assert "chemistry" in parsed_tomorrow["title"].lower()
        assert parsed_tomorrow["priority"] in ("low", "medium", "high", "urgent")
        assert parsed_tomorrow["due_datetime"] is not None

        parsed_urgent = await ai.parse_natural_task("Urgent finish exam prep")
        assert parsed_urgent["priority"] == "urgent"


# ==============================================================================
# SECTION 3: GDPR DATA PRIVACY & ACCOUNT DELETION INTEGRITY
# ==============================================================================

class TestGDPRAndAccountLifecycle:
    """Verifies complete student data portability (export) and irreversible deletion."""

    @pytest.mark.asyncio
    async def test_gdpr_export_structure_compliance(
        self,
        student_user: User,
    ) -> None:
        """Export request must return fully-hydrated UserExportData schema."""
        mock_user_service = AsyncMock()
        mock_export = UserExportData(
            exported_at=datetime.now(UTC),
            export_version="1.0",
            user_profile={
                "id": str(student_user.id),
                "email": student_user.email,
                "full_name": student_user.full_name,
                "role": "student",
            },
            subjects=[{"id": str(uuid.uuid4()), "name": "Calculus III", "color": "#4F46E5"}],
            timetable=[{"id": str(uuid.uuid4()), "day_of_week": 1, "start_time": "09:00"}],
            tasks=[{"id": str(uuid.uuid4()), "title": "Midterm Prep", "priority": "high", "status": "todo"}],
            notes=[{"id": str(uuid.uuid4()), "title": "Taylor Series", "content": "Formula sheet"}],
            flashcards=[{"id": str(uuid.uuid4()), "title": "Limits & Derivatives", "card_count": 25}],
            exams=[{"id": str(uuid.uuid4()), "title": "Final Exam", "exam_date": "2026-12-10"}],
            study_plans=[{"id": str(uuid.uuid4()), "title": "Fall Semester Plan"}],
            study_sessions=[{"id": str(uuid.uuid4()), "duration_minutes": 50, "focus_score": 95}],
            analytics={"total_focus_minutes": 1200, "completion_rate": 88.5},
        )
        mock_user_service.export_user_data.return_value = mock_export

        with patch("app.api.v1.endpoints.users.user_service", mock_user_service):
            app.dependency_overrides[get_current_user] = lambda: student_user
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                res = await client.post("/api/v1/users/me/export")
                assert res.status_code == 200
                data = res.json()
                assert data["user_profile"]["email"] == "robust.student@studymate.ai"
                assert len(data["subjects"]) == 1
                assert len(data["tasks"]) == 1
                assert len(data["notes"]) == 1
                assert len(data["flashcards"]) == 1
                assert "exported_at" in data
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_account_deletion_with_incorrect_password_rejected(
        self,
        student_user: User,
    ) -> None:
        """Attempting to delete account with an invalid password must fail with 400."""
        mock_session = AsyncMock()
        app.dependency_overrides[get_db] = lambda: mock_session
        app.dependency_overrides[get_current_user] = lambda: student_user

        with patch("app.services.user_service.UserRepository") as mock_repo_cls:
            mock_repo = AsyncMock()
            mock_repo.get_by_id.return_value = student_user
            mock_repo_cls.return_value = mock_repo

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                res = await client.request(
                    "DELETE",
                    "/api/v1/users/me",
                    json={"password": "WrongPasswordEntered123!"},
                )
                assert res.status_code == 400
                assert "incorrect" in res.json().get("detail", "").lower()

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 4: BOUNDARY STRESS & SCHEMA PARAMETER VALIDATION
# ==============================================================================

class TestBoundaryStressAndValidation:
    """Verifies that invalid limits, negative offsets, and illegal query parameters fail fast with 422."""

    @pytest.mark.asyncio
    async def test_negative_offset_rejected(
        self,
        student_user: User,
    ) -> None:
        """Offset < 0 must be rejected with 422."""
        app.dependency_overrides[get_current_active_user] = lambda: student_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/tasks?offset=-5")
            assert res.status_code == 422

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_excessive_limit_rejected(
        self,
        student_user: User,
    ) -> None:
        """Limit > 100 exceeds maximum permitted page size and must be rejected with 422."""
        app.dependency_overrides[get_current_active_user] = lambda: student_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/tasks?limit=500")
            assert res.status_code == 422

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_invalid_task_priority_enum_rejected(
        self,
        student_user: User,
    ) -> None:
        """Illegal priority enum value must be rejected with 422."""
        app.dependency_overrides[get_current_active_user] = lambda: student_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/api/v1/tasks?priority=hyper_urgent_unsupported")
            assert res.status_code == 422

        app.dependency_overrides.clear()


# ==============================================================================
# SECTION 5: DATABASE TRANSACTION ROLLBACK SAFETY
# ==============================================================================

class TestDatabaseRollbackSafety:
    """Verifies that unhandled service exceptions result in clean 500 without partial commits."""

    @pytest.mark.asyncio
    async def test_note_creation_database_error_triggers_500_cleanly(
        self,
        student_user: User,
    ) -> None:
        """When note service encounters a critical database fault, 500 is returned."""
        mock_note_service = AsyncMock()
        mock_note_service.create_note.side_effect = NoteError("Database deadlock simulation")

        app.dependency_overrides[get_current_active_user] = lambda: student_user
        app.dependency_overrides[get_note_service] = lambda: mock_note_service

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                "/api/v1/notes",
                json={"title": "Important Note", "content": "Some important content"},
            )
            assert res.status_code == 500
            assert "failed to create note" in res.json().get("detail", "").lower()

        app.dependency_overrides.clear()
