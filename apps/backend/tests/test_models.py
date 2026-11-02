from typing import cast

from sqlalchemy import CheckConstraint, Column, DateTime, String, Table
from sqlalchemy.sql.schema import ColumnDefault, DefaultClause

from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus


def test_user_table_metadata() -> None:
    table = cast(Table, User.__table__)
    assert table.name == "users"
    assert table.c.id.primary_key is True

    # Required (NOT NULL) fields
    assert table.c.email.nullable is False
    assert table.c.hashed_password.nullable is False
    assert table.c.full_name.nullable is False
    assert table.c.role.nullable is False
    assert table.c.status.nullable is False
    assert table.c.daily_study_goal_minutes.nullable is False
    assert table.c.theme_preference.nullable is False
    assert table.c.push_notifications_enabled.nullable is False
    assert table.c.token_version.nullable is False
    assert table.c.created_at.nullable is False
    assert table.c.updated_at.nullable is False

    # Optional (nullable) fields
    assert table.c.avatar_url.nullable is True
    assert table.c.institution.nullable is True
    assert table.c.major.nullable is True
    assert table.c.graduation_year.nullable is True
    assert table.c.quiet_hours_start.nullable is True
    assert table.c.quiet_hours_end.nullable is True
    assert table.c.last_login_at.nullable is True


def test_user_enums_and_defaults() -> None:
    # Role values
    assert [e.value for e in UserRole] == [
        "student",
        "content_manager",
        "support_admin",
        "super_admin",
    ]
    # Status values
    assert [e.value for e in UserStatus] == [
        "active",
        "suspended",
        "pending_verification",
    ]

    table = cast(Table, User.__table__)

    # Model defaults checked via column defaults
    role_col = cast(Column[object], table.c.role)
    assert isinstance(role_col.default, ColumnDefault)
    assert role_col.default.arg == UserRole.STUDENT

    status_col = cast(Column[object], table.c.status)
    assert isinstance(status_col.default, ColumnDefault)
    assert status_col.default.arg == UserStatus.ACTIVE

    goal_col = cast(Column[object], table.c.daily_study_goal_minutes)
    assert isinstance(goal_col.default, ColumnDefault)
    assert goal_col.default.arg == 120

    theme_col = cast(Column[object], table.c.theme_preference)
    assert isinstance(theme_col.default, ColumnDefault)
    assert theme_col.default.arg == "system"

    push_col = cast(Column[object], table.c.push_notifications_enabled)
    assert isinstance(push_col.default, ColumnDefault)
    assert push_col.default.arg is True

    token_ver_col = cast(Column[object], table.c.token_version)
    assert isinstance(token_ver_col.default, ColumnDefault)
    assert token_ver_col.default.arg == 1

    # Database server_defaults
    assert isinstance(role_col.server_default, DefaultClause)
    assert str(role_col.server_default.arg) == "'student'"

    assert isinstance(status_col.server_default, DefaultClause)
    assert str(status_col.server_default.arg) == "'active'"

    assert isinstance(goal_col.server_default, DefaultClause)
    assert str(goal_col.server_default.arg) == "120"

    assert isinstance(theme_col.server_default, DefaultClause)
    assert str(theme_col.server_default.arg) == "'system'"

    assert isinstance(token_ver_col.server_default, DefaultClause)
    assert str(token_ver_col.server_default.arg) == "1"


def test_user_indexes() -> None:
    table = cast(Table, User.__table__)
    index_names = {idx.name for idx in table.indexes}

    assert "idx_users_email" in index_names
    assert "idx_users_status_role" in index_names
    assert "uq_users_email_lower" in index_names

    # Check case-insensitive unique email index
    uq_email = next(idx for idx in table.indexes if idx.name == "uq_users_email_lower")
    assert uq_email.unique is True


def test_user_check_constraints() -> None:
    table = cast(Table, User.__table__)
    check_constraints = [c for c in table.constraints if isinstance(c, CheckConstraint)]
    constraint_names = {c.name for c in check_constraints}
    assert "ck_users_token_version_positive" in constraint_names

    token_ver_ck = next(
        c for c in check_constraints if c.name == "ck_users_token_version_positive"
    )
    assert "token_version >= 1" in str(token_ver_ck.sqltext)


def test_user_session_metadata() -> None:
    table = cast(Table, UserSession.__table__)
    assert table.name == "user_sessions"
    assert table.c.id.primary_key is True

    # Required fields
    assert table.c.user_id.nullable is False
    assert table.c.refresh_token_hash.nullable is False
    assert table.c.refresh_token_hash.unique is True

    token_type = table.c.refresh_token_hash.type
    assert isinstance(token_type, String)
    assert token_type.length == 64  # SHA-256 hex length

    assert table.c.is_revoked.nullable is False
    assert table.c.expires_at.nullable is False
    assert table.c.created_at.nullable is False

    # Optional fields
    assert table.c.device_name.nullable is True
    assert table.c.device_os.nullable is True
    assert table.c.ip_address.nullable is True
    assert table.c.rotated_at.nullable is True

    # Defaults
    revoked_col = cast(Column[object], table.c.is_revoked)
    assert isinstance(revoked_col.default, ColumnDefault)
    assert revoked_col.default.arg is False


def test_user_session_foreign_key_and_indexes() -> None:
    table = cast(Table, UserSession.__table__)

    # Foreign key referencing users.id with ON DELETE CASCADE
    fks = list(table.foreign_keys)
    assert len(fks) == 1
    fk = fks[0]
    assert fk.target_fullname == "users.id"
    assert fk.ondelete == "CASCADE"

    # Compound lookup index on (user_id, is_revoked)
    lookup_idx = next(
        idx for idx in table.indexes if idx.name == "idx_user_sessions_lookup"
    )
    col_names = [col.name for col in lookup_idx.columns]
    assert col_names == ["user_id", "is_revoked"]


def test_timestamp_timezone_settings() -> None:
    user_table = cast(Table, User.__table__)
    session_table = cast(Table, UserSession.__table__)

    # All timestamp columns must be timezone-aware (TIMESTAMPTZ)
    for col_name in ("created_at", "updated_at", "last_login_at"):
        col = cast(Column[object], user_table.c[col_name])
        assert isinstance(col.type, DateTime)
        assert col.type.timezone is True

    for col_name in ("created_at", "expires_at", "rotated_at"):
        col = cast(Column[object], session_table.c[col_name])
        assert isinstance(col.type, DateTime)
        assert col.type.timezone is True


def test_model_relationships() -> None:
    # User.sessions relationship exists
    assert "sessions" in User.__mapper__.relationships
    rel_sessions = User.__mapper__.relationships["sessions"]
    assert rel_sessions.target.name == "user_sessions"
    assert rel_sessions.passive_deletes is True

    # UserSession.user relationship exists
    assert "user" in UserSession.__mapper__.relationships
    rel_user = UserSession.__mapper__.relationships["user"]
    assert rel_user.target.name == "users"
