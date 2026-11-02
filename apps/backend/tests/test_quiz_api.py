import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_quiz_service
from app.main import app
from app.models.quiz import Quiz, QuizQuestion
from app.models.user import User, UserRole, UserStatus
from app.schemas.quiz import QuizAttemptResponse
from app.services.quiz_service import QuizNotFoundError


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="quizstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Quiz Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_quiz_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_quiz_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_quiz_service] = lambda: mock_quiz_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_generate_quiz_api(
    authed_client: AsyncClient,
    mock_quiz_service: AsyncMock,
    test_user: User,
) -> None:
    quiz_id = uuid.uuid4()
    q_id = uuid.uuid4()
    q = QuizQuestion(
        id=q_id,
        quiz_id=quiz_id,
        question_text="What is the time complexity of QuickSort average case?",
        question_type="mcq",
        options=[{"key": "A", "text": "O(N log N)"}, {"key": "B", "text": "O(N^2)"}],
        correct_option_key="A",
        explanation="QuickSort divides arrays around a pivot.",
        created_at=datetime.now(UTC),
    )
    sample_quiz = Quiz(
        id=quiz_id,
        user_id=test_user.id,
        title="Algorithms Quiz",
        source_type="topic",
        difficulty="medium",
        question_count=1,
        created_at=datetime.now(UTC),
        questions=[q],
    )
    mock_quiz_service.generate_quiz.return_value = sample_quiz

    payload = {
        "title": "Algorithms Quiz",
        "topic": "QuickSort",
        "question_count": 1,
    }
    response = await authed_client.post("/api/v1/quizzes/generate", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Algorithms Quiz"
    assert len(body["questions"]) == 1
    assert body["questions"][0]["correct_option_key"] == "A"


@pytest.mark.asyncio
async def test_submit_quiz_api(
    authed_client: AsyncClient,
    mock_quiz_service: AsyncMock,
) -> None:
    quiz_id = uuid.uuid4()
    mock_quiz_service.submit_quiz_attempt.return_value = QuizAttemptResponse(
        id=uuid.uuid4(),
        quiz_id=quiz_id,
        score_percentage=100.0,
        correct_count=1,
        incorrect_count=0,
        time_taken_seconds=30,
        completed_at=datetime.now(UTC),
        review=[],
    )

    payload = {
        "answers": {"question-1": "A"},
        "time_taken_seconds": 30,
    }
    response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/submit", json=payload)
    assert response.status_code == 200
    assert response.json()["score_percentage"] == 100.0


@pytest.mark.asyncio
async def test_convert_missed_to_flashcards_api(
    authed_client: AsyncClient,
    mock_quiz_service: AsyncMock,
) -> None:
    quiz_id = uuid.uuid4()
    attempt_id = uuid.uuid4()
    deck_id = uuid.uuid4()

    mock_quiz_service.convert_missed_to_flashcards.return_value = (deck_id, 3)

    payload = {}
    response = await authed_client.post(
        f"/api/v1/quizzes/{quiz_id}/attempts/{attempt_id}/convert-to-flashcards",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cards_created"] == 3
    assert body["deck_id"] == str(deck_id)
