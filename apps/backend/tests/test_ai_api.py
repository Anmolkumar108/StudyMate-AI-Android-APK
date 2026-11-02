import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_ai_chat_service, get_current_active_user
from app.main import app
from app.models.ai_chat import AIChatSession
from app.models.user import User, UserRole, UserStatus
from app.schemas.ai import AIExplanationResponse, AINoteGenerationResponse


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="aistudent@test.com",
        hashed_password="argon2id$test",
        full_name="AI Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_ai_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_ai_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_ai_chat_service] = lambda: mock_ai_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_explain_topic_endpoint(
    authed_client: AsyncClient,
    mock_ai_service: AsyncMock,
) -> None:
    mock_ai_service.explain_topic.return_value = AIExplanationResponse(
        topic="QuickSort",
        depth="undergraduate",
        explanation="Divide and conquer sorting algorithm.",
        key_takeaways=["Average O(N log N) time", "Partition around pivot"],
        self_check_question="What is the worst-case complexity of QuickSort?",
    )

    payload = {"topic": "QuickSort", "depth": "undergraduate"}
    response = await authed_client.post("/api/v1/ai/explain", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["topic"] == "QuickSort"
    assert "Divide and conquer" in body["explanation"]


@pytest.mark.asyncio
async def test_generate_notes_endpoint(
    authed_client: AsyncClient,
    mock_ai_service: AsyncMock,
) -> None:
    mock_ai_service.generate_notes.return_value = AINoteGenerationResponse(
        title="Cellular Respiration Notes",
        note_type="cornell",
        content="# Cellular Respiration\n\nGlycolysis -> Krebs -> ETC",
        key_points=["ATP yield", "Mitochondria role"],
        summary="Cell energy generation pathway.",
    )

    payload = {
        "source_text": "Cellular respiration produces ATP through glycolysis, Krebs cycle and electron transport chain.",
        "format": "cornell",
        "title": "Cellular Respiration Notes",
    }
    response = await authed_client.post("/api/v1/ai/generate-notes", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Cellular Respiration Notes"
    assert body["note_type"] == "cornell"


@pytest.mark.asyncio
async def test_list_chat_sessions(
    authed_client: AsyncClient,
    mock_ai_service: AsyncMock,
    test_user: User,
) -> None:
    session = AIChatSession(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Physics Questions",
        is_socratic=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_ai_service.list_sessions.return_value = [session]
    mock_ai_service.count_sessions.return_value = 1

    response = await authed_client.get("/api/v1/ai/chat/sessions")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Physics Questions"


@pytest.mark.asyncio
async def test_chat_message_endpoint(
    authed_client: AsyncClient,
    mock_ai_service: AsyncMock,
) -> None:
    from app.schemas.ai import AIChatResponse

    session_id = uuid.uuid4()
    msg_id = uuid.uuid4()
    mock_ai_service.chat_turn.return_value = AIChatResponse(
        session_id=session_id,
        message_id=msg_id,
        reply="Mera naam StudyMate AI hai!",
        role="assistant",
        model_identifier="gemini-3.1-flash-lite",
        created_at=datetime.now(UTC),
    )

    payload = {"message": "Tumhara name kya hai"}
    response = await authed_client.post("/api/v1/ai/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Mera naam StudyMate AI hai!"
    assert body["session_id"] == str(session_id)

