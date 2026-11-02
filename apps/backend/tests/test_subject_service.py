import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate
from app.services.subject_service import (
    DuplicateSubjectNameError,
    SubjectNotFoundError,
    SubjectService,
)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = AsyncMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.delete = AsyncMock()
    return session


@pytest.fixture
def test_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def other_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def sample_subject(test_user_id: uuid.UUID) -> Subject:
    return Subject(
        id=uuid.uuid4(),
        user_id=test_user_id,
        name="Linear Algebra",
        code="MATH-201",
        description="Matrices and vector spaces.",
        semester=2,
        color="#6366F1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_subject_success(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_user_and_name_lower = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.subject_repo.create = AsyncMock(side_effect=lambda s: s)  # type: ignore[method-assign]

    payload = SubjectCreate(
        name="Operating Systems",
        code="CS-401",
        description="Processes, concurrency, memory management.",
        semester=4,
        color="#10B981",
    )

    created = await service.create_subject(test_user_id, payload)
    assert created.name == "Operating Systems"
    assert created.code == "CS-401"
    assert created.user_id == test_user_id
    assert created.semester == 4
    assert created.color == "#10B981"
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_subject_duplicate_name(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    # Existing subject with same name
    service.subject_repo.get_by_user_and_name_lower = AsyncMock(  # type: ignore[method-assign]
        return_value=sample_subject
    )

    payload = SubjectCreate(name="  linear algebra  ")
    with pytest.raises(DuplicateSubjectNameError) as exc_info:
        await service.create_subject(test_user_id, payload)

    assert "Linear Algebra" in str(exc_info.value) or "linear algebra" in str(
        exc_info.value
    )
    mock_session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_subject_database_integrity_error(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_user_and_name_lower = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.subject_repo.create = AsyncMock(  # type: ignore[method-assign]
        side_effect=IntegrityError(
            "duplicate key", params=None, orig=Exception("unique constraint")
        )
    )

    payload = SubjectCreate(name="Artificial Intelligence")
    with pytest.raises(DuplicateSubjectNameError):
        await service.create_subject(test_user_id, payload)

    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_subjects(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.list_by_user = AsyncMock(return_value=[sample_subject])  # type: ignore[method-assign]

    subjects = await service.list_subjects(test_user_id)
    assert len(subjects) == 1
    assert subjects[0].id == sample_subject.id
    service.subject_repo.list_by_user.assert_awaited_once_with(test_user_id)


@pytest.mark.asyncio
async def test_get_subject_success(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=sample_subject)  # type: ignore[method-assign]

    retrieved = await service.get_subject(test_user_id, sample_subject.id)
    assert retrieved.id == sample_subject.id
    assert retrieved.name == sample_subject.name
    service.subject_repo.get_by_id_and_user.assert_awaited_once_with(
        sample_subject.id, test_user_id
    )


@pytest.mark.asyncio
async def test_get_subject_not_found(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(SubjectNotFoundError):
        await service.get_subject(test_user_id, uuid.uuid4())


@pytest.mark.asyncio
async def test_get_subject_cross_user_isolation(
    mock_session: AsyncMock, other_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    # The repository strictly queries with WHERE id = :id AND user_id = :other_user_id
    # so it returns None when another user tries to access it
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(SubjectNotFoundError):
        await service.get_subject(other_user_id, sample_subject.id)


@pytest.mark.asyncio
async def test_update_subject_success(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=sample_subject)  # type: ignore[method-assign]
    service.subject_repo.get_by_user_and_name_lower = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.subject_repo.update = AsyncMock(side_effect=lambda s: s)  # type: ignore[method-assign]

    payload = SubjectUpdate(
        name="Advanced Linear Algebra",
        code="MATH-301",
        semester=3,
    )

    updated = await service.update_subject(test_user_id, sample_subject.id, payload)
    assert updated.name == "Advanced Linear Algebra"
    assert updated.code == "MATH-301"
    assert updated.semester == 3
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_subject_duplicate_name(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=sample_subject)  # type: ignore[method-assign]

    other_subject = Subject(
        id=uuid.uuid4(),
        user_id=test_user_id,
        name="Existing Subject",
    )
    mock_find_other = AsyncMock(return_value=other_subject)
    service.subject_repo.get_by_user_and_name_lower = mock_find_other  # type: ignore[method-assign]

    payload = SubjectUpdate(name="Existing Subject")
    with pytest.raises(DuplicateSubjectNameError):
        await service.update_subject(test_user_id, sample_subject.id, payload)


@pytest.mark.asyncio
async def test_update_subject_same_name_allowed(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=sample_subject)  # type: ignore[method-assign]
    # Finding itself does not raise duplicate error
    mock_find_self = AsyncMock(return_value=sample_subject)
    service.subject_repo.get_by_user_and_name_lower = mock_find_self  # type: ignore[method-assign]
    service.subject_repo.update = AsyncMock(side_effect=lambda s: s)  # type: ignore[method-assign]

    payload = SubjectUpdate(name="Linear Algebra", semester=3)
    updated = await service.update_subject(test_user_id, sample_subject.id, payload)
    assert updated.name == "Linear Algebra"
    assert updated.semester == 3
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_subject_success(
    mock_session: AsyncMock, test_user_id: uuid.UUID, sample_subject: Subject
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=sample_subject)  # type: ignore[method-assign]
    service.subject_repo.delete = AsyncMock()  # type: ignore[method-assign]

    await service.delete_subject(test_user_id, sample_subject.id)
    service.subject_repo.delete.assert_awaited_once_with(sample_subject)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_subject_not_found(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = SubjectService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(SubjectNotFoundError):
        await service.delete_subject(test_user_id, uuid.uuid4())
    mock_session.commit.assert_not_awaited()
