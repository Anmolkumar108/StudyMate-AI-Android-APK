from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.quiz import Quiz, QuizAttempt, QuizQuestion


class QuizRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_quizzes_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Quiz]:
        stmt = select(Quiz).where(Quiz.user_id == user_id)
        if subject_id is not None:
            stmt = stmt.where(Quiz.subject_id == subject_id)

        stmt = stmt.order_by(Quiz.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_quizzes_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count(Quiz.id)).where(Quiz.user_id == user_id)
        if subject_id is not None:
            stmt = stmt.where(Quiz.subject_id == subject_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_quiz_by_id(
        self,
        quiz_id: UUID,
        user_id: UUID,
        load_questions: bool = True,
    ) -> Quiz | None:
        stmt = select(Quiz).where(
            Quiz.id == quiz_id,
            Quiz.user_id == user_id,
        )
        if load_questions:
            stmt = stmt.options(selectinload(Quiz.questions))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_quiz(
        self,
        quiz: Quiz,
        questions: list[QuizQuestion],
    ) -> Quiz:
        quiz.questions = questions
        self.session.add(quiz)
        await self.session.flush()
        return quiz

    async def delete_quiz(self, quiz: Quiz) -> None:
        await self.session.delete(quiz)
        await self.session.flush()

    async def create_attempt(self, attempt: QuizAttempt) -> QuizAttempt:
        self.session.add(attempt)
        await self.session.flush()
        await self.session.refresh(attempt)
        return attempt

    async def get_attempt_by_id(
        self,
        attempt_id: UUID,
        user_id: UUID,
    ) -> QuizAttempt | None:
        stmt = (
            select(QuizAttempt)
            .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
            .options(selectinload(QuizAttempt.quiz).selectinload(Quiz.questions))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_attempts_by_quiz(
        self,
        quiz_id: UUID,
        user_id: UUID,
    ) -> Sequence[QuizAttempt]:
        stmt = (
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
            .order_by(QuizAttempt.completed_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

