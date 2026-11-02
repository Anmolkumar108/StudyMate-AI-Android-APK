import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class QuizQuestionOption(BaseModel):
    key: str = Field(..., description="Option identifier, e.g. A, B, C, D")
    text: str = Field(..., description="Option text")


class QuizGenerateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200, description="Quiz title")
    source_type: Literal["note", "document", "topic", "custom"] = Field(
        default="topic",
        description="Source material type",
    )
    source_id: uuid.UUID | None = Field(default=None, description="Linked Note or Document UUID")
    topic: str | None = Field(default=None, max_length=300, description="Topic inquiry if source_type is topic")
    subject_id: uuid.UUID | None = Field(default=None, description="Associated subject UUID")
    difficulty: Literal["easy", "medium", "hard"] = Field(default="medium")
    question_count: int = Field(default=5, ge=1, le=20)


class QuizQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quiz_id: uuid.UUID
    question_text: str
    question_type: str
    options: list[QuizQuestionOption]
    correct_option_key: str
    explanation: str
    created_at: datetime


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    title: str
    source_type: str
    difficulty: str
    question_count: int
    created_at: datetime


class QuizDetailResponse(QuizResponse):
    questions: list[QuizQuestionResponse] = []


class QuizListResponse(BaseModel):
    items: list[QuizResponse]
    total: int


class QuizSubmitRequest(BaseModel):
    answers: dict[str, str] = Field(
        ...,
        description="Map of question UUID strings to selected option keys (e.g. {'uuid': 'A'})",
    )
    time_taken_seconds: int = Field(default=0, ge=0)


class QuestionReviewItem(BaseModel):
    question_id: uuid.UUID
    question_text: str
    options: list[QuizQuestionOption]
    user_answer: str | None
    correct_answer: str
    is_correct: bool
    explanation: str


class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quiz_id: uuid.UUID
    score_percentage: float
    correct_count: int
    incorrect_count: int
    answers_submitted: dict[str, Any] = Field(default_factory=dict)
    time_taken_seconds: int
    completed_at: datetime
    review: list[QuestionReviewItem] = []


class ConvertMissedToCardsRequest(BaseModel):
    target_deck_id: uuid.UUID | None = Field(
        default=None,
        description="Optional existing flashcard deck UUID. If null, a new deck is created automatically.",
    )


class ConvertMissedToCardsResponse(BaseModel):
    deck_id: uuid.UUID
    cards_created: int
    message: str

