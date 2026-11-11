from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_admin_service
from app.schemas.admin import AnnouncementResponse
from app.services.admin_service import AdminService

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get("/active", response_model=list[AnnouncementResponse])
async def get_active_announcements(
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> list[AnnouncementResponse]:
    """
    Public / Student endpoint: returns currently active broadcast notifications
    for display in the Android mobile app top banner or alert dialog.
    """
    items = await admin_service.announcement_repo.list_active_for_students()
    return [AnnouncementResponse.model_validate(item) for item in items]

