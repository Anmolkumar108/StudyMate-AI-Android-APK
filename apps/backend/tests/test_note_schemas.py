import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate


def test_note_create_valid_all_fields() -> None:
    subj_id = uuid.uuid4()
    data = {
        "title": "Quantum Mechanics Notes",
        "content": "Schrodinger equation overview and wavefunctions.",
        "subject_id": subj_id,
        "is_pinned": True,
    }
    schema = NoteCreate.model_validate(data)
    assert schema.title == "Quantum Mechanics Notes"
    assert schema.content == "Schrodinger equation overview and wavefunctions."
    assert schema.subject_id == subj_id
    assert schema.is_pinned is True


def test_note_create_valid_minimal() -> None:
    schema = NoteCreate(
        title="Quick Reminder",
        content="Submit assignment by 5 PM.",
    )
    assert schema.title == "Quick Reminder"
    assert schema.content == "Submit assignment by 5 PM."
    assert schema.subject_id is None
    assert schema.is_pinned is False


def test_note_create_trims_whitespace() -> None:
    schema = NoteCreate(
        title="  Trimmed Title  ",
        content="   Trimmed Content   ",
    )
    assert schema.title == "Trimmed Title"
    assert schema.content == "Trimmed Content"


def test_note_create_rejects_empty_or_whitespace_title() -> None:
    with pytest.raises(ValidationError):
        NoteCreate(title="", content="Valid content")

    with pytest.raises(ValidationError):
        NoteCreate(title="   ", content="Valid content")


def test_note_create_rejects_empty_or_whitespace_content() -> None:
    with pytest.raises(ValidationError):
        NoteCreate(title="Valid title", content="")

    with pytest.raises(ValidationError):
        NoteCreate(title="Valid title", content="   ")


def test_note_create_rejects_title_exceeding_200_chars() -> None:
    with pytest.raises(ValidationError):
        NoteCreate(title="A" * 201, content="Valid content")


def test_note_create_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        NoteCreate.model_validate(
            {
                "title": "Valid",
                "content": "Valid",
                "hacked_role": "admin",
            }
        )


def test_note_update_partial_fields() -> None:
    update_title = NoteUpdate(title="Updated Title")
    assert update_title.title == "Updated Title"
    assert update_title.content is None
    assert update_title.is_pinned is None

    update_pin = NoteUpdate(is_pinned=True)
    assert update_pin.is_pinned is True

    update_subj = NoteUpdate(subject_id=None)
    dumped = update_subj.model_dump(exclude_unset=True)
    assert "subject_id" in dumped
    assert dumped["subject_id"] is None


def test_note_update_rejects_blank_strings() -> None:
    with pytest.raises(ValidationError):
        NoteUpdate(title="")

    with pytest.raises(ValidationError):
        NoteUpdate(title="   ")

    with pytest.raises(ValidationError):
        NoteUpdate(content="")

    with pytest.raises(ValidationError):
        NoteUpdate(content="   ")


def test_note_update_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        NoteUpdate.model_validate({"title": "Valid", "unknown_field": 123})


def test_note_response_serialization() -> None:
    now = datetime.now(UTC)
    note_id = uuid.uuid4()
    user_id = uuid.uuid4()
    subj_id = uuid.uuid4()

    response = NoteResponse(
        id=note_id,
        user_id=user_id,
        subject_id=subj_id,
        title="Thermodynamics",
        content="Carnot cycle principles.",
        is_pinned=False,
        created_at=now,
        updated_at=now,
    )

    assert response.id == note_id
    assert response.user_id == user_id
    assert response.subject_id == subj_id
    assert response.title == "Thermodynamics"
    assert response.content == "Carnot cycle principles."
    assert response.is_pinned is False
