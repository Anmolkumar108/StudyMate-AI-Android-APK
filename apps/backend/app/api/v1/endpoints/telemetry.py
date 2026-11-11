from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.repositories.audit_log_repo import AuditLogRepository
from app.schemas.admin import DevicePingRequest

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post(
    "/device-ping",
    status_code=status.HTTP_200_OK,
    summary="Record mobile device launch telemetry",
    description="Records device model, operating system, app version, and IP when student opens the app.",
)
async def device_ping(
    payload: DevicePingRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    action = "telemetry.first_launch" if payload.is_first_launch else "telemetry.app_opened"

    device_str = payload.device_name or "Android Device"
    os_str = payload.device_os or "Android"
    ver_str = payload.app_version or "1.0.0"

    details = f"Device: {device_str} | OS: {os_str} | App: v{ver_str}"

    audit_repo = AuditLogRepository(db)
    await audit_repo.log(
        action=action,
        target_type="mobile_device",
        actor_id=payload.user_id,
        target_id=device_str,
        details=details,
        ip_address=client_ip,
    )

    return {
        "status": "recorded",
        "action": action,
        "timestamp": datetime.now(UTC).isoformat(),
    }

