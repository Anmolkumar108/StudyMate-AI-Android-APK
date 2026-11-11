"""StudyMate AI - Production Service Entrypoint

Handles database connectivity wait, automated Alembic migrations,
initial Super Admin seeding, and launches Uvicorn server in Python.
"""

import asyncio
import os
import subprocess
import sys
import time
from sqlalchemy import text


async def wait_for_database() -> bool:
    from app.db.session import engine

    max_attempts = 45
    print("==> [StudyMate AI] Checking PostgreSQL database connectivity...")
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print("==> [StudyMate AI] Cloud PostgreSQL is ready and reachable!")
            return True
        except Exception as err:
            print(f"==> [StudyMate AI] Waiting for DB (attempt {attempt}/{max_attempts}): {err}")
            await asyncio.sleep(2)
    print("==> [StudyMate AI] FATAL: Database connection timed out after 90 seconds.")
    return False


def run_migrations() -> None:
    print("==> [StudyMate AI] Executing Alembic database migrations...")
    cmd = [sys.executable, "-m", "alembic", "upgrade", "head"]
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print("==> [StudyMate AI] First migration attempt failed, retrying in 3 seconds...")
        time.sleep(3)
        subprocess.run(cmd, check=True)
    print("==> [StudyMate AI] Migrations completed successfully!")


def seed_admin() -> None:
    print("==> [StudyMate AI] Verifying Super Admin account in cloud database...")
    try:
        from seed_admin import main as run_seed
        run_seed()
    except Exception as e:
        print(f"==> [StudyMate AI] Seed admin notice: {e}")


def start_server() -> None:
    port = int(os.getenv("PORT", "8000"))
    print(f"==> [StudyMate AI] Launching FastAPI Modular Monolith on port {port}...")
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


def main() -> None:
    print("==> [StudyMate AI] Production container boot starting...")
    db_ok = asyncio.run(wait_for_database())
    if not db_ok:
        print("==> [StudyMate AI] Exiting due to database timeout.")
        sys.exit(1)

    run_migrations()
    seed_admin()
    start_server()


if __name__ == "__main__":
    main()

