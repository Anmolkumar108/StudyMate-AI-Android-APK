import base64
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)

from app.api.deps import get_current_active_user, get_document_service
from app.models.document import DocStatus
from app.models.user import User
from app.schemas.document import (
    DocumentBase64UploadRequest,
    DocumentListResponse,
    DocumentResponse,
    DocumentTextCreateRequest,
)
from app.services.document_service import (
    DocumentNotFoundError,
    DocumentService,
    DocumentValidationError,
)

router = APIRouter()


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload PDF course document and trigger asynchronous ingestion",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
    file: Annotated[UploadFile, File(description="PDF file up to 25MB")],
    title: Annotated[str, Form(description="Display title for document", min_length=1, max_length=250)],
    subject_id: Annotated[UUID | None, Form(description="Optional linked subject UUID")] = None,
) -> DocumentResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename",
        )

    content = await file.read()
    try:
        doc = await doc_service.initiate_upload(
            user_id=current_user.id,
            filename=file.filename,
            content=content,
            title=title,
            subject_id=subject_id,
        )
    except DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # Enqueue background text extraction & summarization
    background_tasks.add_task(
        doc_service.process_document_background,
        document_id=doc.id,
        user_id=current_user.id,
    )

    return DocumentResponse.model_validate(doc)


@router.post(
    "/upload-base64",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload PDF course document as Base64 JSON (zero native FormData friction)",
)
async def upload_document_base64(
    background_tasks: BackgroundTasks,
    payload: DocumentBase64UploadRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    try:
        content = base64.b64decode(payload.file_base64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 payload",
        ) from exc

    try:
        doc = await doc_service.initiate_upload(
            user_id=current_user.id,
            filename=payload.filename,
            content=content,
            title=payload.title,
            subject_id=payload.subject_id,
        )
    except DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # Enqueue background text extraction & summarization
    background_tasks.add_task(
        doc_service.process_document_background,
        document_id=doc.id,
        user_id=current_user.id,
    )

    return DocumentResponse.model_validate(doc)


@router.post(
    "/create",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create course document directly from typed notes or syllabus with instant AI summary",
)
async def create_document_from_text(
    payload: DocumentTextCreateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    doc = await doc_service.create_text_document(
        user_id=current_user.id,
        title=payload.title,
        content=payload.content,
        subject_id=payload.subject_id,
    )
    return DocumentResponse.model_validate(doc)


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List authenticated user's uploaded documents",
)
async def list_documents(
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
    subject_id: UUID | None = None,
    status_filter: DocStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> DocumentListResponse:
    docs = await doc_service.list_documents(
        user_id=current_user.id,
        subject_id=subject_id,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )
    total = await doc_service.count_documents(
        user_id=current_user.id,
        subject_id=subject_id,
        status=status_filter,
    )
    return DocumentListResponse(
        items=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
    )


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get document metadata and AI summary by ID",
)
async def get_document(
    document_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    try:
        doc = await doc_service.get_document(document_id, current_user.id)
        return DocumentResponse.model_validate(doc)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from exc


@router.get(
    "/{document_id}/file",
    summary="Download or stream document PDF file content",
)
async def get_document_file(
    document_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
) -> Response:
    try:
        doc, file_bytes = await doc_service.get_document_file_bytes(document_id, current_user.id)
        return Response(
            content=file_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{doc.file_name}"',
            },
        )
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from exc


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete uploaded document and its physical storage file",
)
async def delete_document(
    document_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    doc_service: Annotated[DocumentService, Depends(get_document_service)],
) -> None:
    try:
        await doc_service.delete_document(document_id, current_user.id)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        ) from exc

