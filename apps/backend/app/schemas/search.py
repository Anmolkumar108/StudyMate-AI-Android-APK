from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SearchResultType = Literal["note", "task", "document", "flashcard", "subject", "exam"]
SearchCategory = Literal["all", "notes", "tasks", "documents", "flashcards", "subjects", "exams"]


class SearchResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: SearchResultType
    title: str
    snippet: str | None = None
    subject_id: UUID | None = None
    subject_name: str | None = None
    subject_color: str | None = None
    target_route: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UniversalSearchResponse(BaseModel):
    query: str
    total_count: int
    counts_by_type: dict[str, int]
    results: list[SearchResultItem]

