import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password, hash_refresh_token
from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import (
    AccountPendingVerificationError,
    AccountSuspendedError,
    AuthService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    SessionNotFoundError,
)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = AsyncMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_register_success(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    service.user_repo.get_by_email = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.user_repo.create = AsyncMock(side_effect=lambda u: u)  # type: ignore[method-assign]

    payload = RegisterRequest(
        email="New.Student@TEST.EDU",
        password="ValidPassword123!",
        full_name="New Student",
    )

    user = await service.register(payload)

    assert user.email == "new.student@test.edu"
    assert user.full_name == "New Student"
    assert user.role == UserRole.STUDENT
    assert user.status == UserStatus.ACTIVE
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_register_duplicate_email(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    existing = User(
        email="existing@test.com",
        hashed_password="hash",
        full_name="Existing",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    service.user_repo.get_by_email = AsyncMock(return_value=existing)  # type: ignore[method-assign]

    payload = RegisterRequest(
        email="existing@test.com",
        password="ValidPassword123!",
        full_name="Another Person",
    )

    with pytest.raises(EmailAlreadyRegisteredError):
        await service.register(payload)


@pytest.mark.asyncio
async def test_register_integrity_error_race_condition(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    service.user_repo.get_by_email = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.user_repo.create = AsyncMock(  # type: ignore[method-assign]
        side_effect=IntegrityError("duplicate key", params=None, orig=Exception())
    )

    payload = RegisterRequest(
        email="race@test.com",
        password="ValidPassword123!",
        full_name="Race User",
    )

    with pytest.raises(EmailAlreadyRegisteredError):
        await service.register(payload)
    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_login_success(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    plain_pw = "CorrectPassword123!"
    user = User(
        id=user_id,
        email="student@test.com",
        hashed_password=hash_password(plain_pw),
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    service.user_repo.get_by_email = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.user_repo.update_last_login = AsyncMock()  # type: ignore[method-assign]
    service.session_repo.create_session = AsyncMock()  # type: ignore[method-assign]

    payload = LoginRequest(
        email="STUDENT@test.com",
        password=plain_pw,
        device_name="Pixel 9",
        device_os="Android 15",
    )

    tokens, logged_user = await service.login(payload, ip_address="127.0.0.1")

    assert logged_user.id == user_id
    assert tokens.token_type == "bearer"
    assert tokens.access_token is not None
    assert tokens.refresh_token is not None
    service.user_repo.update_last_login.assert_awaited_once()
    service.session_repo.create_session.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_login_unknown_email_triggers_dummy_verification(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    service.user_repo.get_by_email = AsyncMock(return_value=None)  # type: ignore[method-assign]

    payload = LoginRequest(
        email="nonexistent@test.com",
        password="AnyPassword123!",
    )

    with patch("app.services.auth_service.verify_dummy_password") as mock_dummy:
        with pytest.raises(InvalidCredentialsError):
            await service.login(payload)
        mock_dummy.assert_called_once_with("AnyPassword123!")


@pytest.mark.asyncio
async def test_login_wrong_password(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user = User(
        id=uuid.uuid4(),
        email="student@test.com",
        hashed_password=hash_password("RealPassword123!"),
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    service.user_repo.get_by_email = AsyncMock(return_value=user)  # type: ignore[method-assign]

    payload = LoginRequest(
        email="student@test.com",
        password="WrongPassword999!",
    )

    with pytest.raises(InvalidCredentialsError):
        await service.login(payload)


@pytest.mark.asyncio
async def test_login_suspended_account_rejected(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    plain_pw = "ValidPassword123!"
    user = User(
        id=uuid.uuid4(),
        email="suspended@test.com",
        hashed_password=hash_password(plain_pw),
        full_name="Suspended Student",
        role=UserRole.STUDENT,
        status=UserStatus.SUSPENDED,
        token_version=1,
    )
    service.user_repo.get_by_email = AsyncMock(return_value=user)  # type: ignore[method-assign]

    payload = LoginRequest(
        email="suspended@test.com",
        password=plain_pw,
    )

    with pytest.raises(AccountSuspendedError):
        await service.login(payload)


@pytest.mark.asyncio
async def test_refresh_token_rotation_success(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="student@test.com",
        hashed_password="hash",
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    plain_token = "valid_refresh_token_value_abc_123"
    token_hash = hash_refresh_token(plain_token)
    now = datetime.now(UTC)
    active_session = UserSession(
        id=uuid.uuid4(),
        user_id=user_id,
        refresh_token_hash=token_hash,
        is_revoked=False,
        expires_at=now + timedelta(days=10),
    )

    service.session_repo.get_by_token_hash_with_lock = AsyncMock(  # type: ignore[method-assign]
        return_value=active_session
    )
    service.user_repo.get_by_id = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.session_repo.create_session = AsyncMock()  # type: ignore[method-assign]

    new_tokens = await service.refresh_tokens(plain_token, ip_address="10.0.0.1")

    assert new_tokens.access_token is not None
    assert new_tokens.refresh_token is not None
    assert new_tokens.refresh_token != plain_token
    # Old session must be marked revoked and rotated
    assert active_session.is_revoked is True
    assert active_session.rotated_at is not None
    service.session_repo.create_session.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_token_unknown_token_rejected(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    service.session_repo.get_by_token_hash_with_lock = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(InvalidRefreshTokenError):
        await service.refresh_tokens("unknown_refresh_token")


@pytest.mark.asyncio
async def test_refresh_token_revoked_token_rejected(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    plain_token = "revoked_token"
    token_hash = hash_refresh_token(plain_token)
    revoked_session = UserSession(
        id=uuid.uuid4(),
        user_id=user_id,
        refresh_token_hash=token_hash,
        is_revoked=True,
        expires_at=datetime.now(UTC) + timedelta(days=5),
    )
    service.session_repo.get_by_token_hash_with_lock = AsyncMock(  # type: ignore[method-assign]
        return_value=revoked_session
    )

    with pytest.raises(InvalidRefreshTokenError) as exc_info:
        await service.refresh_tokens(plain_token)
    assert "revoked" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_refresh_token_expired_token_rejected(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    plain_token = "expired_token"
    token_hash = hash_refresh_token(plain_token)
    expired_session = UserSession(
        id=uuid.uuid4(),
        user_id=user_id,
        refresh_token_hash=token_hash,
        is_revoked=False,
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    service.session_repo.get_by_token_hash_with_lock = AsyncMock(  # type: ignore[method-assign]
        return_value=expired_session
    )

    with pytest.raises(InvalidRefreshTokenError) as exc_info:
        await service.refresh_tokens(plain_token)
    assert "expired" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_refresh_token_pending_verification_rejected(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="pending@test.com",
        hashed_password="hash",
        full_name="Pending Student",
        role=UserRole.STUDENT,
        status=UserStatus.PENDING_VERIFICATION,
        token_version=1,
    )
    plain_token = "valid_refresh_token_for_pending_user"
    token_hash = hash_refresh_token(plain_token)
    now = datetime.now(UTC)
    active_session = UserSession(
        id=uuid.uuid4(),
        user_id=user_id,
        refresh_token_hash=token_hash,
        is_revoked=False,
        expires_at=now + timedelta(days=10),
    )

    service.session_repo.get_by_token_hash_with_lock = AsyncMock(  # type: ignore[method-assign]
        return_value=active_session
    )
    service.user_repo.get_by_id = AsyncMock(return_value=user)  # type: ignore[method-assign]
    service.session_repo.create_session = AsyncMock()  # type: ignore[method-assign]

    with pytest.raises(AccountPendingVerificationError) as exc_info:
        await service.refresh_tokens(plain_token)

    assert "verification is pending" in str(exc_info.value).lower()
    # Explicitly verify session state: must NOT be revoked or rotated
    assert active_session.is_revoked is False
    assert active_session.rotated_at is None
    # No new session created and no commit executed
    service.session_repo.create_session.assert_not_called()
    mock_session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_logout_revokes_matching_session(mock_session: AsyncMock) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    plain_token = "logout_token"
    token_hash = hash_refresh_token(plain_token)
    session = UserSession(
        id=uuid.uuid4(),
        user_id=user_id,
        refresh_token_hash=token_hash,
        is_revoked=False,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    service.session_repo.get_by_token_hash = AsyncMock(return_value=session)  # type: ignore[method-assign]
    service.session_repo.revoke_session = AsyncMock()  # type: ignore[method-assign]

    await service.logout(user_id, plain_token)

    service.session_repo.revoke_session.assert_awaited_once_with(session)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_logout_all_revokes_and_increments_token_version(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    service.session_repo.revoke_all_user_sessions = AsyncMock(return_value=3)  # type: ignore[method-assign]
    service.user_repo.increment_token_version = AsyncMock(return_value=2)  # type: ignore[method-assign]

    count = await service.logout_all(user_id)

    assert count == 3
    service.session_repo.revoke_all_user_sessions.assert_awaited_once_with(user_id)
    service.user_repo.increment_token_version.assert_awaited_once_with(user_id)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_session_revocation_ownership_check(
    mock_session: AsyncMock,
) -> None:
    service = AuthService(mock_session)
    user_id = uuid.uuid4()
    target_session_id = uuid.uuid4()

    # get_session_by_id_and_user returns None when session belongs to a different user
    service.session_repo.get_session_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(SessionNotFoundError):
        await service.revoke_session(user_id, target_session_id)
