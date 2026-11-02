# StudyMate AI - Backend API

Modular monolith backend built with FastAPI, SQLAlchemy 2.0 (asyncpg), and Alembic.

## Requirements
- Python 3.12+ (tested on Python 3.14)
- PostgreSQL 16+

## Setup
1. Create and activate a virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. Install dependencies:
   ```powershell
   pip install -e ".[dev]"
   ```
3. Copy environment configuration:
   ```powershell
   cp .env.example .env
   ```
4. Run migrations:
   ```powershell
   alembic upgrade head
   ```
5. Start development server:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```
