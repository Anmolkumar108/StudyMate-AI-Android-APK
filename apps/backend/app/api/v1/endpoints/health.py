from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine

router = APIRouter()


@router.get("/health", response_model=dict[str, Any])
async def health_check() -> dict[str, Any]:
    db_status = "unconfigured"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as e:  # noqa: BLE001
        db_status = f"unavailable: {type(e).__name__}"

    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
        "database": db_status,
        "smtp_configured": bool(settings.SMTP_HOST and settings.SMTP_PASSWORD),
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
    }


@router.get("/health/smtp", response_model=dict[str, Any])
async def smtp_health() -> dict[str, Any]:
    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER,
        "smtp_configured": bool(settings.SMTP_HOST and settings.SMTP_PASSWORD),
        "from_email": settings.EMAILS_FROM_EMAIL,
        "from_name": settings.EMAILS_FROM_NAME,
        "has_webhook_relay": bool(settings.EMAIL_WEBHOOK_URL),
        "has_brevo": bool(settings.BREVO_API_KEY),
        "has_resend": bool(settings.RESEND_API_KEY),
    }


@router.get("/health/latest-otp", response_model=dict[str, Any])
async def get_latest_otp(email: str = "") -> dict[str, Any]:
    from app.services.auth_service import LATEST_OTPS

    clean = email.strip().lower() if email else ""
    if clean and clean in LATEST_OTPS:
        return {
            "email": clean,
            "latest_otp": LATEST_OTPS[clean],
            "message": "Active 6-digit verification code",
            "expires_in_minutes": 10,
        }
    if not clean and LATEST_OTPS:
        # Return most recent if email param was omitted
        last_key = list(LATEST_OTPS.keys())[-1]
        return {
            "email": last_key,
            "latest_otp": LATEST_OTPS[last_key],
            "message": "Active 6-digit verification code",
            "expires_in_minutes": 10,
        }
    return {
        "email": clean,
        "latest_otp": None,
        "message": "No active OTP generated yet. Request one on the Password Recovery screen.",
    }
