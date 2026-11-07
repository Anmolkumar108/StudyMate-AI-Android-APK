import logging
import uuid
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.quiz import Quiz, QuizAttempt
from app.models.study_plan import StudyPlan
from app.models.study_session import StudySession
from app.models.subject import Subject
from app.models.task import Task, TaskStatus
from app.repositories.study_session_repo import StudySessionRepository
from app.schemas.analytics import (
    AnalyticsHeatmapResponse,
    AnalyticsOverviewResponse,
    DailyActivityItem,
    MilestoneBadge,
    QuizMasteryItem,
    StudySessionCreateRequest,
    StudySessionResponse,
    SubjectTimeDistributionItem,
    TodayStudySummary,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.session_repo = StudySessionRepository(session)

    async def log_session(
        self,
        user_id: uuid.UUID,
        payload: StudySessionCreateRequest,
    ) -> StudySessionResponse:
        """
        Records a completed Pomodoro or focus study session into PostgreSQL.
        Optionally links to a task and updates the task's focus counters.
        """
        # Create session record
        new_session = StudySession(
            id=uuid.uuid4(),
            user_id=user_id,
            subject_id=payload.subject_id,
            task_id=payload.task_id,
            duration_minutes=payload.duration_minutes,
            actual_seconds_spent=payload.actual_seconds_spent,
            session_type=payload.session_type,
            completed_successfully=payload.completed_successfully,
            rating_focus=payload.rating_focus,
            notes=payload.notes,
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            created_at=datetime.now(UTC),
        )
        created = await self.session_repo.create(new_session)

        # If task_id provided, increment task focus minutes and sessions count
        task_title: str | None = None
        if payload.task_id:
            stmt = sa.select(Task).where(Task.id == payload.task_id, Task.user_id == user_id)
            res = await self.session.execute(stmt)
            task = res.scalar_one_or_none()
            if task:
                task_title = task.title
                task.focus_minutes = (task.focus_minutes or 0) + payload.duration_minutes
                task.focus_sessions_count = (task.focus_sessions_count or 0) + 1
                await self.session.flush()

        # Subject metadata
        subject_name: str | None = None
        subject_color: str | None = None
        if payload.subject_id:
            sub_stmt = sa.select(Subject).where(Subject.id == payload.subject_id, Subject.user_id == user_id)
            sub_res = await self.session.execute(sub_stmt)
            sub = sub_res.scalar_one_or_none()
            if sub:
                subject_name = sub.name
                subject_color = sub.color

        return StudySessionResponse(
            id=created.id,
            user_id=created.user_id,
            subject_id=created.subject_id,
            task_id=created.task_id,
            duration_minutes=created.duration_minutes,
            actual_seconds_spent=created.actual_seconds_spent,
            session_type=created.session_type,
            completed_successfully=created.completed_successfully,
            rating_focus=created.rating_focus,
            notes=created.notes,
            started_at=created.started_at,
            ended_at=created.ended_at,
            created_at=created.created_at,
            subject_name=subject_name,
            subject_color=subject_color,
            task_title=task_title,
        )

    async def get_today_summary(
        self,
        user_id: uuid.UUID,
        daily_goal_minutes: int = 60,
    ) -> TodayStudySummary:
        """
        Retrieves today's focus minutes, completed sessions, and goal progress.
        """
        now = datetime.now(UTC)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        sessions = await self.session_repo.get_sessions_in_range(user_id, today_start, today_end)
        focus_sessions = [s for s in sessions if s.session_type == "focus"]

        total_minutes = sum(s.duration_minutes for s in focus_sessions)
        session_count = len(focus_sessions)

        # Also check today's study plan
        today_date = now.date()
        plan_stmt = sa.select(StudyPlan).where(
            StudyPlan.user_id == user_id,
            StudyPlan.plan_date == today_date,
        )
        plan_res = await self.session.execute(plan_stmt)
        today_plan = plan_res.scalar_one_or_none()
        if today_plan and today_plan.completed_minutes > total_minutes:
            total_minutes = today_plan.completed_minutes
            completed_blocks = len([b for b in (today_plan.timeblocks or []) if b.get("is_completed")])
            session_count = max(session_count, completed_blocks or 1)

        # Also check today's task focus
        task_today_stmt = sa.select(sa.func.sum(Task.focus_minutes), sa.func.sum(Task.focus_sessions_count)).where(
            Task.user_id == user_id,
            Task.updated_at >= today_start,
        )
        task_today_res = await self.session.execute(task_today_stmt)
        task_row = task_today_res.first()
        t_mins = task_row[0] if task_row and len(task_row) > 0 and task_row[0] is not None else 0
        t_sess = task_row[1] if task_row and len(task_row) > 1 and task_row[1] is not None else 0
        if t_mins and int(t_mins) > total_minutes:
            total_minutes = int(t_mins)
            session_count = max(session_count, int(t_sess or 1))

        progress_pct = round(min(100.0, (total_minutes / max(1, daily_goal_minutes)) * 100), 1)

        # Calculate streak
        streak = await self._calculate_current_streak(user_id)

        return TodayStudySummary(
            total_focus_minutes=total_minutes,
            total_focus_sessions=session_count,
            daily_goal_minutes=daily_goal_minutes,
            goal_progress_percent=progress_pct,
            current_streak_days=streak,
        )

    async def get_overview(
        self,
        user_id: uuid.UUID,
        timeframe: str = "all",
    ) -> AnalyticsOverviewResponse:
        """
        Compiles high-level analytics: total hours, subjects distribution,
        weekly trends, quiz mastery, and unlocked milestones.
        """
        now = datetime.now(UTC)
        start_date_filter: datetime | None = None
        if timeframe == "week":
            start_date_filter = now - timedelta(days=7)
        elif timeframe == "month":
            start_date_filter = now - timedelta(days=30)

        # 1. Study Sessions
        sessions_query = sa.select(StudySession).where(
            StudySession.user_id == user_id,
            StudySession.session_type == "focus",
        )
        if start_date_filter:
            sessions_query = sessions_query.where(StudySession.started_at >= start_date_filter)
        sessions_res = await self.session.execute(sessions_query)
        sessions = sessions_res.scalars().all()

        total_minutes = sum(s.duration_minutes for s in sessions)
        total_hours = round(total_minutes / 60.0, 1)
        total_sessions = len(sessions)

        # Check task focus minutes if sessions total is low
        task_mins_stmt = sa.select(sa.func.sum(Task.focus_minutes), sa.func.sum(Task.focus_sessions_count)).where(
            Task.user_id == user_id,
        )
        task_mins_res = await self.session.execute(task_mins_stmt)
        task_mins_row = task_mins_res.first()
        task_mins_sum = task_mins_row[0] if task_mins_row and len(task_mins_row) > 0 and task_mins_row[0] is not None else 0
        task_sess_sum = task_mins_row[1] if task_mins_row and len(task_mins_row) > 1 and task_mins_row[1] is not None else 0
        task_mins_val = int(task_mins_sum or 0)
        task_sess_val = int(task_sess_sum or 0)
        if task_mins_val > total_minutes:
            total_minutes = task_mins_val
            total_sessions = max(total_sessions, task_sess_val)
            total_hours = round(total_minutes / 60.0, 1)

        # Check study plan completed minutes if still low
        plans_total_stmt = sa.select(sa.func.sum(StudyPlan.completed_minutes)).where(
            StudyPlan.user_id == user_id,
        )
        plans_total_res = await self.session.execute(plans_total_stmt)
        plans_total_mins = int(plans_total_res.scalar() or 0)
        if plans_total_mins > total_minutes:
            total_minutes = plans_total_mins
            total_hours = round(total_minutes / 60.0, 1)

        # 2. Subjects Distribution
        subjects_stmt = sa.select(Subject).where(Subject.user_id == user_id)
        subjects_res = await self.session.execute(subjects_stmt)
        all_subjects = {s.id: s for s in subjects_res.scalars().all()}

        subject_minutes_map: dict[uuid.UUID | None, int] = {}
        subject_sessions_map: dict[uuid.UUID | None, int] = {}
        for s in sessions:
            subject_minutes_map[s.subject_id] = subject_minutes_map.get(s.subject_id, 0) + s.duration_minutes
            subject_sessions_map[s.subject_id] = subject_sessions_map.get(s.subject_id, 0) + 1

        # Also aggregate subject minutes from tasks if missing
        tasks_focus_stmt = sa.select(Task).where(
            Task.user_id == user_id,
            Task.focus_minutes > 0,
        )
        tasks_focus_res = await self.session.execute(tasks_focus_stmt)
        for tf in tasks_focus_res.scalars().all():
            if tf.subject_id and tf.subject_id not in subject_minutes_map:
                subject_minutes_map[tf.subject_id] = tf.focus_minutes
                subject_sessions_map[tf.subject_id] = max(1, tf.focus_sessions_count or 1)

        subject_distribution: list[SubjectTimeDistributionItem] = []
        for sub_id, mins in subject_minutes_map.items():
            sub = all_subjects.get(sub_id) if sub_id else None
            sub_name = sub.name if sub else "General Focus"
            sub_code = sub.code if sub else None
            color = sub.color if sub and sub.color else "#06B6D4"
            pct = round((mins / max(1, total_minutes)) * 100, 1) if total_minutes > 0 else 0.0

            subject_distribution.append(
                SubjectTimeDistributionItem(
                    subject_id=sub_id,
                    subject_name=sub_name,
                    subject_code=sub_code,
                    color_hex=color,
                    total_minutes=mins,
                    total_hours=round(mins / 60.0, 1),
                    percentage=pct,
                    session_count=subject_sessions_map.get(sub_id, 0),
                )
            )
        subject_distribution.sort(key=lambda x: x.total_minutes, reverse=True)

        # 3. Tasks Completed
        tasks_stmt = sa.select(sa.func.count(Task.id)).where(
            Task.user_id == user_id,
            Task.status == TaskStatus.COMPLETED,
        )
        if start_date_filter:
            tasks_stmt = tasks_stmt.where(Task.completed_at >= start_date_filter)
        tasks_res = await self.session.execute(tasks_stmt)
        tasks_completed_count = tasks_res.scalar() or 0

        # 4. Quizzes & Mastery Curve
        quizzes_stmt = (
            sa.select(QuizAttempt)
            .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
            .where(QuizAttempt.user_id == user_id)
            .options(selectinload(QuizAttempt.quiz))
            .order_by(QuizAttempt.completed_at.desc())
        )
        if start_date_filter:
            quizzes_stmt = quizzes_stmt.where(QuizAttempt.completed_at >= start_date_filter)
        quizzes_res = await self.session.execute(quizzes_stmt)
        attempts = quizzes_res.scalars().all()

        quizzes_taken_count = len(attempts)
        avg_score = (
            round(sum(float(a.score_percentage) for a in attempts) / quizzes_taken_count, 1)
            if quizzes_taken_count > 0
            else 0.0
        )

        quiz_mastery_curve: list[QuizMasteryItem] = [
            QuizMasteryItem(
                date=a.completed_at.strftime("%b %d"),
                quiz_title=a.quiz.title if a.quiz else "Subject Quiz",
                score_percentage=float(a.score_percentage),
                total_questions=(a.correct_count + a.incorrect_count) if hasattr(a, "correct_count") and (a.correct_count + a.incorrect_count) > 0 else 10,
            )
            for a in reversed(attempts[-10:])
        ]

        # 5. Weekly Trends (Last 7 Days)
        weekly_trends = await self._generate_daily_activity(user_id, days=7)

        # 6. Streaks
        current_streak = await self._calculate_current_streak(user_id)
        longest_streak = await self._calculate_longest_streak(user_id)

        # 7. Productivity Score (0 to 100)
        # Weighting: 40% focus time consistency, 30% streak adherence, 15% tasks, 15% quiz performance
        focus_score = min(40.0, (total_minutes / 300.0) * 40.0)
        streak_score = min(30.0, current_streak * 6.0)
        tasks_score = min(15.0, tasks_completed_count * 3.0)
        quiz_score = (avg_score / 100.0) * 15.0 if quizzes_taken_count > 0 else 5.0
        composite_score = int(round(focus_score + streak_score + tasks_score + quiz_score))
        composite_score = max(5, min(100, composite_score))

        # 8. Milestone Badges
        milestones = [
            MilestoneBadge(
                id="first_focus",
                title="First Deep Focus",
                description="Completed your very first focus study block",
                icon="🌱",
                unlocked=total_sessions >= 1,
                progress_text="1/1 sessions" if total_sessions >= 1 else "0/1 sessions",
            ),
            MilestoneBadge(
                id="streak_3",
                title="Momentum Builder",
                description="Maintained a 3-day consecutive study streak",
                icon="🔥",
                unlocked=current_streak >= 3 or longest_streak >= 3,
                progress_text=f"{min(3, max(current_streak, longest_streak))}/3 days",
            ),
            MilestoneBadge(
                id="deep_work_10",
                title="Deep Work Scholar",
                description="Logged 10 or more hours of dedicated focus",
                icon="⚡",
                unlocked=total_hours >= 10.0,
                progress_text=f"{min(10.0, total_hours):.1f}/10 hrs",
            ),
            MilestoneBadge(
                id="task_crusher_5",
                title="Task Destroyer",
                description="Completed 5 homework or assignment tasks",
                icon="✅",
                unlocked=tasks_completed_count >= 5,
                progress_text=f"{min(5, tasks_completed_count)}/5 tasks",
            ),
            MilestoneBadge(
                id="quiz_ace",
                title="Mastery Ace",
                description="Achieved 80%+ average on academic quizzes",
                icon="🎯",
                unlocked=quizzes_taken_count >= 1 and avg_score >= 80.0,
                progress_text=f"{avg_score}% avg (need 80%)" if quizzes_taken_count > 0 else "0/1 quiz",
            ),
            MilestoneBadge(
                id="centurion_100",
                title="Study Centurion",
                description="Surpassed 100 total hours of deep mastery",
                icon="👑",
                unlocked=total_hours >= 100.0,
                progress_text=f"{min(100.0, total_hours):.1f}/100 hrs",
            ),
        ]

        return AnalyticsOverviewResponse(
            total_focus_hours=total_hours,
            total_sessions=total_sessions,
            current_streak_days=current_streak,
            longest_streak_days=longest_streak,
            tasks_completed_count=tasks_completed_count,
            quizzes_taken_count=quizzes_taken_count,
            average_quiz_score=avg_score,
            flashcards_reviewed_count=0,
            productivity_score=composite_score,
            subject_distribution=subject_distribution,
            weekly_trends=weekly_trends,
            quiz_mastery_curve=quiz_mastery_curve,
            milestones=milestones,
        )

    async def get_heatmap(
        self,
        user_id: uuid.UUID,
        days: int = 180,
    ) -> AnalyticsHeatmapResponse:
        """
        Generates 6-month activity matrix for the GitHub-style consistency heatmap.
        """
        now = datetime.now(UTC).date()
        start_date = now - timedelta(days=days - 1)

        matrix = await self._generate_daily_activity(user_id, days=days)
        active_days = sum(1 for item in matrix if item.level > 0)
        total_focus_minutes = sum(item.focus_minutes for item in matrix)

        current_streak = await self._calculate_current_streak(user_id)
        longest_streak = await self._calculate_longest_streak(user_id)

        return AnalyticsHeatmapResponse(
            start_date=start_date.isoformat(),
            end_date=now.isoformat(),
            total_days=days,
            total_active_days=active_days,
            total_focus_minutes=total_focus_minutes,
            current_streak_days=current_streak,
            longest_streak_days=longest_streak,
            matrix=matrix,
        )

    # -------------------------------------------------------------------------
    # Internal Aggregation & Calculation Helpers
    # -------------------------------------------------------------------------

    async def _generate_daily_activity(
        self,
        user_id: uuid.UUID,
        days: int,
    ) -> list[DailyActivityItem]:
        """
        Aggregates daily focus minutes, sessions, completed tasks, and quizzes.
        """
        now = datetime.now(UTC).date()
        start_date = now - timedelta(days=days - 1)
        start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0, tzinfo=UTC)

        # 1. Sessions map
        sessions_stmt = sa.select(StudySession).where(
            StudySession.user_id == user_id,
            StudySession.started_at >= start_dt,
            StudySession.session_type == "focus",
        )
        sessions_res = await self.session.execute(sessions_stmt)
        sessions = sessions_res.scalars().all()

        daily_mins: dict[str, int] = {}
        daily_sessions: dict[str, int] = {}
        for s in sessions:
            d_str = s.started_at.strftime("%Y-%m-%d")
            daily_mins[d_str] = daily_mins.get(d_str, 0) + s.duration_minutes
            daily_sessions[d_str] = daily_sessions.get(d_str, 0) + 1

        # 1b. Check tasks with logged focus minutes
        tasks_focus_stmt = sa.select(Task).where(
            Task.user_id == user_id,
            Task.focus_minutes > 0,
        )
        tasks_focus_res = await self.session.execute(tasks_focus_stmt)
        for tf in tasks_focus_res.scalars().all():
            tf_date = (tf.updated_at or tf.created_at).strftime("%Y-%m-%d")
            if daily_mins.get(tf_date, 0) == 0:
                daily_mins[tf_date] = daily_mins.get(tf_date, 0) + tf.focus_minutes
                daily_sessions[tf_date] = daily_sessions.get(tf_date, 0) + max(1, tf.focus_sessions_count or 1)

        # 1c. Check study plans with completed minutes
        plans_stmt = sa.select(StudyPlan).where(
            StudyPlan.user_id == user_id,
            StudyPlan.completed_minutes > 0,
        )
        plans_res = await self.session.execute(plans_stmt)
        for sp in plans_res.scalars().all():
            sp_date = sp.plan_date.isoformat()
            if daily_mins.get(sp_date, 0) < sp.completed_minutes:
                daily_mins[sp_date] = max(daily_mins.get(sp_date, 0), sp.completed_minutes)
                daily_sessions[sp_date] = max(daily_sessions.get(sp_date, 0), 1)

        # 2. Tasks completed map
        tasks_stmt = sa.select(Task).where(
            Task.user_id == user_id,
            Task.status == TaskStatus.COMPLETED,
        )
        tasks_res = await self.session.execute(tasks_stmt)
        tasks = tasks_res.scalars().all()

        daily_tasks: dict[str, int] = {}
        for t in tasks:
            d_dt = t.completed_at or t.updated_at or t.created_at
            if d_dt:
                d_str = d_dt.strftime("%Y-%m-%d")
                daily_tasks[d_str] = daily_tasks.get(d_str, 0) + 1

        # 3. Quizzes taken map
        quizzes_stmt = sa.select(QuizAttempt).where(
            QuizAttempt.user_id == user_id,
            QuizAttempt.completed_at >= start_dt,
        )
        quizzes_res = await self.session.execute(quizzes_stmt)
        attempts = quizzes_res.scalars().all()

        daily_quizzes: dict[str, int] = {}
        for a in attempts:
            d_str = a.completed_at.strftime("%Y-%m-%d")
            daily_quizzes[d_str] = daily_quizzes.get(d_str, 0) + 1

        # 4. Construct complete continuous array
        result: list[DailyActivityItem] = []
        for i in range(days):
            current_day = start_date + timedelta(days=i)
            d_str = current_day.isoformat()

            mins = daily_mins.get(d_str, 0)
            sess = daily_sessions.get(d_str, 0)
            tsk = daily_tasks.get(d_str, 0)
            qzs = daily_quizzes.get(d_str, 0)

            # Intensity Level Scale (0 to 4)
            # Level 0: Inactive
            # Level 1: Light (1-25m or 1 task)
            # Level 2: Moderate (26-55m or 15m + task)
            # Level 3: Strong (56-110m or 45m + 2 tasks)
            # Level 4: Intensive (110+ mins or 90m + 2+ tasks/quizzes)
            level = 0
            composite_points = mins + (tsk * 20) + (qzs * 25)
            if composite_points >= 120 or mins >= 110:
                level = 4
            elif composite_points >= 60 or mins >= 55:
                level = 3
            elif composite_points >= 25 or mins >= 25:
                level = 2
            elif composite_points > 0:
                level = 1

            result.append(
                DailyActivityItem(
                    date=d_str,
                    focus_minutes=mins,
                    sessions_count=sess,
                    tasks_completed=tsk,
                    quizzes_taken=qzs,
                    level=level,
                )
            )

        return result

    async def _calculate_current_streak(self, user_id: uuid.UUID) -> int:
        """
        Calculates active streak in consecutive days leading up to today (or yesterday).
        """
        now = datetime.now(UTC).date()
        # Check last 60 days
        matrix = await self._generate_daily_activity(user_id, days=60)
        activity_by_date = {item.date: item.level > 0 for item in matrix}

        today_str = now.isoformat()

        # If active today, streak starts from today; if not active yet today, check if yesterday was active
        streak = 0
        start_check = now if activity_by_date.get(today_str, False) else (now - timedelta(days=1))

        current_d = start_check
        while True:
            d_str = current_d.isoformat()
            if activity_by_date.get(d_str, False):
                streak += 1
                current_d = current_d - timedelta(days=1)
            else:
                break

        return streak

    async def _calculate_longest_streak(self, user_id: uuid.UUID) -> int:
        """
        Calculates the maximum consecutive active streak days over the past 180 days.
        """
        matrix = await self._generate_daily_activity(user_id, days=180)
        longest = 0
        current_run = 0
        for item in matrix:
            if item.level > 0:
                current_run += 1
                longest = max(longest, current_run)
            else:
                current_run = 0
        return longest

