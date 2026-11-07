import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.document import DocStatus, Document
from app.models.exam import Exam
from app.models.flashcard import FlashcardDeck
from app.models.note import Note
from app.models.subject import Subject
from app.models.task import Task, TaskPriority, TaskStatus
from app.services.search_service import SearchService, _make_snippet


@pytest.fixture
def search_mock_env():
    session = AsyncMock()
    service = SearchService(session=session)
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    return {
        "service": service,
        "session": session,
        "user_a": user_a,
        "user_b": user_b,
    }


def test_snippet_generator():
    text = "Students should study Dijkstra shortest path algorithm to understand graph theory."
    snippet = _make_snippet(text, "Dijkstra")
    assert snippet is not None
    assert "Dijkstra" in snippet

    # None text returns None
    assert _make_snippet(None, "algo") is None
    assert _make_snippet("", "algo") is None


@pytest.mark.asyncio
async def test_universal_search_all_categories(search_mock_env):
    service: SearchService = search_mock_env["service"]
    session_mock: AsyncMock = search_mock_env["session"]
    user_a: uuid.UUID = search_mock_env["user_a"]

    sub_id = uuid.uuid4()
    sub = Subject(id=sub_id, user_id=user_a, name="Computer Science", code="CS101", color="#06B6D4")

    note = Note(
        id=uuid.uuid4(),
        user_id=user_a,
        subject_id=sub_id,
        title="Dijkstra Algorithm Notes",
        content="Shortest path exploration in weighted directed graphs.",
        subject=sub,
    )

    task = Task(
        id=uuid.uuid4(),
        user_id=user_a,
        subject_id=sub_id,
        title="Implement Dijkstra in C++",
        description="Solve 5 shortest path competitive coding problems.",
        status=TaskStatus.TODO,
        priority=TaskPriority.HIGH,
        subject=sub,
    )

    doc = Document(
        id=uuid.uuid4(),
        user_id=user_a,
        subject_id=sub_id,
        title="Graph Theory Textbook",
        file_name="graph_theory_dijkstra.pdf",
        file_size_bytes=102400,
        status=DocStatus.READY,
        summary_tldr="Comprehensive guide covering Dijkstra, Bellman-Ford, and Floyd-Warshall.",
        subject=sub,
    )

    deck = FlashcardDeck(
        id=uuid.uuid4(),
        user_id=user_a,
        subject_id=sub_id,
        title="Dijkstra Concepts Deck",
        description="Key formulas and time complexities.",
        cards=[],
        subject=sub,
    )

    exam = Exam(
        id=uuid.uuid4(),
        user_id=user_a,
        subject_id=sub_id,
        title="Data Structures Dijkstra Exam",
        location="Hall 4B",
        exam_date=datetime.now(UTC) + timedelta(days=5),
        subject=sub,
    )

    async def mock_execute(stmt):
        mock_res = MagicMock()
        sql = str(stmt).lower()
        if "from notes" in sql:
            mock_res.scalars.return_value.all.return_value = [note]
        elif "from tasks" in sql:
            mock_res.scalars.return_value.all.return_value = [task]
        elif "from documents" in sql:
            mock_res.scalars.return_value.all.return_value = [doc]
        elif "from flashcard_decks" in sql:
            mock_res.scalars.return_value.all.return_value = [deck]
        elif "from flashcards" in sql:
            mock_res.scalars.return_value.all.return_value = []
        elif "from exams" in sql:
            mock_res.scalars.return_value.all.return_value = [exam]
        elif "from subjects" in sql:
            mock_res.scalars.return_value.all.return_value = [sub]
        else:
            mock_res.scalars.return_value.all.return_value = []
        return mock_res

    session_mock.execute.side_effect = mock_execute

    response = await service.universal_search(user_id=user_a, query="Dijkstra", category="all")

    assert response.query == "Dijkstra"
    assert response.total_count >= 5
    assert response.counts_by_type["notes"] == 1
    assert response.counts_by_type["tasks"] == 1
    assert response.counts_by_type["documents"] == 1
    assert response.counts_by_type["flashcards"] == 1
    assert response.counts_by_type["exams"] == 1

    types_found = {r.type for r in response.results}
    assert "note" in types_found
    assert "task" in types_found
    assert "document" in types_found
    assert "flashcard" in types_found
    assert "exam" in types_found


