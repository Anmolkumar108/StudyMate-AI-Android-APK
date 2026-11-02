import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, description="Student prompt or question")
    session_id: uuid.UUID | None = Field(default=None, description="Existing chat session ID or null for new session")
    subject_id: uuid.UUID | None = Field(default=None, description="Subject ID to scope the discussion")
    is_socratic: bool = Field(default=False, description="Enable Socratic questioning mode")


class AIChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    token_count: int | None = None
    model_identifier: str | None = None
    created_at: datetime


class AIChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    title: str
    is_socratic: bool
    created_at: datetime
    updated_at: datetime
    messages: list[AIChatMessageResponse] = []


class AIChatSessionListResponse(BaseModel):
    items: list[AIChatSessionResponse]
    total: int


class AIChatResponse(BaseModel):
    session_id: uuid.UUID
    message_id: uuid.UUID
    reply: str
    role: str = "assistant"
    model_identifier: str | None = None
    created_at: datetime


class AIExplanationRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300, description="Academic topic to explain")
    depth: Literal["elif", "high_school", "undergraduate", "expert"] = Field(
        default="undergraduate",
        description="Explanation depth level (elif = Feynman ELI5)",
    )
    subject_id: uuid.UUID | None = Field(default=None, description="Optional subject context")


class AIExplanationResponse(BaseModel):
    topic: str
    depth: str
    explanation: str
    key_takeaways: list[str]
    self_check_question: str


class AINoteGenerationRequest(BaseModel):
    source_text: str = Field(..., min_length=10, max_length=25000, description="Raw lecture or document text")
    title: str | None = Field(default=None, max_length=200, description="Optional note title")
    format: Literal["cornell", "executive", "study_guide"] = Field(
        default="cornell",
        description="Format of generated notes",
    )
    subject_id: uuid.UUID | None = Field(default=None, description="Subject ID to link")


class AINoteGenerationResponse(BaseModel):
    title: str
    note_type: str
    content: str
    key_points: list[str]
    summary: str

