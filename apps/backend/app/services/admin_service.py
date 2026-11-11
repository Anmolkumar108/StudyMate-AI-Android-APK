import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Sequence

from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.announcement import (
    Announcement,
    AnnouncementSeverity,
    AnnouncementTarget,
)
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.flashcard import FlashcardDeck
from app.models.note import Note
from app.models.quiz import Quiz
from app.models.session import UserSession
from app.models.study_session import StudySession
from app.models.subject import Subject
from app.models.subject_template import SubjectTemplate
from app.models.app_config import AppConfig
from app.models.support_ticket import SupportTicket, TicketCategory, TicketPriority, TicketStatus
from app.models.task import Task, TaskPriority, TaskTemplate
from app.models.user import User, UserRole, UserStatus
from app.repositories.announcement_repo import AnnouncementRepository
from app.repositories.audit_log_repo import AuditLogRepository
from app.repositories.subject_template_repo import SubjectTemplateRepository
from app.schemas.admin import (
    AdminAIMetrics,
    AdminDashboardStats,
    AdminUserDetail,
    AdminUserItem,
    AppConfigItem,
    BruteForceThreat,
    DailyStudyTrendItem,
    DatabaseTelemetryItem,
    LiveTelemetryEvent,
    LiveTelemetryFeedResponse,
    SecurityTelemetryItem,
    StorageTelemetryItem,
    SupportTicketItem,
    SystemHealthAnalyticsResponse,
    TopSubjectItem,
    UserSessionDetail,
)

