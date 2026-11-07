from collections.abc import AsyncGenerator, Sequence
from uuid import UUID

from app.models.ai_chat import AIChatMessage, AIChatSession
from app.repositories.ai_chat_repo import AIChatRepository
from app.repositories.subject_repo import SubjectRepository
from app.schemas.ai import (
    AIChatRequest,
    AIChatResponse,
    AIExplanationRequest,
    AIExplanationResponse,
    AINoteGenerationRequest,
    AINoteGenerationResponse,
)
from app.services.ai_service import AIService


class AIChatService:
    def __init__(
        self,
        repository: AIChatRepository,
        subject_repo: SubjectRepository | None = None,
        ai_service: AIService | None = None,
    ) -> None:
        self.repository = repository
        self.subject_repo = subject_repo
        self.ai = ai_service or AIService()

    async def list_sessions(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[AIChatSession]:
        return await self.repository.list_sessions_by_user(
            user_id=user_id,
            subject_id=subject_id,
            limit=limit,
            offset=offset,
        )

    async def count_sessions(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
    ) -> int:
        return await self.repository.count_sessions_by_user(
            user_id=user_id,
            subject_id=subject_id,
        )

    async def get_session(self, session_id: UUID, user_id: UUID) -> AIChatSession | None:
        return await self.repository.get_session_by_id(session_id, user_id, load_messages=True)

    async def delete_session(self, session_id: UUID, user_id: UUID) -> bool:
        session = await self.get_session(session_id, user_id)
        if not session:
            return False
        await self.repository.delete_session(session)
        return True

    async def stream_chat_turn(
        self,
        user_id: UUID,
        request: AIChatRequest,
    ) -> AsyncGenerator[str, None]:
        """Process chat turn, persist messages, and stream tokens."""
        # 1. Resolve or create session
        subject_name = None
        if request.session_id:
            session = await self.get_session(request.session_id, user_id)
            if not session:
                session = AIChatSession(
                    id=request.session_id,
                    user_id=user_id,
                    subject_id=request.subject_id,
                    title=request.message[:40] + ("..." if len(request.message) > 40 else ""),
                    is_socratic=request.is_socratic,
                )
                session = await self.repository.create_session(session)
        else:
            session = AIChatSession(
                user_id=user_id,
                subject_id=request.subject_id,
                title=request.message[:40] + ("..." if len(request.message) > 40 else ""),
                is_socratic=request.is_socratic,
            )
            session = await self.repository.create_session(session)

        # 2. Contextual subject lookup
        if session.subject_id and self.subject_repo:
            subj = await self.subject_repo.get_by_id(session.subject_id, user_id)
            if subj:
                subject_name = subj.name

        # 3. Save incoming user message
        user_msg = AIChatMessage(
            session_id=session.id,
            role="user",
            content=request.message,
        )
        await self.repository.add_message(user_msg)

        # 4. Fetch recent messages for conversational context
        history = await self.repository.get_session_messages(session.id, limit=12)
        formatted_history = [{"role": m.role, "content": m.content} for m in history]

        # 5. Yield session metadata as initial event
        yield f"event: session\ndata: {session.id!s}\n\n"

        # 6. Stream tokens from AI provider and accumulate response
        full_response_parts: list[str] = []
        async for chunk in self.ai.stream_chat(
            messages=formatted_history,
            is_socratic=session.is_socratic or request.is_socratic,
            subject_name=subject_name,
        ):
            full_response_parts.append(chunk)
            # SSE data format
            clean_chunk = chunk.replace("\n", "\\n")
            yield f"data: {clean_chunk}\n\n"

        yield "event: done\ndata: [DONE]\n\n"

        # 7. Persist assistant response to DB
        full_text = "".join(full_response_parts)
        if full_text.strip():
            assistant_msg = AIChatMessage(
                session_id=session.id,
                role="assistant",
                content=full_text,
                model_identifier=self.ai.model_name,
            )
            await self.repository.add_message(assistant_msg)

    async def chat_turn(
        self,
        user_id: UUID,
        request: AIChatRequest,
    ) -> AIChatResponse:
        """Process conversational chat turn synchronously for mobile clients."""
        # 1. Resolve or create session
        subject_name = None
        if request.session_id:
            session = await self.get_session(request.session_id, user_id)
            if not session:
                session = AIChatSession(
                    id=request.session_id,
                    user_id=user_id,
                    subject_id=request.subject_id,
                    title=request.message[:40] + ("..." if len(request.message) > 40 else ""),
                    is_socratic=request.is_socratic,
                )
                session = await self.repository.create_session(session)
        else:
            session = AIChatSession(
                user_id=user_id,
                subject_id=request.subject_id,
                title=request.message[:40] + ("..." if len(request.message) > 40 else ""),
                is_socratic=request.is_socratic,
            )
            session = await self.repository.create_session(session)

        # 2. Contextual subject lookup
        if session.subject_id and self.subject_repo:
            subj = await self.subject_repo.get_by_id(session.subject_id, user_id)
            if subj:
                subject_name = subj.name

        # 3. Save incoming user message
        user_msg = AIChatMessage(
            session_id=session.id,
            role="user",
            content=request.message,
        )
        await self.repository.add_message(user_msg)

        # 4. Fetch recent history for conversational context
        history = await self.repository.get_session_messages(session.id, limit=12)
        formatted_history = [{"role": m.role, "content": m.content} for m in history]

        # 5. Generate AI reply
        reply_text = await self.ai.chat_completion(
            messages=formatted_history,
            is_socratic=session.is_socratic or request.is_socratic,
            subject_name=subject_name,
        )

        # 6. Save assistant message
        assistant_msg = AIChatMessage(
            session_id=session.id,
            role="assistant",
            content=reply_text,
            model_identifier=self.ai.model_name,
        )
        assistant_msg = await self.repository.add_message(assistant_msg)

        return AIChatResponse(
            session_id=session.id,
            message_id=assistant_msg.id,
            reply=reply_text,
            role="assistant",
            model_identifier=self.ai.model_name,
            created_at=assistant_msg.created_at,
        )

    async def explain_topic(
        self,
        user_id: UUID,
        request: AIExplanationRequest,
    ) -> AIExplanationResponse:
        subject_name = None
        if request.subject_id and self.subject_repo:
            subj = await self.subject_repo.get_by_id(request.subject_id, user_id)
            if subj:
                subject_name = subj.name

        data = await self.ai.generate_explanation(
            topic=request.topic,
            depth=request.depth,
            subject_name=subject_name,
        )
        return AIExplanationResponse(
            topic=data.get("topic", request.topic),
            depth=data.get("depth", request.depth),
            explanation=data.get("explanation", ""),
            key_takeaways=data.get("key_takeaways", []),
            self_check_question=data.get("self_check_question", ""),
        )

    async def generate_notes(
        self,
        user_id: UUID,
        request: AINoteGenerationRequest,
    ) -> AINoteGenerationResponse:
        subject_name = None
        if request.subject_id and self.subject_repo:
            subj = await self.subject_repo.get_by_id(request.subject_id, user_id)
            if subj:
                subject_name = subj.name

        data = await self.ai.generate_notes(
            source_text=request.source_text,
            note_type=request.format,
            title=request.title,
            subject_name=subject_name,
        )
        return AINoteGenerationResponse(
            title=data.get("title", request.title or "Generated Study Note"),
            note_type=data.get("note_type", request.format),
            content=data.get("content", ""),
            key_points=data.get("key_points", []),
            summary=data.get("summary", ""),
        )

