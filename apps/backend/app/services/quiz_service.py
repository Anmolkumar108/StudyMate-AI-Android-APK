import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from app.models.flashcard import Flashcard, FlashcardDeck
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.repositories.document_repo import DocumentRepository
from app.repositories.flashcard_repo import FlashcardDeckRepository, FlashcardRepository
from app.repositories.note_repo import NoteRepository
from app.repositories.quiz_repo import QuizRepository
from app.repositories.subject_repo import SubjectRepository
from app.schemas.quiz import (
    QuestionReviewItem,
    QuizAttemptResponse,
    QuizGenerateRequest,
    QuizQuestionOption,
    QuizSubmitRequest,
)
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)


class QuizNotFoundError(Exception):
    """Raised when quiz does not exist or user is unauthorized."""


class QuizAttemptNotFoundError(Exception):
    """Raised when quiz attempt does not exist."""


class QuizService:
    def __init__(
        self,
        repository: QuizRepository,
        note_repo: NoteRepository | None = None,
        doc_repo: DocumentRepository | None = None,
        subject_repo: SubjectRepository | None = None,
        deck_repo: FlashcardDeckRepository | None = None,
        card_repo: FlashcardRepository | None = None,
        ai_service: AIService | None = None,
    ) -> None:
        self.repository = repository
        self.note_repo = note_repo
        self.doc_repo = doc_repo
        self.subject_repo = subject_repo
        self.deck_repo = deck_repo
        self.card_repo = card_repo
        self.ai = ai_service or AIService()

    async def list_quizzes(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Quiz]:
        return await self.repository.list_quizzes_by_user(
            user_id=user_id,
            subject_id=subject_id,
            limit=limit,
            offset=offset,
        )

    async def count_quizzes(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
    ) -> int:
        return await self.repository.count_quizzes_by_user(
            user_id=user_id,
            subject_id=subject_id,
        )

    async def get_quiz(self, quiz_id: UUID, user_id: UUID) -> Quiz:
        quiz = await self.repository.get_quiz_by_id(quiz_id, user_id, load_questions=True)
        if not quiz:
            raise QuizNotFoundError(f"Quiz {quiz_id} not found or unauthorized.")
        return quiz

    async def delete_quiz(self, quiz_id: UUID, user_id: UUID) -> None:
        quiz = await self.get_quiz(quiz_id, user_id)
        await self.repository.delete_quiz(quiz)

    async def generate_quiz(
        self,
        user_id: UUID,
        request: QuizGenerateRequest,
    ) -> Quiz:
        """Extract source context, request AI questions, and persist Quiz."""
        source_text = ""
        subject_name = None

        # 1. Resolve Subject Name
        if request.subject_id and self.subject_repo:
            subj = await self.subject_repo.get_by_id(request.subject_id, user_id)
            if subj:
                subject_name = subj.name

        # 2. Extract source text based on source_type
        if request.source_type == "note" and request.source_id and self.note_repo:
            note = await self.note_repo.get_by_id(request.source_id, user_id)
            if note:
                source_text = f"{note.title}\n\n{note.content}"
                if not request.title:
                    request.title = f"Quiz: {note.title}"
        elif request.source_type == "document" and request.source_id and self.doc_repo:
            doc = await self.doc_repo.get_by_id(request.source_id, user_id)
            if doc:
                source_text = f"{doc.title}\n\n{doc.summary_tldr or ''}\n\n{doc.extracted_text_snippet or ''}"
                if not request.title:
                    request.title = f"Quiz: {doc.title}"

        if not source_text:
            source_text = request.topic or request.title or "General Academic Knowledge"

        quiz_title = request.title or f"Quiz on {source_text[:30].strip()}"

        # 3. Call AI Service
        raw_questions = await self.ai.generate_quiz_questions(
            source_text=source_text,
            question_count=request.question_count,
            difficulty=request.difficulty,
            subject_name=subject_name,
        )

        # 4. Construct Models
        quiz = Quiz(
            user_id=user_id,
            subject_id=request.subject_id,
            title=quiz_title,
            source_type=request.source_type,
            source_id=request.source_id,
            difficulty=request.difficulty,
            question_count=len(raw_questions),
        )

        question_entities: list[QuizQuestion] = []
        for q_data in raw_questions:
            q_ent = QuizQuestion(
                question_text=q_data.get("question_text", "Sample Question"),
                question_type=q_data.get("question_type", "mcq"),
                options=q_data.get("options", []),
                correct_option_key=q_data.get("correct_option_key", "A"),
                explanation=q_data.get("explanation", ""),
            )
            question_entities.append(q_ent)

        saved_quiz = await self.repository.create_quiz(quiz, question_entities)
        return saved_quiz

    async def submit_quiz_attempt(
        self,
        user_id: UUID,
        quiz_id: UUID,
        request: QuizSubmitRequest,
    ) -> QuizAttemptResponse:
        quiz = await self.get_quiz(quiz_id, user_id)

        correct_count = 0
        incorrect_count = 0
        review_items: list[QuestionReviewItem] = []

        for q in quiz.questions:
            q_id_str = str(q.id)
            user_ans = request.answers.get(q_id_str, "").strip().upper()
            is_correct = user_ans == q.correct_option_key.strip().upper()

            if is_correct:
                correct_count += 1
            else:
                incorrect_count += 1

            options_list = [
                QuizQuestionOption(key=opt.get("key", ""), text=opt.get("text", ""))
                for opt in q.options
            ]

            review_items.append(
                QuestionReviewItem(
                    question_id=q.id,
                    question_text=q.question_text,
                    options=options_list,
                    user_answer=user_ans if user_ans else None,
                    correct_answer=q.correct_option_key,
                    is_correct=is_correct,
                    explanation=q.explanation,
                )
            )

        total_questions = len(quiz.questions)
        score_pct = (correct_count / total_questions * 100.0) if total_questions > 0 else 0.0

        attempt = QuizAttempt(
            quiz_id=quiz.id,
            user_id=user_id,
            score_percentage=round(score_pct, 2),
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            answers_submitted=request.answers,
            time_taken_seconds=request.time_taken_seconds,
            completed_at=datetime.now(UTC),
        )
        saved_attempt = await self.repository.create_attempt(attempt)

        return QuizAttemptResponse(
            id=saved_attempt.id,
            quiz_id=saved_attempt.quiz_id,
            score_percentage=float(saved_attempt.score_percentage),
            correct_count=saved_attempt.correct_count,
            incorrect_count=saved_attempt.incorrect_count,
            answers_submitted=saved_attempt.answers_submitted or request.answers or {},
            time_taken_seconds=saved_attempt.time_taken_seconds,
            completed_at=saved_attempt.completed_at or datetime.now(UTC),
            review=review_items,
        )

    async def convert_missed_to_flashcards(
        self,
        user_id: UUID,
        attempt_id: UUID,
        quiz_id: UUID | None = None,
        target_deck_id: UUID | None = None,
    ) -> tuple[UUID, int]:
        """Convert missed questions in attempt to Spaced Repetition Flashcards."""
        if not self.card_repo or not self.deck_repo:
            raise RuntimeError("Flashcard repositories are required for conversion.")

        attempt = await self.repository.get_attempt_by_id(attempt_id, user_id)
        if not attempt:
            raise QuizAttemptNotFoundError(f"Attempt {attempt_id} not found.")

        quiz = attempt.quiz

        # 1. Resolve or Create Flashcard Deck
        if target_deck_id:
            deck = await self.deck_repo.get_by_id(target_deck_id, user_id)
            if not deck:
                raise ValueError("Target deck not found.")
        else:
            new_deck = FlashcardDeck(
                user_id=user_id,
                subject_id=quiz.subject_id,
                title=f"Review: {quiz.title}",
                description=f"Auto-generated cards from missed questions in {quiz.title}",
            )
            deck = await self.deck_repo.create(new_deck)

        # 2. Iterate through questions and create cards for missed ones
        cards_created = 0
        submitted_answers = attempt.answers_submitted or {}

        for q in quiz.questions:
            user_ans = submitted_answers.get(str(q.id), "").strip().upper()
            if user_ans != q.correct_option_key.strip().upper():
                # Find correct option text
                correct_text = ""
                for opt in q.options:
                    if opt.get("key", "").strip().upper() == q.correct_option_key.strip().upper():
                        correct_text = opt.get("text", "")
                        break

                back_text = (
                    f"**Correct Answer ({q.correct_option_key})**: {correct_text}\n\n"
                    f"**Explanation**: {q.explanation}"
                )

                card = Flashcard(
                    deck_id=deck.id,
                    user_id=user_id,
                    question=q.question_text,
                    answer=back_text,
                )
                await self.card_repo.create(card)
                cards_created += 1

        return deck.id, cards_created
