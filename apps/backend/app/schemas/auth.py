from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_policy


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=150)
    device_name: str | None = Field(default=None, max_length=150)
    device_os: str | None = Field(default=None, max_length=50)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("password", mode="after")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_policy(v)
        return v


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    device_name: str | None = Field(default=None, max_length=150)
    device_os: str | None = Field(default=None, max_length=50)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=1)


class GoogleAuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_token: str | None = Field(default=None, description="Google OAuth ID Token")
    access_token: str | None = Field(default=None, description="Google OAuth Access Token")
    device_name: str | None = Field(default=None, max_length=150)
    device_os: str | None = Field(default=None, max_length=50)


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(..., min_length=8, max_length=256, description="Cryptographic verification token")


class ResendVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class ForgotPasswordOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class ResetPasswordOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., min_length=3, max_length=255)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^[0-9]{6}$", description="6-digit verification code")
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("new_password", mode="after")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_policy(v)
        return v


class OtpResponse(BaseModel):
    message: str
    email: str
    success: bool = True
    dev_otp: str | None = None


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(..., min_length=8, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password", mode="after")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_policy(v)
        return v


class MessageResponse(BaseModel):
    message: str


class VerificationResponse(BaseModel):
    message: str
    verified: bool
    email: str | None = None
