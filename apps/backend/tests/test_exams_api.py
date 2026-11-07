import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, status
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_exam_service
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.exam import (
    ExamListResponse,
    ExamResponse,
    ExamUpcomingSummaryResponse,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="examstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Exam Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_exam_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_exam_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_exam_service] = lambda: mock_exam_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_exam_response(test_user: User) -> ExamResponse:
    now = datetime.now(UTC)
    exam_dt = now + timedelta(days=10)
    return ExamResponse(
        id=uuid.uuid4(),
        user_id=test_user.id,
        subject_id=uuid.uuid4(),
        subject_name="Computer Networks",
        subject_color="#6366F1",
        title="Midterm Exam",
        exam_date=exam_dt,
        location="Room 302",
        target_score=90.0,
        achieved_score=None,
        syllabus_topics=[
            {"id": "top_1", "name": "OSI & TCP/IP Model", "is_completed": True, "confidence": "high"},
            {"id": "top_2", "name": "Routing Algorithms", "is_completed": False, "confidence": "medium"},
        ],
        total_topics=2,
        completed_topics=1,
        readiness_percentage=50.0,
        days_remaining=10,
        hours_remaining=240,
        is_past=False,
        revision_plan=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_list_exams(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    mock_exam_service.list_exams.return_value = ExamListResponse(
        items=[sample_exam_response],
        total=1,
        upcoming_count=1,
        average_readiness=50.0,
    )

    response = await authed_client.get("/api/v1/exams")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["upcoming_count"] == 1
    assert data["items"][0]["title"] == "Midterm Exam"
    assert data["items"][0]["readiness_percentage"] == 50.0


@pytest.mark.asyncio
async def test_create_exam_success(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    mock_exam_service.create_exam.return_value = sample_exam_response

    payload = {
        "subject_id": str(sample_exam_response.subject_id),
        "title": "Midterm Exam",
        "exam_date": (datetime.now(UTC) + timedelta(days=10)).isoformat(),
        "location": "Room 302",
        "target_score": 90.0,
        "syllabus_topics": ["OSI & TCP/IP Model", "Routing Algorithms"],
    }

    response = await authed_client.post("/api/v1/exams", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Midterm Exam"
    assert data["total_topics"] == 2


@pytest.mark.asyncio
async def test_create_exam_subject_not_found(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
) -> None:
    mock_exam_service.create_exam.side_effect = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Subject not found or does not belong to the authenticated user.",
    )

    payload = {
        "subject_id": str(uuid.uuid4()),
        "title": "Ghost Exam",
        "exam_date": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
    }

    response = await authed_client.post("/api/v1/exams", json=payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Subject not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_exam_by_id(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    mock_exam_service.get_exam.return_value = sample_exam_response

    response = await authed_client.get(f"/api/v1/exams/{sample_exam_response.id}")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == str(sample_exam_response.id)


@pytest.mark.asyncio
async def test_get_exam_not_found(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
) -> None:
    mock_exam_service.get_exam.side_effect = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Exam not found.",
    )

    response = await authed_client.get(f"/api/v1/exams/{uuid.uuid4()}")
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_update_exam(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    sample_exam_response.location = "Auditorium A"
    mock_exam_service.update_exam.return_value = sample_exam_response

    response = await authed_client.patch(
        f"/api/v1/exams/{sample_exam_response.id}",
        json={"location": "Auditorium A"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["location"] == "Auditorium A"


@pytest.mark.asyncio
async def test_delete_exam(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
) -> None:
    mock_exam_service.delete_exam.return_value = None

    response = await authed_client.delete(f"/api/v1/exams/{uuid.uuid4()}")
    assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.asyncio
async def test_toggle_syllabus_topic(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    # Update readiness to 100%
    sample_exam_response.completed_topics = 2
    sample_exam_response.readiness_percentage = 100.0
    mock_exam_service.toggle_topic.return_value = sample_exam_response

    response = await authed_client.patch(
        f"/api/v1/exams/{sample_exam_response.id}/topics/top_2/toggle",
        json={"is_completed": True, "confidence": "high"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["readiness_percentage"] == 100.0


@pytest.mark.asyncio
async def test_generate_revision_plan(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    sample_exam_response.revision_plan = {
        "total_days": 10,
        "summary": "3-Phase Plan",
        "phases": [
            {"phase_number": 1, "title": "Phase 1: Comprehension", "daily_focus_minutes": 60},
            {"phase_number": 2, "title": "Phase 2: Active Recall", "daily_focus_minutes": 75},
            {"phase_number": 3, "title": "Phase 3: Practice Mock", "daily_focus_minutes": 90},
        ],
    }
    mock_exam_service.generate_revision_plan.return_value = sample_exam_response

    response = await authed_client.post(
        f"/api/v1/exams/{sample_exam_response.id}/generate-plan"
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["revision_plan"] is not None
    assert len(data["revision_plan"]["phases"]) == 3


@pytest.mark.asyncio
async def test_get_upcoming_exam_summary(
    authed_client: AsyncClient,
    mock_exam_service: AsyncMock,
    sample_exam_response: ExamResponse,
) -> None:
    mock_exam_service.get_upcoming_summary.return_value = ExamUpcomingSummaryResponse(
        next_exam=sample_exam_response,
        total_upcoming=1,
        average_readiness=50.0,
    )

    response = await authed_client.get("/api/v1/exams/upcoming/summary")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_upcoming"] == 1
    assert data["next_exam"]["title"] == "Midterm Exam"


@pytest.mark.asyncio
async def test_unauthenticated_access_rejected(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/exams")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

