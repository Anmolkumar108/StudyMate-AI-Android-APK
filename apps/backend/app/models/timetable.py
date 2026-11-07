import uuid
from datetime import UTC, date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.subject import Subject
    from app.models.user import User


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )
    day_of_week: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )  # 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )
    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )
    room: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    building: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    professor: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    color: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    is_online: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
    )
    virtual_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    reminder_minutes_before: Mapped[int] = mapped_column(
        SmallInteger,
        default=15,
        server_default=text("15"),
        nullable=False,
    )
    start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="timetable_entries")
    subject: Mapped["Subject"] = relationship("Subject", backref="timetable_entries", lazy="joined")

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_timetable_day_of_week"),
        CheckConstraint("end_time > start_time", name="chk_timetable_time_window"),
        Index("idx_timetable_user_day", "user_id", "day_of_week"),
        Index("idx_timetable_subject", "subject_id"),
    )


class AttendanceRecord(Base):
    __tablename__ = "timetable_attendance"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    timetable_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("timetable_entries.id", ondelete="CASCADE"),
        nullable=True,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )
    attendance_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="present",
        server_default=text("'present'"),
        nullable=False,
    )  # 'present', 'absent', 'late'
    notes: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="attendance_records")
    subject: Mapped["Subject"] = relationship("Subject", backref="attendance_records", lazy="joined")
    timetable_entry: Mapped["TimetableEntry | None"] = relationship(
        "TimetableEntry", backref="attendance_records", lazy="joined"
    )

    __table_args__ = (
        CheckConstraint("status IN ('present', 'absent', 'late')", name="chk_attendance_status"),
        UniqueConstraint("user_id", "timetable_entry_id", "attendance_date", name="uq_attendance_user_entry_date"),
        Index("idx_attendance_user_date", "user_id", "attendance_date"),
        Index("idx_attendance_user_subject", "user_id", "subject_id"),
        Index("idx_attendance_entry_date", "timetable_entry_id", "attendance_date"),
    )

