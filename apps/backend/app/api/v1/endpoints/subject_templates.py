import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_admin_service, get_current_active_user
from app.models.user import User
from app.schemas.subject_template import (
    EnrollTemplateResponse,
    SubjectTemplateListResponse,
    SubjectTemplateResponse,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/subject-templates", tags=["Subject Templates"])


@router.get("", response_model=SubjectTemplateListResponse)
async def list_active_subject_templates(
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    category: str | None = Query(None, description="Filter by subject field/category"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SubjectTemplateListResponse:
    """
    Public / Student endpoint: browse curated university subject starter templates.
    """
    items, total, categories = await admin_service.list_subject_templates(
        category=category,
        active_only=True,
        limit=limit,
        offset=offset,
    )
    return SubjectTemplateListResponse(
        items=[SubjectTemplateResponse.model_validate(t) for t in items],
        total=total,
        categories=categories,
    )


@router.post("/{template_id}/enroll", response_model=EnrollTemplateResponse, status_code=status.HTTP_201_CREATED)
async def enroll_in_subject_template(
    template_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
) -> EnrollTemplateResponse:
    """
    Student action: 1-Click enroll in a curated subject template.
    Instantly creates a real Subject in the student's personal semester roster.
    """
    try:
        new_subject = await admin_service.enroll_student_in_template(
            template_id=template_id,
            student_id=current_user.id,
        )
        return EnrollTemplateResponse(
            subject_id=new_subject.id,
            name=new_subject.name,
            code=new_subject.code,
            color=new_subject.color,
            message=f"Successfully enrolled in '{new_subject.name}'. It is now ready in your Subjects roster.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e

