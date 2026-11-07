import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, time
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_db, get_timetable_service
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.schemas.timetable import (
    AttendanceRecordResponse,
    AttendanceSummaryResponse,
    SubjectAttendanceStats,
    TimetableConflictResponse,
    TimetableEntryResponse,
    WeeklyTimetableResponse,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="timetablestudent@test.com",
        hashed_password="argon2id$test",
        full_name="Timetable Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_timetable_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_db() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_timetable_service: AsyncMock,
    mock_db: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_timetable_service] = lambda: mock_timetable_service
    app.dependency_overrides[get_db] = lambda: mock_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def unauthed_client() -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def sample_entry_response(test_user: User) -> TimetableEntryResponse:
    return TimetableEntryResponse(
        id=uuid.uuid4(),
        user_id=test_user.id,
        subject_id=uuid.uuid4(),
        day_of_week=1,  # Monday
        start_time=time(9, 30),
        end_time=time(11, 0),
        room="Hall B-201",
        building="Science Block",
        professor="Dr. Alan Turing",
        color="#3B82F6",
        is_online=False,
        virtual_url=None,
        reminder_minutes_before=15,
        subject_name="Data Structures & Algorithms",
        subject_color="#3B82F6",
        subject_code="CS201",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_list_timetable_entries(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    mock_timetable_service.list_entries.return_value = [sample_entry_response]

    res = await authed_client.get("/api/v1/timetable")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["subject_name"] == "Data Structures & Algorithms"
    assert data[0]["room"] == "Hall B-201"
    assert data[0]["professor"] == "Dr. Alan Turing"


@pytest.mark.asyncio
async def test_get_weekly_schedule(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    by_day = {i: [] for i in range(1, 8)}
    by_day[1] = [sample_entry_response]
    mock_timetable_service.get_weekly_schedule.return_value = WeeklyTimetableResponse(
        entries=[sample_entry_response],
        by_day=by_day,
        total_classes=1,
    )

    res = await authed_client.get("/api/v1/timetable/weekly")
    assert res.status_code == 200
    data = res.json()
    assert data["total_classes"] == 1
    assert len(data["by_day"]["1"]) == 1
    assert data["by_day"]["1"][0]["professor"] == "Dr. Alan Turing"


@pytest.mark.asyncio
async def test_get_today_schedule(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    mock_timetable_service.get_today_schedule.return_value = [sample_entry_response]

    res = await authed_client.get("/api/v1/timetable/today")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["subject_code"] == "CS201"


@pytest.mark.asyncio
async def test_create_timetable_entry_success(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    mock_timetable_service.create_entry.return_value = sample_entry_response

    payload = {
        "day_of_week": 1,
        "start_time": "09:30:00",
        "end_time": "11:00:00",
        "subject_id": str(sample_entry_response.subject_id),
        "room": "Hall B-201",
        "building": "Science Block",
        "professor": "Dr. Alan Turing",
        "color": "#3B82F6",
        "is_online": False,
        "reminder_minutes_before": 15,
    }

    res = await authed_client.post("/api/v1/timetable", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == str(sample_entry_response.id)
    assert data["professor"] == "Dr. Alan Turing"


@pytest.mark.asyncio
async def test_create_timetable_entry_invalid_times(
    authed_client: AsyncClient,
) -> None:
    # end_time before start_time must be rejected by Pydantic schema validation
    payload = {
        "day_of_week": 1,
        "start_time": "11:00:00",
        "end_time": "09:00:00",
        "subject_id": str(uuid.uuid4()),
        "room": "Room 101",
    }
    res = await authed_client.post("/api/v1/timetable", json=payload)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_timetable_entry_invalid_day(
    authed_client: AsyncClient,
) -> None:
    # day_of_week must be between 1 and 7
    payload = {
        "day_of_week": 8,
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "subject_id": str(uuid.uuid4()),
    }
    res = await authed_client.post("/api/v1/timetable", json=payload)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_check_conflict(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    mock_timetable_service.check_conflicts.return_value = TimetableConflictResponse(
        has_conflict=True,
        conflicting_entries=[sample_entry_response],
    )

    payload = {
        "day_of_week": 1,
        "start_time": "10:00:00",
        "end_time": "11:30:00",
    }
    res = await authed_client.post("/api/v1/timetable/check-conflict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["has_conflict"] is True
    assert len(data["conflicting_entries"]) == 1


@pytest.mark.asyncio
async def test_get_timetable_entry_by_id(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    mock_timetable_service.get_entry_by_id.return_value = sample_entry_response

    res = await authed_client.get(f"/api/v1/timetable/{sample_entry_response.id}")
    assert res.status_code == 200
    assert res.json()["id"] == str(sample_entry_response.id)


@pytest.mark.asyncio
async def test_update_timetable_entry(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    updated = sample_entry_response.model_copy(update={"room": "Hall C-303"})
    mock_timetable_service.update_entry.return_value = updated

    res = await authed_client.patch(
        f"/api/v1/timetable/{sample_entry_response.id}",
        json={"room": "Hall C-303"},
    )
    assert res.status_code == 200
    assert res.json()["room"] == "Hall C-303"


@pytest.mark.asyncio
async def test_delete_timetable_entry(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
) -> None:
    mock_timetable_service.delete_entry.return_value = None

    entry_id = uuid.uuid4()
    res = await authed_client.delete(f"/api/v1/timetable/{entry_id}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_unauthenticated_request(
    unauthed_client: AsyncClient,
) -> None:
    res = await unauthed_client.get("/api/v1/timetable")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_batch_create_timetable_entries(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    e1 = sample_entry_response.model_copy(update={"day_of_week": 1})
    e2 = sample_entry_response.model_copy(update={"day_of_week": 3})
    mock_timetable_service.batch_create_entries.return_value = [e1, e2]

    payload = {
        "days_of_week": [1, 3],
        "subject_id": str(sample_entry_response.subject_id),
        "start_time": "09:30:00",
        "end_time": "11:00:00",
        "room": "Lab 101",
    }
    res = await authed_client.post("/api/v1/timetable/batch", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_mark_attendance(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    test_user: User,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    att_resp = AttendanceRecordResponse(
        id=uuid.uuid4(),
        user_id=test_user.id,
        timetable_entry_id=sample_entry_response.id,
        subject_id=sample_entry_response.subject_id,
        attendance_date=datetime.now(UTC).date(),
        status="present",
        notes="On time",
        subject_name="Data Structures",
        subject_color="#3B82F6",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_timetable_service.mark_attendance.return_value = att_resp

    payload = {
        "timetable_entry_id": str(sample_entry_response.id),
        "subject_id": str(sample_entry_response.subject_id),
        "attendance_date": str(datetime.now(UTC).date()),
        "status": "present",
        "notes": "On time",
    }
    res = await authed_client.post("/api/v1/timetable/attendance", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "present"


@pytest.mark.asyncio
async def test_list_attendance(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    test_user: User,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    att_resp = AttendanceRecordResponse(
        id=uuid.uuid4(),
        user_id=test_user.id,
        timetable_entry_id=sample_entry_response.id,
        subject_id=sample_entry_response.subject_id,
        attendance_date=datetime.now(UTC).date(),
        status="present",
        notes=None,
        subject_name="Data Structures",
        subject_color="#3B82F6",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_timetable_service.list_attendance.return_value = [att_resp]

    res = await authed_client.get("/api/v1/timetable/attendance")
    assert res.status_code == 200
    assert len(res.json()) == 1


@pytest.mark.asyncio
async def test_get_attendance_summary(
    authed_client: AsyncClient,
    mock_timetable_service: AsyncMock,
    sample_entry_response: TimetableEntryResponse,
) -> None:
    summary = AttendanceSummaryResponse(
        total_classes=10,
        present_count=8,
        absent_count=2,
        late_count=0,
        overall_percentage=80.0,
        minimum_required_percentage=75.0,
        is_overall_low=False,
        subjects=[
            SubjectAttendanceStats(
                subject_id=sample_entry_response.subject_id,
                subject_name="Data Structures",
                subject_color="#3B82F6",
                total_classes=10,
                present_count=8,
                absent_count=2,
                late_count=0,
                percentage=80.0,
                is_low_attendance=False,
            )
        ],
    )
    mock_timetable_service.get_attendance_summary.return_value = summary

    res = await authed_client.get("/api/v1/timetable/attendance/summary")
    assert res.status_code == 200
    assert res.json()["overall_percentage"] == 80.0
    assert res.json()["is_overall_low"] is False

