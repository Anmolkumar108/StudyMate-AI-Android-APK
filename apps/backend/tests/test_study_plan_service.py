import uuid
from datetime import UTC, date, datetime, time, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.exam import Exam
from app.models.study_plan import StudyPlan
from app.models.subject import Subject
from app.models.task import Task
from app.models.timetable import TimetableEntry
from app.services.study_plan_service import StudyPlannerService


@pytest.fixture
def mock_repos():
    session = AsyncMock()
    study_plan_repo = AsyncMock()
    task_repo = AsyncMock()
    exam_repo = AsyncMock()
    timetable_repo = AsyncMock()
    subject_repo = AsyncMock()
    ai_service = AsyncMock()
    ai_service._is_mock_key = MagicMock(return_value=True)

    service = StudyPlannerService(
        session=session,
        study_plan_repo=study_plan_repo,
        task_repo=task_repo,
        exam_repo=exam_repo,
        timetable_repo=timetable_repo,
        subject_repo=subject_repo,
        ai_service=ai_service,
    )
    return {
        "service": service,
        "study_plan_repo": study_plan_repo,
        "task_repo": task_repo,
        "exam_repo": exam_repo,
        "timetable_repo": timetable_repo,
        "subject_repo": subject_repo,
        "ai_service": ai_service,
    }


