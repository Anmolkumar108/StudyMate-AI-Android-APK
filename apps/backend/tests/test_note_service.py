import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.note import Note
from app.models.subject import Subject
from app.schemas.note import NoteCreate, NoteUpdate
from app.services.note_service import (
    InvalidNoteSubjectError,
    NoteError,
    NoteNotFoundError,
    NoteService,
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
        name="Operating Systems",
        code="CS-302",
        description="Processes, threads, and memory.",
        semester=3,
        color="#6366F1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def sample_note(test_user_id: uuid.UUID, sample_subject: Subject) -> Note:
    return Note(
        id=uuid.uuid4(),
        user_id=test_user_id,
        subject_id=sample_subject.id,
        title="Deadlocks in OS",
        content="Four conditions for deadlock: Mutual exclusion, Hold and wait, No preemption, Circular wait.",
        is_pinned=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_note_minimal_success(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = NoteService(mock_session)
    service.note_repo.create = AsyncMock(side_effect=lambda n: n)  # type: ignore[method-assign]

    payload = NoteCreate(
        title="Weekly Review",
        content="Review math and algorithms exercises.",
    )
    result = await service.create_note(test_user_id, payload)

    assert result.user_id == test_user_id
    assert result.subject_id is None
    assert result.title == "Weekly Review"
    assert result.content == "Review math and algorithms exercises."
    assert result.is_pinned is False
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_note_with_valid_subject_success(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_subject: Subject,
) -> None:
    service = NoteService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(  # type: ignore[method-assign]
        return_value=sample_subject
    )
    service.note_repo.create = AsyncMock(side_effect=lambda n: n)  # type: ignore[method-assign]

    payload = NoteCreate(
        title="Process Scheduling",
        content="Round Robin and FCFS algorithms comparison.",
        subject_id=sample_subject.id,
        is_pinned=True,
    )
    result = await service.create_note(test_user_id, payload)

    assert result.user_id == test_user_id
    assert result.subject_id == sample_subject.id
    assert result.title == "Process Scheduling"
    assert result.is_pinned is True
    service.subject_repo.get_by_id_and_user.assert_awaited_once_with(
        sample_subject.id, test_user_id
    )


@pytest.mark.asyncio
async def test_create_note_rejects_subject_owned_by_another_user(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
) -> None:
    foreign_subject_id = uuid.uuid4()
    service = NoteService(mock_session)
    # SubjectRepository returns None because subject doesn't belong to test_user_id
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    payload = NoteCreate(
        title="Attempted Injection",
        content="Trying to link to foreign subject.",
        subject_id=foreign_subject_id,
    )
    with pytest.raises(InvalidNoteSubjectError) as exc_info:
        await service.create_note(test_user_id, payload)

    assert "Subject does not exist or does not belong to the user" in str(
        exc_info.value
    )


@pytest.mark.asyncio
async def test_create_note_database_integrity_error(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = NoteService(mock_session)
    service.note_repo.create = AsyncMock(  # type: ignore[method-assign]
        side_effect=IntegrityError("stmt", "params", Exception("Foreign key violation"))
    )

    payload = NoteCreate(title="Test", content="Content")
    with pytest.raises(NoteError):
        await service.create_note(test_user_id, payload)

    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_note_success(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=sample_note)  # type: ignore[method-assign]

    result = await service.get_note(test_user_id, sample_note.id)
    assert result.id == sample_note.id
    service.note_repo.get_by_id_and_user.assert_awaited_once_with(
        sample_note.id, test_user_id
    )


@pytest.mark.asyncio
async def test_get_note_not_found(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(NoteNotFoundError):
        await service.get_note(test_user_id, uuid.uuid4())


@pytest.mark.asyncio
async def test_get_note_cross_user_isolation(
    mock_session: AsyncMock,
    other_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    # Repository filters strictly by user_id, returning None for unauthorized user
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(NoteNotFoundError):
        await service.get_note(other_user_id, sample_note.id)

    service.note_repo.get_by_id_and_user.assert_awaited_once_with(
        sample_note.id, other_user_id
    )


@pytest.mark.asyncio
async def test_list_notes_success(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.note_repo.list_by_user = AsyncMock(return_value=[sample_note])  # type: ignore[method-assign]

    result = await service.list_notes(test_user_id)
    assert len(result) == 1
    assert result[0].id == sample_note.id


@pytest.mark.asyncio
async def test_list_notes_with_search_and_filters(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_subject: Subject,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(  # type: ignore[method-assign]
        return_value=sample_subject
    )
    service.note_repo.list_by_user = AsyncMock(return_value=[sample_note])  # type: ignore[method-assign]

    result = await service.list_notes(
        user_id=test_user_id,
        search="Deadlocks",
        subject_id=sample_subject.id,
        is_pinned=True,
        limit=10,
        offset=5,
    )
    assert len(result) == 1
    service.note_repo.list_by_user.assert_awaited_once_with(
        user_id=test_user_id,
        search="Deadlocks",
        subject_id=sample_subject.id,
        is_pinned=True,
        limit=10,
        offset=5,
    )


@pytest.mark.asyncio
async def test_list_notes_rejects_foreign_subject_filter(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
) -> None:
    foreign_subj_id = uuid.uuid4()
    service = NoteService(mock_session)
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(InvalidNoteSubjectError):
        await service.list_notes(user_id=test_user_id, subject_id=foreign_subj_id)


@pytest.mark.asyncio
async def test_update_note_success(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=sample_note)  # type: ignore[method-assign]
    service.note_repo.update = AsyncMock(side_effect=lambda n: n)  # type: ignore[method-assign]

    payload = NoteUpdate(
        title="Updated Title",
        content="Updated Content",
        is_pinned=True,
    )
    updated = await service.update_note(test_user_id, sample_note.id, payload)

    assert updated.title == "Updated Title"
    assert updated.content == "Updated Content"
    assert updated.is_pinned is True
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_note_disassociate_subject(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=sample_note)  # type: ignore[method-assign]
    service.note_repo.update = AsyncMock(side_effect=lambda n: n)  # type: ignore[method-assign]

    payload = NoteUpdate(subject_id=None)
    updated = await service.update_note(test_user_id, sample_note.id, payload)

    assert updated.subject_id is None
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_note_rejects_foreign_subject(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    foreign_subj_id = uuid.uuid4()
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=sample_note)  # type: ignore[method-assign]
    service.subject_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    payload = NoteUpdate(subject_id=foreign_subj_id)
    with pytest.raises(InvalidNoteSubjectError):
        await service.update_note(test_user_id, sample_note.id, payload)


@pytest.mark.asyncio
async def test_delete_note_success(
    mock_session: AsyncMock,
    test_user_id: uuid.UUID,
    sample_note: Note,
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=sample_note)  # type: ignore[method-assign]
    service.note_repo.delete = AsyncMock()  # type: ignore[method-assign]

    await service.delete_note(test_user_id, sample_note.id)
    service.note_repo.delete.assert_awaited_once_with(sample_note)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_note_not_found(
    mock_session: AsyncMock, test_user_id: uuid.UUID
) -> None:
    service = NoteService(mock_session)
    service.note_repo.get_by_id_and_user = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with pytest.raises(NoteNotFoundError):
        await service.delete_note(test_user_id, uuid.uuid4())