@pytest.mark.asyncio
async def test_universal_search_category_filter(search_mock_env):
    service: SearchService = search_mock_env["service"]
    session_mock: AsyncMock = search_mock_env["session"]
    user_a: uuid.UUID = search_mock_env["user_a"]

    task = Task(
        id=uuid.uuid4(),
        user_id=user_a,
        title="Physics Homework Assignment",
        description="Solve friction and tension problems.",
        status=TaskStatus.TODO,
        priority=TaskPriority.MEDIUM,
    )

    async def mock_execute(stmt):
        mock_res = MagicMock()
        sql = str(stmt).lower()
        if "from tasks" in sql:
            mock_res.scalars.return_value.all.return_value = [task]
        else:
            mock_res.scalars.return_value.all.return_value = []
        return mock_res

    session_mock.execute.side_effect = mock_execute

    # Filter category="tasks"
    response = await service.universal_search(user_id=user_a, query="Physics", category="tasks")

    assert response.total_count == 1
    assert response.results[0].type == "task"
    assert response.results[0].title == "Physics Homework Assignment"
    assert response.counts_by_type["tasks"] == 1
    assert response.counts_by_type["notes"] == 0


@pytest.mark.asyncio
async def test_universal_search_idor_cross_tenant_isolation(search_mock_env):
    service: SearchService = search_mock_env["service"]
    session_mock: AsyncMock = search_mock_env["session"]
    user_a: uuid.UUID = search_mock_env["user_a"]
    _user_b: uuid.UUID = search_mock_env["user_b"]

    executed_user_ids = []

    async def mock_execute(stmt):
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = []
        # Inspect where clause to verify user_id scoping
        sql = str(stmt)
        executed_user_ids.append(sql)
        return mock_res

    session_mock.execute.side_effect = mock_execute

    await service.universal_search(user_id=user_a, query="Secret Project")

    # Assert all executed statements contained user_id filtering
    for sql in executed_user_ids:
        assert "user_id" in sql.lower()


@pytest.mark.asyncio
async def test_universal_search_empty_query(search_mock_env):
    service: SearchService = search_mock_env["service"]
    user_a: uuid.UUID = search_mock_env["user_a"]

    response = await service.universal_search(user_id=user_a, query="   ")
    assert response.total_count == 0
    assert len(response.results) == 0


@pytest.mark.asyncio
async def test_universal_search_category_browse_empty_query(search_mock_env):
    service: SearchService = search_mock_env["service"]
    session_mock: AsyncMock = search_mock_env["session"]
    user_a: uuid.UUID = search_mock_env["user_a"]

    note1 = Note(id=uuid.uuid4(), user_id=user_a, title="Note 1", content="Content 1")
    note2 = Note(id=uuid.uuid4(), user_id=user_a, title="Note 2", content="Content 2")

    async def mock_execute(stmt):
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = [note1, note2]
        return mock_res

    session_mock.execute.side_effect = mock_execute

    # When query is empty and category="notes", it returns all notes for immediate browsing
    response = await service.universal_search(user_id=user_a, query="", category="notes")
    assert response.total_count == 2
    assert response.counts_by_type["notes"] == 2
    assert len(response.results) == 2


@pytest.mark.asyncio
async def test_universal_search_category_keyword(search_mock_env):
    service: SearchService = search_mock_env["service"]
    session_mock: AsyncMock = search_mock_env["session"]
    user_a: uuid.UUID = search_mock_env["user_a"]

    task = Task(id=uuid.uuid4(), user_id=user_a, title="Homework 1", description="Complete math exercises")

    async def mock_execute(stmt):
        mock_res = MagicMock()
        sql = str(stmt).lower()
        if "from tasks" in sql:
            mock_res.scalars.return_value.all.return_value = [task]
        else:
            mock_res.scalars.return_value.all.return_value = []
        return mock_res

    session_mock.execute.side_effect = mock_execute

    # Searching keyword "task" in all categories matches all tasks
    response = await service.universal_search(user_id=user_a, query="task", category="all")
    assert response.counts_by_type["tasks"] == 1
    assert any(r.type == "task" for r in response.results)

