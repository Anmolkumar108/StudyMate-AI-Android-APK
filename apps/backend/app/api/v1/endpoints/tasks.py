import base64
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)

from app.api.deps import get_current_active_user, get_task_service
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.task import (
    CreateTaskFromTemplateRequest,
    TaskAnalyticsResponse,
    TaskAttachmentBase64UploadRequest,
    TaskBreakdownRequest,
    TaskBreakdownResponse,
    TaskCreate,
    TaskDailyBriefingResponse,
    TaskListResponse,
    TaskLogFocusRequest,
    TaskParseNaturalRequest,
    TaskParseNaturalResponse,
    TaskResponse,
    TaskScheduleSuggestionRequest,
    TaskScheduleSuggestionResponse,
    TaskTemplateCreate,
    TaskTemplateResponse,
    TaskUpdate,
)
from app.services.task_service import (
    CircularDependencyError,
    DependencyPrerequisiteError,
    InvalidAttachmentError,
    InvalidTaskSubjectError,
    TaskError,
    TaskNotFoundError,
    TaskService,
    TemplateNotFoundError,
)

router = APIRouter()


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task or assignment",
    description="Creates a new task for the authenticated student. Optional subject_id and depends_on_task_id must belong to the user.",
)
async def create_task(
    payload: TaskCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.create_task(current_user.id, payload)
        return TaskResponse.model_validate(task)
    except (InvalidTaskSubjectError, CircularDependencyError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.get(
    "",
    response_model=TaskListResponse,
    status_code=status.HTTP_200_OK,
    summary="List and filter tasks",
    description="Returns tasks belonging to the authenticated student, with optional status, priority, and subject filters.",
)
async def list_tasks(
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
    status_filter: Annotated[
        TaskStatus | None,
        Query(alias="status", description="Filter by status (todo, in_progress, completed, cancelled)"),
    ] = None,
    priority: Annotated[
        TaskPriority | None,
        Query(description="Filter by urgency level (low, medium, high, urgent)"),
    ] = None,
    subject_id: Annotated[
        UUID | None,
        Query(description="Filter by associated subject UUID"),
    ] = None,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=100, description="Search keyword in title or description"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum items to return")] = 50,
    offset: Annotated[int, Query(ge=0, description="Items to skip")] = 0,
) -> TaskListResponse:
    tasks, total, stats = await task_service.list_tasks(
        user_id=current_user.id,
        status=status_filter,
        priority=priority,
        subject_id=subject_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        completed_count=stats["completed"],
        pending_count=stats["pending"],
        overdue_count=stats["overdue"],
    )


# Analytics Endpoint
@router.get(
    "/analytics",
    response_model=TaskAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get task analytics and metrics",
    description="Computes completion rate, overdue tasks, focus duration, weekly trends, and subject workloads.",
)
async def get_task_analytics(
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskAnalyticsResponse:
    data = await task_service.get_analytics(current_user.id)
    return TaskAnalyticsResponse.model_validate(data)


# Template Endpoints
@router.get(
    "/templates",
    response_model=list[TaskTemplateResponse],
    status_code=status.HTTP_200_OK,
    summary="List available task templates",
    description="Returns both system default templates and user-created custom templates.",
)
async def list_task_templates(
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> list[TaskTemplateResponse]:
    templates = await task_service.list_templates(current_user.id)
    return [TaskTemplateResponse.model_validate(t) for t in templates]


@router.post(
    "/templates",
    response_model=TaskTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom task template",
    description="Saves a custom reusable template for assignments, revision plans, or lab work.",
)
async def create_task_template(
    payload: TaskTemplateCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskTemplateResponse:
    tmpl = await task_service.create_template(current_user.id, payload)
    return TaskTemplateResponse.model_validate(tmpl)


@router.post(
    "/from-template",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create task from template",
    description="Instantiates a new active task from a chosen template with fresh subtasks.",
)
async def create_task_from_template(
    payload: CreateTaskFromTemplateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.create_task_from_template(current_user.id, payload)
        return TaskResponse.model_validate(task)
    except TemplateNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user task template",
    description="Deletes a custom template created by the student. Built-in templates cannot be deleted.",
)
async def delete_task_template(
    template_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> None:
    try:
        await task_service.delete_template(template_id, current_user.id)
    except TemplateNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except TaskError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


# AI Task Assistance Endpoints
@router.post(
    "/ai/breakdown",
    response_model=TaskBreakdownResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Task Breakdown into Subtasks",
    description="Breaks a large assignment or study goal into sequential, actionable subtasks.",
)
async def ai_breakdown_task(
    payload: TaskBreakdownRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskBreakdownResponse:
    subtasks = await task_service.breakdown_task(
        title=payload.title,
        description=payload.description,
        estimated_minutes=payload.estimated_minutes,
    )
    return TaskBreakdownResponse(subtasks=subtasks)


@router.post(
    "/ai/suggest-schedule",
    response_model=TaskScheduleSuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Study Schedule Optimization",
    description="Analyzes pending tasks and deadlines to generate an optimized daily study schedule.",
)
async def ai_suggest_schedule(
    payload: TaskScheduleSuggestionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskScheduleSuggestionResponse:
    res = await task_service.suggest_schedule(
        user_id=current_user.id,
        available_hours_per_day=payload.available_hours_per_day,
    )
    return TaskScheduleSuggestionResponse.model_validate(res)


@router.post(
    "/ai/parse-natural",
    response_model=TaskParseNaturalResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Natural Language Task Parser",
    description="Extracts structured fields (title, priority, due date, subtasks) from natural student instructions.",
)
async def ai_parse_natural_task(
    payload: TaskParseNaturalRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskParseNaturalResponse:
    res = await task_service.parse_natural_task(payload.prompt)
    return TaskParseNaturalResponse.model_validate(res)


@router.get(
    "/ai/daily-briefing",
    response_model=TaskDailyBriefingResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Daily Study Briefing",
    description="Generates a focused morning overview with urgent deadlines and recommended order.",
)
async def ai_daily_briefing(
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskDailyBriefingResponse:
    res = await task_service.get_daily_briefing(current_user.id)
    return TaskDailyBriefingResponse.model_validate(res)


# Individual Task Operations
@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Get task by ID",
    description="Retrieves a specific task. Enforces that the task belongs to the authenticated user.",
)
async def get_task(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.get_task(task_id, current_user.id)
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Update task details or status",
    description="Updates task fields. Automatically manages completed_at and spawns recurring tasks.",
)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.update_task(task_id, current_user.id, payload)
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except (InvalidTaskSubjectError, CircularDependencyError, DependencyPrerequisiteError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
    description="Permanently deletes a task belonging to the authenticated student.",
)
async def delete_task(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> None:
    try:
        await task_service.delete_task(task_id, current_user.id)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


# Focus Mode Integration
@router.post(
    "/{task_id}/log-focus",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Log Pomodoro focus time to task",
    description="Records completed focus session minutes and count to the task.",
)
async def log_focus_to_task(
    task_id: UUID,
    payload: TaskLogFocusRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.log_focus(
            task_id=task_id,
            user_id=current_user.id,
            minutes=payload.minutes,
            session_count=payload.session_count,
        )
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


# Attachments
@router.post(
    "/{task_id}/attachments",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload PDF or image attachment",
    description="Attaches a PDF or image (max 25MB) to the task.",
)
async def upload_task_attachment(
    task_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        file_bytes = await file.read()
        task = await task_service.add_attachment(
            task_id=task_id,
            user_id=current_user.id,
            filename=file.filename or "attachment.pdf",
            content_type=file.content_type or "application/octet-stream",
            file_bytes=file_bytes,
        )
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except InvalidAttachmentError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post(
    "/{task_id}/attachments-base64",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload PDF or image attachment as Base64 JSON (zero native FormData friction)",
)
async def upload_task_attachment_base64(
    task_id: UUID,
    payload: TaskAttachmentBase64UploadRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        file_bytes = base64.b64decode(payload.file_base64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 payload",
        ) from exc

    try:
        task = await task_service.add_attachment(
            task_id=task_id,
            user_id=current_user.id,
            filename=payload.filename,
            content_type=payload.file_type,
            file_bytes=file_bytes,
        )
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except InvalidAttachmentError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get(
    "/{task_id}/attachments/{attachment_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download task attachment",
    description="Streams authenticated attachment content bytes.",
)
async def download_task_attachment(
    task_id: UUID,
    attachment_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> Response:
    try:
        data, filename, content_type = await task_service.get_attachment_data(
            task_id=task_id,
            user_id=current_user.id,
            attachment_id=attachment_id,
        )
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except (TaskNotFoundError, InvalidAttachmentError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete task attachment",
    description="Removes attachment metadata and deletes the stored file.",
)
async def delete_task_attachment(
    task_id: UUID,
    attachment_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskResponse:
    try:
        task = await task_service.delete_attachment(
            task_id=task_id,
            user_id=current_user.id,
            attachment_id=attachment_id,
        )
        return TaskResponse.model_validate(task)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except InvalidAttachmentError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
