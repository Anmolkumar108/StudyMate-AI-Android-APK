from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse

from app.api.deps import get_auth_service, get_current_active_user, get_current_user
from app.core.config import settings
from app.models.user import User, UserStatus
from app.repositories.audit_log_repo import AuditLogRepository
from app.schemas.auth import (
    ForgotPasswordOtpRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    OtpResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordOtpRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerificationResponse,
    VerifyEmailRequest,
)
from app.schemas.session import SessionResponse
from app.schemas.user import UserPreferencesUpdate, UserResponse
from app.services.auth_service import (
    AccountPendingVerificationError,
    AccountSuspendedError,
    AuthService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    InvalidVerificationTokenError,
    ResendRateLimitError,
    SessionNotFoundError,
    UserNotFoundError,
)
from app.services.google_auth_service import (
    GoogleEmailNotVerifiedError,
    InvalidGoogleTokenError,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
    description="Registers a new student account with Argon2id password hashing. Role is strictly assigned as 'student'.",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    auto_activate: bool = False,
) -> User:
    try:
        user_status = UserStatus.ACTIVE if auto_activate else UserStatus.PENDING_VERIFICATION
        user = await auth_service.register(
            payload, status=user_status, send_email=not auto_activate
        )
        client_ip = request.client.host if request.client else "unknown"
        device_str = payload.device_name or "Android Device"
        os_str = payload.device_os or "Android"
        audit_repo = AuditLogRepository(auth_service.session)
        await audit_repo.log(
            action="auth.student_registered",
            target_type="student_account",
            actor_id=user.id,
            target_id=str(user.id),
            details=f"New registration: {user.email} from {device_str} ({os_str})",
            ip_address=client_ip,
        )
        return user
    except EmailAlreadyRegisteredError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from e


