import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import (
    get_admin_service,
    get_auth_service,
    get_current_admin_user,
    get_db,
    require_super_admin,
    require_support_admin,
)
from app.core.config import settings
from app.core.rate_limiter import admin_rate_limiter
from app.core.security import create_access_token, generate_refresh_token, verify_password
from app.models.support_ticket import TicketCategory, TicketPriority, TicketStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminAIConfigUpdate,
    AdminAIMetrics,
    AdminDashboardStats,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserDetail,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserStatusUpdate,
    AnnouncementCreate,
    AnnouncementListResponse,
    AnnouncementResponse,
    AppConfigItem,
    AppConfigListResponse,
    AppConfigUpdate,
    AuditLogListResponse,
    AuditLogResponse,
    BruteForceThreat,
    ForceLogoutRequest,
    ForceLogoutResponse,
    LiveTelemetryEvent,
    LiveTelemetryFeedResponse,
    MaintenanceModeRequest,
    MaintenanceModeResponse,
    PasswordResetTriggerResponse,
    StaffCreateRequest,
    StaffPasswordResetRequest,
    StaffRoleUpdateRequest,
    StaffStatusUpdateRequest,
    SupportTicketItem,
    SupportTicketListResponse,
    SupportTicketUpdate,
    SystemHealthAnalyticsResponse,
    UserSessionDetail,
)
from app.schemas.user import UserExportData
from app.services.user_service import user_service
from app.schemas.subject_template import (
    SubjectTemplateCreate,
    SubjectTemplateListResponse,
    SubjectTemplateResponse,
    SubjectTemplateUpdate,
    SystemTaskTemplateCreate,
    SystemTaskTemplateResponse,
)
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService

router = APIRouter(prefix="/admin", tags=["admin"])


# ==============================================================================
# 1. Admin Authentication
# ==============================================================================


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminLoginResponse:
    client_ip = request.client.host if request.client else "unknown"

    # 1. Rate Limiting / Brute-Force Lockout Check
    is_ip_locked, ip_wait = admin_rate_limiter.is_locked(client_ip)
    is_email_locked, email_wait = admin_rate_limiter.is_locked(payload.email)
    if is_ip_locked or is_email_locked:
        wait_seconds = max(ip_wait, email_wait)
        await admin_service.audit_log_repo.log(
            action="admin_login_rate_limited",
            target_type="auth",
            actor_id=None,
            target_id=payload.email,
            details=f"Admin login blocked for {payload.email} (IP: {client_ip}) due to consecutive failed attempts.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Administrative console locked for {wait_seconds} seconds.",
        )

    # 2. Check User and Password
    user = await auth_service.user_repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        admin_rate_limiter.record_failure(client_ip)
        admin_rate_limiter.record_failure(payload.email)
        await admin_service.audit_log_repo.log(
            action="admin_login_failed_credentials",
            target_type="auth",
            actor_id=user.id if user else None,
            target_id=payload.email,
            details=f"Failed admin login attempt for {payload.email} with invalid credentials.",
            ip_address=client_ip,
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative credentials or master security passkey",
        )

    # 3. Strictly deny students from logging into the Admin Panel
    if user.role not in (
        UserRole.SUPER_ADMIN,
        UserRole.SUPPORT_ADMIN,
        UserRole.CONTENT_MANAGER,
    ):
        await admin_service.audit_log_repo.log(
            action="admin_login_unauthorized_role",
            target_type="auth",
            actor_id=user.id,
            target_id=str(user.id),
            details=f"Student account {user.email} attempted unauthorized access to admin console.",
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not possess administrative access privileges.",
        )

    # 4. Multi-Factor Master Security PIN Verification
    if settings.ADMIN_SECURITY_KEY:
        if not payload.security_pin or payload.security_pin.strip() != settings.ADMIN_SECURITY_KEY:
            admin_rate_limiter.record_failure(client_ip)
            admin_rate_limiter.record_failure(payload.email)
            await admin_service.audit_log_repo.log(
                action="admin_login_failed_invalid_pin",
                target_type="auth",
                actor_id=user.id,
                target_id=str(user.id),
                details=f"Admin {user.email} entered incorrect Master Security PIN.",
                ip_address=client_ip,
                commit=True,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid administrative credentials or master security passkey",
            )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative account is not active.",
        )

    # Reset rate limiting upon valid login
    admin_rate_limiter.reset(client_ip)
    admin_rate_limiter.reset(payload.email)

    user.last_login_at = datetime.now(UTC)
    await auth_service.session.flush()

    await admin_service.audit_log_repo.log(
        action="admin_login_success",
        target_type="auth",
        actor_id=user.id,
        target_id=str(user.id),
        details=f"Admin {user.full_name} ({user.email}) successfully authenticated with {user.role.value} role.",
        ip_address=client_ip,
    )

    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        token_version=user.token_version,
    )
    refresh_token = generate_refresh_token()

    return AdminLoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=AdminUserItem.model_validate(user),
    )


