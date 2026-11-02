from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_ai_chat_service, get_current_active_user
from app.models.user import User
from app.schemas.ai import (
    AIChatRequest,
    AIChatResponse,
    AIChatSessionListResponse,
    AIChatSessionResponse,
    AIExplanationRequest,
    AIExplanationResponse,
    AINoteGenerationRequest,
    AINoteGenerationResponse,
)
from app.services.ai_chat_service import AIChatService

router = APIRouter()


@router.post(
    "/chat/stream",
    summary="Stream conversational AI responses via Server-Sent Events (SSE)",
)
async def chat_stream(
    request: AIChatRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> StreamingResponse:
    generator = chat_service.stream_chat_turn(
        user_id=current_user.id,
        request=request,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chat",
    response_model=AIChatResponse,
    summary="Send a chat message and receive AI tutor response",
)
async def chat_message(
    request: AIChatRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> AIChatResponse:
    return await chat_service.chat_turn(
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "/chat/sessions",
    response_model=AIChatSessionListResponse,
    summary="List authenticated user's AI tutor conversations",
)
async def list_chat_sessions(
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
    subject_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AIChatSessionListResponse:
    sessions = await chat_service.list_sessions(
        user_id=current_user.id,
        subject_id=subject_id,
        limit=limit,
        offset=offset,
    )
    total = await chat_service.count_sessions(
        user_id=current_user.id,
        subject_id=subject_id,
    )
    return AIChatSessionListResponse(
        items=[AIChatSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


@router.get(
    "/chat/sessions/{session_id}",
    response_model=AIChatSessionResponse,
    summary="Retrieve AI conversation history by session ID",
)
async def get_chat_session(
    session_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> AIChatSessionResponse:
    session = await chat_service.get_session(session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )
    return AIChatSessionResponse.model_validate(session)


@router.delete(
    "/chat/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an AI chat conversation",
)
async def delete_chat_session(
    session_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> None:
    deleted = await chat_service.delete_session(session_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )


@router.post(
    "/explain",
    response_model=AIExplanationResponse,
    summary="Generate conceptual topic explanation (ELI5 / High School / Academic)",
)
async def explain_topic(
    request: AIExplanationRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> AIExplanationResponse:
    return await chat_service.explain_topic(
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/generate-notes",
    response_model=AINoteGenerationResponse,
    summary="Transform lecture transcript or raw text into Cornell or executive study notes",
)
async def generate_notes(
    request: AINoteGenerationRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    chat_service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> AINoteGenerationResponse:
    return await chat_service.generate_notes(
        user_id=current_user.id,
        request=request,
    )

