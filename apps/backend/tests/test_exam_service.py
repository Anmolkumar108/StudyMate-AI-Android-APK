import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.exam import Exam
from app.models.subject import Subject
from app.schemas.exam import ExamCreate, ExamUpdate
from app.services.ai_service import AIService
from app.services.exam_service import ExamService


@pytest.fixture
def user_a_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def user_b_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def subject_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def mock_session() -> AsyncMock:
    return AsyncMock()


@pytest.mark.asyncio
async def test_exam_service_create_and_readiness_calculation(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    # Mock subject lookup (belongs to user_a)
    mock_subject = Subject(id=subject_id, user_id=user_a_id, name="Algorithms", color="#10B981")
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=mock_subject)

    # Mock exam persistence
    exam_dt = datetime.now(UTC) + timedelta(days=14)
    saved_exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a_id,
        subject_id=subject_id,
        title="Algorithms Midterm",
        exam_date=exam_dt,
        location="Hall 101",
        target_score=95.0,
        syllabus_topics=[
            {"id": "top_1", "name": "Divide and Conquer", "is_completed": True, "confidence": "high"},
            {"id": "top_2", "name": "Greedy Algorithms", "is_completed": False, "confidence": "medium"},
            {"id": "top_3", "name": "Dynamic Programming", "is_completed": False, "confidence": "low"},
        ],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    saved_exam.subject = mock_subject
    service.exam_repo.create = AsyncMock(return_value=saved_exam)

    payload = ExamCreate(
        subject_id=subject_id,
        title="Algorithms Midterm",
        exam_date=exam_dt,
        location="Hall 101",
        target_score=95.0,
        syllabus_topics=["Divide and Conquer", "Greedy Algorithms", "Dynamic Programming"],
    )

    result = await service.create_exam(user_id=user_a_id, payload=payload)
    assert result.title == "Algorithms Midterm"
    assert result.total_topics == 3
    assert result.completed_topics == 1
    assert result.readiness_percentage == 33.3
    assert result.days_remaining >= 13
    assert result.subject_name == "Algorithms"


@pytest.mark.asyncio
async def test_exam_service_idor_cross_tenant_isolation(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    user_b_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    # Subject belongs to user_a, but user_b tries to create an exam for it
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)

    payload = ExamCreate(
        subject_id=subject_id,
        title="Unauthorized Exam",
        exam_date=datetime.now(UTC) + timedelta(days=5),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_exam(user_id=user_b_id, payload=payload)
    assert exc_info.value.status_code == 404

    # User B tries to get user A's exam
    service.exam_repo.get_by_id_and_user = AsyncMock(return_value=None)
    with pytest.raises(HTTPException) as exc_info:
        await service.get_exam(user_id=user_b_id, exam_id=uuid.uuid4())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_exam_service_toggle_topic(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a_id,
        subject_id=subject_id,
        title="Physics Final",
        exam_date=datetime.now(UTC) + timedelta(days=8),
        syllabus_topics=[
            {"id": "top_1", "name": "Kinematics", "is_completed": False, "confidence": "low"},
            {"id": "top_2", "name": "Thermodynamics", "is_completed": False, "confidence": "medium"},
        ],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    exam.subject = Subject(id=subject_id, user_id=user_a_id, name="Physics")
    service.exam_repo.get_by_id_and_user = AsyncMock(return_value=exam)
    service.exam_repo.update = AsyncMock(return_value=exam)

    # Toggle top_1 to True
    res = await service.toggle_topic(
        user_id=user_a_id,
        exam_id=exam.id,
        topic_id="top_1",
        is_completed=True,
        confidence="high",
    )
    assert res.completed_topics == 1
    assert res.readiness_percentage == 50.0

    # Non-existent topic raises 404
    with pytest.raises(HTTPException) as exc_info:
        await service.toggle_topic(
            user_id=user_a_id,
            exam_id=exam.id,
            topic_id="invalid_topic",
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_exam_service_generate_revision_plan(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a_id,
        subject_id=subject_id,
        title="Database Systems",
        exam_date=datetime.now(UTC) + timedelta(days=12),
        syllabus_topics=[
            {"id": "top_1", "name": "SQL & Normalization"},
            {"id": "top_2", "name": "Transactions & ACID"},
            {"id": "top_3", "name": "B-Trees & Indexing"},
        ],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    exam.subject = Subject(id=subject_id, user_id=user_a_id, name="Database Systems")
    service.exam_repo.get_by_id_and_user = AsyncMock(return_value=exam)
    service.exam_repo.update = AsyncMock(return_value=exam)

    ai = AIService(api_key="mock-dev-key")
    res = await service.generate_revision_plan(user_id=user_a_id, exam_id=exam.id, ai_service=ai)

    assert res.revision_plan is not None
    assert "phases" in res.revision_plan
    assert len(res.revision_plan["phases"]) == 3
    p1 = res.revision_plan["phases"][0]
    p2 = res.revision_plan["phases"][1]
    p3 = res.revision_plan["phases"][2]
    assert p1["phase_number"] == 1
    assert "Comprehension" in p1["title"]
    assert p2["phase_number"] == 2
    assert "Active Recall" in p2["title"]
    assert p3["phase_number"] == 3
    assert "Practice Quizzes" in p3["title"]


@pytest.mark.asyncio
async def test_exam_service_reject_past_exam_revision_plan(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    # Exam in past
    past_exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a_id,
        subject_id=subject_id,
        title="Old Exam",
        exam_date=datetime.now(UTC) - timedelta(days=2),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    service.exam_repo.get_by_id_and_user = AsyncMock(return_value=past_exam)

    ai = AIService(api_key="mock-dev-key")
    with pytest.raises(HTTPException) as exc_info:
        await service.generate_revision_plan(user_id=user_a_id, exam_id=past_exam.id, ai_service=ai)
    assert exc_info.value.status_code == 400
    assert "already passed" in exc_info.value.detail


@pytest.mark.asyncio
async def test_exam_service_update_exam_syllabus_topics(
    mock_session: AsyncMock,
    user_a_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    service = ExamService(mock_session)

    exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a_id,
        subject_id=subject_id,
        title="Operating Systems",
        exam_date=datetime.now(UTC) + timedelta(days=10),
        syllabus_topics=[
            {"id": "top_1", "name": "Process Scheduling", "is_completed": True, "confidence": "high"},
            {"id": "top_2", "name": "Paging", "is_completed": False, "confidence": "medium"},
        ],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    exam.subject = Subject(id=subject_id, user_id=user_a_id, name="Operating Systems")
    service.exam_repo.get_by_id_and_user = AsyncMock(return_value=exam)
    service.exam_repo.update = AsyncMock(side_effect=lambda e: e)

    # Student updates topics: keeps "Process Scheduling", adds "Virtual File System" and "Deadlocks"
    update_payload = ExamUpdate(
        syllabus_topics=["Process Scheduling", "Virtual File System", "Deadlocks"]
    )

    res = await service.update_exam(
        user_id=user_a_id,
        exam_id=exam.id,
        payload=update_payload,
    )

    assert res.total_topics == 3
    # Existing "Process Scheduling" should retain is_completed = True
    assert res.completed_topics == 1
    assert res.readiness_percentage == 33.3
    topic_names = [t["name"] for t in res.syllabus_topics]
    assert "Process Scheduling" in topic_names
    assert "Virtual File System" in topic_names
    assert "Deadlocks" in topic_names

