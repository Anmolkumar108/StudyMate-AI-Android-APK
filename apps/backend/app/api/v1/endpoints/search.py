import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, get_search_service
from app.models.user import User
from app.schemas.search import (
    SearchCategory,
    UniversalSearchResponse,
)
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=UniversalSearchResponse, status_code=status.HTTP_200_OK)
async def universal_search(
    current_user: Annotated[User, Depends(get_current_user)],
    search_service: Annotated[SearchService, Depends(get_search_service)],
    q: str = Query("", max_length=100, description="Universal search term (optional)"),
    category: SearchCategory = Query("all", description="Filter by asset category"),
    subject_id: uuid.UUID | None = Query(None, description="Optional subject scope filter"),
    limit: int = Query(30, ge=1, le=100, description="Pagination limit"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> UniversalSearchResponse:
    """
    Search across Notes, Tasks, Documents/PDFs, Flashcards, Subjects, and Exams.
    Strictly scoped to current authenticated student (Application-level IDOR enforcement).
    """
    return await search_service.universal_search(
        user_id=current_user.id,
        query=q,
        category=category,
        subject_id=subject_id,
        limit=limit,
        offset=offset,
    )

