import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.session import AsyncSessionLocal
from app.repositories.subject_template_repo import SubjectTemplateRepository


async def main() -> None:
    async with AsyncSessionLocal() as session:
        repo = SubjectTemplateRepository(session)
        seeded = await repo.seed_defaults()
        await session.commit()
        print(f"SUCCESS: Seeded {len(seeded)} university curriculum templates in PostgreSQL.")


if __name__ == "__main__":
    asyncio.run(main())

