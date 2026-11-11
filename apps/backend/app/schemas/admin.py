from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from app.models.announcement import AnnouncementSeverity, AnnouncementTarget
from app.models.support_ticket import TicketCategory, TicketPriority, TicketStatus
from app.models.user import UserRole, UserStatus


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    security_pin: str | None = Field(default=None, description="Master Admin Security Passkey / 2FA PIN")


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_login_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_email_verified(self) -> bool:
        return self.status != UserStatus.PENDING_VERIFICATION


class AdminLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AdminUserItem


class AdminDashboardStats(BaseModel):
    total_students: int
    active_students: int
    suspended_students: int
    pending_verification_students: int
    total_focus_hours: float
    total_notes: int
    total_flashcard_decks: int
    total_documents: int
    total_quizzes: int
    active_announcements_count: int
    system_status: str = "operational"


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    limit: int
    offset: int


class AdminUserDetail(AdminUserItem):
    subjects_count: int = 0
    tasks_count: int = 0
    notes_count: int = 0
    flashcards_count: int = 0
    documents_count: int = 0
    study_sessions_count: int = 0
    total_focus_minutes: int = 0
    current_streak_days: int = 0


class AdminUserStatusUpdate(BaseModel):
    reason: str | None = Field(None, max_length=500)


class AdminAIMetrics(BaseModel):
    primary_provider: str
    active_model_name: str
    daily_budget_limit_usd: float
    estimated_today_cost_usd: float
    available_models: list[str]


class AdminAIConfigUpdate(BaseModel):
    model_name: str = Field(..., min_length=2, max_length=100)
    daily_budget_limit_usd: float | None = Field(None, gt=0, le=500.0)


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=5)
    severity: AnnouncementSeverity = AnnouncementSeverity.INFO
    target_audience: AnnouncementTarget = AnnouncementTarget.ALL
    expires_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    message: str
    severity: AnnouncementSeverity
    target_audience: AnnouncementTarget
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    expires_at: datetime | None


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementResponse]
    total: int


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID | None
    actor_name: str | None = None
    actor_email: str | None = None
    action: str
    target_type: str
    target_id: str | None
    details: str | None
    ip_address: str | None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


class StaffCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    role: UserRole
    password: str = Field(..., min_length=8, max_length=128)


class StaffStatusUpdateRequest(BaseModel):
    status: UserStatus


class StaffRoleUpdateRequest(BaseModel):
    role: UserRole


class StaffPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class DailyStudyTrendItem(BaseModel):
    date: str
    focus_minutes: int
    sessions_count: int
    unique_students: int


class TopSubjectItem(BaseModel):
    name: str
    code: str | None = None
    student_count: int
    color: str = "#8B5CF6"


class DatabaseTelemetryItem(BaseModel):
    status: str
    latency_ms: float
    version: str
    total_rows: int
    table_counts: dict[str, int] = Field(default_factory=dict)


class StorageTelemetryItem(BaseModel):
    total_files: int
    total_size_mb: float
    storage_backend: str


class SecurityTelemetryItem(BaseModel):
    failed_logins_24h: int
    rate_limit_blocks_24h: int
    active_super_admins: int
    is_maintenance_mode: bool


class SystemHealthAnalyticsResponse(BaseModel):
    dau: int
    wau: int
    mau: int
    retention_rate_pct: float
    daily_focus_trends: list[DailyStudyTrendItem]
    top_subjects: list[TopSubjectItem]
    database: DatabaseTelemetryItem
    storage: StorageTelemetryItem
    security: SecurityTelemetryItem


class MaintenanceModeRequest(BaseModel):
    is_maintenance_mode: bool
    reason: str | None = None


class MaintenanceModeResponse(BaseModel):
    is_maintenance_mode: bool
    message: str


class ForceLogoutRequest(BaseModel):
    scope: str = "students"  # "students" or "all"


class ForceLogoutResponse(BaseModel):
    students_logged_out: int
    message: str


class SupportTicketItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    user_id: UUID
    user_email: str | None = None
    user_name: str | None = None
    subject: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    description: str
    admin_notes: str | None = None
    assigned_to: UUID | None = None
    resolution_summary: str | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class SupportTicketListResponse(BaseModel):
    items: list[SupportTicketItem]
    total: int


class SupportTicketUpdate(BaseModel):
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    admin_notes: str | None = None
    resolution_summary: str | None = None


class AppConfigItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    key: str
    value: Any
    category: str
    description: str | None = None
    is_secret: bool = False
    updated_at: datetime


class AppConfigListResponse(BaseModel):
    items: list[AppConfigItem]


class AppConfigUpdate(BaseModel):
    value: Any
    description: str | None = None


# ==============================================================================
# Device Intelligence & Security Telemetry Schemas
# ==============================================================================


class DevicePingRequest(BaseModel):
    device_name: str | None = Field(default=None, max_length=150)
    device_os: str | None = Field(default=None, max_length=50)
    app_version: str | None = Field(default="1.0.0", max_length=20)
    is_first_launch: bool = False
    user_id: UUID | None = None


class LiveTelemetryEvent(BaseModel):
    id: UUID
    timestamp: datetime
    event_type: str  # "signup", "login_success", "login_failed", "app_opened"
    action: str
    actor_id: UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    device_name: str | None = None
    device_os: str | None = None
    ip_address: str | None = None
    details: str | None = None
    severity: str = "info"  # "info", "warning", "critical"


class BruteForceThreat(BaseModel):
    ip_address: str | None = None
    target_email: str | None = None
    failed_attempts: int
    first_attempt_at: datetime
    last_attempt_at: datetime


class LiveTelemetryFeedResponse(BaseModel):
    events: list[LiveTelemetryEvent]
    total_events: int
    active_devices_24h: int
    failed_logins_24h: int
    new_signups_24h: int
    brute_force_threats: list[BruteForceThreat]


class UserSessionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    device_name: str | None
    device_os: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    is_revoked: bool


class PasswordResetTriggerResponse(BaseModel):
    success: bool
    message: str
    user_email: str
    reset_token_issued: bool





