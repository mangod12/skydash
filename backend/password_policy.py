"""Password policy for self-registration.

Applies to new passwords only; existing accounts and seeded demo users are untouched.
SKYDASH_MIN_PASSWORD_LENGTH raises the minimum length (never below 8).
"""

import os
import re
from typing import Optional

_COMMON = {
    "password", "password1", "password123", "passw0rd", "12345678", "123456789",
    "1234567890", "qwertyuiop", "qwerty123", "iloveyou", "admin123", "administrator",
    "letmein123", "welcome123", "skydash123", "abcd1234", "11111111", "00000000",
}


def min_length() -> int:
    try:
        return max(8, int(os.getenv("SKYDASH_MIN_PASSWORD_LENGTH", "8")))
    except ValueError:
        return 8


def check_password(username: str, password: str) -> Optional[str]:
    """Return a human-readable reason the password is rejected, or None if acceptable."""
    if len(password) < min_length():
        return f"Password must be at least {min_length()} characters"
    if password.lower() in _COMMON:
        return "Password is too common"
    if username and len(username) >= 3 and username.lower() in password.lower():
        return "Password must not contain the username"
    if len(set(password)) < 4:
        return "Password is too repetitive"
    classes = sum(bool(re.search(p, password)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]"))
    if classes < 2:
        return "Password must mix at least two of: lowercase, uppercase, digits, symbols"
    return None
