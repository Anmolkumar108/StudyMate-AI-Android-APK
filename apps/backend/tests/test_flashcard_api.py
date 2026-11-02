import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_flashcard_service
from app.main import app
from app.models.flashcard import Flashcard, FlashcardDeck
from app.models.user import User, UserRole, UserStatus
from app.schemas.flashcard import DeckResponse
from app.services.flashcard_service import (
    CardNotFoundError,
    DeckNotFoundError,
    InvalidDeckSubjectError,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="flashcardstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Flashcard Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_flashcard_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_flashcard_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_flashcard_service] = lambda: mock_flashcard_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def unauthed_client() -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def sample_deck(test_user: User) -> FlashcardDeck:
    now = datetime.now(UTC)
    deck = FlashcardDeck(
        id=uuid.uuid4(),
        user_id=test_user.id,
        subject_id=None,
        title="Linear Algebra",
        description="Matrices and Eigenvectors",
        created_at=now,
        updated_at=now,
    )
    deck.cards = []
    return deck


@pytest.fixture
def sample_card(sample_deck: FlashcardDeck) -> Flashcard:
    now = datetime.now(UTC)
    return Flashcard(
        id=uuid.uuid4(),
        deck_id=sample_deck.id,
        user_id=sample_deck.user_id,
        question="What is an eigenvalue?",
        answer="A scalar lambda such that Av = lambda v for a non-zero vector v.",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_create_deck_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
) -> None:
    mock_flashcard_service.create_deck.return_value = sample_deck

    response = await authed_client.post(
        "/api/v1/flashcards/decks",
        json={"title": "Linear Algebra", "description": "Matrices"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(sample_deck.id)
    assert data["title"] == "Linear Algebra"
    assert data["card_count"] == 0


@pytest.mark.asyncio
async def test_create_deck_unauthorized(
    unauthed_client: AsyncClient,
) -> None:
    response = await unauthed_client.post(
        "/api/v1/flashcards/decks",
        json={"title": "Unauthorized Deck"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_deck_invalid_subject_400(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
) -> None:
    mock_flashcard_service.create_deck.side_effect = InvalidDeckSubjectError(
        "Subject does not exist."
    )

    response = await authed_client.post(
        "/api/v1/flashcards/decks",
        json={"title": "Math", "subject_id": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "Subject does not exist." in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_decks_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
) -> None:
    mock_flashcard_service.list_decks.return_value = [
        DeckResponse(
            id=sample_deck.id,
            user_id=sample_deck.user_id,
            subject_id=sample_deck.subject_id,
            title=sample_deck.title,
            description=sample_deck.description,
            card_count=3,
            created_at=sample_deck.created_at,
            updated_at=sample_deck.updated_at,
        )
    ]

    response = await authed_client.get("/api/v1/flashcards/decks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Linear Algebra"
    assert data[0]["card_count"] == 3


@pytest.mark.asyncio
async def test_get_deck_details_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    sample_deck.cards = [sample_card]
    mock_flashcard_service.get_deck.return_value = sample_deck

    response = await authed_client.get(f"/api/v1/flashcards/decks/{sample_deck.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(sample_deck.id)
    assert len(data["cards"]) == 1
    assert data["cards"][0]["question"] == sample_card.question


@pytest.mark.asyncio
async def test_get_deck_not_found_404(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
) -> None:
    mock_flashcard_service.get_deck.side_effect = DeckNotFoundError("Deck not found.")

    response = await authed_client.get(f"/api/v1/flashcards/decks/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_deck_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
) -> None:
    sample_deck.title = "Updated Algebra"
    mock_flashcard_service.update_deck.return_value = sample_deck

    response = await authed_client.patch(
        f"/api/v1/flashcards/decks/{sample_deck.id}",
        json={"title": "Updated Algebra"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Algebra"


@pytest.mark.asyncio
async def test_delete_deck_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
) -> None:
    mock_flashcard_service.delete_deck.return_value = None

    response = await authed_client.delete(f"/api/v1/flashcards/decks/{sample_deck.id}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_list_cards_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    mock_flashcard_service.list_cards.return_value = [sample_card]

    response = await authed_client.get(
        f"/api/v1/flashcards/decks/{sample_deck.id}/cards"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["question"] == sample_card.question


@pytest.mark.asyncio
async def test_create_card_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    mock_flashcard_service.create_card.return_value = sample_card

    response = await authed_client.post(
        f"/api/v1/flashcards/decks/{sample_deck.id}/cards",
        json={
            "question": "What is an eigenvalue?",
            "answer": "A scalar lambda such that Av = lambda v for a non-zero vector v.",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(sample_card.id)
    assert data["question"] == sample_card.question


@pytest.mark.asyncio
async def test_get_card_not_found_404(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
) -> None:
    mock_flashcard_service.get_card.side_effect = CardNotFoundError("Card not found.")

    response = await authed_client.get(
        f"/api/v1/flashcards/decks/{sample_deck.id}/cards/{uuid.uuid4()}"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_card_success(
    authed_client: AsyncClient,
    mock_flashcard_service: AsyncMock,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    mock_flashcard_service.delete_card.return_value = None

    response = await authed_client.delete(
        f"/api/v1/flashcards/decks/{sample_deck.id}/cards/{sample_card.id}"
    )
    assert response.status_code == 204
