#!/bin/sh
set -e

echo "==> [StudyMate AI] Checking database connection and executing migrations..."
alembic upgrade head

echo "==> [StudyMate AI] Launching FastAPI Modular Monolith on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
