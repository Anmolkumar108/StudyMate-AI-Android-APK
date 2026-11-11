from pathlib import Path
from typing import Literal

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "StudyMate AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True

    # Security & Tokens
    SECRET_KEY: str = "default-insecure-dev-key-change-in-production"
    JWT_SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # PostgreSQL Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "studymate_app"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "studymate_db"
    DATABASE_URL: str | None = None
    DB_ECHO: bool = False

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    # Email & SMTP Settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "noreply@studymate.ai"
    EMAILS_FROM_NAME: str = "StudyMate AI"

    # Deep Linking & Token Expiry
    FRONTEND_URL: str = "http://localhost:8081"
    APP_DEEP_LINK_SCHEME: str = "studymate"
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1
    PASSWORD_RESET_OTP_EXPIRE_MINUTES: int = 10
    RESEND_COOLDOWN_SECONDS: int = 60

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        # Honor JWT_SECRET_KEY alias if provided
        if self.JWT_SECRET_KEY:
            self.SECRET_KEY = self.JWT_SECRET_KEY

        # Validate minimum secret strength in production or staging
        if self.ENVIRONMENT in ("production", "staging") and (
            self.SECRET_KEY == "default-insecure-dev-key-change-in-production"
            or len(self.SECRET_KEY) < 16
        ):
            raise ValueError(
                "SECRET_KEY must be a cryptographically secure string of at least 16 characters in production/staging."
            )

        if self.ALGORITHM != "HS256":
            raise ValueError("Only 'HS256' algorithm is supported.")

        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            if "sslmode=" in url:
                url = (
                    url.replace("sslmode=require", "ssl=require")
                    .replace("sslmode=prefer", "ssl=prefer")
                    .replace("sslmode=disable", "ssl=disable")
                )
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Storage
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_DIR: str = "./uploads/documents"

    # AI Configuration (Backend-only)
    PRIMARY_AI_PROVIDER: str = "gemini"
    AI_MODEL_NAME: str = "gemini-3.1-flash-lite"
    AI_API_KEY: str | None = None
    AI_DAILY_BUDGET_LIMIT_USD: float = 10.0

    # Administrative Security & Hardening (MFA / Rate Limiting)
    ADMIN_SECURITY_KEY: str = "979831"
    ADMIN_LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    ADMIN_LOGIN_LOCKOUT_MINUTES: int = 15


settings = Settings()
