import logging
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.session import UserSession
from app.models.user import User
from app.repositories.document_repo import DocumentRepository
from app.repositories.exam_repo import ExamRepository
from app.repositories.flashcard_repo import FlashcardDeckRepository
from app.repositories.note_repo import NoteRepository
from app.repositories.session_repo import SessionRepository
from app.repositories.study_plan_repo import StudyPlanRepository
from app.repositories.study_session_repo import StudySessionRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.timetable_repo import TimetableRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    DeleteAccountRequest,
    UserExportData,
)

logger = logging.getLogger("app.user_service")


class UserService:
    async def change_password(
        self,
        db: AsyncSession,
        user_id: UUID,
        payload: ChangePasswordRequest,
    ) -> ChangePasswordResponse:
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        if payload.current_password == payload.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be identical to the current password.",
            )

        if len(payload.new_password) < 8 or len(payload.new_password) > 128:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="New password must be between 8 and 128 characters long.",
            )

        new_hash = hash_password(payload.new_password)
        await user_repo.update_password(user_id, new_hash)

        # Invalidate all active refresh token sessions across devices
        session_repo = SessionRepository(db)
        await session_repo.revoke_all_user_sessions(user_id)

        # Fetch fresh user model to get updated token_version
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        now = datetime.now(UTC)
        new_access_token = create_access_token(
            subject=user.id,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            token_version=user.token_version,
        )
        new_refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(new_refresh_token)
        session_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        new_session = UserSession(
            user_id=user.id,
            refresh_token_hash=token_hash,
            device_name="Android Mobile",
            device_os="Android",
            expires_at=session_expires,
        )
        await session_repo.create_session(new_session)
        await db.commit()

        logger.info("Password successfully changed for user %s. New session issued.", user_id)

        return ChangePasswordResponse(
            message="Password updated successfully with Argon2id encryption.",
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
        )

    async def export_user_data(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> UserExportData:
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Gather all student entities defensively
        subjects_seq = await SubjectRepository(db).list_by_user(user_id)
        timetable_seq = await TimetableRepository(db).list_by_user(user_id)
        tasks_seq = await TaskRepository(db).list_by_user(user_id, limit=500)
        notes_seq = await NoteRepository(db).list_by_user(user_id, limit=500)
        decks_seq = await FlashcardDeckRepository(db).list_by_user(user_id, limit=500)
        exams_seq = await ExamRepository(db).list_by_user(user_id)
        study_plans_seq = await StudyPlanRepository(db).list_for_user(user_id, limit=100)
        study_sessions_seq = await StudySessionRepository(db).list_for_user(user_id, limit=500)

        # Build clean JSON-serializable dictionaries
        user_profile = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "status": user.status.value if hasattr(user.status, "value") else str(user.status),
            "institution": user.institution,
            "major": user.major,
            "graduation_year": user.graduation_year,
            "daily_study_goal_minutes": user.daily_study_goal_minutes,
            "theme_preference": user.theme_preference,
            "push_notifications_enabled": user.push_notifications_enabled,
            "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
            "last_login_at": user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
        }

        subjects_data = [
            {
                "id": str(s.id),
                "name": s.name,
                "code": getattr(s, "code", None),
                "description": getattr(s, "description", None),
                "semester": getattr(s, "semester", None),
                "color": getattr(s, "color", None),
                "created_at": s.created_at.isoformat() if getattr(s, "created_at", None) else None,
            }
            for s in subjects_seq
        ]

        timetable_data = [
            {
                "id": str(t.id),
                "day_of_week": t.day_of_week,
                "start_time": str(t.start_time),
                "end_time": str(t.end_time),
                "room": t.room,
                "professor": t.professor,
                "is_online": t.is_online,
            }
            for t in timetable_seq
        ]

        tasks_data = [
            {
                "id": str(tk.id),
                "title": tk.title,
                "description": getattr(tk, "description", None),
                "priority": tk.priority.value if hasattr(getattr(tk, "priority", None), "value") else str(getattr(tk, "priority", "medium")),
                "status": tk.status.value if hasattr(getattr(tk, "status", None), "value") else str(getattr(tk, "status", "todo")),
                "due_date": (getattr(tk, "due_datetime", None) or getattr(tk, "due_date", None)).isoformat() if (getattr(tk, "due_datetime", None) or getattr(tk, "due_date", None)) else None,
                "created_at": tk.created_at.isoformat() if getattr(tk, "created_at", None) else None,
            }
            for tk in tasks_seq
        ]

        notes_data = [
            {
                "id": str(n.id),
                "title": n.title,
                "content": n.content,
                "subject_id": str(n.subject_id) if getattr(n, "subject_id", None) else None,
                "is_pinned": getattr(n, "is_pinned", False),
                "created_at": n.created_at.isoformat() if getattr(n, "created_at", None) else None,
            }
            for n in notes_seq
        ]

        decks_data = []
        for item in decks_seq:
            if hasattr(item, "__getitem__"):
                deck_obj = item[0]
                card_count = item[1] if len(item) > 1 else 0
            else:
                deck_obj = item
                card_count = 0
            decks_data.append({
                "id": str(getattr(deck_obj, "id", "")),
                "title": getattr(deck_obj, "title", "Untitled Deck"),
                "description": getattr(deck_obj, "description", None),
                "card_count": int(card_count) if card_count else 0,
                "created_at": deck_obj.created_at.isoformat() if getattr(deck_obj, "created_at", None) else None,
            })

        exams_data = [
            {
                "id": str(e.id),
                "title": e.title,
                "exam_date": e.exam_date.isoformat() if getattr(e, "exam_date", None) else None,
                "location": getattr(e, "location", None),
                "target_score": getattr(e, "target_score", None),
                "achieved_score": getattr(e, "achieved_score", None),
            }
            for e in exams_seq
        ]

        plans_data = [
            {
                "id": str(p.id),
                "plan_date": p.plan_date.isoformat() if getattr(p, "plan_date", None) else None,
                "target_study_minutes": getattr(p, "target_study_minutes", 180),
                "planned_minutes": getattr(p, "planned_minutes", 0),
                "completed_minutes": getattr(p, "completed_minutes", 0),
                "blocks_count": len(getattr(p, "timeblocks", [])) if getattr(p, "timeblocks", None) else 0,
            }
            for p in study_plans_seq
        ]

        sessions_data = [
            {
                "id": str(ss.id),
                "duration_minutes": getattr(ss, "duration_minutes", 0),
                "completed": getattr(ss, "completed_successfully", True),
                "session_type": getattr(ss, "session_type", "focus"),
                "created_at": ss.created_at.isoformat() if getattr(ss, "created_at", None) else None,
            }
            for ss in study_sessions_seq
        ]

        total_focus = sum(
            getattr(s, "duration_minutes", 0)
            for s in study_sessions_seq
            if getattr(s, "completed_successfully", False) or getattr(s, "completed", False)
        )

        analytics_summary = {
            "total_focus_minutes": total_focus,
            "total_subjects": len(subjects_data),
            "total_notes": len(notes_data),
            "total_tasks": len(tasks_data),
            "total_decks": len(decks_data),
            "total_exams": len(exams_data),
        }

        return UserExportData(
            exported_at=datetime.now(UTC),
            export_version="1.0",
            user_profile=user_profile,
            subjects=subjects_data,
            timetable=timetable_data,
            tasks=tasks_data,
            notes=notes_data,
            flashcards=decks_data,
            exams=exams_data,
            study_plans=plans_data,
            study_sessions=sessions_data,
            analytics=analytics_summary,
        )

    async def delete_account(
        self,
        db: AsyncSession,
        user_id: UUID,
        payload: DeleteAccountRequest,
    ) -> MessageResponse:
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password. Account deletion was aborted.",
            )

        # Cleanup local document files on disk if any
        try:
            doc_repo = DocumentRepository(db)
            docs = await doc_repo.list_by_user(user_id)
            for d in docs:
                if d.storage_path and os.path.exists(d.storage_path):
                    try:
                        os.remove(d.storage_path)
                    except OSError:
                        pass
        except Exception as e:
            logger.warning("Error cleaning up document files during user deletion: %s", e)

        # Revoke all active sessions
        try:
            session_repo = SessionRepository(db)
            await session_repo.revoke_all_user_sessions(user_id)
        except Exception as e:
            logger.warning("Error revoking sessions during user deletion: %s", e)

        # Delete user record using direct SQL DELETE to cleanly trigger PostgreSQL ON DELETE CASCADE
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()

        logger.info("Account permanently deleted for user %s (Reason: %s)", user_id, payload.reason)

        return MessageResponse(
            message="Your account and all associated study data have been permanently deleted."
        )


user_service = UserService()