@pytest.mark.asyncio
async def test_generate_balanced_plan(mock_repos):
    service: StudyPlannerService = mock_repos["service"]
    study_plan_repo = mock_repos["study_plan_repo"]
    task_repo = mock_repos["task_repo"]
    exam_repo = mock_repos["exam_repo"]
    timetable_repo = mock_repos["timetable_repo"]
    subject_repo = mock_repos["subject_repo"]

    user_id = uuid.uuid4()
    sub_id = uuid.uuid4()
    mock_subject = Subject(id=sub_id, user_id=user_id, name="Algorithms", code="CS301", color="#6366F1")
    subject_repo.list_by_user.return_value = [mock_subject]

    # Task due soon
    mock_task = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=sub_id,
        title="Implement Dijkstra",
        status="todo",
        priority="urgent",
        due_datetime=datetime.now(UTC) + timedelta(days=1),
    )
    task_repo.list_by_user.return_value = [mock_task]

    # Exam in 3 days
    mock_exam = Exam(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=sub_id,
        title="Midterm Algorithms",
        exam_date=datetime.now(UTC) + timedelta(days=3),
    )
    mock_exam.subject = mock_subject
    exam_repo.list_by_user.return_value = [mock_exam]

    # No classes today
    timetable_repo.list_by_user.return_value = []
    study_plan_repo.get_by_date.return_value = None

    # Mock plan create
    created_plan = StudyPlan(
        id=uuid.uuid4(),
        user_id=user_id,
        plan_date=date.today(),
        target_study_minutes=180,
        planned_minutes=105,
        completed_minutes=0,
        timeblocks=[],
        ai_summary="Focused exam prep",
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    def side_effect_create(plan):
        plan.id = created_plan.id
        plan.created_at = created_plan.created_at
        plan.updated_at = created_plan.updated_at
        return plan

    study_plan_repo.create.side_effect = side_effect_create

    res = await service.generate_daily_plan(user_id=user_id, target_study_minutes=180)

    assert res.target_study_minutes == 180
    assert len(res.timeblocks) >= 2
    assert any(b.block_type == "exam_revision" for b in res.timeblocks)
    assert any(b.block_type == "task_work" for b in res.timeblocks)
    assert res.status == "active"


@pytest.mark.asyncio
async def test_timetable_collision_avoidance(mock_repos):
    service: StudyPlannerService = mock_repos["service"]
    study_plan_repo = mock_repos["study_plan_repo"]
    task_repo = mock_repos["task_repo"]
    exam_repo = mock_repos["exam_repo"]
    timetable_repo = mock_repos["timetable_repo"]
    subject_repo = mock_repos["subject_repo"]

    user_id = uuid.uuid4()
    sub_id = uuid.uuid4()
    mock_subject = Subject(id=sub_id, user_id=user_id, name="Physics", code="PHY101", color="#10B981")
    subject_repo.list_by_user.return_value = [mock_subject]
    task_repo.list_by_user.return_value = []
    exam_repo.list_by_user.return_value = []

    # University class from 14:00 to 16:30
    mock_class = TimetableEntry(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=sub_id,
        day_of_week=date.today().isoweekday(),
        start_time=time(14, 0),
        end_time=time(16, 30),
    )
    timetable_repo.list_by_user.return_value = [mock_class]
    study_plan_repo.get_by_date.return_value = None

    def side_effect_create(plan):
        plan.id = uuid.uuid4()
        plan.created_at = datetime.now(UTC)
        plan.updated_at = datetime.now(UTC)
        return plan

    study_plan_repo.create.side_effect = side_effect_create

    res = await service.generate_daily_plan(user_id=user_id, target_study_minutes=60)
    assert len(res.timeblocks) > 0

    first_study_block = res.timeblocks[0]
    st_hour = int(first_study_block.start_time.split(":")[0])
    # Must start after 16:30 + 15 min buffer => at or after 16:45
    assert st_hour >= 16


@pytest.mark.asyncio
async def test_toggle_block_completion(mock_repos):
    service: StudyPlannerService = mock_repos["service"]
    study_plan_repo = mock_repos["study_plan_repo"]

    user_id = uuid.uuid4()
    plan_id = uuid.uuid4()

    existing_plan = StudyPlan(
        id=plan_id,
        user_id=user_id,
        plan_date=date.today(),
        target_study_minutes=90,
        planned_minutes=90,
        completed_minutes=0,
        timeblocks=[
            {
                "id": "blk-1",
                "title": "Study Block 1",
                "block_type": "task_work",
                "duration_minutes": 45,
                "is_completed": False,
                "completed_at": None,
            },
            {
                "id": "blk-2",
                "title": "Study Block 2",
                "block_type": "task_work",
                "duration_minutes": 45,
                "is_completed": False,
                "completed_at": None,
            },
        ],
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    study_plan_repo.get_by_id.return_value = existing_plan
    study_plan_repo.update.side_effect = lambda p: p

    # Complete block 1
    res1 = await service.toggle_block_completion(user_id, plan_id, "blk-1", True)
    assert res1.completed_minutes == 45
    assert res1.status == "active"
    assert res1.timeblocks[0].is_completed is True

    # Complete block 2 => all done
    res2 = await service.toggle_block_completion(user_id, plan_id, "blk-2", True)
    assert res2.completed_minutes == 90
    assert res2.status == "completed"


@pytest.mark.asyncio
async def test_rebalance_plan(mock_repos):
    service: StudyPlannerService = mock_repos["service"]
    study_plan_repo = mock_repos["study_plan_repo"]

    user_id = uuid.uuid4()
    plan_id = uuid.uuid4()

    existing_plan = StudyPlan(
        id=plan_id,
        user_id=user_id,
        plan_date=date.today(),
        target_study_minutes=120,
        planned_minutes=120,
        completed_minutes=45,
        timeblocks=[
            {
                "id": "blk-1",
                "title": "Block Done",
                "block_type": "task_work",
                "duration_minutes": 45,
                "start_time": "15:00",
                "end_time": "15:45",
                "is_completed": True,
                "completed_at": datetime.now(UTC).isoformat(),
            },
            {
                "id": "blk-2",
                "title": "Block Missed",
                "block_type": "task_work",
                "duration_minutes": 45,
                "start_time": "16:00",
                "end_time": "16:45",
                "is_completed": False,
                "completed_at": None,
            },
        ],
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    study_plan_repo.get_by_id.return_value = existing_plan
    study_plan_repo.update.side_effect = lambda p: p

    rebalanced = await service.rebalance_plan(user_id, plan_id, remaining_available_minutes=60)
    assert rebalanced is not None
    assert len(rebalanced.timeblocks) == 2
    assert rebalanced.timeblocks[0].is_completed is True
    assert "rebalanced" in rebalanced.ai_summary.lower()


@pytest.mark.asyncio
async def test_generate_with_focus_subjects_and_pace(mock_repos):
    service: StudyPlannerService = mock_repos["service"]
    study_plan_repo = mock_repos["study_plan_repo"]
    task_repo = mock_repos["task_repo"]
    exam_repo = mock_repos["exam_repo"]
    timetable_repo = mock_repos["timetable_repo"]
    subject_repo = mock_repos["subject_repo"]

    user_id = uuid.uuid4()
    sub_math = Subject(id=uuid.uuid4(), user_id=user_id, name="Mathematics", code="MATH101", color="#38BDF8")
    sub_cs = Subject(id=uuid.uuid4(), user_id=user_id, name="Computer Science", code="CS101", color="#10B981")
    subject_repo.list_by_user.return_value = [sub_math, sub_cs]

    task_math = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=sub_math.id,
        title="Calculus Problem Set",
        status="todo",
        priority="high",
        due_datetime=datetime.now(UTC) + timedelta(days=2),
    )
    task_cs = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        subject_id=sub_cs.id,
        title="Python Project",
        status="todo",
        priority="high",
        due_datetime=datetime.now(UTC) + timedelta(days=2),
    )
    task_repo.list_by_user.return_value = [task_math, task_cs]
    exam_repo.list_by_user.return_value = []
    timetable_repo.list_by_user.return_value = []
    study_plan_repo.get_by_date.return_value = None

    def side_effect_create(plan):
        plan.id = uuid.uuid4()
        plan.created_at = datetime.now(UTC)
        plan.updated_at = datetime.now(UTC)
        return plan

    study_plan_repo.create.side_effect = side_effect_create

    # Generate strictly focusing on Math with Pomodoro pace (25m blocks)
    res = await service.generate_daily_plan(
        user_id=user_id,
        target_study_minutes=60,
        focus_subject_ids=[sub_math.id],
        pace_mode="pomodoro",
        start_hour=18,
        include_breaks=False,
    )

    assert res.target_study_minutes == 60
    assert len(res.timeblocks) >= 1
    # Check that Math was prioritized
    first_block = res.timeblocks[0]
    assert first_block.subject_id == sub_math.id
    assert first_block.duration_minutes == 25
    assert first_block.start_time.startswith("18:")
    assert not any(b.block_type == "break" for b in res.timeblocks)

