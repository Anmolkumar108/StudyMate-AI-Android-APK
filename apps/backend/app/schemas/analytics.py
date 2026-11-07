from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StudySessionCreateRequest(BaseModel):
    duration_minutes: int = Field(default=25, ge=1, le=180, description="Planned duration in minutes")
    actual_seconds_spent: int = Field(default=1500, ge=0, description="Actual seconds spent focusing")
    session_type: str = Field(default="focus", description="Type of session: focus, short_break, long_break")
    subject_id: UUID | None = Field(default=None, description="Optional associated subject ID")
    task_id: UUID | None = Field(default=None, description="Optional associated task ID")
    completed_successfully: bool = Field(default=True, description="Whether session finished cleanly")
    rating_focus: int | None = Field(default=None, ge=1, le=5, description="Self-reported focus rating 1-5")
    notes: str | None = Field(default=None, max_length=500, description="Optional reflection notes")
    started_at: datetime = Field(description="ISO timestamp when session began")
    ended_at: datetime = Field(description="ISO timestamp when session concluded")


class StudySessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    subject_id: UUID | None = None
    task_id: UUID | None = None
    duration_minutes: int
    actual_seconds_spent: int
    session_type: str
    completed_successfully: bool
    rating_focus: int | None = None
    notes: str | None = None
    started_at: datetime
    ended_at: datetime
    created_at: datetime
    subject_name: str | None = None
    subject_color: str | None = None
    task_title: str | None = None


class TodayStudySummary(BaseModel):
    total_focus_minutes: int = 0
    total_focus_sessions: int = 0
    daily_goal_minutes: int = 60
    goal_progress_percent: float = 0.0
    current_streak_days: int = 0


class SubjectTimeDistributionItem(BaseModel):
    subject_id: UUID | None = None
    subject_name: str
    subject_code: str | None = None
    color_hex: str = "#06B6D4"
    total_minutes: int
    total_hours: float
    percentage: float
    session_count: int


class DailyActivityItem(BaseModel):
    date: str  # YYYY-MM-DD
    focus_minutes: int = 0
    sessions_count: int = 0
    tasks_completed: int = 0
    quizzes_taken: int = 0
    level: int = 0  # 0 to 4 intensity scale


class MilestoneBadge(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    unlocked: bool
    progress_text: str


class QuizMasteryItem(BaseModel):
    date: str
    quiz_title: str
    score_percentage: float
    total_questions: int


class AnalyticsOverviewResponse(BaseModel):
    total_focus_hours: float
    total_sessions: int
    current_streak_days: int
    longest_streak_days: int
    tasks_completed_count: int
    quizzes_taken_count: int
    average_quiz_score: float
    flashcards_reviewed_count: int
    productivity_score: int
    subject_distribution: list[SubjectTimeDistributionItem]
    weekly_trends: list[DailyActivityItem]
    quiz_mastery_curve: list[QuizMasteryItem]
    milestones: list[MilestoneBadge]


class AnalyticsHeatmapResponse(BaseModel):
    start_date: str
    end_date: str
    total_days: int
    total_active_days: int
    total_focus_minutes: int
    current_streak_days: int
    longest_streak_days: int
    matrix: list[DailyActivityItem]

