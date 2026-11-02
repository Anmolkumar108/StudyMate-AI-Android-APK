from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_dummy_password,
    verify_password,
)
from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus
from app.repositories.session_repo import SessionRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


class AuthError(Exception):
    """Base domain exception for authentication errors."""


class EmailAlreadyRegisteredError(AuthError):
    """Raised when an email address is already registered."""


class InvalidCredentialsError(AuthError):
    """Raised when email or password is incorrect."""


class AccountSuspendedError(AuthError):
    """Raised when attempting authentication on a suspended account."""


class AccountPendingVerificationError(AuthError):
    """Raised when an account is pending verification."""


class InvalidRefreshTokenError(AuthError):
    """Raised when a refresh token is invalid, expired, or revoked."""


class SessionNotFoundError(AuthError):
    """Raised when a session is not found or not owned by user."""


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.session_repo = SessionRepository(session)

    async def register(self, payload: RegisterRequest) -> User:
        normalized_email = payload.email.strip().lower()

        # Check existing user before insert
        existing_user = await self.user_repo.get_by_email(normalized_email)
        if existing_user is not None:
            raise EmailAlreadyRegisteredError(
                "An account with this email already exists."
            )

        hashed = hash_password(payload.password)
        new_user = User(
            email=normalized_email,
            hashed_password=hashed,
            full_name=payload.full_name,
            role=UserRole.STUDENT,  # Strictly hardcoded: never public admin
            status=UserStatus.ACTIVE,
        )

        try:
            await self.user_repo.create(new_user)
            await self.session.commit()
            await self.session.refresh(new_user)
            return new_user
        except IntegrityError as e:
            await self.session.rollback()
            raise EmailAlreadyRegisteredError(
                "An account with this email already exists."
            ) from e

    async def login(
        self, payload: LoginRequest, ip_address: str | None = None
    ) -> tuple[TokenResponse, User]:
        normalized_email = payload.email.strip().lower()
        user = await self.user_repo.get_by_email(normalized_email)

        if user is None:
            # Timing attack mitigation: run dummy Argon2id verification
            verify_dummy_password(payload.password)
            raise InvalidCredentialsError("Invalid email or password.")

        if not verify_password(payload.password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or password.")

        if user.status == UserStatus.SUSPENDED:
            raise AccountSuspendedError("Account is suspended. Please contact support.")

        if user.status == UserStatus.PENDING_VERIFICATION:
            raise AccountPendingVerificationError(
                "Account verification is pending. Please verify your email."
            )

        now = datetime.now(UTC)
        await self.user_repo.update_last_login(user.id, now)

        # Generate tokens
        access_token = create_access_token(
            subject=user.id,
            role=user.role.value,
            token_version=user.token_version,
        )
        refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(refresh_token)

        # Create persisted user session
        session_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        user_session = UserSession(
            user_id=user.id,
            refresh_token_hash=token_hash,
            device_name=payload.device_name,
            device_os=payload.device_os,
            ip_address=ip_address,
            expires_at=session_expires,
        )
        await self.session_repo.create_session(user_session)
        await self.session.commit()

        tokens = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return tokens, user

    async def refresh_tokens(
        self, refresh_token: str, ip_address: str | None = None
    ) -> TokenResponse:
        token_hash = hash_refresh_token(refresh_token)

        # Fetch session with row lock for atomic rotation
        existing_session = await self.session_repo.get_by_token_hash_with_lock(
            token_hash
        )
        if existing_session is None:
            raise InvalidRefreshTokenError("Invalid or expired refresh token.")

        if existing_session.is_revoked:
            raise InvalidRefreshTokenError("Refresh token has been revoked.")

        now = datetime.now(UTC)
        if existing_session.expires_at <= now:
            raise InvalidRefreshTokenError("Refresh token has expired.")

        user = await self.user_repo.get_by_id(existing_session.user_id)
        if user is None:
            raise InvalidRefreshTokenError("User not found.")

        if user.status == UserStatus.SUSPENDED:
            raise AccountSuspendedError("Account is suspended. Please contact support.")

        if user.status == UserStatus.PENDING_VERIFICATION:
            raise AccountPendingVerificationError(
                "Account verification is pending. Please verify your email."
            )

        # Atomic single-use rotation
        existing_session.is_revoked = True
        existing_session.rotated_at = now

        new_refresh_token = generate_refresh_token()
        new_token_hash = hash_refresh_token(new_refresh_token)
        new_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        new_session = UserSession(
            user_id=user.id,
            refresh_token_hash=new_token_hash,
            device_name=existing_session.device_name,
            device_os=existing_session.device_os,
            ip_address=ip_address or existing_session.ip_address,
            expires_at=new_expires,
        )
        await self.session_repo.create_session(new_session)

        new_access_token = create_access_token(
            subject=user.id,
            role=user.role.value,
            token_version=user.token_version,
        )
        await self.session.commit()

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(self, user_id: UUID, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        session = await self.session_repo.get_by_token_hash(token_hash)
        if session and session.user_id == user_id:
            await self.session_repo.revoke_session(session)
            await self.session.commit()

    async def logout_all(self, user_id: UUID) -> int:
        revoked_count = await self.session_repo.revoke_all_user_sessions(user_id)
        await self.user_repo.increment_token_version(user_id)
        await self.session.commit()
        return revoked_count

    async def list_sessions(self, user_id: UUID) -> Sequence[UserSession]:
        return await self.session_repo.list_active_sessions_for_user(user_id)

    async def revoke_session(self, user_id: UUID, session_id: UUID) -> None:
        session = await self.session_repo.get_session_by_id_and_user(
            session_id, user_id
        )
        if session is None:
            raise SessionNotFoundError("Session not found.")
        await self.session_repo.revoke_session(session)
        await self.session.commit()
