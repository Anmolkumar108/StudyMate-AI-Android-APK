import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    UserExportData,
)
from app.services.user_service import UserService


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = lambda x: None
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def test_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.uuid4(),
        email="security.student@studymate.ai",
        hashed_password=hash_password("OldPassword123!"),
        full_name="Security Test Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        daily_study_goal_minutes=120,
        theme_preference="system",
        push_notifications_enabled=True,
        token_version=1,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_change_password_success(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls, \
         patch("app.services.user_service.SessionRepository") as mock_sess_repo_cls:
        mock_user_repo = AsyncMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)
        mock_user_repo.update_password = AsyncMock()
        mock_user_repo_cls.return_value = mock_user_repo

        mock_sess_repo = AsyncMock()
        mock_sess_repo.revoke_all_user_sessions = AsyncMock()
        mock_sess_repo.create_session = AsyncMock()
        mock_sess_repo_cls.return_value = mock_sess_repo

        payload = ChangePasswordRequest(
            current_password="OldPassword123!",
            new_password="BrandNewPassword456!",
        )

        res = await service.change_password(mock_session, test_user.id, payload)
        assert "successfully" in res.message.lower()
        assert res.access_token is not None
        assert res.refresh_token is not None
        mock_user_repo.update_password.assert_awaited_once()
        mock_sess_repo.revoke_all_user_sessions.assert_awaited_once_with(test_user.id)
        mock_sess_repo.create_session.assert_awaited_once()
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_invalid_current_password(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls:
        mock_user_repo = AsyncMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)
        mock_user_repo_cls.return_value = mock_user_repo

        payload = ChangePasswordRequest(
            current_password="WrongOldPassword999!",
            new_password="BrandNewPassword456!",
        )

        with pytest.raises(HTTPException) as exc:
            await service.change_password(mock_session, test_user.id, payload)
        assert exc.value.status_code == 400
        assert "current password is incorrect" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_change_password_identical_password_rejected(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls:
        mock_user_repo = AsyncMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)
        mock_user_repo_cls.return_value = mock_user_repo

        payload = ChangePasswordRequest(
            current_password="OldPassword123!",
            new_password="OldPassword123!",
        )

        with pytest.raises(HTTPException) as exc:
            await service.change_password(mock_session, test_user.id, payload)
        assert exc.value.status_code == 400
        assert "cannot be identical" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_export_user_data(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls, \
         patch("app.services.user_service.SubjectRepository") as mock_sub_cls, \
         patch("app.services.user_service.TimetableRepository") as mock_tt_cls, \
         patch("app.services.user_service.TaskRepository") as mock_task_cls, \
         patch("app.services.user_service.NoteRepository") as mock_note_cls, \
         patch("app.services.user_service.FlashcardDeckRepository") as mock_deck_cls, \
         patch("app.services.user_service.ExamRepository") as mock_exam_cls, \
         patch("app.services.user_service.StudyPlanRepository") as mock_sp_cls, \
         patch("app.services.user_service.StudySessionRepository") as mock_ss_cls:

        mock_user_repo_cls.return_value.get_by_id = AsyncMock(return_value=test_user)
        mock_sub_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_tt_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_task_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_note_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_deck_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_exam_cls.return_value.list_by_user = AsyncMock(return_value=[])
        mock_sp_cls.return_value.list_for_user = AsyncMock(return_value=[])
        mock_ss_cls.return_value.list_for_user = AsyncMock(return_value=[])

        export = await service.export_user_data(mock_session, test_user.id)
        assert isinstance(export, UserExportData)
        assert export.user_profile["email"] == test_user.email
        assert export.export_version == "1.0"
        assert "total_focus_minutes" in export.analytics


@pytest.mark.asyncio
async def test_delete_account_success(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls, \
         patch("app.services.user_service.DocumentRepository") as mock_doc_repo_cls, \
         patch("app.services.user_service.SessionRepository") as mock_sess_repo_cls:

        mock_user_repo = AsyncMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)
        mock_user_repo_cls.return_value = mock_user_repo

        mock_doc_repo = AsyncMock()
        mock_doc_repo.list_by_user = AsyncMock(return_value=[])
        mock_doc_repo_cls.return_value = mock_doc_repo

        mock_sess_repo = AsyncMock()
        mock_sess_repo.revoke_all_user_sessions = AsyncMock()
        mock_sess_repo_cls.return_value = mock_sess_repo

        payload = DeleteAccountRequest(password="OldPassword123!", reason="Graduated")
        res = await service.delete_account(mock_session, test_user.id, payload)

        assert "deleted" in res.message.lower()
        mock_session.execute.assert_awaited_once()
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_account_wrong_password_aborted(mock_session: AsyncMock, test_user: User) -> None:
    service = UserService()

    with patch("app.services.user_service.UserRepository") as mock_user_repo_cls:
        mock_user_repo = AsyncMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)
        mock_user_repo_cls.return_value = mock_user_repo

        payload = DeleteAccountRequest(password="WrongPassword999!", reason="Testing")

        with pytest.raises(HTTPException) as exc:
            await service.delete_account(mock_session, test_user.id, payload)

        assert exc.value.status_code == 400
        assert "incorrect password" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_users_api_endpoints(test_user: User) -> None:
    """Verifies FastAPI router integration for /api/v1/users/me/*"""
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[get_db] = lambda: AsyncMock()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. GET /api/v1/users/me
        get_res = await ac.get("/api/v1/users/me")
        assert get_res.status_code == 200
        assert get_res.json()["email"] == test_user.email

        # 2. POST /api/v1/users/me/change-password
        with patch.object(UserService, "change_password", return_value={"message": "Password updated successfully with Argon2id encryption."}):
            ch_res = await ac.post(
                "/api/v1/users/me/change-password",
                json={"current_password": "OldPassword123!", "new_password": "NewPassword123!"},
            )
            assert ch_res.status_code == 200
            assert "updated" in ch_res.json()["message"]

        # 3. POST /api/v1/users/me/export
        dummy_export = UserExportData(
            exported_at=datetime.now(UTC),
            export_version="1.0",
            user_profile={"id": str(test_user.id), "email": test_user.email},
            subjects=[],
            timetable=[],
            tasks=[],
            notes=[],
            flashcards=[],
            exams=[],
            study_plans=[],
            study_sessions=[],
            analytics={"total_focus_minutes": 0},
        )
        with patch.object(UserService, "export_user_data", return_value=dummy_export):
            exp_res = await ac.post("/api/v1/users/me/export")
            assert exp_res.status_code == 200
            assert exp_res.json()["export_version"] == "1.0"

        # 4. DELETE /api/v1/users/me
        with patch.object(UserService, "delete_account", return_value={"message": "Account deleted."}):
            del_res = await ac.request("DELETE", "/api/v1/users/me", json={"password": "OldPassword123!"})
            assert del_res.status_code == 200
            assert "deleted" in del_res.json()["message"]

    app.dependency_overrides.clear()
