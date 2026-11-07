import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.exam import Exam
from app.repositories.exam_repo import ExamRepository
from app.repositories.subject_repo import SubjectRepository
from app.schemas.exam import (
    ExamCreate,
    ExamListResponse,
    ExamResponse,
    ExamUpcomingSummaryResponse,
    ExamUpdate,
)
from app.services.ai_service import AIService


class ExamService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.exam_repo = ExamRepository(session)
        self.subject_repo = SubjectRepository(session)

    @staticmethod
    def _to_response(exam: Exam) -> ExamResponse:
        topics = exam.syllabus_topics or []
        total_topics = len(topics)
        completed_topics = sum(1 for t in topics if t.get("is_completed"))
        readiness_pct = (
            round((completed_topics / total_topics) * 100, 1) if total_topics > 0 else 0.0
        )

        now = datetime.now(UTC)
        is_past = exam.exam_date < now
        if not is_past:
            diff = exam.exam_date - now
            days_remaining = diff.days
            hours_remaining = int(diff.total_seconds() // 3600)
        else:
            days_remaining = 0
            hours_remaining = 0

        subject = exam.subject
        return ExamResponse(
            id=exam.id,
            user_id=exam.user_id,
            subject_id=exam.subject_id,
            subject_name=subject.name if subject else None,
            subject_color=subject.color if subject else None,
            title=exam.title,
            exam_date=exam.exam_date,
            location=exam.location,
            target_score=exam.target_score,
            achieved_score=exam.achieved_score,
            syllabus_topics=topics,
            total_topics=total_topics,
            completed_topics=completed_topics,
            readiness_percentage=readiness_pct,
            days_remaining=days_remaining,
            hours_remaining=hours_remaining,
            is_past=is_past,
            revision_plan=exam.revision_plan,
            created_at=exam.created_at,
            updated_at=exam.updated_at,
        )

    async def list_exams(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        upcoming_only: bool = False,
    ) -> ExamListResponse:
        exams = await self.exam_repo.list_by_user(
            user_id=user_id,
            subject_id=subject_id,
            upcoming_only=upcoming_only,
        )
        items = [self._to_response(e) for e in exams]
        upcoming_count = sum(1 for item in items if not item.is_past)
        avg_readiness = (
            round(sum(item.readiness_percentage for item in items) / len(items), 1)
            if items
            else 0.0
        )

        return ExamListResponse(
            items=items,
            total=len(items),
            upcoming_count=upcoming_count,
            average_readiness=avg_readiness,
        )

    async def get_exam(self, user_id: UUID, exam_id: UUID) -> ExamResponse:
        exam = await self.exam_repo.get_by_id_and_user(exam_id=exam_id, user_id=user_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )
        return self._to_response(exam)

    async def create_exam(self, user_id: UUID, payload: ExamCreate) -> ExamResponse:
        # Verify subject exists and belongs to current user (IDOR prevention)
        subject = await self.subject_repo.get_by_id_and_user(
            subject_id=payload.subject_id,
            user_id=user_id,
        )
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the authenticated user.",
            )

        # Standardize syllabus topics
        formatted_topics: list[dict[str, Any]] = []
        for item in payload.syllabus_topics:
            if isinstance(item, str):
                cleaned = item.strip()
                if cleaned:
                    formatted_topics.append({
                        "id": f"top_{uuid.uuid4().hex[:8]}",
                        "name": cleaned,
                        "is_completed": False,
                        "confidence": "medium",
                    })
            elif isinstance(item, dict):
                name = str(item.get("name", "")).strip()
                if name:
                    formatted_topics.append({
                        "id": str(item.get("id") or f"top_{uuid.uuid4().hex[:8]}"),
                        "name": name,
                        "is_completed": bool(item.get("is_completed", False)),
                        "confidence": str(item.get("confidence", "medium")),
                    })

        exam = Exam(
            user_id=user_id,
            subject_id=payload.subject_id,
            title=payload.title.strip(),
            exam_date=payload.exam_date,
            location=payload.location.strip() if payload.location else None,
            target_score=payload.target_score,
            achieved_score=payload.achieved_score,
            syllabus_topics=formatted_topics,
            revision_plan=None,
        )

        saved = await self.exam_repo.create(exam)
        return self._to_response(saved)

    async def update_exam(
        self,
        user_id: UUID,
        exam_id: UUID,
        payload: ExamUpdate,
    ) -> ExamResponse:
        exam = await self.exam_repo.get_by_id_and_user(exam_id=exam_id, user_id=user_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )

        if payload.subject_id is not None and payload.subject_id != exam.subject_id:
            subject = await self.subject_repo.get_by_id_and_user(
                subject_id=payload.subject_id,
                user_id=user_id,
            )
            if not subject:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subject not found or does not belong to the authenticated user.",
                )
            exam.subject_id = payload.subject_id

        if payload.title is not None:
            exam.title = payload.title.strip()
        if payload.exam_date is not None:
            exam.exam_date = payload.exam_date
        if payload.location is not None:
            exam.location = payload.location.strip() if payload.location else None
        if payload.target_score is not None:
            exam.target_score = payload.target_score
        if payload.achieved_score is not None:
            exam.achieved_score = payload.achieved_score
        if payload.syllabus_topics is not None:
            existing_by_name = {
                t.get("name", "").strip().lower(): t
                for t in (exam.syllabus_topics or [])
                if isinstance(t, dict) and t.get("name")
            }
            existing_by_id = {
                str(t.get("id")): t
                for t in (exam.syllabus_topics or [])
                if isinstance(t, dict) and t.get("id")
            }

            formatted_topics: list[dict[str, Any]] = []
            for item in payload.syllabus_topics:
                if isinstance(item, str):
                    cleaned = item.strip()
                    if cleaned:
                        prev = existing_by_name.get(cleaned.lower())
                        formatted_topics.append({
                            "id": prev.get("id") if prev else f"top_{uuid.uuid4().hex[:8]}",
                            "name": cleaned,
                            "is_completed": bool(prev.get("is_completed", False)) if prev else False,
                            "confidence": str(prev.get("confidence", "medium")) if prev else "medium",
                        })
                elif isinstance(item, dict):
                    name = str(item.get("name", "")).strip()
                    topic_id = str(item.get("id") or "")
                    if name:
                        prev = existing_by_id.get(topic_id) or existing_by_name.get(name.lower())
                        formatted_topics.append({
                            "id": topic_id or (prev.get("id") if prev else f"top_{uuid.uuid4().hex[:8]}"),
                            "name": name,
                            "is_completed": bool(item.get("is_completed", prev.get("is_completed", False) if prev else False)),
                            "confidence": str(item.get("confidence", prev.get("confidence", "medium") if prev else "medium")),
                        })

            exam.syllabus_topics = formatted_topics
            flag_modified(exam, "syllabus_topics")

        saved = await self.exam_repo.update(exam)
        return self._to_response(saved)

    async def delete_exam(self, user_id: UUID, exam_id: UUID) -> None:
        exam = await self.exam_repo.get_by_id_and_user(exam_id=exam_id, user_id=user_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )
        await self.exam_repo.delete(exam)

    async def toggle_topic(
        self,
        user_id: UUID,
        exam_id: UUID,
        topic_id: str,
        is_completed: bool | None = None,
        confidence: str | None = None,
    ) -> ExamResponse:
        exam = await self.exam_repo.get_by_id_and_user(exam_id=exam_id, user_id=user_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )

        topics = list(exam.syllabus_topics or [])
        found = False
        for t in topics:
            if t.get("id") == topic_id:
                found = True
                if is_completed is not None:
                    t["is_completed"] = is_completed
                else:
                    t["is_completed"] = not t.get("is_completed", False)
                if confidence is not None:
                    t["confidence"] = confidence
                break

        if not found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Topic '{topic_id}' not found in exam syllabus.",
            )

        exam.syllabus_topics = topics
        flag_modified(exam, "syllabus_topics")
        saved = await self.exam_repo.update(exam)
        return self._to_response(saved)

    async def generate_revision_plan(
        self,
        user_id: UUID,
        exam_id: UUID,
        ai_service: AIService,
    ) -> ExamResponse:
        exam = await self.exam_repo.get_by_id_and_user(exam_id=exam_id, user_id=user_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found.",
            )

        now = datetime.now(UTC)
        if exam.exam_date <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate an AI revision plan for an exam that has already passed.",
            )

        total_days = max(1, (exam.exam_date - now).days)
        subject_name = exam.subject.name if exam.subject else "Course"
        topics = exam.syllabus_topics or []
        topic_names = [t.get("name", "Topic") for t in topics]

        # Calculate phase day allocations
        if total_days >= 3:
            p1_days = max(1, int(round(total_days * 0.40)))
            p2_days = max(1, int(round(total_days * 0.35)))
            p3_days = max(1, total_days - (p1_days + p2_days))
        elif total_days == 2:
            p1_days = 1
            p2_days = 1
            p3_days = 1
        else:
            p1_days = 1
            p2_days = 1
            p3_days = 1

        d0 = now.date()
        p1_start = d0
        p1_end = d0 + timedelta(days=p1_days)
        p2_start = p1_end
        p2_end = p2_start + timedelta(days=p2_days)
        p3_start = p2_end
        p3_end = exam.exam_date.date()

        # Build 3 structured phases
        p1_activities = [
            f"Review comprehensive notes for {subject_name}",
            "Summarize lecture slides and textbook chapters",
            f"Highlight difficult definitions across {len(topic_names)} syllabus modules",
        ]
        if topic_names:
            p1_activities.append(f"Deep-dive comprehension into: {', '.join(topic_names[:3])}")

        p2_activities = [
            "Drill high-yield flashcards with SM-2 spaced repetition",
            "Feynman technique: Explain key topics out loud without looking at notes",
            "Solve medium-difficulty practice questions and homework problems",
        ]
        if len(topic_names) > 3:
            p2_activities.append(f"Active recall drill on: {', '.join(topic_names[3:6])}")

        p3_activities = [
            f"Complete full timed mock exam matching {subject_name} format",
            "Review mistake log and convert missed concepts to flashcards",
            "Formula sheet memorization and final quick-fire review",
        ]

        revision_plan = {
            "total_days": total_days,
            "generated_at": now.isoformat(),
            "summary": (
                f"Personalized 3-Phase Revision Plan for {exam.title} ({subject_name}) "
                f"targeting {exam.target_score or 90}% over {total_days} days."
            ),
            "phases": [
                {
                    "phase_number": 1,
                    "title": "Phase 1: Comprehension & Note Review",
                    "start_date": p1_start.isoformat(),
                    "end_date": p1_end.isoformat(),
                    "days": p1_days,
                    "description": "Understand core concepts, build study guides, and clarify confusing topics.",
                    "daily_focus_minutes": 60,
                    "suggested_activities": p1_activities,
                },
                {
                    "phase_number": 2,
                    "title": "Phase 2: Active Recall & Flashcard Drilling",
                    "start_date": p2_start.isoformat(),
                    "end_date": p2_end.isoformat(),
                    "days": p2_days,
                    "description": "Strengthen memory consolidation using spaced repetition and self-testing.",
                    "daily_focus_minutes": 75,
                    "suggested_activities": p2_activities,
                },
                {
                    "phase_number": 3,
                    "title": "Phase 3: Timed Practice Quizzes & Mock Exams",
                    "start_date": p3_start.isoformat(),
                    "end_date": p3_end.isoformat(),
                    "days": p3_days,
                    "description": "Simulate real exam conditions, analyze weaknesses, and fine-tune pacing.",
                    "daily_focus_minutes": 90,
                    "suggested_activities": p3_activities,
                },
            ],
        }

        exam.revision_plan = revision_plan
        flag_modified(exam, "revision_plan")
        saved = await self.exam_repo.update(exam)
        return self._to_response(saved)

    async def get_upcoming_summary(self, user_id: UUID) -> ExamUpcomingSummaryResponse:
        earliest = await self.exam_repo.get_earliest_upcoming(user_id=user_id)
        all_exams = await self.exam_repo.list_by_user(user_id=user_id, upcoming_only=True)

        avg_readiness = 0.0
        if all_exams:
            total_readiness = sum(self._to_response(e).readiness_percentage for e in all_exams)
            avg_readiness = round(total_readiness / len(all_exams), 1)

        return ExamUpcomingSummaryResponse(
            next_exam=self._to_response(earliest) if earliest else None,
            total_upcoming=len(all_exams),
            average_readiness=avg_readiness,
        )

