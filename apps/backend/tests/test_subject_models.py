import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import Table

from app.models.subject import Subject


def test_subject_model_instantiation() -> None:
    user_id = uuid.uuid4()
    sub_id = uuid.uuid4()
    now = datetime.now(UTC)

    subject = Subject(
        id=sub_id,
        user_id=user_id,
        name="Computer Architecture",
        code="CS-202",
        description="CPU, caches, assembly language.",
        semester=4,
        color="#3B82F6",
        created_at=now,
        updated_at=now,
    )

    assert subject.id == sub_id
    assert subject.user_id == user_id
    assert subject.name == "Computer Architecture"
    assert subject.code == "CS-202"
    assert subject.description == "CPU, caches, assembly language."
    assert subject.semester == 4
    assert subject.color == "#3B82F6"
    assert subject.created_at == now
    assert subject.updated_at == now


def test_subject_model_table_args() -> None:
    table = cast(Table, Subject.__table__)
    indexes = [idx.name for idx in table.indexes]
    assert "idx_subjects_user_id" in indexes
    assert "uq_subjects_user_name_lower" in indexes

    constraints = [c.name for c in table.constraints if hasattr(c, "name")]
    assert "ck_subjects_semester_positive" in constraints
