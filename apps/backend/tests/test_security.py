from datetime import timedelta
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    validate_password_policy,
    verify_dummy_password,
    verify_password,
)


def test_password_hashing_and_verification() -> None:
    password = "MySecurePassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_password_whitespace_and_unicode_preservation() -> None:
    # Passphrases with internal, leading, or trailing spaces must be preserved verbatim
    passphrase_with_spaces = "  correct horse battery staple  "
    hashed_spaces = hash_password(passphrase_with_spaces)
    assert verify_password(passphrase_with_spaces, hashed_spaces) is True
    # Without leading/trailing spaces, it must NOT match (proves no accidental trimming)
    assert verify_password("correct horse battery staple", hashed_spaces) is False

    # Unicode & special characters
    unicode_pass = "StudîMâte-AI-🔒-2026"
    hashed_unicode = hash_password(unicode_pass)
    assert verify_password(unicode_pass, hashed_unicode) is True


def test_password_length_policy_validation() -> None:
    # Minimum 8 characters
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_policy("short")

    with pytest.raises(ValueError, match="at least 8 characters"):
        hash_password("1234567")

    # Boundary 8 characters succeeds
    validate_password_policy("12345678")

    # Boundary 128 characters succeeds
    pass_128 = "A" * 128
    validate_password_policy(pass_128)

    # Maximum 128 characters exceeded raises
    pass_129 = "A" * 129
    with pytest.raises(ValueError, match="must not exceed 128 characters"):
        validate_password_policy(pass_129)

    with pytest.raises(ValueError, match="must not exceed 128 characters"):
        hash_password(pass_129)


def test_unknown_email_dummy_verification() -> None:
    # Precomputed dummy hash verifies safely and always returns False
    result = verify_dummy_password("some_random_password")
    assert result is False


def test_jwt_access_token_creation_and_decoding() -> None:
    user_id = uuid4()
    token = create_access_token(
        subject=user_id,
        role="student",
        token_version=1,
    )

    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "student"
    assert payload["type"] == "access"
    assert payload["token_version"] == 1
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_invalid_signature() -> None:
    user_id = uuid4()
    # Sign with a different secret
    forged_token = jwt.encode(
        {
            "sub": str(user_id),
            "role": "student",
            "type": "access",
            "token_version": 1,
            "exp": 9999999999,
        },
        "wrong-secret-key-different-signature-32char",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(forged_token)


def test_jwt_expired_token() -> None:
    user_id = uuid4()
    expired_token = create_access_token(
        subject=user_id,
        role="student",
        token_version=1,
        expires_delta=timedelta(seconds=-10),  # expired 10 seconds ago
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


def test_jwt_invalid_token_type() -> None:
    user_id = uuid4()
    # Craft a token with type != 'access'
    refresh_like_token = jwt.encode(
        {
            "sub": str(user_id),
            "role": "student",
            "type": "refresh",  # Should be rejected by decode_access_token
            "token_version": 1,
            "exp": 9999999999,
        },
        from_settings_secret(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidTokenError, match="Invalid token type"):
        decode_access_token(refresh_like_token)


def test_jwt_missing_required_claims() -> None:
    # Token missing 'token_version'
    incomplete_token = jwt.encode(
        {
            "sub": str(uuid4()),
            "role": "student",
            "type": "access",
            "exp": 9999999999,
        },
        from_settings_secret(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.MissingRequiredClaimError):
        decode_access_token(incomplete_token)


def test_jwt_invalid_subject_uuid() -> None:
    # Token creation with non-UUID subject must be rejected
    with pytest.raises(ValueError):
        create_access_token(
            subject="not-a-valid-uuid",
            role="student",
            token_version=1,
        )

    # Token with non-UUID subject crafted directly
    malformed_sub_token = jwt.encode(
        {
            "sub": "non-uuid-subject-string",
            "role": "student",
            "type": "access",
            "token_version": 1,
            "exp": 9999999999,
        },
        from_settings_secret(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidTokenError, match="Invalid UUID subject"):
        decode_access_token(malformed_sub_token)


def test_jwt_valid_token_version() -> None:
    user_id = uuid4()
    for valid_version in (1, 2, 42, 9999):
        token = create_access_token(
            subject=user_id,
            role="student",
            token_version=valid_version,
        )
        payload = decode_access_token(token)
        assert payload["token_version"] == valid_version
        assert type(payload["token_version"]) is int


@pytest.mark.parametrize(
    "invalid_version",
    [
        True,  # bool subclass of int
        False,  # bool subclass of int
        0,  # zero (not positive)
        -1,  # negative integer
        -100,  # negative integer
        "1",  # string digit
        "invalid",  # arbitrary string
        "",  # empty string
        1.0,  # float integer-like
        2.5,  # float
        [],  # list
        {},  # dict
    ],
)
def test_jwt_invalid_token_version_rejected(invalid_version: object) -> None:
    user_id = uuid4()
    token = jwt.encode(
        {
            "sub": str(user_id),
            "role": "student",
            "type": "access",
            "token_version": invalid_version,
            "exp": 9999999999,
        },
        from_settings_secret(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidTokenError, match="Invalid token_version"):
        decode_access_token(token)


@pytest.mark.parametrize(
    "invalid_version",
    [
        0,
        -1,
        True,
        False,
    ],
)
def test_create_access_token_rejects_invalid_token_version(
    invalid_version: int,
) -> None:
    with pytest.raises(ValueError, match="token_version must be a positive integer"):
        create_access_token(
            subject=uuid4(),
            role="student",
            token_version=invalid_version,
        )


def test_secret_key_environment_validation() -> None:
    # Weak secret in production must raise validation error
    with pytest.raises(ValidationError, match="at least 32 characters"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="too-short",
        )

    # Default dev secret in production must raise validation error
    with pytest.raises(ValidationError, match="at least 32 characters"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="default-insecure-dev-key-change-in-production",
        )

    # Valid 32+ char secret in production succeeds
    valid_prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
    )
    assert valid_prod_settings.SECRET_KEY == "a" * 32

    # In development, shorter/dev keys are tolerated
    dev_settings = Settings(
        ENVIRONMENT="development",
        SECRET_KEY="short-dev-key",
    )
    assert dev_settings.SECRET_KEY == "short-dev-key"


def test_refresh_token_generation_and_hashing() -> None:
    raw_token = generate_refresh_token()
    assert isinstance(raw_token, str)
    assert len(raw_token) >= 64  # secrets.token_urlsafe(48) is 64 chars

    token_hash = hash_refresh_token(raw_token)
    assert isinstance(token_hash, str)
    assert len(token_hash) == 64  # SHA-256 hex digest is exactly 64 characters
    # Hashing is deterministic
    assert hash_refresh_token(raw_token) == token_hash
    # Different tokens have different hashes
    assert hash_refresh_token(generate_refresh_token()) != token_hash


def from_settings_secret() -> str:
    from app.core.config import settings

    return settings.SECRET_KEY