@router.get(
    "/verify-email",
    response_class=HTMLResponse,
    summary="Web fallback and deep link trigger for email verification",
    description="Verifies token from clicked link and redirects/opens the mobile app.",
)
async def verify_email_web(
    token: Annotated[str, Query(description="Verification token from email link")],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> HTMLResponse:
    try:
        user = await auth_service.verify_email(token)
        app_deep_link = f"{settings.APP_DEEP_LINK_SCHEME}://verify-email?token={token}&status=success"
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified - StudyMate AI</title>
            <style>
                body {{
                    background: linear-gradient(135deg, #090514 0%, #150f2e 100%);
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    box-sizing: border-box;
                }}
                .card {{
                    background: rgba(22, 17, 48, 0.85);
                    border: 1px solid #3b2d6a;
                    border-radius: 24px;
                    padding: 40px 32px;
                    text-align: center;
                    max-width: 440px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                }}
                .icon {{
                    font-size: 54px;
                    margin-bottom: 16px;
                }}
                h1 {{
                    font-size: 26px;
                    font-weight: 700;
                    margin: 0 0 12px;
                    background: linear-gradient(135deg, #c084fc, #818cf8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }}
                p {{
                    color: #94a3b8;
                    font-size: 15px;
                    line-height: 1.5;
                    margin: 0 0 28px;
                }}
                .btn {{
                    display: inline-block;
                    width: 100%;
                    padding: 14px 0;
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 16px;
                    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35);
                    box-sizing: border-box;
                }}
                .note {{
                    margin-top: 20px;
                    font-size: 12px;
                    color: #64748b;
                }}
            </style>
            <script>
                // Attempt automatic deep link open on mobile browsers
                window.onload = function() {{
                    window.location.href = "{app_deep_link}";
                }};
            </script>
        </head>
        <body>
            <div class="card">
                <div class="icon">✨🎓</div>
                <h1>Email Verified!</h1>
                <p>Welcome, <strong>{user.full_name}</strong>! Your StudyMate AI account is now active and ready for your academic journey.</p>
                <a href="{app_deep_link}" class="btn">Open StudyMate AI App</a>
                <div class="note">If the app did not open automatically, tap the button above or return to the app to log in.</div>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=200)
    except InvalidVerificationTokenError as e:
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Error - StudyMate AI</title>
            <style>
                body {{
                    background: #090514;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }}
                .card {{
                    background: #181233;
                    border: 1px solid #4a2138;
                    border-radius: 20px;
                    padding: 36px 28px;
                    text-align: center;
                    max-width: 420px;
                }}
                h1 {{ color: #f87171; font-size: 22px; margin-bottom: 12px; }}
                p {{ color: #94a3b8; font-size: 14px; margin-bottom: 24px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Link Expired or Invalid</h1>
                <p>{e!s} Please open the StudyMate AI app and tap 'Resend Verification'.</p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=400)


@router.post(
    "/verify-email",
    response_model=VerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email via API code/token",
    description="Validates a single-use verification token from deep link or in-app code entry.",
)
async def verify_email_api(
    payload: VerifyEmailRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> VerificationResponse:
    try:
        user = await auth_service.verify_email(payload.token)
        return VerificationResponse(
            message="Email verified successfully. You can now log in.",
            verified=True,
            email=user.email,
        )
    except InvalidVerificationTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend email verification token",
    description="Resends a single-use verification email with cooldown rate limiting.",
)
async def resend_verification(
    payload: ResendVerificationRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    try:
        await auth_service.resend_verification(payload.email)
        return MessageResponse(
            message="If an unverified account exists with this email, a new verification link has been sent."
        )
    except ResendRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        ) from e


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate via Google OAuth",
    description="Validates a Google ID token or Access Token against Google OAuth servers and issues session tokens.",
)
async def google_auth(
    payload: GoogleAuthRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    client_ip = request.client.host if request.client else None
    try:
        tokens, _ = await auth_service.google_authenticate(payload, ip_address=client_ip)
        return tokens
    except InvalidGoogleTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
    except GoogleEmailNotVerifiedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        ) from e
    except AccountSuspendedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact support.",
        ) from e


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Request password reset",
    description="Sends password reset instructions to the given email address without exposing user existence.",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    await auth_service.forgot_password(payload.email)
    return MessageResponse(
        message="If an account exists with this email, password reset instructions have been sent."
    )


@router.post(
    "/forgot-password-otp",
    response_model=OtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Request 6-digit password reset OTP",
    description="Generates and dispatches a 6-digit numeric OTP to the student's email.",
)
async def forgot_password_otp(
    payload: ForgotPasswordOtpRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> OtpResponse:
    try:
        email, message, otp_code = await auth_service.request_password_reset_otp(payload.email)
        return OtpResponse(
            email=email,
            message=message,
            success=True,
            dev_otp=otp_code,
        )
    except UserNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        ) from err
    except AccountSuspendedError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        ) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to send verification code: {err}",
        ) from err


@router.post(
    "/reset-password-otp",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset password using 6-digit OTP",
    description="Verifies the 6-digit OTP and updates the student's password in PostgreSQL.",
)
async def reset_password_otp(
    payload: ResetPasswordOtpRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    try:
        await auth_service.reset_password_with_otp(
            payload.email, payload.otp, payload.new_password
        )
        return MessageResponse(
            message="Your password has been reset successfully. You can now log in."
        )
    except InvalidVerificationTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset password with token",
    description="Sets a new password using a valid, non-expired password reset token.",
)
async def reset_password(
    payload: ResetPasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    try:
        await auth_service.reset_password(payload.token, payload.new_password)
        return MessageResponse(
            message="Your password has been reset successfully. Please log in with your new password."
        )
    except InvalidVerificationTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue tokens",
    description="Authenticates credentials using Argon2id, timing-safe evaluation, and returns an access and refresh token pair.",
)
async def login(
    payload: LoginRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    client_ip = request.client.host if request.client else None
    audit_repo = AuditLogRepository(auth_service.session)
    device_str = payload.device_name or "Android Device"
    os_str = payload.device_os or "Android"

    try:
        tokens, user = await auth_service.login(payload, ip_address=client_ip)
        await audit_repo.log(
            action="auth.student_login_success",
            target_type="student_session",
            actor_id=user.id,
            target_id=str(user.id),
            details=f"Login successful: {user.email} on {device_str} ({os_str})",
            ip_address=client_ip,
        )
        return tokens
    except InvalidCredentialsError as e:
        await audit_repo.log(
            action="auth.student_login_failed",
            target_type="auth_attempt",
            actor_id=None,
            target_id=payload.email,
            details=f"Failed login (Invalid credentials) for {payload.email} on {device_str} ({os_str})",
            ip_address=client_ip,
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        ) from e
    except AccountSuspendedError as e:
        await audit_repo.log(
            action="auth.student_login_failed",
            target_type="auth_attempt",
            actor_id=None,
            target_id=payload.email,
            details=f"Failed login (Suspended account) for {payload.email} on {device_str} ({os_str})",
            ip_address=client_ip,
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact support.",
        ) from e
    except AccountPendingVerificationError as e:
        await audit_repo.log(
            action="auth.student_login_failed",
            target_type="auth_attempt",
            actor_id=None,
            target_id=payload.email,
            details=f"Failed login (Pending verification) for {payload.email} on {device_str} ({os_str})",
            ip_address=client_ip,
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account verification is pending. Please verify your email.",
        ) from e


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token",
    description="Validates the presented single-use refresh token, revokes it atomically, and issues a new access and refresh token pair.",
)
async def refresh_tokens(
    payload: RefreshTokenRequest,
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    client_ip = request.client.host if request.client else None
    try:
        tokens = await auth_service.refresh_tokens(
            payload.refresh_token, ip_address=client_ip
        )
        return tokens
    except InvalidRefreshTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token.",
        ) from e
    except AccountSuspendedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact support.",
        ) from e
    except AccountPendingVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account verification is pending. Please verify your email.",
        ) from e


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated student profile",
    description="Returns the safe profile of the currently authenticated student.",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    return current_user


@router.patch(
    "/me/preferences",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update student notification preferences and quiet hours",
    description="Updates push notification toggles, quiet hours, study goals, or theme preference.",
)
async def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    return await auth_service.update_preferences(current_user.id, payload)


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out current session",
    description="Revokes the specified refresh token session for the authenticated user.",
)
async def logout(
    payload: LogoutRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    await auth_service.logout(current_user.id, payload.refresh_token)
    return MessageResponse(message="Successfully logged out.")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out all devices",
    description="Revokes all active sessions for the user and increments token_version to invalidate all existing access tokens immediately.",
)
async def logout_all(
    current_user: Annotated[User, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    await auth_service.logout_all(current_user.id)
    return MessageResponse(message="Successfully logged out from all devices.")


@router.get(
    "/sessions",
    response_model=list[SessionResponse],
    status_code=status.HTTP_200_OK,
    summary="List active device sessions",
    description="Returns all active, non-expired sessions belonging to the authenticated student.",
)
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_active_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[SessionResponse]:
    sessions = await auth_service.list_sessions(current_user.id)
    return [SessionResponse.model_validate(s) for s in sessions]


@router.delete(
    "/sessions/{session_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Revoke a specific session",
    description="Revokes a single active session belonging to the authenticated student. Enforces strict ownership checks.",
)
async def revoke_session(
    session_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    try:
        await auth_service.revoke_session(current_user.id, session_id)
        return MessageResponse(message="Session successfully revoked.")
    except SessionNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        ) from e
