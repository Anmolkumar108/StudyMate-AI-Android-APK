import uuid
from unittest.mock import AsyncMock

import pytest

from app.models.flashcard import FlashcardDeck
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.schemas.quiz import QuizGenerateRequest, QuizSubmitRequest
from app.services.ai_service import AIService
from app.services.quiz_service import QuizService


@pytest.mark.asyncio
async def test_generate_quiz_success() -> None:
    repo = AsyncMock()
    user_id = uuid.uuid4()
    quiz_id = uuid.uuid4()

    async def mock_create_quiz(quiz: Quiz, questions: list[QuizQuestion]) -> Quiz:
        quiz.id = quiz_id
        quiz.questions = questions
        return quiz

    repo.create_quiz.side_effect = mock_create_quiz

    ai = AIService(api_key="mock-dev-key")
    service = QuizService(repository=repo, ai_service=ai)

    req = QuizGenerateRequest(
        title="Operating Systems Quiz",
        topic="Virtual Memory & Paging",
        difficulty="medium",
        question_count=3,
    )

    quiz = await service.generate_quiz(user_id=user_id, request=req)
    assert quiz.id == quiz_id
    assert len(quiz.questions) == 3
    assert repo.create_quiz.called


@pytest.mark.asyncio
async def test_submit_quiz_attempt_scoring() -> None:
    repo = AsyncMock()
    user_id = uuid.uuid4()
    quiz_id = uuid.uuid4()
    q1_id = uuid.uuid4()
    q2_id = uuid.uuid4()

    q1 = QuizQuestion(
        id=q1_id,
        quiz_id=quiz_id,
        question_text="What does TCP guarantee?",
        question_type="mcq",
        options=[{"key": "A", "text": "Ordered, reliable delivery"}, {"key": "B", "text": "Low latency only"}],
        correct_option_key="A",
        explanation="TCP uses ACKs and sequence numbers.",
    )
    q2 = QuizQuestion(
        id=q2_id,
        quiz_id=quiz_id,
        question_text="What is 2+2?",
        question_type="mcq",
        options=[{"key": "A", "text": "3"}, {"key": "B", "text": "4"}],
        correct_option_key="B",
        explanation="2+2=4.",
    )

    mock_quiz = Quiz(
        id=quiz_id,
        user_id=user_id,
        title="Math & Network Quiz",
        questions=[q1, q2],
    )
    repo.get_quiz_by_id.return_value = mock_quiz

    async def mock_create_attempt(attempt: QuizAttempt) -> QuizAttempt:
        attempt.id = uuid.uuid4()
        return attempt

    repo.create_attempt.side_effect = mock_create_attempt

    service = QuizService(repository=repo)
    # User gets q1 right (A) and q2 wrong (A instead of B)
    submit_req = QuizSubmitRequest(
        answers={str(q1_id): "A", str(q2_id): "A"},
        time_taken_seconds=45,
    )

    result = await service.submit_quiz_attempt(user_id=user_id, quiz_id=quiz_id, request=submit_req)
    assert result.correct_count == 1
    assert result.incorrect_count == 1
    assert result.score_percentage == 50.0
    assert len(result.review) == 2
    assert result.review[0].is_correct is True
    assert result.review[1].is_correct is False


@pytest.mark.asyncio
async def test_convert_missed_to_flashcards() -> None:
    repo = AsyncMock()
    deck_repo = AsyncMock()
    card_repo = AsyncMock()
    user_id = uuid.uuid4()
    quiz_id = uuid.uuid4()
    attempt_id = uuid.uuid4()
    q1_id = uuid.uuid4()

    q1 = QuizQuestion(
        id=q1_id,
        quiz_id=quiz_id,
        question_text="What is Dijkstra's algorithm?",
        options=[{"key": "A", "text": "Shortest path algorithm"}, {"key": "B", "text": "Sorting algorithm"}],
        correct_option_key="A",
        explanation="Dijkstra solves single-source shortest path.",
    )
    mock_quiz = Quiz(id=quiz_id, user_id=user_id, title="Graph Algorithms", questions=[q1])
    mock_attempt = QuizAttempt(
        id=attempt_id,
        quiz_id=quiz_id,
        user_id=user_id,
        answers_submitted={str(q1_id): "B"},  # user submitted B, correct is A
        quiz=mock_quiz,
    )
    repo.get_attempt_by_id.return_value = mock_attempt

    mock_deck = FlashcardDeck(id=uuid.uuid4(), user_id=user_id, title="Review: Graph Algorithms")
    deck_repo.create.return_value = mock_deck

    service = QuizService(
        repository=repo,
        deck_repo=deck_repo,
        card_repo=card_repo,
    )

    deck_id, cards_created = await service.convert_missed_to_flashcards(
        user_id=user_id,
        quiz_id=quiz_id,
        attempt_id=attempt_id,
    )

    assert cards_created == 1
    assert card_repo.create.called
    created_card = card_repo.create.call_args[0][0]
    assert created_card.question == "What is Dijkstra's algorithm?"
    assert "Shortest path algorithm" in created_card.answer
