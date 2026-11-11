import time
from app.core.rate_limiter import AdminLoginRateLimiter


def test_rate_limiter_allows_under_threshold() -> None:
    limiter = AdminLoginRateLimiter(max_attempts=3, lockout_minutes=1)
    ip = "192.168.1.50"

    is_locked, remaining = limiter.is_locked(ip)
    assert not is_locked
    assert remaining == 0

    limiter.record_failure(ip)
    limiter.record_failure(ip)

    is_locked, _ = limiter.is_locked(ip)
    assert not is_locked


def test_rate_limiter_locks_at_threshold() -> None:
    limiter = AdminLoginRateLimiter(max_attempts=3, lockout_minutes=1)
    ip = "192.168.1.99"

    limiter.record_failure(ip)
    limiter.record_failure(ip)
    limiter.record_failure(ip)

    is_locked, remaining = limiter.is_locked(ip)
    assert is_locked
    assert remaining > 0


def test_rate_limiter_resets_cleanly() -> None:
    limiter = AdminLoginRateLimiter(max_attempts=2, lockout_minutes=1)
    ip = "10.0.0.1"

    limiter.record_failure(ip)
    limiter.record_failure(ip)
    assert limiter.is_locked(ip)[0] is True

    limiter.reset(ip)
    assert limiter.is_locked(ip)[0] is False

