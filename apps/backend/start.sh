#!/bin/sh
set -e

echo "==> [StudyMate AI] Starting production backend service..."

# Wait for database to be reachable (up to 45 attempts, 2 seconds each = 90s)
echo "==> [StudyMate AI] Checking PostgreSQL database connectivity..."
python - << 'EOF'
import asyncio
import os
import sys

async def wait_for_database():
    from sqlalchemy import text
    from app.db.session import engine

    max_attempts = 45
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print("==> [StudyMate AI] Cloud PostgreSQL is ready and reachable!")
            return True
        except Exception as err:
            print(f"==> [StudyMate AI] Database not ready yet (attempt {attempt}/{max_attempts}). Retrying in 2s... Error: {err}")
            await asyncio.sleep(2)
    print("==> [StudyMate AI] FATAL: Database connection timed out after 90 seconds.")
    return False

if not asyncio.run(wait_for_database()):
    sys.exit(1)
EOF

echo "==> [StudyMate AI] Executing Alembic database migrations..."
alembic upgrade head

echo "==> [StudyMate AI] Verifying Super Admin account in cloud database..."
python seed_admin.py || echo "==> [StudyMate AI] Seed script completed or skipped."

echo "==> [StudyMate AI] Launching FastAPI Modular Monolith on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
