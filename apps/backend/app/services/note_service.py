from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.repositories.note_repo import NoteRepository
from app.repositories.subject_repo import SubjectRepository
from app.schemas.note import NoteCreate, NoteUpdate


class NoteError(Exception):
    """Base domain exception for note operations."""


class NoteNotFoundError(NoteError):
    """Raised when a note is not found or does not belong to the user."""


class InvalidNoteSubjectError(NoteError):
    """Raised when an associated subject does not exist or does not belong to the user."""


class NoteService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.note_repo = NoteRepository(session)
        self.subject_repo = SubjectRepository(session)

    async def list_notes(
        self,
        user_id: UUID,
        search: str | None = None,
        subject_id: UUID | None = None,
        is_pinned: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Note]:
        """List notes owned by the user with optional filters, search, and pagination."""
        if subject_id is not None:
            subject = await self.subject_repo.get_by_id_and_user(subject_id, user_id)
            if subject is None:
                raise InvalidNoteSubjectError(
                    "Subject not found or does not belong to the user."
                )

        return await self.note_repo.list_by_user(
            user_id=user_id,
            search=search,
            subject_id=subject_id,
            is_pinned=is_pinned,
            limit=limit,
            offset=offset,
        )

    async def get_note(self, user_id: UUID, note_id: UUID) -> Note:
        """Retrieve a specific note owned by the authenticated student.

        Raises:
            NoteNotFoundError: If the note does not exist or is owned by another user.
        """
        note = await self.note_repo.get_by_id_and_user(note_id, user_id)
        if note is None:
            raise NoteNotFoundError("Note not found.")
        return note

    async def create_note(self, user_id: UUID, payload: NoteCreate) -> Note:
        """Create a new note, verifying subject ownership if subject_id is specified."""
        if payload.subject_id is not None:
            subject = await self.subject_repo.get_by_id_and_user(
                payload.subject_id, user_id
            )
            if subject is None:
                raise InvalidNoteSubjectError(
                    "Subject does not exist or does not belong to the user."
                )

        note = Note(
            user_id=user_id,
            subject_id=payload.subject_id,
            title=payload.title.strip(),
            content=payload.content.strip(),
            is_pinned=payload.is_pinned,
        )

        try:
            created = await self.note_repo.create(note)
            await self.session.commit()
            return created
        except IntegrityError as exc:
            await self.session.rollback()
            raise NoteError("Failed to persist note.") from exc

    async def update_note(
        self, user_id: UUID, note_id: UUID, payload: NoteUpdate
    ) -> Note:
        """Partially update an existing note, verifying subject ownership and user isolation."""
        note = await self.get_note(user_id, note_id)
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return note

        if "subject_id" in update_data:
            new_subject_id = update_data["subject_id"]
            if new_subject_id is not None:
                subject = await self.subject_repo.get_by_id_and_user(
                    new_subject_id, user_id
                )
                if subject is None:
                    raise InvalidNoteSubjectError(
                        "Subject does not exist or does not belong to the user."
                    )
                note.subject_id = new_subject_id
            else:
                note.subject_id = None

        if "title" in update_data and payload.title is not None:
            note.title = payload.title.strip()

        if "content" in update_data and payload.content is not None:
            note.content = payload.content.strip()

        if "is_pinned" in update_data and payload.is_pinned is not None:
            note.is_pinned = payload.is_pinned

        note.updated_at = datetime.now(UTC)

        try:
            updated = await self.note_repo.update(note)
            await self.session.commit()
            return updated
        except IntegrityError as exc:
            await self.session.rollback()
            raise NoteError("Failed to update note.") from exc

    async def delete_note(self, user_id: UUID, note_id: UUID) -> None:
        """Delete an existing note enforcing user ownership."""
        note = await self.get_note(user_id, note_id)
        await self.note_repo.delete(note)
        await self.session.commit()
