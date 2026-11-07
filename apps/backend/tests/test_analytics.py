import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.quiz import Quiz, QuizAttempt
from app.models.study_session import StudySession
from app.models.subject import Subject
from app.models.task import Task
from app.schemas.analytics import StudySessionCreateRequest
from app.services.analytics_service import AnalyticsService


@pytest.fixture
def analytics_mock_env():
    session = AsyncMock()
    session.add = MagicMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = []
    mock_res.scalar_one_or_none.return_value = None
    mock_res.first.return_value = (0, 0)
    session.execute.return_value = mock_res
    service = AnalyticsService(session=session)
    user_id = uuid.uuid4()
    return {
        "service": service,
        "session": session,
        "user_id": user_id,
    }


@pytest.mark.asyncio
async def test_log_study_session(analytics_mock_env):
    service: AnalyticsService = analytics_mock_env["service"]
    session_mock: AsyncMock = analytics_mock_env["session"]
    user_id: uuid.UUID = analytics_mock_env["user_id"]

    now = datetime.now(UTC)
    task_id = uuid.uuid4()
    sub_id = uuid.uuid4()

    # Mock Task query
    mock_task = Task(
        id=task_id,
        user_id=user_id,
        title="Implement Graph Algorithms",
        focus_minutes=15,
        focus_sessions_count=1,
    )
    mock_sub = Subject(
        id=sub_id,
        user_id=user_id,
        name="Computer Science",
        color="#06B6D4",
    )

    # Setup execute returns for task and subject lookup
    async def mock_execute(stmt):
        mock_result = MagicMock()
        # stringify statement to discern
        sql_str = str(stmt).lower()
        if "from tasks" in sql_str:
            mock_result.scalar_one_or_none.return_value = mock_task
        elif "from subjects" in sql_str:
            mock_result.scalar_one_or_none.return_value = mock_sub
        else:
            mock_result.scalar_one_or_none.return_value = None
        return mock_result

    session_mock.execute.side_effect = mock_execute

    payload = StudySessionCreateRequest(
        duration_minutes=45,
        actual_seconds_spent=2700,
        session_type="focus",
        subject_id=sub_id,
        task_id=task_id,
        completed_successfully=True,
        rating_focus=5,
        notes="Deep concentration on Dijkstra algorithm",
        started_at=now - timedelta(minutes=45),
        ended_at=now,
    )

    response = await service.log_session(user_id=user_id, payload=payload)

    assert response.user_id == user_id
    assert response.duration_minutes == 45
    assert response.session_type == "focus"
    assert response.subject_name == "Computer Science"
    assert response.task_title == "Implement Graph Algorithms"
    # Task focus minutes should be incremented
    assert mock_task.focus_minutes == 60  # 15 + 45
    assert mock_task.focus_sessions_count == 2  # 1 + 1


@pytest.mark.asyncio
async def test_get_today_summary(analytics_mock_env):
    service: AnalyticsService = analytics_mock_env["service"]
    user_id: uuid.UUID = analytics_mock_env["user_id"]

    now = datetime.now(UTC)
    mock_sessions = [
        StudySession(
            id=uuid.uuid4(),
            user_id=user_id,
            duration_minutes=25,
            actual_seconds_spent=1500,
            session_type="focus",
            started_at=now - timedelta(minutes=60),
            ended_at=now - timedelta(minutes=35),
        ),
        StudySession(
            id=uuid.uuid4(),
            user_id=user_id,
            duration_minutes=50,
            actual_seconds_spent=3000,
            session_type="focus",
            started_at=now - timedelta(minutes=30),
            ended_at=now,
        ),
    ]

    service.session_repo.get_sessions_in_range = AsyncMock(return_value=mock_sessions)
    service._calculate_current_streak = AsyncMock(return_value=4)

    summary = await service.get_today_summary(user_id=user_id, daily_goal_minutes=100)

    assert summary.total_focus_minutes == 75  # 25 + 50
    assert summary.total_focus_sessions == 2
    assert summary.daily_goal_minutes == 100
    assert summary.goal_progress_percent == 75.0
    assert summary.current_streak_days == 4


