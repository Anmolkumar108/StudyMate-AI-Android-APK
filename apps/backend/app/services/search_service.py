import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.exam import Exam
from app.models.flashcard import Flashcard, FlashcardDeck
from app.models.note import Note
from app.models.subject import Subject
from app.models.task import Task
from app.schemas.search import (
    SearchCategory,
    SearchResultItem,
    UniversalSearchResponse,
)

logger = logging.getLogger(__name__)

NOTE_KEYWORDS = {"note", "notes"}
TASK_KEYWORDS = {"task", "tasks", "todo", "to-do", "homework", "assignment"}
DOC_KEYWORDS = {"pdf", "pdfs", "doc", "docs", "document", "documents", "file", "files"}
FLASHCARD_KEYWORDS = {"flashcard", "flashcards", "card", "cards", "deck", "decks"}
SUBJECT_KEYWORDS = {"subject", "subjects", "course", "courses", "class", "classes"}
EXAM_KEYWORDS = {"exam", "exams", "test", "tests", "midterm", "final", "quiz"}


def _make_snippet(text: str | None, query: str, max_chars: int = 120) -> str | None:
    if not text or not text.strip():
        return None
    clean = text.strip().replace("\n", " ")
    if not query:
        return clean[:max_chars] + ("..." if len(clean) > max_chars else "")

    idx = clean.lower().find(query.lower())
    if idx == -1:
        return clean[:max_chars] + ("..." if len(clean) > max_chars else "")

    start = max(0, idx - 35)
    end = min(len(clean), idx + len(query) + 65)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(clean) else ""
    return f"{prefix}{clean[start:end].strip()}{suffix}"


class SearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def universal_search(
        self,
        user_id: uuid.UUID,
        query: str = "",
        category: SearchCategory = "all",
        subject_id: uuid.UUID | None = None,
        limit: int = 30,
        offset: int = 0,
    ) -> UniversalSearchResponse:
        """
        Executes cross-asset universal search across Notes, Tasks, PDFs, Flashcards,
        Subjects, and Exams strictly isolated to user_id (Zero IDOR leakage).

        - When category is 'all' and query is empty, returns empty results (search landing view).
        - When category is a specific tab (e.g. 'notes', 'tasks', etc.) and query is empty,
          returns all assets in that category so user can browse them immediately.
        - When query is provided, searches title, content/description, and linked subject name/code,
          and matches academic category keywords.
        """
        clean_q = query.strip()
        q_lower = clean_q.lower()
        like_pattern = f"%{clean_q}%" if clean_q else "%"

        counts: dict[str, int] = {
            "notes": 0,
            "tasks": 0,
            "documents": 0,
            "flashcards": 0,
            "subjects": 0,
            "exams": 0,
        }

        # If user is in "all" view without any search query, return empty results immediately
        if not clean_q and category == "all":
            return UniversalSearchResponse(
                query="",
                total_count=0,
                counts_by_type=counts,
                results=[],
            )

        all_results: list[SearchResultItem] = []

        # 1. Notes Search
        if category in ("all", "notes"):
            notes_stmt = (
                select(Note)
                .outerjoin(Note.subject)
                .options(selectinload(Note.subject))
                .where(Note.user_id == user_id)
            )
            if subject_id:
                notes_stmt = notes_stmt.where(Note.subject_id == subject_id)

            if clean_q and q_lower not in NOTE_KEYWORDS:
                notes_stmt = notes_stmt.where(
                    or_(
                        Note.title.ilike(like_pattern),
                        Note.content.ilike(like_pattern),
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                    )
                )
            notes_stmt = notes_stmt.order_by(Note.is_pinned.desc(), Note.updated_at.desc())

            res = await self.session.execute(notes_stmt)
            notes = res.scalars().all()
            counts["notes"] = len(notes)

            for n in notes:
                snippet = _make_snippet(n.content, clean_q) or _make_snippet(n.title, clean_q)
                sub_name = n.subject.name if n.subject else None
                sub_color = n.subject.color if n.subject else None
                all_results.append(
                    SearchResultItem(
                        id=n.id,
                        type="note",
                        title=n.title,
                        snippet=snippet,
                        subject_id=n.subject_id,
                        subject_name=sub_name,
                        subject_color=sub_color,
                        target_route=f"/notes?noteId={n.id}",
                        metadata={"is_pinned": n.is_pinned},
                        created_at=n.created_at,
                        updated_at=n.updated_at,
                    )
                )

        # 2. Tasks Search
        if category in ("all", "tasks"):
            tasks_stmt = (
                select(Task)
                .outerjoin(Task.subject)
                .options(selectinload(Task.subject))
                .where(Task.user_id == user_id)
            )
            if subject_id:
                tasks_stmt = tasks_stmt.where(Task.subject_id == subject_id)

            if clean_q and q_lower not in TASK_KEYWORDS:
                tasks_stmt = tasks_stmt.where(
                    or_(
                        Task.title.ilike(like_pattern),
                        Task.description.ilike(like_pattern),
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                    )
                )
            tasks_stmt = tasks_stmt.order_by(Task.due_datetime.asc().nulls_last(), Task.created_at.desc())

            res = await self.session.execute(tasks_stmt)
            tasks = res.scalars().all()
            counts["tasks"] = len(tasks)

            for t in tasks:
                p_val = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
                s_val = t.status.value if hasattr(t.status, "value") else str(t.status)
                snippet = _make_snippet(t.description, clean_q) or f"Status: {s_val.title()} • Priority: {p_val.title()}"
                sub_name = t.subject.name if t.subject else None
                sub_color = t.subject.color if t.subject else None
                all_results.append(
                    SearchResultItem(
                        id=t.id,
                        type="task",
                        title=t.title,
                        snippet=snippet,
                        subject_id=t.subject_id,
                        subject_name=sub_name,
                        subject_color=sub_color,
                        target_route=f"/tasks?taskId={t.id}",
                        metadata={
                            "priority": p_val,
                            "status": s_val,
                            "due_datetime": t.due_datetime.isoformat() if t.due_datetime else None,
                        },
                        created_at=t.created_at,
                        updated_at=t.updated_at,
                    )
                )

        # 3. Documents / PDFs Search
        if category in ("all", "documents"):
            docs_stmt = (
                select(Document)
                .outerjoin(Document.subject)
                .options(selectinload(Document.subject))
                .where(Document.user_id == user_id)
            )
            if subject_id:
                docs_stmt = docs_stmt.where(Document.subject_id == subject_id)

            if clean_q and q_lower not in DOC_KEYWORDS:
                docs_stmt = docs_stmt.where(
                    or_(
                        Document.title.ilike(like_pattern),
                        Document.file_name.ilike(like_pattern),
                        Document.summary_tldr.ilike(like_pattern),
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                    )
                )
            docs_stmt = docs_stmt.order_by(Document.created_at.desc())

            res = await self.session.execute(docs_stmt)
            docs = res.scalars().all()
            counts["documents"] = len(docs)

            for d in docs:
                snippet = _make_snippet(d.summary_tldr, clean_q) or f"File: {d.file_name} • {(d.file_size_bytes / 1024):.1f} KB"
                sub_name = d.subject.name if d.subject else None
                sub_color = d.subject.color if d.subject else None
                st_val = d.status.value if hasattr(d.status, "value") else str(d.status)
                all_results.append(
                    SearchResultItem(
                        id=d.id,
                        type="document",
                        title=d.title,
                        snippet=snippet,
                        subject_id=d.subject_id,
                        subject_name=sub_name,
                        subject_color=sub_color,
                        target_route=f"/documents?documentId={d.id}",
                        metadata={
                            "file_name": d.file_name,
                            "file_size_bytes": d.file_size_bytes,
                            "page_count": d.page_count,
                            "status": st_val,
                        },
                        created_at=d.created_at,
                        updated_at=d.created_at,
                    )
                )

        # 4. Flashcard Decks & Cards Search
        if category in ("all", "flashcards"):
            decks_stmt = (
                select(FlashcardDeck)
                .outerjoin(FlashcardDeck.subject)
                .options(selectinload(FlashcardDeck.subject), selectinload(FlashcardDeck.cards))
                .where(FlashcardDeck.user_id == user_id)
            )
            if subject_id:
                decks_stmt = decks_stmt.where(FlashcardDeck.subject_id == subject_id)

            if clean_q and q_lower not in FLASHCARD_KEYWORDS:
                decks_stmt = decks_stmt.where(
                    or_(
                        FlashcardDeck.title.ilike(like_pattern),
                        FlashcardDeck.description.ilike(like_pattern),
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                    )
                )
            decks_stmt = decks_stmt.order_by(FlashcardDeck.updated_at.desc())

            res_decks = await self.session.execute(decks_stmt)
            matching_decks = {d.id: d for d in res_decks.scalars().all()}

            # If specific query, also check card question/answer matches
            deck_card_snippets: dict[uuid.UUID, str] = {}
            if clean_q and q_lower not in FLASHCARD_KEYWORDS:
                cards_stmt = (
                    select(Flashcard)
                    .join(FlashcardDeck, Flashcard.deck_id == FlashcardDeck.id)
                    .options(
                        selectinload(Flashcard.deck).selectinload(FlashcardDeck.subject),
                        selectinload(Flashcard.deck).selectinload(FlashcardDeck.cards),
                    )
                    .where(Flashcard.user_id == user_id)
                    .where(or_(Flashcard.question.ilike(like_pattern), Flashcard.answer.ilike(like_pattern)))
                )
                if subject_id:
                    cards_stmt = cards_stmt.where(FlashcardDeck.subject_id == subject_id)

                res_cards = await self.session.execute(cards_stmt)
                matching_cards = res_cards.scalars().all()

                for c in matching_cards:
                    if c.deck:
                        matching_decks[c.deck.id] = c.deck
                        if c.deck.id not in deck_card_snippets:
                            snip = _make_snippet(c.question, clean_q) or _make_snippet(c.answer, clean_q)
                            if snip:
                                deck_card_snippets[c.deck.id] = f"Card Match: {snip}"

            counts["flashcards"] = len(matching_decks)

            for d_id, d in matching_decks.items():
                card_snip = deck_card_snippets.get(d_id)
                snippet = card_snip or _make_snippet(d.description, clean_q) or f"Deck contains {len(d.cards)} flashcards"
                sub_name = d.subject.name if d.subject else None
                sub_color = d.subject.color if d.subject else None
                all_results.append(
                    SearchResultItem(
                        id=d.id,
                        type="flashcard",
                        title=d.title,
                        snippet=snippet,
                        subject_id=d.subject_id,
                        subject_name=sub_name,
                        subject_color=sub_color,
                        target_route=f"/flashcards?deckId={d.id}",
                        metadata={"cards_count": len(d.cards)},
                        created_at=d.created_at,
                        updated_at=d.updated_at,
                    )
                )

        # 5. Exams Search
        if category in ("all", "exams"):
            exams_stmt = (
                select(Exam)
                .outerjoin(Exam.subject)
                .options(selectinload(Exam.subject))
                .where(Exam.user_id == user_id)
            )
            if subject_id:
                exams_stmt = exams_stmt.where(Exam.subject_id == subject_id)

            if clean_q and q_lower not in EXAM_KEYWORDS:
                exams_stmt = exams_stmt.where(
                    or_(
                        Exam.title.ilike(like_pattern),
                        Exam.location.ilike(like_pattern),
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                    )
                )
            exams_stmt = exams_stmt.order_by(Exam.exam_date.asc())

            res = await self.session.execute(exams_stmt)
            exams = res.scalars().all()
            counts["exams"] = len(exams)

            for ex in exams:
                ex_date_str = ex.exam_date.strftime("%A, %b %d, %Y") if ex.exam_date else "Scheduled"
                snippet = f"Date: {ex_date_str}" + (f" • Location: {ex.location}" if ex.location else "")
                sub_name = ex.subject.name if ex.subject else None
                sub_color = ex.subject.color if ex.subject else None
                all_results.append(
                    SearchResultItem(
                        id=ex.id,
                        type="exam",
                        title=ex.title,
                        snippet=snippet,
                        subject_id=ex.subject_id,
                        subject_name=sub_name,
                        subject_color=sub_color,
                        target_route=f"/exams?examId={ex.id}",
                        metadata={
                            "exam_date": ex.exam_date.isoformat() if ex.exam_date else None,
                            "location": ex.location,
                            "target_score": ex.target_score,
                        },
                        created_at=ex.created_at,
                        updated_at=ex.updated_at,
                    )
                )

        # 6. Subjects Search
        if category in ("all", "subjects"):
            subs_stmt = (
                select(Subject)
                .where(Subject.user_id == user_id)
            )
            if subject_id:
                subs_stmt = subs_stmt.where(Subject.id == subject_id)

            if clean_q and q_lower not in SUBJECT_KEYWORDS:
                subs_stmt = subs_stmt.where(
                    or_(
                        Subject.name.ilike(like_pattern),
                        Subject.code.ilike(like_pattern),
                        Subject.description.ilike(like_pattern),
                    )
                )
            subs_stmt = subs_stmt.order_by(Subject.name.asc())

            res = await self.session.execute(subs_stmt)
            subs = res.scalars().all()
            counts["subjects"] = len(subs)

            for s in subs:
                snippet = f"Course Code: {s.code}" if s.code else "Enrolled Course Subject"
                all_results.append(
                    SearchResultItem(
                        id=s.id,
                        type="subject",
                        title=s.name,
                        snippet=snippet,
                        subject_id=s.id,
                        subject_name=s.name,
                        subject_color=s.color,
                        target_route=f"/subjects?subjectId={s.id}",
                        metadata={"code": s.code, "color": s.color},
                        created_at=s.created_at,
                        updated_at=s.updated_at,
                    )
                )

        # Sort: exact title match boost, then updated_at / created_at desc
        def _sort_rank(item: SearchResultItem) -> tuple[int, datetime]:
            t_lower = item.title.lower()
            if not clean_q or t_lower == q_lower:
                rank = 0
            elif t_lower.startswith(q_lower):
                rank = 1
            elif q_lower in t_lower:
                rank = 2
            elif item.subject_name and q_lower in item.subject_name.lower():
                rank = 3
            else:
                rank = 4

            dt = item.updated_at or item.created_at or datetime.min.replace(tzinfo=UTC)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return (rank, dt)

        all_results.sort(key=_sort_rank)

        total_count = len(all_results)
        paginated = all_results[offset : offset + limit]

        return UniversalSearchResponse(
            query=clean_q,
            total_count=total_count,
            counts_by_type=counts,
            results=paginated,
        )