@router.get("/auth/me", response_model=AdminUserItem)
async def get_admin_profile(
    current_admin: Annotated[User, Depends(get_current_admin_user)],
) -> AdminUserItem:
    return AdminUserItem.model_validate(current_admin)


# ==============================================================================
# 2. Executive Dashboard Stats
# ==============================================================================


@router.get("/dashboard/stats", response_model=AdminDashboardStats)
async def get_dashboard_metrics(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminDashboardStats:
    return await admin_service.get_dashboard_stats()


# ==============================================================================
# 3. Student Management & Moderation
# ==============================================================================


@router.get("/users", response_model=AdminUserListResponse)
async def list_students(
    _admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    search: str | None = Query(None, description="Search by name or email"),
    role: UserRole | None = Query(None, description="Filter by user role"),
    status_filter: UserStatus | None = Query(None, alias="status", description="Filter by account status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AdminUserListResponse:
    items, total = await admin_service.list_users(
        search=search,
        role=role,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return AdminUserListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_student_details(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserDetail:
    detail = await admin_service.get_user_detail(user_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return detail


@router.post("/users/{user_id}/suspend", response_model=AdminUserItem)
async def suspend_student(
    user_id: uuid.UUID,
    payload: AdminUserStatusUpdate,
    request: Request,
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    try:
        updated_user = await admin_service.suspend_user(
            user_id=user_id,
            actor_id=admin.id,
            reason=payload.reason,
            ip_address=client_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    return AdminUserItem.model_validate(updated_user)


@router.post("/users/{user_id}/reactivate", response_model=AdminUserItem)
async def reactivate_student(
    user_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    updated_user = await admin_service.reactivate_user(
        user_id=user_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    return AdminUserItem.model_validate(updated_user)


@router.post("/users/{user_id}/reset-password")
async def trigger_student_password_reset(
    user_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> dict[str, Any]:
    client_ip = request.client.host if request.client else None
    result = await admin_service.request_student_password_reset(
        user_id=user_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("message", "User not found"),
        )
    return result


# ==============================================================================
# 4. AI Governance & Budget Controller
# ==============================================================================


@router.get("/ai/metrics", response_model=AdminAIMetrics)
async def get_ai_metrics(
    _admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminAIMetrics:
    return admin_service.get_ai_metrics()


@router.post("/ai/config", response_model=AdminAIMetrics)
async def update_ai_configuration(
    payload: AdminAIConfigUpdate,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminAIMetrics:
    client_ip = request.client.host if request.client else None
    return await admin_service.update_ai_config(
        model_name=payload.model_name,
        actor_id=admin.id,
        daily_budget_limit_usd=payload.daily_budget_limit_usd,
        ip_address=client_ip,
    )


# ==============================================================================
# 5. Broadcast Announcements
# ==============================================================================


@router.get("/announcements", response_model=AnnouncementListResponse)
async def list_announcements(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AnnouncementListResponse:
    items, total = await admin_service.announcement_repo.list_all(limit=limit, offset=offset)
    return AnnouncementListResponse(
        items=[AnnouncementResponse.model_validate(item) for item in items],
        total=total,
    )


@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AnnouncementResponse:
    client_ip = request.client.host if request.client else None
    announcement = await admin_service.create_announcement(
        title=payload.title,
        message=payload.message,
        actor_id=admin.id,
        severity=payload.severity,
        target_audience=payload.target_audience,
        expires_at=payload.expires_at,
        ip_address=client_ip,
    )
    return AnnouncementResponse.model_validate(announcement)


@router.patch("/announcements/{announcement_id}/toggle", response_model=AnnouncementResponse)
async def toggle_announcement(
    announcement_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AnnouncementResponse:
    client_ip = request.client.host if request.client else None
    announcement = await admin_service.toggle_announcement_active(
        announcement_id=announcement_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    return AnnouncementResponse.model_validate(announcement)


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> None:
    client_ip = request.client.host if request.client else None
    success = await admin_service.delete_announcement(
        announcement_id=announcement_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )


# ==============================================================================
# 6. Audit Trail & Logs
# ==============================================================================


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_trail(
    _admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    action: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AuditLogListResponse:
    items, total = await admin_service.list_audit_logs(
        limit=limit,
        offset=offset,
        action=action,
    )
    return AuditLogListResponse(
        items=[
            AuditLogResponse(
                id=log.id,
                actor_id=log.actor_id,
                actor_name=log.actor.full_name if log.actor else "System",
                actor_email=log.actor.email if log.actor else None,
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                details=log.details,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
            for log in items
        ],
        total=total,
    )


# ==============================================================================
# 7. Curated Subject Templates (AR-05)
# ==============================================================================


@router.get("/templates/subjects", response_model=SubjectTemplateListResponse)
async def list_admin_subject_templates(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    category: str | None = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SubjectTemplateListResponse:
    items, total, categories = await admin_service.list_subject_templates(
        category=category,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
    return SubjectTemplateListResponse(
        items=[SubjectTemplateResponse.model_validate(t) for t in items],
        total=total,
        categories=categories,
    )


@router.post("/templates/subjects", response_model=SubjectTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_subject_template(
    payload: SubjectTemplateCreate,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> SubjectTemplateResponse:
    client_ip = request.client.host if request.client else None
    template = await admin_service.create_subject_template(
        name=payload.name,
        category=payload.category,
        actor_id=admin.id,
        code=payload.code,
        description=payload.description,
        color=payload.color,
        credits=payload.credits,
        difficulty_level=payload.difficulty_level,
        suggested_units=payload.suggested_units,
        is_active=payload.is_active,
        ip_address=client_ip,
    )
    return SubjectTemplateResponse.model_validate(template)


@router.post("/templates/subjects/seed-defaults", response_model=list[SubjectTemplateResponse])
async def seed_starter_curriculum(
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[SubjectTemplateResponse]:
    client_ip = request.client.host if request.client else None
    seeded = await admin_service.seed_default_subject_templates(
        actor_id=admin.id,
        ip_address=client_ip,
    )
    return [SubjectTemplateResponse.model_validate(t) for t in seeded]


@router.patch("/templates/subjects/{template_id}", response_model=SubjectTemplateResponse)
async def update_subject_template(
    template_id: uuid.UUID,
    payload: SubjectTemplateUpdate,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> SubjectTemplateResponse:
    client_ip = request.client.host if request.client else None
    update_data = payload.model_dump(exclude_unset=True)
    template = await admin_service.update_subject_template(
        template_id=template_id,
        actor_id=admin.id,
        ip_address=client_ip,
        **update_data,
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject template not found",
        )
    return SubjectTemplateResponse.model_validate(template)


@router.delete("/templates/subjects/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject_template(
    template_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> None:
    client_ip = request.client.host if request.client else None
    success = await admin_service.delete_subject_template(
        template_id=template_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject template not found",
        )


# ==============================================================================
# 8. System Task Templates & Workflows
# ==============================================================================


@router.get("/templates/tasks", response_model=list[SystemTaskTemplateResponse])
async def list_system_task_templates(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[SystemTaskTemplateResponse]:
    items = await admin_service.list_system_task_templates()
    return [
        SystemTaskTemplateResponse(
            id=item.id,
            title=item.title,
            description=item.description,
            default_priority=item.default_priority.value if hasattr(item.default_priority, "value") else str(item.default_priority),
            estimated_minutes=item.estimated_minutes,
            category=item.category,
            subtasks=item.subtasks or [],
            is_system=item.is_system,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.post("/templates/tasks", response_model=SystemTaskTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_system_task_template(
    payload: SystemTaskTemplateCreate,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> SystemTaskTemplateResponse:
    client_ip = request.client.host if request.client else None
    template = await admin_service.create_system_task_template(
        title=payload.title,
        actor_id=admin.id,
        description=payload.description,
        default_priority=payload.default_priority,
        estimated_minutes=payload.estimated_minutes,
        category=payload.category,
        subtasks=payload.subtasks,
        ip_address=client_ip,
    )
    return SystemTaskTemplateResponse(
        id=template.id,
        title=template.title,
        description=template.description,
        default_priority=template.default_priority.value if hasattr(template.default_priority, "value") else str(template.default_priority),
        estimated_minutes=template.estimated_minutes,
        category=template.category,
        subtasks=template.subtasks or [],
        is_system=template.is_system,
        created_at=template.created_at,
    )


@router.delete("/templates/tasks/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_task_template(
    template_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> None:
    client_ip = request.client.host if request.client else None
    success = await admin_service.delete_system_task_template(
        template_id=template_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task template not found",
        )


# ==============================================================================
# 9. Admin Staff & Team Accounts (AR-01)
# ==============================================================================


@router.get("/staff", response_model=list[AdminUserItem])
async def list_staff_members(
    _admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AdminUserItem]:
    return await admin_service.list_staff_users()


@router.post("/staff", response_model=AdminUserItem, status_code=status.HTTP_201_CREATED)
async def create_staff_member(
    payload: StaffCreateRequest,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    try:
        new_staff = await admin_service.create_staff_user(
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
            plain_password=payload.password,
            actor_id=admin.id,
            ip_address=client_ip,
        )
        return AdminUserItem.model_validate(new_staff)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch("/staff/{user_id}/status", response_model=AdminUserItem)
async def update_staff_status(
    user_id: uuid.UUID,
    payload: StaffStatusUpdateRequest,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    try:
        updated = await admin_service.update_staff_status(
            staff_id=user_id,
            new_status=payload.status,
            actor_id=admin.id,
            ip_address=client_ip,
        )
        return AdminUserItem.model_validate(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch("/staff/{user_id}/role", response_model=AdminUserItem)
async def update_staff_role(
    user_id: uuid.UUID,
    payload: StaffRoleUpdateRequest,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    try:
        updated = await admin_service.update_staff_role(
            staff_id=user_id,
            new_role=payload.role,
            actor_id=admin.id,
            ip_address=client_ip,
        )
        return AdminUserItem.model_validate(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/staff/{user_id}/reset-password", response_model=AdminUserItem)
async def reset_staff_password(
    user_id: uuid.UUID,
    payload: StaffPasswordResetRequest,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AdminUserItem:
    client_ip = request.client.host if request.client else None
    try:
        updated = await admin_service.reset_staff_password(
            staff_id=user_id,
            new_password=payload.new_password,
            actor_id=admin.id,
            ip_address=client_ip,
        )
        return AdminUserItem.model_validate(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete("/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff_member(
    user_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> None:
    client_ip = request.client.host if request.client else None
    try:
        deleted = await admin_service.delete_staff_user(
            staff_id=user_id,
            actor_id=admin.id,
            ip_address=client_ip,
        )
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


# ==============================================================================
# 10. Platform Analytics & Operational Health Monitoring (AR-04)
# ==============================================================================


@router.get("/analytics/overview", response_model=SystemHealthAnalyticsResponse)
async def get_system_health_analytics(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> SystemHealthAnalyticsResponse:
    """Retrieve aggregate platform telemetry, DAU/WAU/MAU, storage footprint, and study trends."""
    return await admin_service.get_system_health_analytics()


@router.post("/system/maintenance", response_model=MaintenanceModeResponse)
async def toggle_maintenance_mode(
    payload: MaintenanceModeRequest,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> MaintenanceModeResponse:
    """Toggle platform maintenance mode and broadcast system status."""
    client_ip = request.client.host if request.client else None
    is_active = await admin_service.toggle_maintenance_mode(
        is_active=payload.is_maintenance_mode,
        reason=payload.reason,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    status_msg = "Maintenance mode activated across platform" if is_active else "Maintenance mode deactivated; normal operations resumed"
    return MaintenanceModeResponse(
        is_maintenance_mode=is_active,
        message=status_msg,
    )


@router.post("/system/force-logout-students", response_model=ForceLogoutResponse)
async def force_logout_students(
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    payload: ForceLogoutRequest | None = None,
) -> ForceLogoutResponse:
    """Emergency killswitch: invalidate all active mobile JWT sessions and refresh tokens immediately."""
    client_ip = request.client.host if request.client else None
    scope = payload.scope if payload else "students"
    count = await admin_service.force_logout_students(
        actor_id=admin.id,
        ip_address=client_ip,
        scope=scope,
    )
    scope_label = "all platform users (including staff)" if scope == "all" else "all students"
    return ForceLogoutResponse(
        students_logged_out=count,
        message=f"Successfully revoked active mobile JWT sessions and refresh tokens for {count} users ({scope_label}).",
    )


@router.post("/users/{user_id}/force-logout", response_model=dict[str, Any])
async def force_logout_student_single(
    user_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> dict[str, Any]:
    """Invalidate all active mobile sessions and refresh tokens for a specific user."""
    client_ip = request.client.host if request.client else None
    success = await admin_service.force_logout_single_user(
        user_id=user_id,
        actor_id=admin.id,
        ip_address=client_ip,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "success": True,
        "message": "User sessions and refresh tokens have been immediately revoked.",
    }


@router.get("/users/{user_id}/export", response_model=UserExportData)
async def export_student_data_admin(
    user_id: uuid.UUID,
    db: Annotated[Any, Depends(get_db)],
    _admin: Annotated[User, Depends(require_support_admin)],
) -> UserExportData:
    """Administrative inspection & GDPR Right to Portability data export for a student."""
    return await user_service.export_user_data(db, user_id)


# ==============================================================================
# Support & Complaints Management (Blueprint Section 8)
# ==============================================================================


@router.get("/support/tickets", response_model=SupportTicketListResponse)
async def list_support_tickets(
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    status: TicketStatus | None = None,
    priority: TicketPriority | None = None,
    category: TicketCategory | None = None,
    search: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SupportTicketListResponse:
    """Retrieve filtered, searchable list of support tickets & complaints with user metadata."""
    items, total = await admin_service.list_support_tickets(
        status_filter=status,
        priority_filter=priority,
        category_filter=category,
        search_query=search,
        limit=limit,
        offset=offset,
    )
    return SupportTicketListResponse(items=items, total=total)


@router.patch("/support/tickets/{ticket_id}", response_model=SupportTicketItem)
async def update_support_ticket(
    ticket_id: uuid.UUID,
    payload: SupportTicketUpdate,
    request: Request,
    admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> SupportTicketItem:
    """Update support ticket status, priority, admin resolution notes, or internal notes."""
    client_ip = request.client.host if request.client else None
    ticket = await admin_service.update_support_ticket(
        ticket_id=ticket_id,
        actor_id=admin.id,
        status=payload.status,
        priority=payload.priority,
        admin_notes=payload.admin_notes,
        resolution_summary=payload.resolution_summary,
        ip_address=client_ip,
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found")
    return ticket


# ==============================================================================
# Remote App Configuration & Feature Flags (Blueprint Section 11 & Section 7)
# ==============================================================================


@router.get("/config/app", response_model=AppConfigListResponse)
async def list_app_configurations(
    _admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AppConfigListResponse:
    """Retrieve all dynamic remote application configurations and feature flags."""
    items = await admin_service.list_app_configs()
    return AppConfigListResponse(items=items)


@router.put("/config/app/{key}", response_model=AppConfigItem)
async def update_app_configuration(
    key: str,
    payload: AppConfigUpdate,
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> AppConfigItem:
    """Update remote runtime configuration parameter or feature flags."""
    client_ip = request.client.host if request.client else None
    item = await admin_service.update_app_config(
        key=key,
        value=payload.value,
        actor_id=admin.id,
        description=payload.description,
        ip_address=client_ip,
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update configuration")
    return item


# ==============================================================================
# Database Backup & Snapshot Safeguard (Milestone 3 / AR-02)
# ==============================================================================


@router.post("/system/backup")
async def trigger_database_backup(
    request: Request,
    admin: Annotated[User, Depends(require_super_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> dict[str, Any]:
    """Super Admin 1-click snapshot trigger to generate database state snapshot."""
    client_ip = request.client.host if request.client else None
    analytics = await admin_service.get_system_health_analytics()
    configs = await admin_service.list_app_configs()
    raw_announcements = await admin_service.announcement_repo.list_all(limit=100)
    if isinstance(raw_announcements, tuple):
        announcements = raw_announcements[0]
    elif isinstance(raw_announcements, list):
        announcements = raw_announcements
    else:
        announcements = list(raw_announcements or [])

    announcements_data = []
    for a in announcements:
        sev = getattr(a, "severity", "info")
        sev_val = sev.value if hasattr(sev, "value") else str(sev)
        target = getattr(a, "target_audience", "all")
        target_val = target.value if hasattr(target, "value") else str(target)
        announcements_data.append({
            "id": str(getattr(a, "id", "")),
            "title": getattr(a, "title", ""),
            "severity": sev_val,
            "target_audience": target_val,
            "is_active": getattr(a, "is_active", True),
        })

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"studymate_db_snapshot_{timestamp}.json"

    snapshot_data = {
        "snapshot_version": "1.0",
        "created_at": datetime.now(UTC).isoformat(),
        "created_by": admin.email,
        "environment": settings.ENVIRONMENT,
        "database_version": analytics.database.version,
        "total_rows": analytics.database.total_rows,
        "table_breakdown": getattr(analytics.database, "table_counts", {}),
        "storage": {
            "backend": analytics.storage.storage_backend,
            "total_files": analytics.storage.total_files,
            "size_mb": analytics.storage.total_size_mb,
        },
        "app_configurations": [
            {"key": getattr(c, "key", ""), "value": getattr(c, "value", ""), "description": getattr(c, "description", "")}
            for c in configs
        ],
        "announcements": announcements_data,
    }

    await admin_service.audit_log_repo.log(
        action="admin_db_backup_triggered",
        target_type="system",
        actor_id=admin.id,
        target_id=filename,
        details=f"Super Admin {admin.email} generated database state snapshot '{filename}' ({analytics.database.total_rows} total rows).",
        ip_address=client_ip,
    )

    return {
        "success": True,
        "filename": filename,
        "snapshot": snapshot_data,
        "message": f"Database snapshot '{filename}' generated successfully.",
    }


# ==============================================================================
# 11. Device Radar & Live Security Telemetry Feed
# ==============================================================================


@router.get(
    "/telemetry/live-feed",
    response_model=LiveTelemetryFeedResponse,
    summary="Get live security telemetry and device activity feed",
    description="Returns real-time device logs, active devices in 24h, failed logins, and brute-force alert sentinels.",
)
async def get_live_telemetry_feed(
    current_admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> LiveTelemetryFeedResponse:
    return await admin_service.get_telemetry_live_feed(limit=limit)


@router.get(
    "/users/{identifier}/sessions",
    response_model=list[UserSessionDetail],
    summary="Get all active and past device sessions for a student",
    description="Inspect device models, operating systems, IP addresses, and session states for a specific user ID or email.",
)
async def get_user_sessions(
    identifier: str,
    current_admin: Annotated[User, Depends(get_current_admin_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[UserSessionDetail]:
    return await admin_service.get_user_sessions(identifier=identifier)


@router.delete(
    "/sessions/{session_id}",
    summary="Remotely revoke a specific device session",
    description="Immediately terminates a student's session on a specific device, requiring them to re-authenticate.",
)
async def revoke_device_session(
    session_id: uuid.UUID,
    request: Request,
    current_admin: Annotated[User, Depends(require_support_admin)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> dict[str, Any]:
    client_ip = request.client.host if request.client else None
    revoked = await admin_service.revoke_session(
        session_id=session_id, actor_id=current_admin.id, ip_address=client_ip
    )
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked.",
        )
    return {"success": True, "message": "Device session successfully revoked."}


@router.post(
    "/users/{identifier}/trigger-password-reset",
    response_model=PasswordResetTriggerResponse,
    summary="Trigger secure password reset for student",
    description="Generates a cryptographically secure password reset token and dispatches reset instructions to the student's registered email without exposing passwords in plaintext.",
)
async def trigger_user_password_reset(
    identifier: str,
    request: Request,
    current_admin: Annotated[User, Depends(require_support_admin)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> PasswordResetTriggerResponse:
    student = None
    try:
        uid = uuid.UUID(identifier)
        student = await auth_service.user_repo.get_by_id(uid)
    except ValueError:
        student = None

    if not student:
        student = await auth_service.user_repo.get_by_email(identifier.strip().lower())

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student account not found for '{identifier}'.",
        )

    await auth_service.forgot_password(student.email)
    client_ip = request.client.host if request.client else None
    await admin_service.audit_log_repo.log(
        action="admin_triggered_password_reset",
        target_type="student_account",
        actor_id=current_admin.id,
        target_id=str(student.id),
        details=f"Admin {current_admin.email} triggered secure password reset for student {student.email}",
        ip_address=client_ip,
        commit=True,
    )

    return PasswordResetTriggerResponse(
        success=True,
        message=f"Password reset instructions successfully dispatched to {student.email}",
        user_email=student.email,
        reset_token_issued=True,
    )






