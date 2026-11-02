import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.core.config import settings

# RFC 9106 recommended Argon2id configuration (Memory-hard 64MB)
password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Precomputed static hash used to mitigate timing variance for unknown-email login attempts
DUMMY_ARGON2_HASH: str = password_hasher.hash("studymate_dummy_timing_protection_value")

# Password Policy Bounds
PASSWORD_MIN_LENGTH: int = 8
PASSWORD_MAX_LENGTH: int = 128


def validate_password_policy(password: str) -> None:
    """Validate password length bounds before expensive Argon2 hashing.

    Preserves verbatim characters and whitespace. Does not trim or convert case.
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters long."
        )
    if len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"Password must not exceed {PASSWORD_MAX_LENGTH} characters.")


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    validate_password_policy(password)
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash.

    Returns False safely on any verification mismatch or corrupt hash.
    """
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False


def verify_dummy_password(plain_password: str) -> bool:
    """Execute a dummy Argon2id verification to reduce response-time discrepancy

    when an email address does not exist.
    """
    try:
        password_hasher.verify(DUMMY_ARGON2_HASH, plain_password)
    except (VerifyMismatchError, VerificationError):
        pass
    return False


def create_access_token(
    *,
    subject: str | UUID,
    role: str,
    token_version: int,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed HMAC-SHA256 JWT access token."""
    # Ensure subject is valid UUID format
    sub_str = str(subject)
    UUID(sub_str)  # Validates UUID format, raises ValueError if invalid

    # Validate token_version is a genuine positive integer >= 1 (reject booleans, strings, <= 0)
    if (
        not isinstance(token_version, int)
        or isinstance(token_version, bool)
        or token_version < 1
    ):
        raise ValueError(
            f"token_version must be a positive integer >= 1, got {token_version!r}"
        )

    now = datetime.now(UTC)
    expire = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = {
        "sub": sub_str,
        "role": role,
        "type": "access",
        "token_version": token_version,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token.

    Enforces HS256 algorithm, signature, expiration, required claims,
    token type, and UUID subject format.
    """
    payload: dict[str, Any] = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={
            "require": ["exp", "sub", "type", "token_version"],
            "verify_exp": True,
        },
    )

    token_type = payload.get("type")
    if token_type != "access":
        raise jwt.InvalidTokenError(
            f"Invalid token type: expected 'access', got '{token_type}'"
        )

    # Validate sub is a parseable UUID
    sub = payload.get("sub")
    if not isinstance(sub, str):
        raise jwt.InvalidTokenError("Token subject must be a string UUID")
    try:
        UUID(sub)
    except ValueError as e:
        raise jwt.InvalidTokenError(f"Invalid UUID subject: {e}") from e

    # Validate token_version is a genuine positive integer >= 1 (reject booleans, strings, floats, non-positive)
    token_version = payload.get("token_version")
    if (
        not isinstance(token_version, int)
        or isinstance(token_version, bool)
        or token_version < 1
    ):
        raise jwt.InvalidTokenError(
            f"Invalid token_version: expected positive integer >= 1, got {token_version!r}"
        )

    return payload


def generate_refresh_token() -> str:
    """Generate a cryptographically secure, high-entropy 64-character refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token using SHA-256 for secure database persistence."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
