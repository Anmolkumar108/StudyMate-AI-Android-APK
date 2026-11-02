import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import ForeignKeyConstraint, Table

from app.models.note import Note


def test_note_model_instantiation() -> None:
    note_id = uuid.uuid4()
    user_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    now = datetime.now(UTC)

    note = Note(
        id=note_id,
        user_id=user_id,
        subject_id=subject_id,
        title="Binary Search Trees",
        content="# BST Operations\n\n- Insertion: O(log n)\n- Deletion: O(log n)",
        is_pinned=True,
        created_at=now,
        updated_at=now,
    )

    assert note.id == note_id
    assert note.user_id == user_id
    assert note.subject_id == subject_id
    assert note.title == "Binary Search Trees"
    assert "BST Operations" in note.content
    assert note.is_pinned is True
    assert note.created_at == now
    assert note.updated_at == now


def test_note_model_table_args_and_indexes() -> None:
    table = cast(Table, Note.__table__)
    indexes = [idx.name for idx in table.indexes]

    assert "idx_notes_user_id" in indexes
    assert "idx_notes_subject_id" in indexes
    assert "idx_notes_user_pinned_updated" in indexes


def test_note_model_foreign_key_constraints() -> None:
    table = cast(Table, Note.__table__)
    fk_constraints = [
        c for c in table.constraints if isinstance(c, ForeignKeyConstraint)
    ]

    fk_map = {}
    for fk in fk_constraints:
        for element in fk.elements:
            fk_map[element.parent.name] = (
                element.target_fullname,
                fk.ondelete,
            )

    # user_id -> users.id with CASCADE
    assert "user_id" in fk_map
    assert fk_map["user_id"][0] == "users.id"
    assert fk_map["user_id"][1] == "CASCADE"

    # subject_id -> subjects.id with SET NULL
    assert "subject_id" in fk_map
    assert fk_map["subject_id"][0] == "subjects.id"
    assert fk_map["subject_id"][1] == "SET NULL"
