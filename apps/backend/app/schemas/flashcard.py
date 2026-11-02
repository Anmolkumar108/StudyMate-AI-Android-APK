from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ============================================================================
# Card Schemas
# ============================================================================


class CardBase(BaseModel):
    question: str = Field(
        ..., min_length=1, description="Flashcard question or front text"
    )
    answer: str = Field(..., min_length=1, description="Flashcard answer or back text")

    @field_validator("question", mode="after")
    @classmethod
    def validate_question(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Card question cannot be blank or whitespace only.")
        return cleaned

    @field_validator("answer", mode="after")
    @classmethod
    def validate_answer(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Card answer cannot be blank or whitespace only.")
        return cleaned


class CardCreate(CardBase):
    model_config = ConfigDict(extra="forbid")


class CardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str | None = Field(
        default=None,
        min_length=1,
        description="Updated question",
    )
    answer: str | None = Field(
        default=None,
        min_length=1,
        description="Updated answer",
    )

    @field_validator("question", mode="after")
    @classmethod
    def validate_question(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Card question cannot be blank or whitespace only.")
            return cleaned
        return None

    @field_validator("answer", mode="after")
    @classmethod
    def validate_answer(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Card answer cannot be blank or whitespace only.")
            return cleaned
        return None


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    user_id: UUID
    question: str
    answer: str
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Deck Schemas
# ============================================================================


class DeckBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Deck title")
    description: str | None = Field(
        default=None, description="Optional deck description"
    )
    subject_id: UUID | None = Field(
        default=None,
        description="Optional associated subject ID",
    )

    @field_validator("title", mode="after")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Deck title cannot be blank or whitespace only.")
        return cleaned


class DeckCreate(DeckBase):
    model_config = ConfigDict(extra="forbid")


class DeckUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Deck title",
    )
    description: str | None = Field(
        default=None,
        description="Deck description (null to remove description)",
    )
    subject_id: UUID | None = Field(
        default=None,
        description="Associated subject ID (null to remove subject link)",
    )

    @field_validator("title", mode="after")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Deck title cannot be blank or whitespace only.")
            return cleaned
        return None


class DeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    subject_id: UUID | None = None
    title: str
    description: str | None = None
    card_count: int = 0
    created_at: datetime
    updated_at: datetime


class DeckDetailResponse(DeckResponse):
    cards: list[CardResponse] = []
