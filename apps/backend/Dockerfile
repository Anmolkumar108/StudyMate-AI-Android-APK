# ==============================================================================
# StudyMate AI - Production Dockerfile (Backend API)
# ==============================================================================
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install minimal runtime utilities (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and migration graph
COPY pyproject.toml alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY start.sh ./start.sh

# Fix line endings and make script executable
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

# Create non-root system user for container security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && mkdir -p /app/uploads/documents \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1

CMD ["./start.sh"]
