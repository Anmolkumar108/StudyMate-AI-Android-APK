# StudyMate AI — DevOps & Deployment Guide

## 1. Local Development Environment Setup (Windows)

### 1.1 Prerequisites
* Python 3.12+
* Node.js 20+ LTS or 22+ LTS & npm
* Android Studio (with Android SDK 34+ and Android Virtual Device)
* PostgreSQL 16+ (running natively on Windows or via a minimal Docker container)

### 1.2 Windows Environment Inspection Commands
Before installing additional database engines, future coding agents must run these non-destructive inspection commands in PowerShell to inspect what is already installed:

```powershell
# 1. Check Python version
python --version

# 2. Check Node.js and npm versions
node --version
npm --version

# 3. Check if Docker is installed and running
docker --version
docker info

# 4. Check if Native PostgreSQL client or Windows Service is present
psql --version
Get-Service *postgres* -ErrorAction SilentlyContinue
```

### 1.3 Windows PostgreSQL Setup Strategy: Native vs. Docker Compose

| Criteria | Native PostgreSQL on Windows | PostgreSQL via Docker Compose |
| :--- | :--- | :--- |
| **RAM Footprint** | Extremely low (~50–100 MB RAM service). | Higher (~2–4 GB for WSL 2 / Docker Desktop VM daemon). |
| **Prerequisites** | PostgreSQL installer or `winget install PostgreSQL.PostgreSQL.16`. | Requires Docker Desktop installed and running with WSL 2 backend. |
| **Startup Behavior** | Starts automatically with Windows background services. | Requires Docker daemon started before containers can boot. |
| **Isolation** | Installs directly to Windows filesystem (`C:\Program Files\PostgreSQL`). | Completely containerized; wiped with `docker compose down -v`. |

**Recommendation**:
1. If Docker Desktop is already installed and running on the machine, use the minimal single-service `docker-compose.yml` below for clean container isolation.
2. If Docker Desktop is **not** installed, use **Native PostgreSQL on Windows** (via Windows installer or `winget`). This avoids the heavy virtualization overhead of Docker Desktop on a 16 GB RAM laptop.

#### Minimal Docker Compose (If Docker is installed):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: studymate_postgres
    environment:
      POSTGRES_USER: studymate
      POSTGRES_PASSWORD: studymate_dev_password
      POSTGRES_DB: studymate_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studymate -d studymate_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 1.4 Backend Setup & Database Migrations
1. Navigate to `backend/`:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. Copy environment template:
   ```powershell
   cp .env.example .env
   ```
3. Run Alembic migrations:
   ```powershell
   alembic upgrade head
   ```
4. Start FastAPI server with live reload:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

### 1.5 Mobile Client Setup & Verified Installation Procedure
1. Initialize the project with verified stable Expo tooling (SDK 57+):
   ```bash
   npx create-expo-app@latest apps/mobile
   cd apps/mobile
   ```
2. Always install native packages using `npx expo install` to guarantee compatibility with the installed Expo SDK:
   ```bash
   npx expo install @tanstack/react-query zustand react-native-mmkv expo-secure-store expo-router react-native-safe-area-context react-native-screens
   ```
3. Audit dependencies for peer compatibility:
   ```bash
   npx expo-doctor
   ```
4. Start Expo development server:
   ```bash
   npx expo start
   ```
5. Press `a` to open on an Android emulator or connect a physical Android device with USB debugging enabled.

---

## 2. Environment Variables & Configuration

### 2.1 Backend `.env` Specification

```ini
# Application
ENVIRONMENT=development # development | staging | production
DEBUG=True
PROJECT_NAME="StudyMate AI"
API_V1_STR="/api/v1"
SECRET_KEY=change_this_to_a_super_secure_random_64_char_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# Database (PostgreSQL 16)
DATABASE_URL=postgresql+asyncpg://studymate:studymate_dev_password@localhost:5432/studymate_db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=5

# File Storage Configuration (Pluggable)
STORAGE_BACKEND=local # local | s3
LOCAL_STORAGE_DIR="./uploads/documents"

# Production S3 / Cloudflare R2 (Deferred to Production)
# S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
# S3_ACCESS_KEY_ID=your_access_key
# S3_SECRET_ACCESS_KEY=your_secret_key
# S3_BUCKET_NAME=studymate-documents

# Configurable AI Provider (Backend-only, never client-exposed)
PRIMARY_AI_PROVIDER=gemini # gemini | openai
AI_MODEL_NAME=gemini-3.1-flash-lite # Options: gemini-3.1-flash-lite, gemini-3.8-flash, gpt-4o-mini
AI_API_KEY=your_secure_api_key_here
AI_DAILY_BUDGET_LIMIT_USD=10.0
```

> [!NOTE]
> **AI Provider Pricing & Availability**: API pricing, rate limits, and model availability depend on individual provider accounts and regions. The active model can be changed in `.env` without modifying application source code.

### 2.2 Mobile Client `.env` Specification
```ini
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1 # 10.0.2.2 routes to host machine in Android Emulator
EXPO_PUBLIC_APP_ENV=development
```
*Note*: The mobile client `.env` must **never** contain private keys, AI credentials, or database connection strings.

---

## 3. Production Deployment Architecture (Phased)

```mermaid
flowchart TD
    ALB["Reverse Proxy / Nginx"] --> APICluster["FastAPI Modular Monolith Containers"]
    APICluster --> ManagedPG[("Managed PostgreSQL 16 (Neon / AWS RDS)")]
    APICluster --> Storage[("Cloudflare R2 / S3 Object Storage")]
    APICluster --> ExternalAI["Configured AI Provider API"]
```

* **Backend API**: Deployed as containerized services (Render, Fly.io, or AWS ECS).
* **Database**: Managed PostgreSQL 16 (Neon, Supabase, or AWS RDS) with daily automated backups.
* **Storage**: In production, `STORAGE_BACKEND=s3` enables Cloudflare R2 (zero egress fees, fully S3-compatible).

---

## 4. Mobile Build & Release Pipeline (Expo EAS)

### 4.1 EAS Build Configuration (`eas.json`)
```json
{
  "cli": {
    "version": ">= 9.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 4.2 Android Release Steps
1. Build production Android App Bundle:
   ```bash
   eas build --platform android --profile production
   ```
2. Submit to Google Play Console internal testing track:
   ```bash
   eas submit --platform android --profile production
   ```
