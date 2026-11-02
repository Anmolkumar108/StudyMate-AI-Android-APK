from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_current_active_user, get_subject_service
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate
from app.services.subject_service import (
    DuplicateSubjectNameError,
    SubjectNotFoundError,
    SubjectService,
)

router = APIRouter()


@router.post(
    "",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new subject",
    description="Creates a new academic subject for the authenticated student. Enforces unique subject names per user.",
)
async def create_subject(
    payload: SubjectCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> SubjectResponse:
    try:
        subject = await subject_service.create_subject(current_user.id, payload)
        return SubjectResponse.model_validate(subject)
    except DuplicateSubjectNameError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e


@router.get(
    "",
    response_model=list[SubjectResponse],
    status_code=status.HTTP_200_OK,
    summary="List all subjects",
    description="Returns all subjects belonging to the authenticated student.",
)
async def list_subjects(
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> list[SubjectResponse]:
    subjects = await subject_service.list_subjects(current_user.id)
    return [SubjectResponse.model_validate(s) for s in subjects]


@router.get(
    "/{subject_id}",
    response_model=SubjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a subject by ID",
    description="Fetches a single subject by ID. Returns 404 if the subject does not exist or belongs to another user.",
)
async def get_subject(
    subject_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> SubjectResponse:
    try:
        subject = await subject_service.get_subject(current_user.id, subject_id)
        return SubjectResponse.model_validate(subject)
    except SubjectNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        ) from e


@router.patch(
    "/{subject_id}",
    response_model=SubjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update a subject",
    description="Updates one or more fields of an existing subject owned by the authenticated student.",
)
async def patch_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> SubjectResponse:
    try:
        subject = await subject_service.update_subject(
            current_user.id, subject_id, payload
        )
        return SubjectResponse.model_validate(subject)
    except SubjectNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        ) from e
    except DuplicateSubjectNameError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e


@router.put(
    "/{subject_id}",
    response_model=SubjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a subject",
    description="Updates an existing subject owned by the authenticated student.",
)
async def put_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> SubjectResponse:
    return await patch_subject(
        subject_id=subject_id,
        payload=payload,
        current_user=current_user,
        subject_service=subject_service,
    )


@router.delete(
    "/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a subject",
    description="Deletes an existing subject owned by the authenticated student.",
)
async def delete_subject(
    subject_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_service: Annotated[SubjectService, Depends(get_subject_service)],
) -> Response:
    try:
        await subject_service.delete_subject(current_user.id, subject_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except SubjectNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        ) from e
