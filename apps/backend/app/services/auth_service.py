import hashlib
import logging
import secrets
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
from app.models.verification_token import TokenType, VerificationToken
from app.repositories.session_repo import SessionRepository
from app.repositories.user_repo import UserRepository
from app.repositories.verification_token_repo import VerificationTokenRepository
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserPreferencesUpdate
from app.services.email_service import get_email_service
from app.services.google_auth_service import verify_google_token

logger = logging.getLogger("app.auth")


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


class InvalidVerificationTokenError(AuthError):
    """Raised when a verification or reset token is invalid, expired, or used."""


class ResendRateLimitError(AuthError):
    """Raised when a user requests verification emails too quickly."""


class UserNotFoundError(AuthError):
    """Raised when a requested user account does not exist."""


# In-memory store for recent verification OTPs (enables testing and instant verification on cloud free tier)
LATEST_OTPS: dict[str, str] = {}


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.session_repo = SessionRepository(session)
        self.token_repo = VerificationTokenRepository(session)
        self.email_service = get_email_service()

    def _hash_token(self, raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    async def register(
        self,
        payload: RegisterRequest,
        status: UserStatus = UserStatus.PENDING_VERIFICATION,
        send_email: bool = True,
    ) -> User:
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
            status=status,
        )

        try:
            await self.user_repo.create(new_user)
            await self.session.commit()
            await self.session.refresh(new_user)
        except IntegrityError as e:
            await self.session.rollback()
            raise EmailAlreadyRegisteredError(
                "An account with this email already exists."
            ) from e

        # If user is pending verification, issue token and send email
        if status == UserStatus.PENDING_VERIFICATION and send_email:
            try:
                raw_token = secrets.token_urlsafe(32)
                token_hash = self._hash_token(raw_token)
                expires = datetime.now(UTC) + timedelta(
                    hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
                )
                verification_record = VerificationToken(
                    user_id=new_user.id,
                    token_hash=token_hash,
                    token_type=TokenType.EMAIL_VERIFICATION.value,
                    expires_at=expires,
                )
                await self.token_repo.create(verification_record)
                await self.session.commit()

                verification_url = (
                    f"{settings.FRONTEND_URL}/api/v1/auth/verify-email?token={raw_token}"
                )
                try:
                    await self.email_service.send_verification_email(
                        to_email=new_user.email,
                        full_name=new_user.full_name,
                        verification_url=verification_url,
                        raw_token=raw_token,
                    )
                except Exception as email_err:
                    logger.warning(f"Could not dispatch verification email: {email_err}")
            except Exception as token_err:
                await self.session.rollback()
                logger.error(f"Error creating verification token: {token_err}")

        return new_user

    async def verify_email(self, token_str: str) -> User:
        token_hash = self._hash_token(token_str.strip())
        token_record = await self.token_repo.get_valid_token(
            token_hash=token_hash,
            token_type=TokenType.EMAIL_VERIFICATION.value,
        )
        if not token_record:
            raise InvalidVerificationTokenError(
                "Invalid or expired email verification link."
            )

        user = await self.user_repo.get_by_id(token_record.user_id)
        if not user:
            raise InvalidVerificationTokenError("User associated with token not found.")

        # Activate user account
        user.status = UserStatus.ACTIVE
        await self.token_repo.mark_as_used(token_record.id)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def resend_verification(self, email: str) -> None:
        normalized_email = email.strip().lower()
        user = await self.user_repo.get_by_email(normalized_email)
        if not user or user.status != UserStatus.PENDING_VERIFICATION:
            # Generic return to prevent user enumeration
            return

        latest_token = await self.token_repo.get_latest_for_user(
            user.id, TokenType.EMAIL_VERIFICATION.value
        )
        if latest_token:
            now = datetime.now(UTC)
            elapsed = (now - latest_token.created_at).total_seconds()
            if elapsed < settings.RESEND_COOLDOWN_SECONDS:
                wait_time = int(settings.RESEND_COOLDOWN_SECONDS - elapsed)
                raise ResendRateLimitError(
                    f"Please wait {wait_time} seconds before requesting a new verification email."
                )

        # Invalidate old tokens
        await self.token_repo.invalidate_user_tokens(
            user.id, TokenType.EMAIL_VERIFICATION.value
        )

        raw_token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(raw_token)
        expires = datetime.now(UTC) + timedelta(
            hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
        )
        new_record = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=TokenType.EMAIL_VERIFICATION.value,
            expires_at=expires,
        )
        await self.token_repo.create(new_record)
        await self.session.commit()

        verification_url = (
            f"{settings.FRONTEND_URL}/api/v1/auth/verify-email?token={raw_token}"
        )
        await self.email_service.send_verification_email(
            to_email=user.email,
            full_name=user.full_name,
            verification_url=verification_url,
            raw_token=raw_token,
        )

    async def forgot_password(self, email: str) -> None:
        normalized_email = email.strip().lower()
        user = await self.user_repo.get_by_email(normalized_email)
        if not user or user.status == UserStatus.SUSPENDED:
            # Anti-enumeration: do not reveal user presence
            return

        try:
            await self.token_repo.invalidate_user_tokens(
                user.id, TokenType.PASSWORD_RESET.value
            )

            raw_token = secrets.token_urlsafe(32)
            token_hash = self._hash_token(raw_token)
            expires = datetime.now(UTC) + timedelta(
                hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
            )
            new_record = VerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                token_type=TokenType.PASSWORD_RESET.value,
                expires_at=expires,
            )
            await self.token_repo.create(new_record)
            await self.session.commit()

            reset_url = (
                f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
            )
            try:
                await self.email_service.send_password_reset_email(
                    to_email=user.email,
                    full_name=user.full_name,
                    reset_url=reset_url,
                    raw_token=raw_token,
                )
            except Exception as email_err:
                logger.warning(f"Could not dispatch password reset email: {email_err}")
        except Exception as err:
            await self.session.rollback()
            logger.error(f"Error in forgot_password: {err}")

    async def reset_password(self, token_str: str, new_password: str) -> None:
        token_hash = self._hash_token(token_str.strip())
        token_record = await self.token_repo.get_valid_token(
            token_hash=token_hash,
            token_type=TokenType.PASSWORD_RESET.value,
        )
        if not token_record:
            raise InvalidVerificationTokenError(
                "Invalid or expired password reset link."
            )

        user = await self.user_repo.get_by_id(token_record.user_id)
        if not user:
            raise InvalidVerificationTokenError("User associated with token not found.")

        # Update password
        user.hashed_password = hash_password(new_password)
        # Invalidate existing access tokens by bumping token_version
        user.token_version += 1
        # Revoke all existing sessions
        await self.session_repo.revoke_all_user_sessions(user.id)
        # Mark token as used
        await self.token_repo.mark_as_used(token_record.id)
        await self.session.commit()

    async def request_password_reset_otp(
        self, identifier: str
    ) -> tuple[str, str, str]:
        clean_id = identifier.strip().lower()
        user = await self.user_repo.get_by_email(clean_id)
        if not user:
            raise UserNotFoundError(
                f"No account found with email '{clean_id}'. Please check your email or register a new account."
            )
        if user.status == UserStatus.SUSPENDED:
            raise AccountSuspendedError("This account is suspended. Please contact support.")

        # Invalidate old OTPs for this user
        await self.token_repo.invalidate_user_tokens(
            user.id, TokenType.PASSWORD_RESET_OTP.value
        )

        # Generate cryptographically secure 6-digit numeric OTP
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        token_hash = self._hash_token(otp_code)
        expires = datetime.now(UTC) + timedelta(
            minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
        )

        new_record = VerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type=TokenType.PASSWORD_RESET_OTP.value,
            expires_at=expires,
        )
        await self.token_repo.create(new_record)
        await self.session.commit()

        # Record in LATEST_OTPS for diagnostics & cloud free-tier fallback
        LATEST_OTPS[clean_id] = otp_code

        logger.info(
            f"\n================ [PASSWORD RESET OTP] ================\n"
            f"To: {user.email}\n"
            f"OTP Code: {otp_code}\n"
            f"Expires in: 10 minutes\n"
            f"======================================================="
        )

        try:
            await self.email_service.send_password_reset_otp_email(
                to_email=user.email,
                full_name=user.full_name,
                otp_code=otp_code,
            )
        except Exception as err:
            logger.warning(f"Could not dispatch OTP email via SMTP to {user.email}: {err}")

        return (
            user.email,
            "A 6-digit verification code has been generated and sent.",
            otp_code,
        )

    async def reset_password_with_otp(
        self, email: str, otp_code: str, new_password: str
    ) -> None:
        clean_email = email.strip().lower()
        user = await self.user_repo.get_by_email(clean_email)
        if not user or user.status == UserStatus.SUSPENDED:
            raise InvalidVerificationTokenError("Invalid or expired verification code.")

        token_hash = self._hash_token(otp_code.strip())
        token_record = await self.token_repo.get_valid_token(
            token_hash=token_hash,
            token_type=TokenType.PASSWORD_RESET_OTP.value,
        )
        if not token_record or token_record.user_id != user.id:
            raise InvalidVerificationTokenError("Invalid or expired verification code.")

        # Update password
        user.hashed_password = hash_password(new_password)
        if user.status == UserStatus.PENDING_VERIFICATION:
            user.status = UserStatus.ACTIVE

        user.token_version += 1
        await self.session_repo.revoke_all_user_sessions(user.id)
        await self.token_repo.mark_as_used(token_record.id)
        await self.session.commit()

    async def google_authenticate(
        self, payload: GoogleAuthRequest, ip_address: str | None = None
    ) -> tuple[TokenResponse, User]:
        user_info = await verify_google_token(
            id_token=payload.id_token, access_token=payload.access_token
        )
        email = user_info["email"]
        user = await self.user_repo.get_by_email(email)

        if user is None:
            # First-time Google user: Auto-provision student account
            random_pw = secrets.token_urlsafe(32)
            user = User(
                id=UUID(int=secrets.randbits(128), version=4),
                email=email,
                hashed_password=hash_password(random_pw),
                full_name=user_info.get("name") or "Student",
                avatar_url=user_info.get("picture"),
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,  # Google verified
                token_version=1,
            )
            await self.user_repo.create(user)
            await self.session.commit()
            await self.session.refresh(user)
        else:
            if user.status == UserStatus.SUSPENDED:
                raise AccountSuspendedError("Account is suspended. Please contact support.")
            if user.status == UserStatus.PENDING_VERIFICATION:
                # If existing account was pending verification, Google verified it
                user.status = UserStatus.ACTIVE
            if not user.avatar_url and user_info.get("picture"):
                user.avatar_url = user_info.get("picture")

        now = datetime.now(UTC)
        await self.user_repo.update_last_login(user.id, now)

        access_token = create_access_token(
            subject=user.id,
            role=user.role.value,
            token_version=user.token_version,
        )
        refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(refresh_token)

        session_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        user_session = UserSession(
            user_id=user.id,
            refresh_token_hash=token_hash,
            device_name=payload.device_name or "Android Device",
            device_os=payload.device_os or "Android",
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

    async def update_preferences(
        self, user_id: UUID, payload: UserPreferencesUpdate
    ) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise InvalidCredentialsError("User not found.")

        if payload.push_notifications_enabled is not None:
            user.push_notifications_enabled = payload.push_notifications_enabled
        if payload.quiet_hours_start is not None:
            user.quiet_hours_start = payload.quiet_hours_start
        if payload.quiet_hours_end is not None:
            user.quiet_hours_end = payload.quiet_hours_end
        if payload.daily_study_goal_minutes is not None:
            user.daily_study_goal_minutes = payload.daily_study_goal_minutes
        if payload.theme_preference is not None:
            user.theme_preference = payload.theme_preference

        await self.session.commit()
        await self.session.refresh(user)
        return user
