import uuid

import pytest
from pydantic import ValidationError

from app.schemas.flashcard import (
    CardCreate,
    CardUpdate,
    DeckCreate,
    DeckUpdate,
)


def test_deck_create_valid() -> None:
    subject_id = uuid.uuid4()
    payload = DeckCreate(
        title="  Data Structures & Algorithms  ",
        description="Core concepts and asymptotic notation.",
        subject_id=subject_id,
    )
    assert payload.title == "Data Structures & Algorithms"
    assert payload.description == "Core concepts and asymptotic notation."
    assert payload.subject_id == subject_id


def test_deck_create_blank_title_rejected() -> None:
    with pytest.raises(ValidationError):
        DeckCreate(title="   ")


def test_deck_create_extra_field_rejected() -> None:
    with pytest.raises(ValidationError):
        DeckCreate.model_validate({"title": "Test", "extra_prop": "bad"})


def test_deck_update_valid_partial() -> None:
    payload = DeckUpdate(title="Updated Title")
    assert payload.title == "Updated Title"
    assert payload.description is None
    assert payload.subject_id is None


def test_deck_update_blank_title_rejected() -> None:
    with pytest.raises(ValidationError):
        DeckUpdate(title="   ")


def test_card_create_valid() -> None:
    payload = CardCreate(
        question="  What is QuickSort time complexity?  ",
        answer="  O(N log N) average, O(N^2) worst case.  ",
    )
    assert payload.question == "What is QuickSort time complexity?"
    assert payload.answer == "O(N log N) average, O(N^2) worst case."


def test_card_create_blank_question_rejected() -> None:
    with pytest.raises(ValidationError):
        CardCreate(question="   ", answer="Valid answer")


def test_card_create_blank_answer_rejected() -> None:
    with pytest.raises(ValidationError):
        CardCreate(question="Valid question", answer="   ")


def test_card_update_valid_partial() -> None:
    payload = CardUpdate(question="New Question")
    assert payload.question == "New Question"
    assert payload.answer is None


def test_card_update_blank_question_rejected() -> None:
    with pytest.raises(ValidationError):
        CardUpdate(question="   ")


def test_card_update_blank_answer_rejected() -> None:
    with pytest.raises(ValidationError):
        CardUpdate(answer="   ")
