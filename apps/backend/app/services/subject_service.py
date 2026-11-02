from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Subject
from app.repositories.subject_repo import SubjectRepository
from app.schemas.subject import SubjectCreate, SubjectUpdate


class SubjectError(Exception):
    """Base domain exception for subject operations."""


class SubjectNotFoundError(SubjectError):
    """Raised when a subject does not exist or does not belong to the user."""


class DuplicateSubjectNameError(SubjectError):
    """Raised when a subject with the same name already exists for the user."""


class SubjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.subject_repo = SubjectRepository(session)

    async def list_subjects(self, user_id: UUID) -> Sequence[Subject]:
        """List all subjects owned by the authenticated student."""
        return await self.subject_repo.list_by_user(user_id)

    async def get_subject(self, user_id: UUID, subject_id: UUID) -> Subject:
        """Retrieve a specific subject owned by the authenticated student.

        Raises:
            SubjectNotFoundError: If the subject doesn't exist or is owned by another user.
        """
        subject = await self.subject_repo.get_by_id_and_user(subject_id, user_id)
        if subject is None:
            raise SubjectNotFoundError("Subject not found.")
        return subject

    async def create_subject(self, user_id: UUID, payload: SubjectCreate) -> Subject:
        """Create a new subject with case-insensitive unique name enforcement."""
        cleaned_name = payload.name.strip()

        # Proactive duplicate name check
        existing = await self.subject_repo.get_by_user_and_name_lower(
            user_id, cleaned_name
        )
        if existing is not None:
            raise DuplicateSubjectNameError(
                f"A subject with the name '{cleaned_name}' already exists."
            )

        subject = Subject(
            user_id=user_id,
            name=cleaned_name,
            code=payload.code.strip() if payload.code else None,
            description=payload.description.strip() if payload.description else None,
            semester=payload.semester,
            color=payload.color or "#6366F1",
        )

        try:
            created = await self.subject_repo.create(subject)
            await self.session.commit()
            return created
        except IntegrityError as exc:
            await self.session.rollback()
            raise DuplicateSubjectNameError(
                f"A subject with the name '{cleaned_name}' already exists."
            ) from exc

    async def update_subject(
        self, user_id: UUID, subject_id: UUID, payload: SubjectUpdate
    ) -> Subject:
        """Update an existing subject enforcing user ownership and uniqueness."""
        subject = await self.get_subject(user_id, subject_id)
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return subject

        if "name" in update_data and payload.name is not None:
            cleaned_name = payload.name.strip()
            existing = await self.subject_repo.get_by_user_and_name_lower(
                user_id, cleaned_name
            )
            if existing is not None and existing.id != subject_id:
                raise DuplicateSubjectNameError(
                    f"A subject with the name '{cleaned_name}' already exists."
                )
            subject.name = cleaned_name

        if "code" in update_data:
            subject.code = payload.code.strip() if payload.code else None
        if "description" in update_data:
            subject.description = (
                payload.description.strip() if payload.description else None
            )
        if "semester" in update_data:
            subject.semester = payload.semester
        if "color" in update_data:
            subject.color = payload.color

        subject.updated_at = datetime.now(UTC)

        try:
            updated = await self.subject_repo.update(subject)
            await self.session.commit()
            return updated
        except IntegrityError as exc:
            await self.session.rollback()
            raise DuplicateSubjectNameError(
                f"A subject with the name '{subject.name}' already exists."
            ) from exc

    async def delete_subject(self, user_id: UUID, subject_id: UUID) -> None:
        """Delete an existing subject enforcing user ownership."""
        subject = await self.get_subject(user_id, subject_id)
        await self.subject_repo.delete(subject)
        await self.session.commit()
