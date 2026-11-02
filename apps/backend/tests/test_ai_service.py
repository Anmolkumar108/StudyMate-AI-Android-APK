import uuid
import pytest
from unittest.mock import AsyncMock

from app.models.ai_chat import AIChatSession
from app.schemas.ai import AIChatRequest, AIExplanationRequest, AINoteGenerationRequest
from app.services.ai_chat_service import AIChatService
from app.services.ai_service import AIService


@pytest.mark.asyncio
async def test_ai_service_mock_stream_chat() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "What is photosynthesis?"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=False):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "photosynthesis" in full_text.lower()
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_ai_service_socratic_mode() -> None:
    ai = AIService(api_key="mock-dev-key")
    messages = [{"role": "user", "content": "Solve quadratic equation for me"}]

    chunks = []
    async for chunk in ai.stream_chat(messages=messages, is_socratic=True):
        chunks.append(chunk)

    full_text = "".join(chunks)
    assert "break it down" in full_text.lower() or "starting principle" in full_text.lower()


@pytest.mark.asyncio
async def test_ai_service_generate_explanation() -> None:
    ai = AIService(api_key="mock-dev-key")
    res = await ai.generate_explanation(topic="Binary Search Trees", depth="elif")

    assert res["topic"] == "Binary Search Trees"
    assert res["depth"] == "elif"
    assert len(res["key_takeaways"]) >= 1
    assert "self_check_question" in res


@pytest.mark.asyncio
async def test_ai_chat_service_stream_turn() -> None:
    repo = AsyncMock()
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    mock_session = AIChatSession(
        id=session_id,
        user_id=user_id,
        title="Test Chat",
        is_socratic=False,
    )
    repo.get_session_by_id.return_value = mock_session
    repo.get_session_messages.return_value = []

    chat_service = AIChatService(repository=repo, ai_service=AIService(api_key="mock-dev-key"))

    req = AIChatRequest(
        message="Help me understand Newton's third law",
        session_id=session_id,
        is_socratic=False,
    )

    events = []
    async for event in chat_service.stream_chat_turn(user_id=user_id, request=req):
        events.append(event)

    assert any("event: session" in e for e in events)
    assert any("event: done" in e for e in events)
    assert repo.add_message.call_count >= 2  # User message + assistant message

