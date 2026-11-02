import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.models.flashcard import Flashcard, FlashcardDeck
from app.schemas.flashcard import (
    CardCreate,
    CardUpdate,
    DeckCreate,
    DeckUpdate,
)
from app.services.flashcard_service import (
    CardNotFoundError,
    DeckNotFoundError,
    FlashcardService,
    InvalidDeckSubjectError,
)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def flashcard_service(mock_session: AsyncMock) -> FlashcardService:
    service = FlashcardService(mock_session)
    service.deck_repo = AsyncMock()
    service.card_repo = AsyncMock()
    service.subject_repo = AsyncMock()
    return service


@pytest.fixture
def sample_deck() -> FlashcardDeck:
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    deck = FlashcardDeck(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=None,
        title="Operating Systems",
        description="Processes, threads, and memory management.",
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
        question="What is a mutex?",
        answer="A mutual exclusion lock used to prevent race conditions.",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_create_deck_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.create.return_value = sample_deck

    result = await flashcard_service.create_deck(
        user_id=sample_deck.user_id,
        payload=DeckCreate(title="Operating Systems", description="Processes"),
    )

    assert result == sample_deck
    flashcard_service.deck_repo.create.assert_awaited_once()
    flashcard_service.session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_deck_invalid_subject_raises_error(
    flashcard_service: FlashcardService,
) -> None:
    user_id = uuid.uuid4()
    bad_subject_id = uuid.uuid4()
    flashcard_service.subject_repo.get_by_id_and_user.return_value = None

    with pytest.raises(InvalidDeckSubjectError):
        await flashcard_service.create_deck(
            user_id=user_id,
            payload=DeckCreate(title="Algorithms", subject_id=bad_subject_id),
        )


@pytest.mark.asyncio
async def test_get_deck_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck

    result = await flashcard_service.get_deck(sample_deck.user_id, sample_deck.id)
    assert result == sample_deck


@pytest.mark.asyncio
async def test_get_deck_not_found_raises_error(
    flashcard_service: FlashcardService,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = None

    with pytest.raises(DeckNotFoundError):
        await flashcard_service.get_deck(uuid.uuid4(), uuid.uuid4())


@pytest.mark.asyncio
async def test_list_decks_returns_counts(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.list_by_user.return_value = [(sample_deck, 5)]

    results = await flashcard_service.list_decks(user_id=sample_deck.user_id)
    assert len(results) == 1
    assert results[0].id == sample_deck.id
    assert results[0].card_count == 5


@pytest.mark.asyncio
async def test_update_deck_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck
    flashcard_service.deck_repo.update.return_value = sample_deck

    result = await flashcard_service.update_deck(
        user_id=sample_deck.user_id,
        deck_id=sample_deck.id,
        payload=DeckUpdate(title="Advanced OS"),
    )

    assert result.title == "Advanced OS"
    flashcard_service.deck_repo.update.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_deck_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck

    await flashcard_service.delete_deck(sample_deck.user_id, sample_deck.id)
    flashcard_service.deck_repo.delete.assert_awaited_once_with(sample_deck)


@pytest.mark.asyncio
async def test_create_card_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck
    flashcard_service.card_repo.create.return_value = sample_card

    result = await flashcard_service.create_card(
        user_id=sample_deck.user_id,
        deck_id=sample_deck.id,
        payload=CardCreate(question="What is a mutex?", answer="A lock"),
    )

    assert result == sample_card
    flashcard_service.card_repo.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_card_not_found_raises_error(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck
    flashcard_service.card_repo.get_by_id_deck_and_user.return_value = None

    with pytest.raises(CardNotFoundError):
        await flashcard_service.get_card(
            sample_deck.user_id, sample_deck.id, uuid.uuid4()
        )


@pytest.mark.asyncio
async def test_update_card_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck
    flashcard_service.card_repo.get_by_id_deck_and_user.return_value = sample_card
    flashcard_service.card_repo.update.return_value = sample_card

    result = await flashcard_service.update_card(
        user_id=sample_deck.user_id,
        deck_id=sample_deck.id,
        card_id=sample_card.id,
        payload=CardUpdate(question="Updated Question"),
    )

    assert result.question == "Updated Question"


@pytest.mark.asyncio
async def test_delete_card_success(
    flashcard_service: FlashcardService,
    sample_deck: FlashcardDeck,
    sample_card: Flashcard,
) -> None:
    flashcard_service.deck_repo.get_by_id_and_user.return_value = sample_deck
    flashcard_service.card_repo.get_by_id_deck_and_user.return_value = sample_card

    await flashcard_service.delete_card(
        sample_deck.user_id, sample_deck.id, sample_card.id
    )
    flashcard_service.card_repo.delete.assert_awaited_once_with(sample_card)
