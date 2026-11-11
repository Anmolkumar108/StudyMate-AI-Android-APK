from app.db.base import Base
from app.models.ai_chat import AIChatMessage, AIChatSession
from app.models.announcement import (
    Announcement,
    AnnouncementSeverity,
    AnnouncementTarget,
)
from app.models.audit_log import AuditLog
from app.models.document import DocStatus, Document
from app.models.exam import Exam
from app.models.flashcard import Flashcard, FlashcardDeck
from app.models.note import Note
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.session import UserSession
from app.models.study_plan import StudyPlan
from app.models.study_session import PomodoroSession, StudySession
from app.models.subject import Subject
from app.models.subject_template import SubjectTemplate
from app.models.task import Task, TaskPriority, TaskStatus, TaskTemplate
from app.models.timetable import AttendanceRecord, TimetableEntry
from app.models.user import User, UserRole, UserStatus
from app.models.verification_token import TokenType, VerificationToken
from app.models.support_ticket import SupportTicket, TicketCategory, TicketPriority, TicketStatus
from app.models.app_config import AppConfig

__all__ = [
    "AIChatMessage",
    "AIChatSession",
    "Announcement",
    "AnnouncementSeverity",
    "AnnouncementTarget",
    "AppConfig",
    "AttendanceRecord",
    "AuditLog",
    "Base",
    "DocStatus",
    "Document",
    "Exam",
    "Flashcard",
    "FlashcardDeck",
    "Note",
    "PomodoroSession",
    "Quiz",
    "QuizAttempt",
    "QuizQuestion",
    "StudyPlan",
    "StudySession",
    "Subject",
    "SubjectTemplate",
    "SupportTicket",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "TaskTemplate",
    "TicketCategory",
    "TicketPriority",
    "TicketStatus",
    "TimetableEntry",
    "TokenType",
    "User",
    "UserRole",
    "UserSession",
    "UserStatus",
    "VerificationToken",
]
