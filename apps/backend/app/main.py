from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure Super Admin exists in database on boot
    try:
        from seed_admin import seed_production_database
        await seed_production_database(
            email="akanmolbhumihar09@gmail.com",
            password="Anmol@SINGH",
            full_name="Anmol Singh",
        )
    except Exception as err:
        print(f"==> [Startup] Super Admin verification notice: {err}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="StudyMate AI - Premium Student Productivity & Learning Backend API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS Configuration - Support Mobile App & Admin Console
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "health_check": f"{settings.API_V1_STR}/health",
        "docs": "/docs",
    }
