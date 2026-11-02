import uuid
from datetime import UTC, datetime

from app.models.flashcard import Flashcard, FlashcardDeck


def test_flashcard_deck_instantiation() -> None:
    user_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    now = datetime.now(UTC)

    deck = FlashcardDeck(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=subject_id,
        title="Computer Architecture",
        description="Pipelining, caches, and instruction sets.",
        created_at=now,
        updated_at=now,
    )

    assert deck.title == "Computer Architecture"
    assert deck.description == "Pipelining, caches, and instruction sets."
    assert deck.user_id == user_id
    assert deck.subject_id == subject_id
    assert deck.__tablename__ == "flashcard_decks"


def test_flashcard_instantiation() -> None:
    deck_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    card = Flashcard(
        id=uuid.uuid4(),
        deck_id=deck_id,
        user_id=user_id,
        question="What is spatial locality?",
        answer="Accessing memory locations close to recently accessed locations.",
        created_at=now,
        updated_at=now,
    )

    assert card.question == "What is spatial locality?"
    assert (
        card.answer
        == "Accessing memory locations close to recently accessed locations."
    )
    assert card.deck_id == deck_id
    assert card.user_id == user_id
    assert card.__tablename__ == "flashcards"