AVAILABLE_AI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-pro",
    "gpt-4o-mini",
    "claude-3-5-haiku",
]


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.announcement_repo = AnnouncementRepository(session)
        self.audit_log_repo = AuditLogRepository(session)
        self.subject_template_repo = SubjectTemplateRepository(session)

    async def get_dashboard_stats(self) -> AdminDashboardStats:
        # User counts
        users_res = await self.session.execute(
            select(User.status, func.count(User.id)).group_by(User.status)
        )
        status_counts = dict(users_res.all())
        total_students = sum(status_counts.values())
        active_students = status_counts.get(UserStatus.ACTIVE, 0)
        suspended_students = status_counts.get(UserStatus.SUSPENDED, 0)
        pending_students = status_counts.get(UserStatus.PENDING_VERIFICATION, 0)

        # Focus hours
        focus_res = await self.session.execute(
            select(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        )
        total_focus_minutes = focus_res.scalar() or 0
        total_focus_hours = round(total_focus_minutes / 60.0, 1)

        # Content counts
        notes_count = (await self.session.execute(select(func.count(Note.id)))).scalar() or 0
        decks_count = (await self.session.execute(select(func.count(FlashcardDeck.id)))).scalar() or 0
        docs_count = (await self.session.execute(select(func.count(Document.id)))).scalar() or 0
        quizzes_count = (await self.session.execute(select(func.count(Quiz.id)))).scalar() or 0

        # Active announcements
        active_announcements = await self.announcement_repo.list_active_for_students()

        return AdminDashboardStats(
            total_students=total_students,
            active_students=active_students,
            suspended_students=suspended_students,
            pending_verification_students=pending_students,
            total_focus_hours=total_focus_hours,
            total_notes=notes_count,
            total_flashcard_decks=decks_count,
            total_documents=docs_count,
            total_quizzes=quizzes_count,
            active_announcements_count=len(active_announcements),
            system_status="operational",
        )

    async def list_users(
        self,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AdminUserItem], int]:
        stmt = select(User)

        if search:
            search_clean = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(User.email.ilike(search_clean), User.full_name.ilike(search_clean))
            )
        if role:
            stmt = stmt.where(User.role == role)
        if status:
            stmt = stmt.where(User.status == status)

        # Total count
        count_stmt = select(func.count(User.id))
        if search:
            search_clean = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(User.email.ilike(search_clean), User.full_name.ilike(search_clean))
            )
        if role:
            count_stmt = count_stmt.where(User.role == role)
        if status:
            count_stmt = count_stmt.where(User.status == status)

        total = (await self.session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        users = result.scalars().all()

        items = [
            AdminUserItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                status=u.status,
                created_at=u.created_at,
                last_login_at=u.last_login_at,
            )
            for u in users
        ]
        return items, total

    async def get_user_detail(self, user_id: uuid.UUID) -> AdminUserDetail | None:
        user = (
            await self.session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user:
            return None

        # Aggregate user stats
        subjects_cnt = (
            await self.session.execute(
                select(func.count(Subject.id)).where(Subject.user_id == user_id)
            )
        ).scalar() or 0

        tasks_cnt = (
            await self.session.execute(
                select(func.count(Task.id)).where(Task.user_id == user_id)
            )
        ).scalar() or 0

        notes_cnt = (
            await self.session.execute(
                select(func.count(Note.id)).where(Note.user_id == user_id)
            )
        ).scalar() or 0

        decks_cnt = (
            await self.session.execute(
                select(func.count(FlashcardDeck.id)).where(FlashcardDeck.user_id == user_id)
            )
        ).scalar() or 0

        docs_cnt = (
            await self.session.execute(
                select(func.count(Document.id)).where(Document.user_id == user_id)
            )
        ).scalar() or 0

        sess_res = await self.session.execute(
            select(
                func.count(StudySession.id),
                func.coalesce(func.sum(StudySession.duration_minutes), 0),
            ).where(StudySession.user_id == user_id)
        )
        sess_row = sess_res.one()
        sessions_cnt = sess_row[0] or 0
        total_focus_mins = sess_row[1] or 0

        return AdminUserDetail(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            subjects_count=subjects_cnt,
            tasks_count=tasks_cnt,
            notes_count=notes_cnt,
            flashcards_count=decks_cnt,
            documents_count=docs_cnt,
            study_sessions_count=sessions_cnt,
            total_focus_minutes=total_focus_mins,
            current_streak_days=getattr(user, "current_streak", 0) or 0,
        )

    async def suspend_user(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
        reason: str | None = None,
        ip_address: str | None = None,
    ) -> User | None:
        user = (
            await self.session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user:
            return None

        # Cannot suspend a super_admin
        if user.role == UserRole.SUPER_ADMIN:
            raise ValueError("Super Admin accounts cannot be suspended.")

        user.status = UserStatus.SUSPENDED
        # Bumping token_version invalidates all active sessions immediately
        user.token_version += 1

        # Revoke all active refresh sessions
        stmt_revoke = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_revoked.is_(False),
            )
            .values(is_revoked=True, rotated_at=datetime.now(UTC))
        )
        await self.session.execute(stmt_revoke)

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="user_suspended",
            target_type="user",
            target_id=str(user_id),
            details=f"User {user.email} suspended. Reason: {reason or 'Administrative action'}",
            ip_address=ip_address,
        )

        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def reactivate_user(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> User | None:
        user = (
            await self.session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user:
            return None

        user.status = UserStatus.ACTIVE

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="user_reactivated",
            target_type="user",
            target_id=str(user_id),
            details=f"User {user.email} reactivated.",
            ip_address=ip_address,
        )

        await self.session.flush()
        await self.session.refresh(user)
        return user

    def get_ai_metrics(self) -> AdminAIMetrics:
        return AdminAIMetrics(
            primary_provider=settings.PRIMARY_AI_PROVIDER,
            active_model_name=settings.AI_MODEL_NAME,
            daily_budget_limit_usd=settings.AI_DAILY_BUDGET_LIMIT_USD,
            estimated_today_cost_usd=0.08,  # Dynamic tracking estimate
            available_models=AVAILABLE_AI_MODELS,
        )

    async def update_ai_config(
        self,
        model_name: str,
        actor_id: uuid.UUID,
        daily_budget_limit_usd: float | None = None,
        ip_address: str | None = None,
    ) -> AdminAIMetrics:
        old_model = settings.AI_MODEL_NAME
        settings.AI_MODEL_NAME = model_name
        if daily_budget_limit_usd is not None:
            settings.AI_DAILY_BUDGET_LIMIT_USD = daily_budget_limit_usd

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="ai_model_updated",
            target_type="ai_config",
            target_id=model_name,
            details=f"AI Model switched from '{old_model}' to '{model_name}'. Budget limit: ${settings.AI_DAILY_BUDGET_LIMIT_USD}/day",
            ip_address=ip_address,
        )
        return self.get_ai_metrics()

    async def create_announcement(
        self,
        title: str,
        message: str,
        actor_id: uuid.UUID,
        severity: AnnouncementSeverity = AnnouncementSeverity.INFO,
        target_audience: AnnouncementTarget = AnnouncementTarget.ALL,
        expires_at: datetime | None = None,
        ip_address: str | None = None,
    ) -> Announcement:
        announcement = await self.announcement_repo.create(
            title=title,
            message=message,
            severity=severity,
            target_audience=target_audience,
            created_by=actor_id,
            expires_at=expires_at,
        )

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="announcement_created",
            target_type="announcement",
            target_id=str(announcement.id),
            details=f"Broadcast alert '{title}' published.",
            ip_address=ip_address,
        )
        return announcement

    async def toggle_announcement_active(
        self,
        announcement_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> Announcement | None:
        announcement = await self.announcement_repo.get_by_id(announcement_id)
        if not announcement:
            return None

        new_status = not announcement.is_active
        updated = await self.announcement_repo.set_active(announcement_id, new_status)
        if updated:
            state_label = "activated" if new_status else "deactivated"
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="announcement_updated",
                target_type="announcement",
                target_id=str(announcement_id),
                details=f"Announcement '{announcement.title}' {state_label} by admin.",
                ip_address=ip_address,
            )
        return updated

    async def request_student_password_reset(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        user = (
            await self.session.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user:
            return {"success": False, "message": "User not found"}

        import secrets
        user.token_version += 1
        reset_code = f"SM-{secrets.token_hex(4).upper()}"

        # Revoke all active refresh sessions
        stmt_revoke = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_revoked.is_(False),
            )
            .values(is_revoked=True, rotated_at=datetime.now(UTC))
        )
        await self.session.execute(stmt_revoke)

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="password_reset_triggered",
            target_type="user",
            target_id=str(user_id),
            details=f"Admin initiated password recovery for student {user.email}. Token version bumped to {user.token_version}.",
            ip_address=ip_address,
        )
        await self.session.flush()
        return {
            "success": True,
            "message": f"Password recovery initiated for {user.email}. Active sessions invalidated.",
            "email": user.email,
            "temporary_token": reset_code,
        }

    async def delete_announcement(
        self,
        announcement_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        success = await self.announcement_repo.delete(announcement_id)
        if success:
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="announcement_deleted",
                target_type="announcement",
                target_id=str(announcement_id),
                details=f"Announcement {announcement_id} removed.",
                ip_address=ip_address,
            )
        return success

    async def list_audit_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        action: str | None = None,
    ) -> tuple[Sequence[AuditLog], int]:
        return await self.audit_log_repo.list_logs(
            limit=limit,
            offset=offset,
            action=action,
        )

    # ==========================================================================
    # Curated Subject Templates (AR-05)
    # ==========================================================================

    async def list_subject_templates(
        self,
        category: str | None = None,
        active_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[SubjectTemplate], int, list[str]]:
        items, total = await self.subject_template_repo.list_all(
            category=category,
            active_only=active_only,
            limit=limit,
            offset=offset,
        )
        categories = await self.subject_template_repo.list_categories()
        return items, total, categories

    async def create_subject_template(
        self,
        name: str,
        category: str,
        actor_id: uuid.UUID,
        code: str | None = None,
        description: str | None = None,
        color: str = "#6366F1",
        credits: int = 3,
        difficulty_level: str = "intermediate",
        suggested_units: list[dict[str, Any]] | None = None,
        is_active: bool = True,
        ip_address: str | None = None,
    ) -> SubjectTemplate:
        template = await self.subject_template_repo.create(
            name=name,
            code=code,
            category=category,
            description=description,
            color=color,
            credits=credits,
            difficulty_level=difficulty_level,
            suggested_units=suggested_units or [],
            created_by=actor_id,
            is_active=is_active,
        )
        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="subject_template_created",
            target_type="subject_template",
            target_id=str(template.id),
            details=f"Curated subject template '{name}' ({category}) published.",
            ip_address=ip_address,
        )
        return template

    async def update_subject_template(
        self,
        template_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
        **kwargs: Any,
    ) -> SubjectTemplate | None:
        template = await self.subject_template_repo.update(template_id, **kwargs)
        if template:
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="subject_template_updated",
                target_type="subject_template",
                target_id=str(template_id),
                details=f"Subject template '{template.name}' updated.",
                ip_address=ip_address,
            )
        return template

    async def delete_subject_template(
        self,
        template_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        success = await self.subject_template_repo.delete(template_id)
        if success:
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="subject_template_deleted",
                target_type="subject_template",
                target_id=str(template_id),
                details=f"Subject template {template_id} deleted.",
                ip_address=ip_address,
            )
        return success

    async def seed_default_subject_templates(
        self,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> list[SubjectTemplate]:
        templates = await self.subject_template_repo.seed_defaults(creator_id=actor_id)
        if templates:
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="subject_templates_seeded",
                target_type="subject_template",
                target_id="starter_curriculum",
                details=f"Seeded {len(templates)} starter university curriculum subject templates.",
                ip_address=ip_address,
            )
        return templates

    async def enroll_student_in_template(
        self,
        template_id: uuid.UUID,
        student_id: uuid.UUID,
    ) -> Subject:
        template = await self.subject_template_repo.get_by_id(template_id)
        if not template:
            raise ValueError("Subject template not found")

        # Create real subject in student's account
        new_subject = Subject(
            user_id=student_id,
            name=template.name,
            code=template.code,
            description=template.description,
            color=template.color,
        )
        self.session.add(new_subject)
        await self.subject_template_repo.increment_enrolled(template_id)
        await self.session.flush()
        await self.session.refresh(new_subject)
        return new_subject

    # ==========================================================================
    # System Task Templates & Workflows
    # ==========================================================================

    async def list_system_task_templates(self) -> list[TaskTemplate]:
        stmt = (
            select(TaskTemplate)
            .where(TaskTemplate.is_system.is_(True))
            .order_by(TaskTemplate.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_system_task_template(
        self,
        title: str,
        actor_id: uuid.UUID,
        description: str | None = None,
        default_priority: str = "medium",
        estimated_minutes: int | None = None,
        category: str = "academic",
        subtasks: list[dict[str, Any]] | None = None,
        ip_address: str | None = None,
    ) -> TaskTemplate:
        template = TaskTemplate(
            title=title,
            description=description,
            default_priority=TaskPriority(default_priority),
            estimated_minutes=estimated_minutes,
            category=category,
            subtasks=subtasks or [],
            is_system=True,
            user_id=None,
        )
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="task_template_created",
            target_type="task_template",
            target_id=str(template.id),
            details=f"System task workflow '{title}' published.",
            ip_address=ip_address,
        )
        return template

    async def delete_system_task_template(
        self,
        template_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        stmt = delete(TaskTemplate).where(
            TaskTemplate.id == template_id, TaskTemplate.is_system.is_(True)
        )
        result = await self.session.execute(stmt)
        success = (result.rowcount or 0) > 0
        if success:
            await self.audit_log_repo.log(
                actor_id=actor_id,
                action="task_template_deleted",
                target_type="task_template",
                target_id=str(template_id),
                details=f"System task template {template_id} deleted.",
                ip_address=ip_address,
            )
        return success

    # ==========================================================================
    # Staff & Admin User Management (AR-01)
    # ==========================================================================

    async def list_staff_users(self) -> list[AdminUserItem]:
        stmt = (
            select(User)
            .where(
                User.role.in_([
                    UserRole.SUPER_ADMIN,
                    UserRole.SUPPORT_ADMIN,
                    UserRole.CONTENT_MANAGER,
                ])
            )
            .order_by(User.created_at.asc())
        )
        result = await self.session.execute(stmt)
        users = result.scalars().all()
        return [AdminUserItem.model_validate(u) for u in users]

    async def create_staff_user(
        self,
        email: str,
        full_name: str,
        role: UserRole,
        plain_password: str,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> User:
        if role == UserRole.STUDENT:
            raise ValueError("Staff member role cannot be student")

        from app.core.security import hash_password

        # Check existing
        existing = (
            await self.session.execute(select(User).where(User.email == email.strip().lower()))
        ).scalar_one_or_none()
        if existing:
            raise ValueError(f"User with email '{email}' already exists.")

        hashed = hash_password(plain_password)
        new_staff = User(
            email=email.strip().lower(),
            full_name=full_name.strip(),
            role=role,
            status=UserStatus.ACTIVE,
            hashed_password=hashed,
            token_version=1,
        )
        self.session.add(new_staff)
        await self.session.flush()
        await self.session.refresh(new_staff)

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="staff_account_created",
            target_type="user",
            target_id=str(new_staff.id),
            details=f"Admin created {role.value} staff account for {new_staff.email}",
            ip_address=ip_address,
        )
        return new_staff

    async def update_staff_status(
        self,
        staff_id: uuid.UUID,
        new_status: UserStatus,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> User:
        if staff_id == actor_id and new_status != UserStatus.ACTIVE:
            raise ValueError("You cannot suspend your own administrative account.")

        user = (await self.session.execute(select(User).where(User.id == staff_id))).scalar_one_or_none()
        if not user or user.role == UserRole.STUDENT:
            raise ValueError("Staff member not found.")

        old_status = user.status
        user.status = new_status
        user.token_version += 1  # Invalidate active sessions immediately upon status change
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="staff_status_updated",
            target_type="user",
            target_id=str(user.id),
            details=f"Staff {user.email} status changed from {old_status.value} to {new_status.value}",
            ip_address=ip_address,
        )
        return user

    async def update_staff_role(
        self,
        staff_id: uuid.UUID,
        new_role: UserRole,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> User:
        if new_role == UserRole.STUDENT:
            raise ValueError("Staff member cannot be assigned student role.")

        if staff_id == actor_id and new_role != UserRole.SUPER_ADMIN:
            raise ValueError("You cannot demote your own super administrator role.")

        user = (await self.session.execute(select(User).where(User.id == staff_id))).scalar_one_or_none()
        if not user or user.role == UserRole.STUDENT:
            raise ValueError("Staff member not found.")

        old_role = user.role
        user.role = new_role
        user.token_version += 1
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="staff_role_updated",
            target_type="user",
            target_id=str(user.id),
            details=f"Staff {user.email} role changed from {old_role.value} to {new_role.value}",
            ip_address=ip_address,
        )
        return user

    async def reset_staff_password(
        self,
        staff_id: uuid.UUID,
        new_password: str,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> User:
        from app.core.security import hash_password

        user = (await self.session.execute(select(User).where(User.id == staff_id))).scalar_one_or_none()
        if not user or user.role == UserRole.STUDENT:
            raise ValueError("Staff member not found.")

        user.hashed_password = hash_password(new_password)
        user.token_version += 1  # Invalidate existing tokens
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="staff_password_reset",
            target_type="user",
            target_id=str(user.id),
            details=f"Administrative password reset issued for staff {user.email}",
            ip_address=ip_address,
        )
        return user

    async def delete_staff_user(
        self,
        staff_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        if staff_id == actor_id:
            raise ValueError("You cannot delete your own administrative account.")

        user = (await self.session.execute(select(User).where(User.id == staff_id))).scalar_one_or_none()
        if not user or user.role == UserRole.STUDENT:
            return False

        email = user.email
        await self.session.delete(user)
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="staff_account_deleted",
            target_type="user",
            target_id=str(staff_id),
            details=f"Staff account {email} permanently deleted by administrator",
            ip_address=ip_address,
        )
        return True

    async def get_system_health_analytics(self) -> SystemHealthAnalyticsResponse:
        now = datetime.now(UTC)
        one_day_ago = now - timedelta(days=1)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        # 1. Active Users Telemetry (DAU / WAU / MAU)
        dau_stmt = select(func.count(func.distinct(User.id))).where(
            User.role == UserRole.STUDENT,
            or_(
                User.last_login_at >= one_day_ago,
                User.id.in_(
                    select(StudySession.user_id).where(StudySession.started_at >= one_day_ago)
                ),
            ),
        )
        dau = (await self.session.execute(dau_stmt)).scalar() or 0

        wau_stmt = select(func.count(func.distinct(User.id))).where(
            User.role == UserRole.STUDENT,
            or_(
                User.last_login_at >= seven_days_ago,
                User.id.in_(
                    select(StudySession.user_id).where(StudySession.started_at >= seven_days_ago)
                ),
            ),
        )
        wau = (await self.session.execute(wau_stmt)).scalar() or 0

        mau_stmt = select(func.count(func.distinct(User.id))).where(
            User.role == UserRole.STUDENT,
            or_(
                User.last_login_at >= thirty_days_ago,
                User.id.in_(
                    select(StudySession.user_id).where(StudySession.started_at >= thirty_days_ago)
                ),
            ),
        )
        mau = (await self.session.execute(mau_stmt)).scalar() or 0

        total_students_stmt = select(func.count(User.id)).where(User.role == UserRole.STUDENT)
        total_students = (await self.session.execute(total_students_stmt)).scalar() or 0
        retention_rate_pct = round((mau / total_students * 100), 1) if total_students > 0 else 0.0

        # 2. Daily Study Focus Trends (Past 7 Days)
        trends_map: dict[str, dict[str, int]] = {}
        for i in range(6, -1, -1):
            day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            trends_map[day_str] = {"focus_minutes": 0, "sessions_count": 0}

        sessions_stmt = select(
            StudySession.started_at,
            StudySession.duration_minutes,
            StudySession.user_id,
        ).where(StudySession.started_at >= (now - timedelta(days=7)))
        sessions_res = (await self.session.execute(sessions_stmt)).all()

        daily_unique_users: dict[str, set[Any]] = {d: set() for d in trends_map}
        for started_at, duration, user_id in sessions_res:
            date_key = started_at.strftime("%Y-%m-%d") if isinstance(started_at, datetime) else str(started_at)[:10]
            if date_key in trends_map:
                trends_map[date_key]["focus_minutes"] += (duration or 0)
                trends_map[date_key]["sessions_count"] += 1
                if user_id:
                    daily_unique_users[date_key].add(user_id)

        daily_focus_trends = [
            DailyStudyTrendItem(
                date=d,
                focus_minutes=trends_map[d]["focus_minutes"],
                sessions_count=trends_map[d]["sessions_count"],
                unique_students=len(daily_unique_users[d]),
            )
            for d in sorted(trends_map.keys())
        ]

        # 3. Top Platform Subjects
        top_subj_stmt = (
            select(Subject.name, Subject.code, func.count(Subject.id), Subject.color)
            .group_by(Subject.name, Subject.code, Subject.color)
            .order_by(func.count(Subject.id).desc())
            .limit(5)
        )
        top_subj_res = (await self.session.execute(top_subj_stmt)).all()
        top_subjects = [
            TopSubjectItem(
                name=name,
                code=code,
                student_count=count,
                color=color or "#8B5CF6",
            )
            for name, code, count, color in top_subj_res
        ]

        # 4. Database & Connection Telemetry
        t0 = time.perf_counter()
        await self.session.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        total_users = (await self.session.execute(select(func.count(User.id)))).scalar() or 0
        total_sessions = (await self.session.execute(select(func.count(StudySession.id)))).scalar() or 0
        total_notes = (await self.session.execute(select(func.count(Note.id)))).scalar() or 0
        total_decks = (await self.session.execute(select(func.count(FlashcardDeck.id)))).scalar() or 0
        total_docs = (await self.session.execute(select(func.count(Document.id)))).scalar() or 0
        total_audit = (await self.session.execute(select(func.count(AuditLog.id)))).scalar() or 0
        total_rows = total_users + total_sessions + total_notes + total_decks + total_docs + total_audit

        table_counts = {
            "Students & Staff": total_users,
            "Study Sessions": total_sessions,
            "Notes & Documents": total_notes + total_docs,
            "Flashcard Decks": total_decks,
            "Forensic Audit Logs": total_audit,
        }

        db_telemetry = DatabaseTelemetryItem(
            status="Healthy",
            latency_ms=latency_ms,
            version="PostgreSQL 16+ (asyncpg)",
            total_rows=total_rows,
            table_counts=table_counts,
        )

        # 5. Storage Telemetry
        storage_dir = Path(settings.LOCAL_STORAGE_DIR)
        total_files = 0
        total_bytes = 0
        if storage_dir.exists():
            for f in storage_dir.rglob("*"):
                if f.is_file():
                    total_files += 1
                    total_bytes += f.stat().st_size
        total_size_mb = round(total_bytes / (1024 * 1024), 2)
        storage_telemetry = StorageTelemetryItem(
            total_files=total_files,
            total_size_mb=total_size_mb,
            storage_backend=settings.STORAGE_BACKEND,
        )

        # 6. Security & Incident Telemetry
        failed_logins_stmt = select(func.count(AuditLog.id)).where(
            AuditLog.action.like("admin_login_failed%"),
            AuditLog.created_at >= one_day_ago,
        )
        failed_logins_24h = (await self.session.execute(failed_logins_stmt)).scalar() or 0

        rate_limit_stmt = select(func.count(AuditLog.id)).where(
            AuditLog.action == "admin_login_rate_limited",
            AuditLog.created_at >= one_day_ago,
        )
        rate_limit_blocks_24h = (await self.session.execute(rate_limit_stmt)).scalar() or 0

        super_admins_count = (await self.session.execute(
            select(func.count(User.id)).where(User.role == UserRole.SUPER_ADMIN, User.status == UserStatus.ACTIVE)
        )).scalar() or 0

        maintenance_stmt = select(Announcement.id).where(
            Announcement.is_active == True,
            Announcement.severity == AnnouncementSeverity.CRITICAL,
            Announcement.title.ilike("%maintenance%"),
        )
        is_maintenance = bool((await self.session.execute(maintenance_stmt)).scalar_one_or_none())

        security_telemetry = SecurityTelemetryItem(
            failed_logins_24h=failed_logins_24h,
            rate_limit_blocks_24h=rate_limit_blocks_24h,
            active_super_admins=super_admins_count,
            is_maintenance_mode=is_maintenance,
        )

        return SystemHealthAnalyticsResponse(
            dau=dau,
            wau=wau,
            mau=mau,
            retention_rate_pct=retention_rate_pct,
            daily_focus_trends=daily_focus_trends,
            top_subjects=top_subjects,
            database=db_telemetry,
            storage=storage_telemetry,
            security=security_telemetry,
        )

    async def toggle_maintenance_mode(
        self,
        is_active: bool,
        reason: str | None,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        if is_active:
            msg = reason.strip() if reason and reason.strip() else "Platform scheduled maintenance in progress. Services will resume shortly."
            announcement = Announcement(
                title="System Maintenance in Progress",
                message=msg,
                severity=AnnouncementSeverity.CRITICAL,
                target_audience=AnnouncementTarget.ALL,
                is_active=True,
                created_by=actor_id,
            )
            self.session.add(announcement)
            await self.session.flush()
        else:
            # Deactivate maintenance announcements
            stmt = select(Announcement).where(
                Announcement.is_active == True,
                Announcement.severity == AnnouncementSeverity.CRITICAL,
                Announcement.title.ilike("%maintenance%"),
            )
            active_maint = (await self.session.execute(stmt)).scalars().all()
            for a in active_maint:
                a.is_active = False
            await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="system_maintenance_toggled",
            target_type="system",
            target_id="maintenance_mode",
            details=f"Maintenance mode {'ENABLED' if is_active else 'DISABLED'}. Reason: {reason or 'N/A'}",
            ip_address=ip_address,
        )
        return is_active

    async def force_logout_students(
        self,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
        scope: str = "students",
    ) -> int:
        now = datetime.now(UTC)
        if scope == "all":
            role_filter = User.id.is_not(None)
        else:
            role_filter = User.role == UserRole.STUDENT

        # 1. Invalidate access tokens by incrementing token_version
        stmt_users = (
            update(User)
            .where(role_filter)
            .values(token_version=User.token_version + 1)
        )
        res = await self.session.execute(stmt_users)
        count = int(res.rowcount) if res.rowcount is not None else 0

        # 2. Invalidate ALL active refresh sessions so client cannot auto-refresh
        stmt_revoke = (
            update(UserSession)
            .where(
                UserSession.user_id.in_(
                    select(User.id).where(role_filter)
                ),
                UserSession.is_revoked.is_(False),
            )
            .values(is_revoked=True, rotated_at=now)
        )
        await self.session.execute(stmt_revoke)
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="force_logout_students",
            target_type="auth",
            target_id=f"{count}_users",
            details=f"Administrator invalidated all active sessions and refresh tokens for {count} users (scope: {scope})",
            ip_address=ip_address,
        )
        return count

    async def force_logout_single_user(
        self,
        user_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> bool:
        now = datetime.now(UTC)
        user = (await self.session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user:
            return False

        # 1. Bump token version
        user.token_version += 1

        # 2. Revoke all active refresh sessions
        stmt_revoke = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_revoked.is_(False),
            )
            .values(is_revoked=True, rotated_at=now)
        )
        await self.session.execute(stmt_revoke)
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="force_logout_user",
            target_type="user",
            target_id=str(user_id),
            details=f"Administrator forcefully revoked all active mobile sessions for {user.email}",
            ip_address=ip_address,
        )
        return True

    async def list_support_tickets(
        self,
        status_filter: TicketStatus | None = None,
        priority_filter: TicketPriority | None = None,
        category_filter: TicketCategory | None = None,
        search_query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[SupportTicketItem], int]:
        stmt = select(SupportTicket, User.email, User.full_name).join(User, SupportTicket.user_id == User.id)

        if status_filter:
            stmt = stmt.where(SupportTicket.status == status_filter)
        if priority_filter:
            stmt = stmt.where(SupportTicket.priority == priority_filter)
        if category_filter:
            stmt = stmt.where(SupportTicket.category == category_filter)
        if search_query:
            term = f"%{search_query.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(SupportTicket.ticket_number).like(term),
                    func.lower(SupportTicket.subject).like(term),
                    func.lower(SupportTicket.description).like(term),
                    func.lower(User.email).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).all()

        items: list[SupportTicketItem] = []
        for ticket, user_email, user_name in rows:
            items.append(
                SupportTicketItem(
                    id=ticket.id,
                    ticket_number=ticket.ticket_number,
                    user_id=ticket.user_id,
                    user_email=user_email,
                    user_name=user_name,
                    subject=ticket.subject,
                    category=ticket.category,
                    priority=ticket.priority,
                    status=ticket.status,
                    description=ticket.description,
                    admin_notes=ticket.admin_notes,
                    assigned_to=ticket.assigned_to,
                    resolution_summary=ticket.resolution_summary,
                    created_at=ticket.created_at,
                    updated_at=ticket.updated_at,
                    resolved_at=ticket.resolved_at,
                )
            )
        return items, total

    async def update_support_ticket(
        self,
        ticket_id: uuid.UUID,
        actor_id: uuid.UUID,
        status: TicketStatus | None = None,
        priority: TicketPriority | None = None,
        admin_notes: str | None = None,
        resolution_summary: str | None = None,
        ip_address: str | None = None,
    ) -> SupportTicketItem | None:
        stmt = select(SupportTicket, User.email, User.full_name).join(
            User, SupportTicket.user_id == User.id
        ).where(SupportTicket.id == ticket_id)
        row = (await self.session.execute(stmt)).first()
        if not row:
            return None
        ticket, user_email, user_name = row

        now = datetime.now(UTC)
        changes = []
        if status is not None:
            changes.append(f"status: {ticket.status} -> {status}")
            ticket.status = status
            if status in (TicketStatus.RESOLVED, TicketStatus.CLOSED) and not ticket.resolved_at:
                ticket.resolved_at = now
            elif status == TicketStatus.OPEN:
                ticket.resolved_at = None

        if priority is not None:
            changes.append(f"priority: {ticket.priority} -> {priority}")
            ticket.priority = priority

        if admin_notes is not None:
            ticket.admin_notes = admin_notes
            changes.append("updated admin notes")

        if resolution_summary is not None:
            ticket.resolution_summary = resolution_summary
            changes.append("updated resolution summary")

        ticket.updated_at = now
        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="update_support_ticket",
            target_type="support_ticket",
            target_id=ticket.ticket_number,
            details=f"Updated ticket {ticket.ticket_number}: {', '.join(changes)}",
            ip_address=ip_address,
        )

        return SupportTicketItem(
            id=ticket.id,
            ticket_number=ticket.ticket_number,
            user_id=ticket.user_id,
            user_email=user_email,
            user_name=user_name,
            subject=ticket.subject,
            category=ticket.category,
            priority=ticket.priority,
            status=ticket.status,
            description=ticket.description,
            admin_notes=ticket.admin_notes,
            assigned_to=ticket.assigned_to,
            resolution_summary=ticket.resolution_summary,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
            resolved_at=ticket.resolved_at,
        )

    async def list_app_configs(self) -> list[AppConfigItem]:
        stmt = select(AppConfig).order_by(AppConfig.category, AppConfig.key)
        configs = (await self.session.execute(stmt)).scalars().all()
        return [
            AppConfigItem(
                id=c.id,
                key=c.key,
                value=c.value,
                category=c.category,
                description=c.description,
                is_secret=c.is_secret,
                updated_at=c.updated_at,
            )
            for c in configs
        ]

    async def update_app_config(
        self,
        key: str,
        value: Any,
        actor_id: uuid.UUID,
        description: str | None = None,
        ip_address: str | None = None,
    ) -> AppConfigItem | None:
        stmt = select(AppConfig).where(AppConfig.key == key)
        config = (await self.session.execute(stmt)).scalar_one_or_none()
        now = datetime.now(UTC)
        if not config:
            config = AppConfig(
                key=key,
                value=value,
                category="custom",
                description=description,
                updated_by=actor_id,
                updated_at=now,
            )
            self.session.add(config)
        else:
            config.value = value
            if description is not None:
                config.description = description
            config.updated_by = actor_id
            config.updated_at = now

        await self.session.flush()

        await self.audit_log_repo.log(
            actor_id=actor_id,
            action="update_app_config",
            target_type="app_configuration",
            target_id=key,
            details=f"Administrator updated dynamic configuration parameter '{key}'",
            ip_address=ip_address,
        )

        return AppConfigItem(
            id=config.id,
            key=config.key,
            value=config.value,
            category=config.category,
            description=config.description,
            is_secret=config.is_secret,
            updated_at=config.updated_at,
        )

    # ==========================================================================
    # Device Intelligence & Security Telemetry
    # ==========================================================================

    @staticmethod
    def _parse_device_info(details: str | None, target_id: str | None) -> tuple[str | None, str | None]:
        if not details:
            return target_id, None
        import re

        m1 = re.search(r"Device:\s*([^|]+)\s*\|\s*OS:\s*([^|]+)", details)
        if m1:
            return m1.group(1).strip(), m1.group(2).strip()

        m2 = re.search(r"(?:from|on)\s+([^(]+)\s*\(([^)]+)\)", details)
        if m2:
            return m2.group(1).strip(), m2.group(2).strip()

        return target_id, None

    async def get_telemetry_live_feed(self, limit: int = 100) -> LiveTelemetryFeedResponse:
        now = datetime.now(UTC)
        cutoff_24h = now - timedelta(hours=24)

        # 1. Fetch recent audit logs relating to auth, telemetry, and admin operations
        stmt = (
            select(AuditLog)
            .options(joinedload(AuditLog.actor))
            .where(
                or_(
                    AuditLog.action.like("auth.%"),
                    AuditLog.action.like("telemetry.%"),
                    AuditLog.action.like("admin_%"),
                )
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        logs = (await self.session.execute(stmt)).scalars().all()

        events: list[LiveTelemetryEvent] = []
        for log in logs:
            event_type = "other"
            severity = "info"
            if "student_registered" in log.action:
                event_type = "signup"
                severity = "info"
            elif "student_login_success" in log.action:
                event_type = "login_success"
                severity = "info"
            elif "student_login_failed" in log.action:
                event_type = "login_failed"
                severity = "critical"
            elif "telemetry." in log.action:
                event_type = "app_opened"
                severity = "info"
            elif "admin_" in log.action:
                event_type = "admin_action"
                severity = "warning"

            dev_name, dev_os = self._parse_device_info(log.details, log.target_id)

            actor_name = log.actor.full_name if log.actor else None
            actor_email = log.actor.email if log.actor else None
            if not actor_email and event_type == "login_failed":
                actor_email = log.target_id

            events.append(
                LiveTelemetryEvent(
                    id=log.id,
                    timestamp=log.created_at,
                    event_type=event_type,
                    action=log.action,
                    actor_id=log.actor_id,
                    actor_name=actor_name,
                    actor_email=actor_email,
                    device_name=dev_name,
                    device_os=dev_os,
                    ip_address=log.ip_address,
                    details=log.details,
                    severity=severity,
                )
            )

        # 2. Count active devices in 24h
        active_devices_res = await self.session.execute(
            select(func.count(func.distinct(UserSession.device_name))).where(
                UserSession.created_at >= cutoff_24h,
                UserSession.is_revoked.is_(False),
            )
        )
        active_devices_24h = active_devices_res.scalar() or 0

        if active_devices_24h == 0:
            active_audit_res = await self.session.execute(
                select(func.count(func.distinct(AuditLog.ip_address))).where(
                    AuditLog.created_at >= cutoff_24h,
                    AuditLog.ip_address.isnot(None),
                )
            )
            active_devices_24h = active_audit_res.scalar() or 0

        # 3. Count failed logins in 24h
        failed_res = await self.session.execute(
            select(func.count(AuditLog.id)).where(
                or_(
                    AuditLog.action == "auth.student_login_failed",
                    AuditLog.action == "admin_login_failed_credentials",
                ),
                AuditLog.created_at >= cutoff_24h,
            )
        )
        failed_logins_24h = failed_res.scalar() or 0

        # 4. Count new signups in 24h
        signups_res = await self.session.execute(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == "auth.student_registered",
                AuditLog.created_at >= cutoff_24h,
            )
        )
        new_signups_24h = signups_res.scalar() or 0

        # 5. Detect brute-force threats (>= 3 failed logins on same IP or email in 24h)
        threats_stmt = (
            select(
                AuditLog.ip_address,
                AuditLog.target_id,
                func.count(AuditLog.id).label("failed_count"),
                func.min(AuditLog.created_at).label("first_attempt"),
                func.max(AuditLog.created_at).label("last_attempt"),
            )
            .where(
                or_(
                    AuditLog.action == "auth.student_login_failed",
                    AuditLog.action == "admin_login_failed_credentials",
                ),
                AuditLog.created_at >= cutoff_24h,
            )
            .group_by(AuditLog.ip_address, AuditLog.target_id)
            .having(func.count(AuditLog.id) >= 3)
        )
        threats_rows = (await self.session.execute(threats_stmt)).all()
        brute_force_threats: list[BruteForceThreat] = [
            BruteForceThreat(
                ip_address=row.ip_address,
                target_email=row.target_id,
                failed_attempts=row.failed_count,
                first_attempt_at=row.first_attempt,
                last_attempt_at=row.last_attempt,
            )
            for row in threats_rows
        ]

        return LiveTelemetryFeedResponse(
            events=events,
            total_events=len(events),
            active_devices_24h=active_devices_24h,
            failed_logins_24h=failed_logins_24h,
            new_signups_24h=new_signups_24h,
            brute_force_threats=brute_force_threats,
        )

    async def get_user_sessions(self, identifier: str) -> list[UserSessionDetail]:
        target_user = None
        ident_str = str(identifier).strip()

        # 1. Try by UUID
        try:
            uid = uuid.UUID(ident_str)
            target_user = (await self.session.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if not target_user:
                audit = (await self.session.execute(select(AuditLog).where(AuditLog.id == uid))).scalar_one_or_none()
                if audit:
                    if audit.actor_id:
                        target_user = (await self.session.execute(select(User).where(User.id == audit.actor_id))).scalar_one_or_none()
                    elif audit.target_id:
                        try:
                            tid = uuid.UUID(audit.target_id)
                            target_user = (await self.session.execute(select(User).where(User.id == tid))).scalar_one_or_none()
                        except ValueError:
                            target_user = (await self.session.execute(select(User).where(User.email.ilike(audit.target_id.strip())))).scalar_one_or_none()
        except ValueError:
            target_user = None

        # 2. Try by email
        if not target_user:
            target_user = (await self.session.execute(select(User).where(User.email.ilike(ident_str)))).scalar_one_or_none()

        if not target_user:
            return []

        stmt = (
            select(UserSession)
            .where(UserSession.user_id == target_user.id)
            .order_by(UserSession.created_at.desc())
        )
        sessions = (await self.session.execute(stmt)).scalars().all()
        return [
            UserSessionDetail(
                id=s.id,
                user_id=s.user_id,
                device_name=s.device_name,
                device_os=s.device_os,
                ip_address=s.ip_address,
                created_at=s.created_at,
                expires_at=s.expires_at,
                is_revoked=s.is_revoked,
            )
            for s in sessions
        ]

    async def revoke_session(
        self, session_id: uuid.UUID, actor_id: uuid.UUID, ip_address: str | None = None
    ) -> bool:
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(is_revoked=True)
            .returning(UserSession.user_id, UserSession.device_name)
        )
        res = await self.session.execute(stmt)
        row = res.first()
        if not row:
            return False

        # Invalidate current access tokens by incrementing token_version
        target_uid = row[0]
        await self.session.execute(
            update(User)
            .where(User.id == target_uid)
            .values(token_version=User.token_version + 1)
        )
        await self.session.commit()
        await self.audit_log_repo.log(
            action="admin_revoked_device_session",
            target_type="user_session",
            actor_id=actor_id,
            target_id=str(session_id),
            details=f"Admin remotely revoked session for device: {row.device_name or 'Unknown'}",
            ip_address=ip_address,
        )
        return True


