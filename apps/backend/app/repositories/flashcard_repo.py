from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.flashcard import Flashcard, FlashcardDeck


class FlashcardDeckRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[tuple[FlashcardDeck, int]]:
        """Fetch decks owned by a specific user with card counts.

        Strictly filtered by user_id to enforce cross-user isolation.
        """
        stmt = (
            select(
                FlashcardDeck,
                func.count(Flashcard.id).label("card_count"),
            )
            .outerjoin(Flashcard, Flashcard.deck_id == FlashcardDeck.id)
            .where(FlashcardDeck.user_id == user_id)
        )

        if subject_id is not None:
            stmt = stmt.where(FlashcardDeck.subject_id == subject_id)

        if search is not None and search.strip():
            cleaned = search.strip()
            escaped = (
                cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    FlashcardDeck.title.ilike(pattern, escape="\\"),
                    FlashcardDeck.description.ilike(pattern, escape="\\"),
                )
            )

        stmt = (
            stmt.group_by(FlashcardDeck.id)
            .order_by(
                FlashcardDeck.updated_at.desc(),
                FlashcardDeck.created_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.all()  # List of Row tuples (FlashcardDeck, int)

    async def get_by_id_and_user(
        self, deck_id: UUID, user_id: UUID, include_cards: bool = True
    ) -> FlashcardDeck | None:
        """Fetch a single deck strictly matching both deck_id and user_id.

        Never queries by ID alone to enforce application-level tenant isolation.
        """
        stmt = select(FlashcardDeck).where(
            FlashcardDeck.id == deck_id,
            FlashcardDeck.user_id == user_id,
        )
        if include_cards:
            stmt = stmt.options(selectinload(FlashcardDeck.cards))

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(
        self, deck_id: UUID, user_id: UUID, include_cards: bool = True
    ) -> FlashcardDeck | None:
        """Alias for get_by_id_and_user."""
        return await self.get_by_id_and_user(deck_id, user_id, include_cards=include_cards)

    async def create(self, deck: FlashcardDeck) -> FlashcardDeck:
        """Persist a new flashcard deck to the database."""
        self.session.add(deck)
        await self.session.flush()
        return deck

    async def update(self, deck: FlashcardDeck) -> FlashcardDeck:
        """Flush changes to an existing flashcard deck."""
        await self.session.flush()
        return deck

    async def delete(self, deck: FlashcardDeck) -> None:
        """Delete an existing flashcard deck (cascades to cards)."""
        await self.session.delete(deck)
        await self.session.flush()


class FlashcardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_deck_and_user(
        self, deck_id: UUID, user_id: UUID
    ) -> Sequence[Flashcard]:
        """Fetch all cards belonging to a deck owned by user_id."""
        stmt = (
            select(Flashcard)
            .where(
                Flashcard.deck_id == deck_id,
                Flashcard.user_id == user_id,
            )
            .order_by(Flashcard.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_deck_and_user(
        self, card_id: UUID, deck_id: UUID, user_id: UUID
    ) -> Flashcard | None:
        """Fetch a single card verifying card_id, deck_id, and user_id ownership."""
        stmt = select(Flashcard).where(
            Flashcard.id == card_id,
            Flashcard.deck_id == deck_id,
            Flashcard.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(
        self, deck_id: UUID, user_id: UUID, include_cards: bool = True
    ) -> FlashcardDeck | None:
        """Alias for get_by_id_and_user."""
        return await self.get_by_id_and_user(deck_id, user_id, include_cards=include_cards)

    async def count_by_deck(self, deck_id: UUID, user_id: UUID) -> int:
        """Count total cards in a deck owned by user_id."""
        stmt = select(func.count(Flashcard.id)).where(
            Flashcard.deck_id == deck_id,
            Flashcard.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def create(self, card: Flashcard) -> Flashcard:
        """Persist a new flashcard to the database."""
        self.session.add(card)
        await self.session.flush()
        return card

    async def update(self, card: Flashcard) -> Flashcard:
        """Flush changes to an existing card."""
        await self.session.flush()
        return card

    async def delete(self, card: Flashcard) -> None:
        """Delete an existing card from the database."""
        await self.session.delete(card)
        await self.session.flush()
