# ==============================================================================
# StudyMate AI - Production Dockerfile (Backend API)
# ==============================================================================
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PYTHONPATH=/app

# Install minimal runtime utilities (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code, migrations and runners
COPY pyproject.toml alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY seed_admin.py run_prod.py ./

# Create non-root system user for container security
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser \
    && mkdir -p /app/uploads/documents \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1

CMD ["python", "run_prod.py"]
