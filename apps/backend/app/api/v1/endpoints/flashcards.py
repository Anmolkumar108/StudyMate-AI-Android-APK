from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_current_active_user, get_flashcard_service
from app.models.user import User
from app.schemas.flashcard import (
    CardCreate,
    CardResponse,
    CardUpdate,
    DeckCreate,
    DeckDetailResponse,
    DeckResponse,
    DeckUpdate,
)
from app.services.flashcard_service import (
    CardNotFoundError,
    DeckNotFoundError,
    FlashcardError,
    FlashcardService,
    InvalidDeckSubjectError,
)

router = APIRouter()


# ============================================================================
# Deck Endpoints
# ============================================================================


@router.post(
    "/decks",
    response_model=DeckResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new flashcard deck",
    description="Creates a new deck for the authenticated student. Optional subject_id must belong to the user.",
)
async def create_deck(
    payload: DeckCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> DeckResponse:
    try:
        deck = await flashcard_service.create_deck(current_user.id, payload)
        return DeckResponse(
            id=deck.id,
            user_id=deck.user_id,
            subject_id=deck.subject_id,
            title=deck.title,
            description=deck.description,
            card_count=0,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )
    except InvalidDeckSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except FlashcardError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create flashcard deck.",
        ) from e


@router.get(
    "/decks",
    response_model=list[DeckResponse],
    status_code=status.HTTP_200_OK,
    summary="List flashcard decks",
    description="Returns decks belonging to the authenticated student, with optional subject filter and search.",
)
async def list_decks(
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
    subject_id: Annotated[
        UUID | None,
        Query(description="Filter decks by associated subject ID"),
    ] = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=100,
            description="Search term matching deck title or description",
        ),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=100, description="Maximum number of decks to return"),
    ] = 50,
    offset: Annotated[
        int,
        Query(ge=0, description="Offset for pagination"),
    ] = 0,
) -> list[DeckResponse]:
    try:
        return await flashcard_service.list_decks(
            user_id=current_user.id,
            subject_id=subject_id,
            search=search,
            limit=limit,
            offset=offset,
        )
    except InvalidDeckSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get(
    "/decks/{deck_id}",
    response_model=DeckDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve deck details and cards",
    description="Returns full deck details including all contained cards for the authenticated student.",
)
async def get_deck(
    deck_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> DeckDetailResponse:
    try:
        deck = await flashcard_service.get_deck(current_user.id, deck_id)
        cards = [CardResponse.model_validate(c) for c in deck.cards]
        return DeckDetailResponse(
            id=deck.id,
            user_id=deck.user_id,
            subject_id=deck.subject_id,
            title=deck.title,
            description=deck.description,
            card_count=len(cards),
            created_at=deck.created_at,
            updated_at=deck.updated_at,
            cards=cards,
        )
    except DeckNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.patch(
    "/decks/{deck_id}",
    response_model=DeckResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a flashcard deck",
    description="Partially updates an existing deck owned by the authenticated student.",
)
async def update_deck(
    deck_id: UUID,
    payload: DeckUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> DeckResponse:
    try:
        deck = await flashcard_service.update_deck(current_user.id, deck_id, payload)
        card_count = (
            len(deck.cards) if hasattr(deck, "cards") and deck.cards is not None else 0
        )
        return DeckResponse(
            id=deck.id,
            user_id=deck.user_id,
            subject_id=deck.subject_id,
            title=deck.title,
            description=deck.description,
            card_count=card_count,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )
    except DeckNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except InvalidDeckSubjectError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except FlashcardError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update flashcard deck.",
        ) from e


@router.delete(
    "/decks/{deck_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a flashcard deck",
    description="Permanently deletes a deck and all its flashcards.",
)
async def delete_deck(
    deck_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> Response:
    try:
        await flashcard_service.delete_deck(current_user.id, deck_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DeckNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


# ============================================================================
# Card Endpoints
# ============================================================================


@router.get(
    "/decks/{deck_id}/cards",
    response_model=list[CardResponse],
    status_code=status.HTTP_200_OK,
    summary="List cards in a deck",
    description="Returns all flashcards in a deck owned by the authenticated student.",
)
async def list_cards(
    deck_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> list[CardResponse]:
    try:
        cards = await flashcard_service.list_cards(current_user.id, deck_id)
        return [CardResponse.model_validate(c) for c in cards]
    except DeckNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.post(
    "/decks/{deck_id}/cards",
    response_model=CardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a flashcard in a deck",
    description="Adds a new flashcard to a deck owned by the authenticated student.",
)
async def create_card(
    deck_id: UUID,
    payload: CardCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> CardResponse:
    try:
        card = await flashcard_service.create_card(current_user.id, deck_id, payload)
        return CardResponse.model_validate(card)
    except DeckNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except FlashcardError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create flashcard.",
        ) from e


@router.get(
    "/decks/{deck_id}/cards/{card_id}",
    response_model=CardResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a single flashcard",
    description="Returns a specific card from a deck owned by the authenticated student.",
)
async def get_card(
    deck_id: UUID,
    card_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> CardResponse:
    try:
        card = await flashcard_service.get_card(current_user.id, deck_id, card_id)
        return CardResponse.model_validate(card)
    except (DeckNotFoundError, CardNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.patch(
    "/decks/{deck_id}/cards/{card_id}",
    response_model=CardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a flashcard",
    description="Partially updates an existing flashcard in a deck owned by the authenticated student.",
)
async def update_card(
    deck_id: UUID,
    card_id: UUID,
    payload: CardUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> CardResponse:
    try:
        card = await flashcard_service.update_card(
            current_user.id, deck_id, card_id, payload
        )
        return CardResponse.model_validate(card)
    except (DeckNotFoundError, CardNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except FlashcardError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update flashcard.",
        ) from e


@router.delete(
    "/decks/{deck_id}/cards/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a flashcard",
    description="Permanently deletes a card from a deck owned by the authenticated student.",
)
async def delete_card(
    deck_id: UUID,
    card_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    flashcard_service: Annotated[FlashcardService, Depends(get_flashcard_service)],
) -> Response:
    try:
        await flashcard_service.delete_card(current_user.id, deck_id, card_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except (DeckNotFoundError, CardNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
