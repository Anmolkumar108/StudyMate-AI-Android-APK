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
    }
