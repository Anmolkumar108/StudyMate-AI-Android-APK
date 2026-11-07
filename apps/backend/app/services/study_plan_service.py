import logging
import uuid
from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.exam import Exam
from app.models.study_plan import StudyPlan
from app.models.task import Task
from app.repositories.exam_repo import ExamRepository
from app.repositories.study_plan_repo import StudyPlanRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.timetable_repo import TimetableRepository
from app.schemas.study_plan import StudyBlockItem, StudyPlanResponse
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)


def _time_to_minutes(t: time | str) -> int:
    if isinstance(t, str):
        parts = t.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    return t.hour * 60 + t.minute


def _minutes_to_time_str(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"


class StudyPlannerService:
    def __init__(
        self,
        session: AsyncSession,
        study_plan_repo: StudyPlanRepository,
        task_repo: TaskRepository,
        exam_repo: ExamRepository,
        timetable_repo: TimetableRepository,
        subject_repo: SubjectRepository,
        ai_service: AIService | None = None,
    ):
        self.session = session
        self.study_plan_repo = study_plan_repo
        self.task_repo = task_repo
        self.exam_repo = exam_repo
        self.timetable_repo = timetable_repo
        self.subject_repo = subject_repo
        self.ai_service = ai_service or AIService()

    def _to_response(self, plan: StudyPlan) -> StudyPlanResponse:
        blocks = [StudyBlockItem.model_validate(b) for b in (plan.timeblocks or [])]
        study_minutes = sum(b.duration_minutes for b in blocks if b.block_type != "break")
        comp_pct = (
            round((plan.completed_minutes / study_minutes) * 100, 1)
            if study_minutes > 0
            else 0.0
        )
        return StudyPlanResponse(
            id=plan.id or uuid.uuid4(),
            user_id=plan.user_id,
            plan_date=plan.plan_date,
            target_study_minutes=plan.target_study_minutes,
            planned_minutes=plan.planned_minutes,
            completed_minutes=plan.completed_minutes,
            completion_percentage=min(100.0, comp_pct),
            timeblocks=blocks,
            ai_summary=plan.ai_summary,
            status=plan.status,
            created_at=plan.created_at or datetime.now(UTC),
            updated_at=plan.updated_at or datetime.now(UTC),
        )

    async def get_plan_by_date(self, user_id: uuid.UUID, plan_date: date) -> StudyPlanResponse | None:
        plan = await self.study_plan_repo.get_by_date(plan_date, user_id)
        if not plan:
            return None
        return self._to_response(plan)

    async def get_plan_by_id(self, user_id: uuid.UUID, plan_id: uuid.UUID) -> StudyPlanResponse | None:
        plan = await self.study_plan_repo.get_by_id(plan_id, user_id)
        if not plan:
            return None
        return self._to_response(plan)

    async def delete_plan(self, user_id: uuid.UUID, plan_id: uuid.UUID) -> bool:
        plan = await self.study_plan_repo.get_by_id(plan_id, user_id)
        if not plan:
            return False
        await self.study_plan_repo.delete(plan)
        return True

    async def generate_daily_plan(
        self,
        user_id: uuid.UUID,
        plan_date: date | None = None,
        target_study_minutes: int = 180,
        focus_subject_ids: list[uuid.UUID] | None = None,
        pace_mode: str = "balanced",
        start_hour: int | None = None,
        include_breaks: bool = True,
    ) -> StudyPlanResponse:
        target_date = plan_date or date.today()
        clamped_target = max(30, min(480, target_study_minutes))

        # Pace mode sizing
        if pace_mode == "intensive":
            default_dur = 60
            break_dur = 10
        elif pace_mode == "pomodoro":
            default_dur = 25
            break_dur = 5
        else:  # balanced
            default_dur = 45
            break_dur = 15

        # 1. Fetch user subjects
        user_subjects = await self.subject_repo.list_by_user(user_id)
        subject_map = {s.id: s for s in user_subjects}
        focus_set = set(focus_subject_ids) if focus_subject_ids else None

        # 2. Fetch pending tasks (using list_by_user correctly)
        active_tasks = await self.task_repo.list_by_user(user_id=user_id, limit=50)
        pending_tasks = [t for t in active_tasks if t.status != "completed"]

        # Sort by urgency with focus subject boost and safe tz-aware dates
        priority_rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}

        def _get_task_sort_key(t: Task) -> tuple[int, datetime]:
            p_val = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
            p_score = priority_rank.get(p_val, 2)
            if focus_set and t.subject_id in focus_set:
                p_score -= 10
            due = t.due_datetime
            if due is None:
                due = datetime.max.replace(tzinfo=UTC)
            elif due.tzinfo is None:
                due = due.replace(tzinfo=UTC)
            return (p_score, due)

        pending_tasks.sort(key=_get_task_sort_key)

        # 3. Fetch upcoming exams
        upcoming_exams = await self.exam_repo.list_by_user(user_id=user_id, upcoming_only=True)

        # 4. Fetch timetable classes for today to avoid collisions
        day_of_week = target_date.isoweekday()  # Monday = 1, Sunday = 7
        today_classes = await self.timetable_repo.list_by_user(user_id=user_id, day_of_week=day_of_week)

        busy_intervals: list[tuple[int, int]] = []
        for c in today_classes:
            st = _time_to_minutes(c.start_time)
            et = _time_to_minutes(c.end_time) + 15  # 15-min travel/cool-off buffer
            busy_intervals.append((st, et))

        # Sort and merge busy intervals
        busy_intervals.sort()

        # 5. Workload allocation engine
        allocated_blocks: list[dict[str, Any]] = []
        current_allocated_mins = 0

        # Phase A: High-priority exams (due within 10 days)
        def _exam_sort_key(e: Exam) -> tuple[int, datetime]:
            f_score = 0 if focus_set and e.subject_id in focus_set else 1
            ed = e.exam_date
            if isinstance(ed, date) and not isinstance(ed, datetime):
                ed = datetime.combine(ed, time.min).replace(tzinfo=UTC)
            elif isinstance(ed, datetime) and ed.tzinfo is None:
                ed = ed.replace(tzinfo=UTC)
            return (f_score, ed if isinstance(ed, datetime) else datetime.max.replace(tzinfo=UTC))

        sorted_exams = sorted(upcoming_exams, key=_exam_sort_key)
        for ex in sorted_exams:
            if current_allocated_mins >= clamped_target:
                break
            if focus_set and ex.subject_id not in focus_set and len(allocated_blocks) < len(focus_set):
                continue

            ex_date = ex.exam_date.date() if isinstance(ex.exam_date, datetime) else ex.exam_date
            days_away = (ex_date - target_date).days
            if 0 <= days_away <= 10:
                sub = subject_map.get(ex.subject_id)
                sub_name = sub.name if sub else (ex.subject.name if ex.subject else "Exam Course")
                sub_color = sub.color if sub else "#EC4899"
                dur = default_dur if days_away > 4 else min(default_dur + 15, 60)
                dur = min(dur, clamped_target - current_allocated_mins)
                if dur >= 15:
                    allocated_blocks.append({
                        "id": f"blk-ex-{ex.id}-{len(allocated_blocks)}",
                        "subject_id": str(ex.subject_id),
                        "subject_name": sub_name,
                        "subject_color": sub_color,
                        "task_id": None,
                        "exam_id": str(ex.id),
                        "title": f"Revise {sub_name} (Exam in {days_away}d)",
                        "block_type": "exam_revision",
                        "duration_minutes": dur,
                        "priority": "urgent" if days_away <= 3 else "high",
                        "is_completed": False,
                        "completed_at": None,
                    })
                    current_allocated_mins += dur

        # Phase B: Pending assignment tasks
        for t in pending_tasks:
            if current_allocated_mins >= clamped_target:
                break
            if focus_set and t.subject_id and t.subject_id not in focus_set and len(allocated_blocks) < len(focus_set):
                continue

            sub = subject_map.get(t.subject_id) if t.subject_id else None
            sub_name = sub.name if sub else (t.subject.name if t.subject else "General Task")
            sub_color = sub.color if sub else "#38BDF8"
            dur = min(default_dur, clamped_target - current_allocated_mins)
            p_val = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
            p_clean = str(p_val).lower().strip()
            p_final = p_clean if p_clean in ("urgent", "high", "medium", "low") else "medium"
            if dur >= 15:
                allocated_blocks.append({
                    "id": f"blk-tk-{t.id}-{len(allocated_blocks)}",
                    "subject_id": str(t.subject_id) if t.subject_id else None,
                    "subject_name": sub_name,
                    "subject_color": sub_color,
                    "task_id": str(t.id),
                    "exam_id": None,
                    "title": t.title,
                    "block_type": "task_work",
                    "duration_minutes": dur,
                    "priority": p_final,
                    "is_completed": False,
                    "completed_at": None,
                })
                current_allocated_mins += dur

        # Phase C: Spaced review / Active subjects if time remains
        candidate_subjects = [s for s in user_subjects if not focus_set or s.id in focus_set]
        if not candidate_subjects and user_subjects:
            candidate_subjects = user_subjects

        if current_allocated_mins < clamped_target and candidate_subjects:
            for s in candidate_subjects:
                if current_allocated_mins >= clamped_target:
                    break
                represented = any(b.get("subject_id") == str(s.id) for b in allocated_blocks)
                if not represented or len(allocated_blocks) < 2:
                    dur = min(default_dur, clamped_target - current_allocated_mins)
                    if dur >= 15:
                        allocated_blocks.append({
                            "id": f"blk-sub-{s.id}-{len(allocated_blocks)}",
                            "subject_id": str(s.id),
                            "subject_name": s.name,
                            "subject_color": s.color,
                            "task_id": None,
                            "exam_id": None,
                            "title": f"Deep Practice: {s.name}",
                            "block_type": "spaced_review",
                            "duration_minutes": dur,
                            "priority": "medium",
                            "is_completed": False,
                            "completed_at": None,
                        })
                        current_allocated_mins += dur

        # If user has no tasks or exams yet, create an onboarding study block
        if not allocated_blocks:
            default_sub = candidate_subjects[0] if candidate_subjects else (user_subjects[0] if user_subjects else None)
            allocated_blocks.append({
                "id": f"blk-init-{uuid.uuid4().hex[:6]}",
                "subject_id": str(default_sub.id) if default_sub else None,
                "subject_name": default_sub.name if default_sub else "Deep Study",
                "subject_color": default_sub.color if default_sub else "#10B981",
                "task_id": None,
                "exam_id": None,
                "title": f"Core Focus Session: {default_sub.name if default_sub else 'Reading & Notes'}",
                "block_type": "task_work",
                "duration_minutes": min(default_dur, clamped_target),
                "priority": "medium",
                "is_completed": False,
                "completed_at": None,
            })
            current_allocated_mins += min(default_dur, clamped_target)

        # 6. Schedule time placements
        if start_hour is not None:
            study_start_minute = start_hour * 60
        else:
            study_start_minute = 15 * 60  # 15:00 default
            if busy_intervals:
                last_class_end = max(end for _, end in busy_intervals)
                study_start_minute = max(study_start_minute, last_class_end + 15)

        cursor = study_start_minute
        scheduled_blocks: list[dict[str, Any]] = []

        for idx, blk in enumerate(allocated_blocks):
            # Check if cursor falls in a busy window
            for b_start, b_end in busy_intervals:
                if b_start <= cursor < b_end:
                    cursor = b_end + 10

            st_str = _minutes_to_time_str(cursor)
            cursor += blk["duration_minutes"]
            et_str = _minutes_to_time_str(cursor)

            blk["start_time"] = st_str
            blk["end_time"] = et_str
            scheduled_blocks.append(blk)

            # Insert a rest break if include_breaks is True
            if include_breaks and (idx + 1) % 2 == 0 and idx < len(allocated_blocks) - 1:
                break_start = cursor
                cursor += break_dur
                scheduled_blocks.append({
                    "id": f"blk-brk-{idx}",
                    "subject_id": None,
                    "subject_name": "Break",
                    "subject_color": "#64748B",
                    "task_id": None,
                    "exam_id": None,
                    "title": "☕ Refresh & Rest Break",
                    "block_type": "break",
                    "start_time": _minutes_to_time_str(break_start),
                    "end_time": _minutes_to_time_str(cursor),
                    "duration_minutes": break_dur,
                    "priority": "low",
                    "is_completed": False,
                    "completed_at": None,
                })
            else:
                cursor += 10  # 10 min transition buffer

        # 7. AI Strategic Insight
        ai_summary = "Prioritize your highest urgency tasks early when energy is peak. Take regular breathers to maximize retention."
        try:
            if not self.ai_service._is_mock_key():
                top_items = [b["title"] for b in allocated_blocks[:3]]
                prompt = (
                    f"Student has a planned study routine for {target_date.strftime('%A, %b %d')}: "
                    f"{', '.join(top_items)}. Total target: {current_allocated_mins} minutes. "
                    f"Provide exactly 2 concise, motivating sentences of coaching guidance."
                )
                ai_advice = self.ai_service.stream_chat(
                    [{"role": "user", "content": prompt}],
                    is_socratic=False,
                )
                # Collect output
                collected = []
                async for chunk in ai_advice:
                    collected.append(chunk)
                resp_text = "".join(collected).strip()
                if resp_text and len(resp_text) > 10:
                    ai_summary = resp_text
        except Exception as e:
            logger.warning(f"AI summary generation skipped: {e}")

        # 8. Check if plan already exists for this date
        existing_plan = await self.study_plan_repo.get_by_date(target_date, user_id)
        if existing_plan:
            existing_plan.target_study_minutes = clamped_target
            existing_plan.planned_minutes = current_allocated_mins
            existing_plan.completed_minutes = 0
            existing_plan.timeblocks = scheduled_blocks
            existing_plan.ai_summary = ai_summary
            existing_plan.status = "active"
            flag_modified(existing_plan, "timeblocks")
            saved = await self.study_plan_repo.update(existing_plan)
            return self._to_response(saved)

        new_plan = StudyPlan(
            user_id=user_id,
            plan_date=target_date,
            target_study_minutes=clamped_target,
            planned_minutes=current_allocated_mins,
            completed_minutes=0,
            timeblocks=scheduled_blocks,
            ai_summary=ai_summary,
            status="active",
        )
        saved = await self.study_plan_repo.create(new_plan)
        return self._to_response(saved)

    async def toggle_block_completion(
        self,
        user_id: uuid.UUID,
        plan_id: uuid.UUID,
        block_id: str,
        is_completed: bool,
    ) -> StudyPlanResponse | None:
        plan = await self.study_plan_repo.get_by_id(plan_id, user_id)
        if not plan:
            return None

        blocks = list(plan.timeblocks or [])
        found = False
        completed_mins = 0

        for b in blocks:
            if b.get("id") == block_id:
                b["is_completed"] = is_completed
                b["completed_at"] = datetime.now(UTC).isoformat() if is_completed else None
                found = True

            if b.get("is_completed") and b.get("block_type") != "break":
                completed_mins += b.get("duration_minutes", 0)

        if not found:
            return None

        plan.timeblocks = blocks
        plan.completed_minutes = completed_mins

        # If all non-break blocks are completed, mark plan completed
        study_blocks = [b for b in blocks if b.get("block_type") != "break"]
        if study_blocks and all(b.get("is_completed") for b in study_blocks):
            plan.status = "completed"
        else:
            plan.status = "active"

        flag_modified(plan, "timeblocks")
        saved = await self.study_plan_repo.update(plan)
        return self._to_response(saved)

    async def rebalance_plan(
        self,
        user_id: uuid.UUID,
        plan_id: uuid.UUID,
        remaining_available_minutes: int | None = None,
    ) -> StudyPlanResponse | None:
        plan = await self.study_plan_repo.get_by_id(plan_id, user_id)
        if not plan:
            return None

        blocks = list(plan.timeblocks or [])
        pending_blocks = [b for b in blocks if not b.get("is_completed") and b.get("block_type") != "break"]
        completed_blocks = [b for b in blocks if b.get("is_completed")]

        if not pending_blocks:
            return self._to_response(plan)

        # Start rebalancing from the current hour or 17:00
        now = datetime.now(UTC)
        start_min = max(17 * 60, now.hour * 60 + now.minute + 10)

        # Available time limit
        avail_mins = (
            remaining_available_minutes
            if remaining_available_minutes is not None
            else max(60, plan.target_study_minutes - plan.completed_minutes)
        )

        cursor = start_min
        rebalanced_pending: list[dict[str, Any]] = []
        allocated = 0

        for b in pending_blocks:
            if allocated >= avail_mins:
                break
            dur = min(b.get("duration_minutes", 45), avail_mins - allocated)
            if dur < 15:
                break
            b["duration_minutes"] = dur
            b["start_time"] = _minutes_to_time_str(cursor)
            cursor += dur
            b["end_time"] = _minutes_to_time_str(cursor)
            cursor += 10
            allocated += dur
            rebalanced_pending.append(b)

        all_new_blocks = completed_blocks + rebalanced_pending
        all_new_blocks.sort(key=lambda b: _time_to_minutes(b.get("start_time", "00:00")))

        plan.timeblocks = all_new_blocks
        plan.planned_minutes = plan.completed_minutes + allocated
        plan.ai_summary = "Schedule rebalanced! Remaining study blocks adjusted to match your evening availability."
        flag_modified(plan, "timeblocks")

        saved = await self.study_plan_repo.update(plan)
        return self._to_response(saved)

