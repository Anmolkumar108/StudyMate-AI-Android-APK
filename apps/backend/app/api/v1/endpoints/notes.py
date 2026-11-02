from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_current_active_user, get_note_service
from app.models.user import User
from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate
from app.services.note_service import (
    InvalidNoteSubjectError,
    NoteError,
    NoteNotFoundError,
    NoteService,
)

router = APIRouter()


@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new note",
    description="Creates a new note for the authenticated student. Optional subject_id must belong to the user.",
)
async def create_note(
    payload: NoteCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
) -> NoteResponse:
    try:
        note = await note_service.create_note(current_user.id, payload)
        return NoteResponse.model_validate(note)
    except InvalidNoteSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except NoteError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create note.",
        ) from e


@router.get(
    "",
    response_model=list[NoteResponse],
    status_code=status.HTTP_200_OK,
    summary="List and filter notes",
    description="Returns notes belonging to the authenticated student, with optional search, subject filter, pinned filter, and pagination.",
)
async def list_notes(
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=100,
            description="Search term matching note title or content",
        ),
    ] = None,
    subject_id: Annotated[
        UUID | None,
        Query(description="Filter notes by associated subject ID"),
    ] = None,
    is_pinned: Annotated[
        bool | None,
        Query(description="Filter notes by pinned status"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=100, description="Maximum number of notes to return"),
    ] = 50,
    offset: Annotated[
        int,
        Query(ge=0, description="Offset for pagination"),
    ] = 0,
) -> list[NoteResponse]:
    try:
        notes = await note_service.list_notes(
            user_id=current_user.id,
            search=search,
            subject_id=subject_id,
            is_pinned=is_pinned,
            limit=limit,
            offset=offset,
        )
        return [NoteResponse.model_validate(n) for n in notes]
    except InvalidNoteSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get(
    "/{note_id}",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a note by ID",
    description="Fetches a single note by ID. Returns 404 if the note does not exist or belongs to another user.",
)
async def get_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
) -> NoteResponse:
    try:
        note = await note_service.get_note(current_user.id, note_id)
        return NoteResponse.model_validate(note)
    except NoteNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found.",
        ) from e


@router.patch(
    "/{note_id}",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update a note",
    description="Updates one or more fields of an existing note owned by the authenticated student.",
)
async def patch_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
) -> NoteResponse:
    try:
        note = await note_service.update_note(current_user.id, note_id, payload)
        return NoteResponse.model_validate(note)
    except NoteNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found.",
        ) from e
    except InvalidNoteSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except NoteError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update note.",
        ) from e


@router.put(
    "/{note_id}",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a note",
    description="Updates an existing note owned by the authenticated student.",
)
async def put_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
) -> NoteResponse:
    return await patch_note(
        note_id=note_id,
        payload=payload,
        current_user=current_user,
        note_service=note_service,
    )


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a note",
    description="Deletes an existing note owned by the authenticated student.",
)
async def delete_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    note_service: Annotated[NoteService, Depends(get_note_service)],
) -> Response:
    try:
        await note_service.delete_note(current_user.id, note_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except NoteNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found.",
        ) from e
