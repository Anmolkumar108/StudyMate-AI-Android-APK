import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate


def test_subject_create_valid_all_fields() -> None:
    data = {
        "name": "Advanced Data Structures",
        "code": "CS-301",
        "description": "Graph algorithms and advanced trees.",
        "semester": 5,
        "color": "#4F46E5",
    }
    schema = SubjectCreate.model_validate(data)
    assert schema.name == "Advanced Data Structures"
    assert schema.code == "CS-301"
    assert schema.description == "Graph algorithms and advanced trees."
    assert schema.semester == 5
    assert schema.color == "#4F46E5"


def test_subject_create_valid_minimal() -> None:
    schema = SubjectCreate(name="Biology")
    assert schema.name == "Biology"
    assert schema.code is None
    assert schema.description is None
    assert schema.semester is None
    assert schema.color == "#6366F1"


def test_subject_create_trims_whitespace() -> None:
    schema = SubjectCreate(
        name="  Computer Networks  ",
        code="  NET-101  ",
        description="  Networking fundamentals  ",
        color="  #10B981  ",
    )
    assert schema.name == "Computer Networks"
    assert schema.code == "NET-101"
    assert schema.description == "Networking fundamentals"
    assert schema.color == "#10B981"


def test_subject_create_rejects_empty_name() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectCreate(name="")
    assert "name" in str(exc_info.value)


def test_subject_create_rejects_whitespace_only_name() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectCreate(name="    ")
    assert "blank or whitespace only" in str(exc_info.value)


def test_subject_create_rejects_invalid_semester() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectCreate(name="History", semester=0)
    assert "greater than or equal to 1" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        SubjectCreate(name="History", semester=-2)
    assert "greater than or equal to 1" in str(exc_info.value)


def test_subject_create_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectCreate.model_validate(
            {"name": "Physics", "extra_unauthorized_field": "malicious"}
        )
    assert "Extra inputs are not permitted" in str(exc_info.value)


def test_subject_update_partial_fields() -> None:
    schema = SubjectUpdate(name="Updated Chemistry", semester=3)
    assert schema.name == "Updated Chemistry"
    assert schema.semester == 3
    assert schema.code is None

    dump = schema.model_dump(exclude_unset=True)
    assert dump == {"name": "Updated Chemistry", "semester": 3}


def test_subject_update_rejects_empty_name() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectUpdate(name="   ")
    assert "blank or whitespace only" in str(exc_info.value)


def test_subject_update_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SubjectUpdate.model_validate({"extra_field": "invalid"})
    assert "Extra inputs are not permitted" in str(exc_info.value)


def test_subject_response_serialization() -> None:
    subject_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    dummy = type(
        "DummySubject",
        (),
        {
            "id": subject_id,
            "user_id": user_id,
            "name": "Calculus I",
            "code": "MATH-101",
            "description": "Limits, derivatives, integrals.",
            "semester": 1,
            "color": "#EF4444",
            "created_at": now,
            "updated_at": now,
        },
    )()

    resp = SubjectResponse.model_validate(dummy)
    assert resp.id == subject_id
    assert resp.user_id == user_id
    assert resp.name == "Calculus I"
    assert resp.code == "MATH-101"
    assert resp.description == "Limits, derivatives, integrals."
    assert resp.semester == 1
    assert resp.color == "#EF4444"
    assert resp.created_at == now
    assert resp.updated_at == now