@pytest.mark.asyncio
async def test_analytics_overview(analytics_mock_env):
    service: AnalyticsService = analytics_mock_env["service"]
    session_mock: AsyncMock = analytics_mock_env["session"]
    user_id: uuid.UUID = analytics_mock_env["user_id"]

    now = datetime.now(UTC)
    sub1_id = uuid.uuid4()
    sub2_id = uuid.uuid4()

    sub1 = Subject(id=sub1_id, user_id=user_id, name="Mathematics", color="#6366F1", code="MATH101")
    sub2 = Subject(id=sub2_id, user_id=user_id, name="Physics", color="#10B981", code="PHYS201")

    sessions = [
        StudySession(
            id=uuid.uuid4(),
            user_id=user_id,
            subject_id=sub1_id,
            duration_minutes=60,
            session_type="focus",
            started_at=now - timedelta(days=1),
            ended_at=now - timedelta(days=1, minutes=-60),
        ),
        StudySession(
            id=uuid.uuid4(),
            user_id=user_id,
            subject_id=sub2_id,
            duration_minutes=30,
            session_type="focus",
            started_at=now - timedelta(hours=2),
            ended_at=now - timedelta(hours=1, minutes=30),
        ),
    ]

    mock_quiz = Quiz(id=uuid.uuid4(), user_id=user_id, title="Calculus Midterm Quiz")
    quiz_attempts = [
        QuizAttempt(
            id=uuid.uuid4(),
            user_id=user_id,
            quiz_id=mock_quiz.id,
            score_percentage=90.0,
            correct_count=9,
            incorrect_count=1,
            answers_submitted={},
            completed_at=now,
            quiz=mock_quiz,
        )
    ]

    async def mock_exec(stmt):
        mock_res = MagicMock()
        sql = str(stmt).lower()
        if "from pomodoro_sessions" in sql:
            mock_res.scalars.return_value.all.return_value = sessions
        elif "from subjects" in sql:
            mock_res.scalars.return_value.all.return_value = [sub1, sub2]
        elif "count(tasks.id)" in sql:
            mock_res.scalar.return_value = 6
        elif "from quiz_attempts" in sql:
            mock_res.scalars.return_value.all.return_value = quiz_attempts
        else:
            mock_res.scalars.return_value.all.return_value = []
            mock_res.scalar.return_value = 0
        return mock_res

    session_mock.execute.side_effect = mock_exec
    service._generate_daily_activity = AsyncMock(return_value=[])
    service._calculate_current_streak = AsyncMock(return_value=3)
    service._calculate_longest_streak = AsyncMock(return_value=5)

    overview = await service.get_overview(user_id=user_id, timeframe="all")

    assert overview.total_focus_hours == 1.5  # 90 mins / 60
    assert overview.total_sessions == 2
    assert overview.tasks_completed_count == 6
    assert overview.quizzes_taken_count == 1
    assert overview.average_quiz_score == 90.0
    assert overview.current_streak_days == 3

    # Subject distribution check
    assert len(overview.subject_distribution) == 2
    math_item = next(item for item in overview.subject_distribution if item.subject_name == "Mathematics")
    assert math_item.total_minutes == 60
    assert math_item.percentage == pytest.approx(66.7, abs=0.1)

    # Milestones verification
    unlocked_ids = {m.id for m in overview.milestones if m.unlocked}
    assert "first_focus" in unlocked_ids
    assert "streak_3" in unlocked_ids
    assert "task_crusher_5" in unlocked_ids
    assert "quiz_ace" in unlocked_ids


@pytest.mark.asyncio
async def test_analytics_heatmap(analytics_mock_env):
    service: AnalyticsService = analytics_mock_env["service"]
    user_id: uuid.UUID = analytics_mock_env["user_id"]

    now = datetime.now(UTC)
    # Generate 180 days with simulated activity on 5 of them
    days_count = 180
    start_date = (now.date() - timedelta(days=days_count - 1))

    # Mock daily activity generator
    from app.schemas.analytics import DailyActivityItem
    mock_matrix = []
    for i in range(days_count):
        d_str = (start_date + timedelta(days=i)).isoformat()
        mins = 60 if i % 10 == 0 else 0
        level = 3 if mins > 0 else 0
        mock_matrix.append(
            DailyActivityItem(
                date=d_str,
                focus_minutes=mins,
                sessions_count=1 if mins > 0 else 0,
                tasks_completed=0,
                quizzes_taken=0,
                level=level,
            )
        )

    service._generate_daily_activity = AsyncMock(return_value=mock_matrix)
    service._calculate_current_streak = AsyncMock(return_value=2)
    service._calculate_longest_streak = AsyncMock(return_value=7)

    heatmap = await service.get_heatmap(user_id=user_id, days=180)

    assert heatmap.total_days == 180
    assert heatmap.total_active_days == 18  # 180 / 10
    assert heatmap.total_focus_minutes == 18 * 60
    assert heatmap.current_streak_days == 2
    assert heatmap.longest_streak_days == 7
    assert len(heatmap.matrix) == 180

