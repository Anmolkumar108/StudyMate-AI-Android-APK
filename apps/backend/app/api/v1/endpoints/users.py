from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    DeleteAccountRequest,
    PushTokenRegisterRequest,
    UserExportData,
    UserPreferencesUpdate,
    UserResponse,
)
from app.services.auth_service import AuthService
from app.services.user_service import user_service

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve full profile details of the authenticated student."""
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me/preferences",
    response_model=UserResponse,
    summary="Update notification and study preferences",
)
async def update_my_preferences(
    payload: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Update push notifications, quiet hours, or study goals."""
    service = AuthService(db)
    return await service.update_preferences(current_user.id, payload)


@router.post(
    "/me/change-password",
    response_model=ChangePasswordResponse,
    summary="Update account password with Argon2id",
)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChangePasswordResponse:
    """Securely updates password after verifying current password, and revokes active sessions."""
    return await user_service.change_password(db, current_user.id, payload)


@router.post(
    "/me/export",
    response_model=UserExportData,
    summary="GDPR Right to Portability - Complete data export",
)
async def export_user_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserExportData:
    """Generates a complete structured archive of all student study assets."""
    return await user_service.export_user_data(db, current_user.id)


@router.delete(
    "/me",
    response_model=MessageResponse,
    summary="GDPR Right to be Forgotten - Permanent account deletion",
)
async def delete_account(
    payload: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    """Permanently purges the student account and cascades across all database records and storage."""
    return await user_service.delete_account(db, current_user.id, payload)


@router.post(
    "/me/push-token",
    response_model=MessageResponse,
    summary="Register device push token for background notifications",
)
async def register_push_token(
    payload: PushTokenRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    """Stores student's FCM / Expo push token for background alerts and announcements."""
    current_user.push_token = payload.push_token.strip()
    await db.flush()
    return MessageResponse(message="Push token registered successfully.")

