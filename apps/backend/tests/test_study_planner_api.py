import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_study_planner_service
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.study_plan import StudyBlockItem, StudyPlanResponse


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="plannerstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Planner Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_planner_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_planner_service: AsyncMock,
):
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[get_study_planner_service] = lambda: mock_planner_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


def sample_plan_response(user_id: uuid.UUID) -> StudyPlanResponse:
    plan_id = uuid.uuid4()
    return StudyPlanResponse(
        id=plan_id,
        user_id=user_id,
        plan_date=date.today(),
        target_study_minutes=180,
        planned_minutes=120,
        completed_minutes=45,
        completion_percentage=37.5,
        timeblocks=[
            StudyBlockItem(
                id="blk-1",
                subject_name="Mathematics",
                title="Calculus Integration",
                block_type="task_work",
                start_time="17:00",
                end_time="17:45",
                duration_minutes=45,
                priority="high",
                is_completed=True,
            ),
            StudyBlockItem(
                id="blk-2",
                subject_name="Physics",
                title="Thermodynamics Revision",
                block_type="exam_revision",
                start_time="18:00",
                end_time="18:45",
                duration_minutes=45,
                priority="urgent",
                is_completed=False,
            ),
        ],
        ai_summary="Great momentum today! Tackle Thermodynamics next.",
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_get_today_plan_exists(authed_client: AsyncClient, test_user: User, mock_planner_service: AsyncMock):
    plan = sample_plan_response(test_user.id)
    mock_planner_service.get_plan_by_date.return_value = plan

    resp = await authed_client.get("/api/v1/study-planner/today")
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_study_minutes"] == 180
    assert len(data["timeblocks"]) == 2
    assert data["completion_percentage"] == 37.5


@pytest.mark.asyncio
async def test_get_today_plan_empty(authed_client: AsyncClient, mock_planner_service: AsyncMock):
    mock_planner_service.get_plan_by_date.return_value = None

    resp = await authed_client.get("/api/v1/study-planner/today")
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_generate_plan_endpoint(authed_client: AsyncClient, test_user: User, mock_planner_service: AsyncMock):
    plan = sample_plan_response(test_user.id)
    mock_planner_service.generate_daily_plan.return_value = plan

    payload = {"target_study_minutes": 180}
    resp = await authed_client.post("/api/v1/study-planner/generate", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["target_study_minutes"] == 180
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_toggle_block_endpoint(authed_client: AsyncClient, test_user: User, mock_planner_service: AsyncMock):
    plan = sample_plan_response(test_user.id)
    mock_planner_service.toggle_block_completion.return_value = plan

    plan_id = plan.id
    resp = await authed_client.patch(
        f"/api/v1/study-planner/{plan_id}/blocks/blk-1/toggle",
        json={"is_completed": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(plan_id)


@pytest.mark.asyncio
async def test_rebalance_plan_endpoint(authed_client: AsyncClient, test_user: User, mock_planner_service: AsyncMock):
    plan = sample_plan_response(test_user.id)
    mock_planner_service.rebalance_plan.return_value = plan

    plan_id = plan.id
    resp = await authed_client.post(
        f"/api/v1/study-planner/{plan_id}/rebalance",
        json={"remaining_available_minutes": 90},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(plan_id)


@pytest.mark.asyncio
async def test_delete_plan_endpoint(authed_client: AsyncClient, mock_planner_service: AsyncMock):
    mock_planner_service.delete_plan.return_value = True

    plan_id = uuid.uuid4()
    resp = await authed_client.delete(f"/api/v1/study-planner/{plan_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_idor_cross_tenant_access_prevented(authed_client: AsyncClient, mock_planner_service: AsyncMock):
    # If student attempts to access a plan belonging to another student, service returns None
    mock_planner_service.get_plan_by_id.return_value = None

    foreign_plan_id = uuid.uuid4()
    resp = await authed_client.get(f"/api/v1/study-planner/{foreign_plan_id}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Study plan not found"

