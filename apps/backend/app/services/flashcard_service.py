from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flashcard import Flashcard, FlashcardDeck
from app.repositories.flashcard_repo import (
    FlashcardDeckRepository,
    FlashcardRepository,
)
from app.repositories.subject_repo import SubjectRepository
from app.schemas.flashcard import (
    CardCreate,
    CardUpdate,
    DeckCreate,
    DeckResponse,
    DeckUpdate,
)


class FlashcardError(Exception):
    """Base domain exception for flashcard operations."""


class DeckNotFoundError(FlashcardError):
    """Raised when a deck is not found or does not belong to the user."""


class CardNotFoundError(FlashcardError):
    """Raised when a card is not found or does not belong to the user/deck."""


class InvalidDeckSubjectError(FlashcardError):
    """Raised when an associated subject does not exist or does not belong to the user."""


class FlashcardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.deck_repo = FlashcardDeckRepository(session)
        self.card_repo = FlashcardRepository(session)
        self.subject_repo = SubjectRepository(session)

    # =========================================================================
    # Deck Operations
    # =========================================================================

    async def list_decks(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DeckResponse]:
        """List all flashcard decks owned by user_id with card counts."""
        if subject_id is not None:
            subject = await self.subject_repo.get_by_id_and_user(subject_id, user_id)
            if subject is None:
                raise InvalidDeckSubjectError(
                    "Subject not found or does not belong to the user."
                )

        deck_rows = await self.deck_repo.list_by_user(
            user_id=user_id,
            subject_id=subject_id,
            search=search,
            limit=limit,
            offset=offset,
        )

        responses: list[DeckResponse] = []
        for deck, card_count in deck_rows:
            resp = DeckResponse(
                id=deck.id,
                user_id=deck.user_id,
                subject_id=deck.subject_id,
                title=deck.title,
                description=deck.description,
                card_count=int(card_count),
                created_at=deck.created_at,
                updated_at=deck.updated_at,
            )
            responses.append(resp)

        return responses

    async def get_deck(
        self, user_id: UUID, deck_id: UUID, include_cards: bool = True
    ) -> FlashcardDeck:
        """Fetch a specific deck owned by the user.

        Raises:
            DeckNotFoundError: If the deck does not exist or belongs to another user.
        """
        deck = await self.deck_repo.get_by_id_and_user(
            deck_id=deck_id,
            user_id=user_id,
            include_cards=include_cards,
        )
        if deck is None:
            raise DeckNotFoundError("Flashcard deck not found.")
        return deck

    async def create_deck(self, user_id: UUID, payload: DeckCreate) -> FlashcardDeck:
        """Create a new flashcard deck for user_id."""
        if payload.subject_id is not None:
            subject = await self.subject_repo.get_by_id_and_user(
                payload.subject_id, user_id
            )
            if subject is None:
                raise InvalidDeckSubjectError(
                    "Subject does not exist or does not belong to the user."
                )

        deck = FlashcardDeck(
            user_id=user_id,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            subject_id=payload.subject_id,
        )

        try:
            created = await self.deck_repo.create(deck)
            await self.session.commit()
            return created
        except IntegrityError as exc:
            await self.session.rollback()
            raise FlashcardError("Failed to persist flashcard deck.") from exc

    async def update_deck(
        self, user_id: UUID, deck_id: UUID, payload: DeckUpdate
    ) -> FlashcardDeck:
        """Update an existing deck enforcing user isolation."""
        deck = await self.get_deck(user_id, deck_id, include_cards=True)
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return deck

        if "subject_id" in update_data:
            new_subject_id = update_data["subject_id"]
            if new_subject_id is not None:
                subject = await self.subject_repo.get_by_id_and_user(
                    new_subject_id, user_id
                )
                if subject is None:
                    raise InvalidDeckSubjectError(
                        "Subject does not exist or does not belong to the user."
                    )
                deck.subject_id = new_subject_id
            else:
                deck.subject_id = None

        if "title" in update_data and payload.title is not None:
            deck.title = payload.title.strip()

        if "description" in update_data:
            deck.description = (
                payload.description.strip() if payload.description else None
            )

        deck.updated_at = datetime.now(UTC)

        try:
            updated = await self.deck_repo.update(deck)
            await self.session.commit()
            return updated
        except IntegrityError as exc:
            await self.session.rollback()
            raise FlashcardError("Failed to update flashcard deck.") from exc

    async def delete_deck(self, user_id: UUID, deck_id: UUID) -> None:
        """Delete an existing deck and all its cards."""
        deck = await self.get_deck(user_id, deck_id, include_cards=False)
        await self.deck_repo.delete(deck)
        await self.session.commit()

    # =========================================================================
    # Card Operations
    # =========================================================================

    async def list_cards(self, user_id: UUID, deck_id: UUID) -> Sequence[Flashcard]:
        """List all cards in a deck owned by user_id."""
        # Verify deck exists and belongs to user
        await self.get_deck(user_id, deck_id, include_cards=False)
        return await self.card_repo.list_by_deck_and_user(deck_id, user_id)

    async def get_card(self, user_id: UUID, deck_id: UUID, card_id: UUID) -> Flashcard:
        """Fetch a specific card in a deck owned by user_id.

        Raises:
            CardNotFoundError: If the card does not exist or belongs to another user/deck.
        """
        await self.get_deck(user_id, deck_id, include_cards=False)
        card = await self.card_repo.get_by_id_deck_and_user(
            card_id=card_id,
            deck_id=deck_id,
            user_id=user_id,
        )
        if card is None:
            raise CardNotFoundError("Flashcard not found.")
        return card

    async def create_card(
        self, user_id: UUID, deck_id: UUID, payload: CardCreate
    ) -> Flashcard:
        """Create a new flashcard in a deck owned by user_id."""
        deck = await self.get_deck(user_id, deck_id, include_cards=False)

        card = Flashcard(
            deck_id=deck_id,
            user_id=user_id,
            question=payload.question.strip(),
            answer=payload.answer.strip(),
        )

        deck.updated_at = datetime.now(UTC)

        try:
            created = await self.card_repo.create(card)
            await self.session.commit()
            return created
        except IntegrityError as exc:
            await self.session.rollback()
            raise FlashcardError("Failed to persist flashcard.") from exc

    async def update_card(
        self, user_id: UUID, deck_id: UUID, card_id: UUID, payload: CardUpdate
    ) -> Flashcard:
        """Partially update an existing flashcard."""
        deck = await self.get_deck(user_id, deck_id, include_cards=False)
        card = await self.get_card(user_id, deck_id, card_id)

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return card

        if "question" in update_data and payload.question is not None:
            card.question = payload.question.strip()

        if "answer" in update_data and payload.answer is not None:
            card.answer = payload.answer.strip()

        card.updated_at = datetime.now(UTC)
        deck.updated_at = datetime.now(UTC)

        try:
            updated = await self.card_repo.update(card)
            await self.session.commit()
            return updated
        except IntegrityError as exc:
            await self.session.rollback()
            raise FlashcardError("Failed to update flashcard.") from exc

    async def delete_card(self, user_id: UUID, deck_id: UUID, card_id: UUID) -> None:
        """Delete an existing card from a deck."""
        deck = await self.get_deck(user_id, deck_id, include_cards=False)
        card = await self.get_card(user_id, deck_id, card_id)

        await self.card_repo.delete(card)
        deck.updated_at = datetime.now(UTC)
        await self.session.commit()
