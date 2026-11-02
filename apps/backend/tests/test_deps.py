import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import get_current_active_user, get_current_user
from app.core.security import create_access_token
from app.models.user import User, UserRole, UserStatus


@pytest.fixture
def mock_db() -> AsyncMock:
    db = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_get_current_user_missing_credentials(mock_db: AsyncMock) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=None, db=mock_db)
    assert exc_info.value.status_code == 401
    assert "not provided" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_invalid_jwt(mock_db: AsyncMock) -> None:
    creds = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="invalid.jwt.token"
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=mock_db)
    assert exc_info.value.status_code == 401
    assert "could not validate credentials" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_user_not_found(mock_db: AsyncMock) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="student", token_version=1)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    mock_db.get.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=mock_db)
    assert exc_info.value.status_code == 401
    assert "user not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_token_version_mismatch(mock_db: AsyncMock) -> None:
    user_id = uuid.uuid4()
    # Token was issued with token_version=1
    token = create_access_token(subject=user_id, role="student", token_version=1)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    # Database user now has token_version=2 (e.g. after logout-all or password change)
    user = User(
        id=user_id,
        email="student@test.com",
        hashed_password="hash",
        full_name="Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=2,
    )
    mock_db.get.return_value = user

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=mock_db)
    assert exc_info.value.status_code == 401
    assert "invalidated" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_suspended_account(mock_db: AsyncMock) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="student", token_version=1)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    user = User(
        id=user_id,
        email="suspended@test.com",
        hashed_password="hash",
        full_name="Suspended",
        role=UserRole.STUDENT,
        status=UserStatus.SUSPENDED,
        token_version=1,
    )
    mock_db.get.return_value = user

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=creds, db=mock_db)
    assert exc_info.value.status_code == 403
    assert "suspended" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_current_user_valid(mock_db: AsyncMock) -> None:
    user_id = uuid.uuid4()
    token = create_access_token(subject=user_id, role="student", token_version=1)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    user = User(
        id=user_id,
        email="valid@test.com",
        hashed_password="hash",
        full_name="Valid Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        token_version=1,
    )
    mock_db.get.return_value = user

    current_user = await get_current_user(credentials=creds, db=mock_db)
    assert current_user.id == user_id
    assert current_user.email == "valid@test.com"


@pytest.mark.asyncio
async def test_get_current_active_user_inactive_rejected() -> None:
    user = User(
        id=uuid.uuid4(),
        email="pending@test.com",
        hashed_password="hash",
        full_name="Pending",
        role=UserRole.STUDENT,
        status=UserStatus.PENDING_VERIFICATION,
        token_version=1,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_active_user(current_user=user)
    assert exc_info.value.status_code == 403
    assert "inactive" in exc_info.value.detail.lower()
