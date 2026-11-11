from datetime import UTC, datetime, timedelta
import threading


class AdminLoginRateLimiter:
    """
    Thread-safe in-memory rate limiter and brute-force protector for admin logins.
    Tracks failed attempts by IP and email identifier.
    """

    def __init__(self, max_attempts: int = 5, lockout_minutes: int = 15) -> None:
        self.max_attempts = max_attempts
        self.lockout_duration = timedelta(minutes=lockout_minutes)
        self._failures: dict[str, list[datetime]] = {}
        self._lock = threading.Lock()

    def _cleanup_expired(self, key: str, now: datetime) -> list[datetime]:
        cutoff = now - self.lockout_duration
        valid = [t for t in self._failures.get(key, []) if t > cutoff]
        self._failures[key] = valid
        return valid

    def is_locked(self, key: str) -> tuple[bool, int]:
        """
        Check if the key (IP or email) is locked out.
        Returns (is_locked, remaining_seconds).
        """
        now = datetime.now(UTC)
        with self._lock:
            valid = self._cleanup_expired(key, now)
            if len(valid) >= self.max_attempts:
                oldest_in_window = valid[0]
                unlock_time = oldest_in_window + self.lockout_duration
                remaining = int((unlock_time - now).total_seconds())
                return True, max(remaining, 1)
            return False, 0

    def record_failure(self, key: str) -> int:
        """
        Record a failed attempt. Returns remaining allowed attempts before lockout.
        """
        now = datetime.now(UTC)
        with self._lock:
            valid = self._cleanup_expired(key, now)
            valid.append(now)
            self._failures[key] = valid
            remaining = self.max_attempts - len(valid)
            return max(remaining, 0)

    def reset(self, key: str) -> None:
        """
        Clear failed attempts upon successful login.
        """
        with self._lock:
            if key in self._failures:
                del self._failures[key]


# Singleton instance for administrative auth protection
admin_rate_limiter = AdminLoginRateLimiter(max_attempts=5, lockout_minutes=15)

