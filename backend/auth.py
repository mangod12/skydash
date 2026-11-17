import os
import hashlib
import math
import secrets
import time
import logging

import jwt  # PyJWT

import database as db

log = logging.getLogger("skydash.auth")

# JWT secret: required for production, auto-generated for dev
_env_secret = os.getenv("SKYDASH_JWT_SECRET")
if not _env_secret:
    _env_secret = secrets.token_hex(32)
    log.warning("SKYDASH_JWT_SECRET not set — using ephemeral secret (tokens invalidate on restart)")
SECRET_KEY = _env_secret
ALGORITHM = "HS256"
def _ttl_seconds():
    """Token lifetime. Default 24h; SKYDASH_TOKEN_TTL_MINUTES shortens (or lengthens) it."""
    try:
        minutes = float(os.getenv("SKYDASH_TOKEN_TTL_MINUTES", "1440"))
        seconds = minutes * 60
        if not math.isfinite(seconds) or seconds <= 0:
            return 86400
        return max(1, int(seconds))
    except (ValueError, OverflowError):
        return 86400


TOKEN_EXPIRE_SECONDS = _ttl_seconds()


class UserStore:
    def __init__(self):
        self._init()

    def _init(self):
        conn = db.get_connection()
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'analyst',
            created_at TEXT
        )""")
        cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "disabled" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0")
        conn.execute("""CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti TEXT PRIMARY KEY,
            exp REAL NOT NULL
        )""")
        conn.commit()
        # Production deployments set SKYDASH_DISABLE_DEMO_USERS=1 so no built-in accounts exist.
        demo_off = os.getenv("SKYDASH_DISABLE_DEMO_USERS", "").lower() in ("1", "true", "yes")
        if not demo_off and conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            self.create_user("admin", "admin", "commander")
            self.create_user("analyst", "analyst", "analyst")
            self.create_user("operator", "operator", "operator")

    def _hash_password(self, password, salt=None):
        """PBKDF2-SHA256 with per-user salt."""
        if salt is None:
            salt = secrets.token_hex(16)
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
        return f"{salt}${key.hex()}"

    def _verify_password(self, password, stored_hash):
        """Verify password against PBKDF2 hash. Also accepts legacy SHA-256."""
        if '$' in stored_hash:
            salt = stored_hash.split('$')[0]
            return self._hash_password(password, salt) == stored_hash
        # Legacy: plain SHA-256 (migrate on next login)
        return hashlib.sha256(password.encode()).hexdigest() == stored_hash

    def create_user(self, username, password, role="analyst"):
        uid = secrets.token_hex(4)
        pw_hash = self._hash_password(password)
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
                (uid, username, pw_hash, role, time.strftime("%Y-%m-%dT%H:%M:%SZ")),
            )
            conn.commit()
        return uid

    def authenticate(self, username, password):
        row = db.get_connection().execute(
            "SELECT * FROM users WHERE username=?", (username,),
        ).fetchone()
        if not row:
            return None
        user = dict(row)
        if user.get('disabled'):
            return None
        if not self._verify_password(password, user['password_hash']):
            return None
        # Migrate legacy SHA-256 hash to PBKDF2 on successful login
        if '$' not in user['password_hash']:
            new_hash = self._hash_password(password)
            with db.get_lock():
                db.get_connection().execute(
                    "UPDATE users SET password_hash=? WHERE id=?", (new_hash, user['id'])
                )
                db.get_connection().commit()
        return user

    def list_users(self):
        rows = db.get_connection().execute(
            "SELECT id, username, role, created_at, COALESCE(disabled, 0) AS disabled "
            "FROM users ORDER BY username"
        ).fetchall()
        return [dict(r) | {"disabled": bool(r["disabled"])} for r in rows]

    def update_user(self, user_id, role=None, disabled=None):
        """Change a user's role and/or disabled flag. Returns the user, or None if unknown."""
        if not self.get_user(user_id):
            return None
        conn = db.get_connection()
        with db.get_lock():
            if role is not None:
                conn.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
            if disabled is not None:
                conn.execute("UPDATE users SET disabled=? WHERE id=?", (1 if disabled else 0, user_id))
            conn.commit()
        return next(u for u in self.list_users() if u["id"] == user_id)

    def get_user(self, user_id):
        row = db.get_connection().execute(
            "SELECT id, username, role, created_at FROM users WHERE id=?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None

    def username_exists(self, username):
        row = db.get_connection().execute(
            "SELECT 1 FROM users WHERE username=?", (username,)
        ).fetchone()
        return row is not None


def create_token(user):
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": time.time() + TOKEN_EXPIRE_SECONDS,
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _is_revoked(jti):
    if not jti:
        return False
    row = db.get_connection().execute(
        "SELECT 1 FROM revoked_tokens WHERE jti=?", (jti,)
    ).fetchone()
    return row is not None


def revoke_token(payload):
    """Revoke a verified token payload until its natural expiry (idempotent)."""
    jti = payload.get("jti")
    if not jti:
        return False
    conn = db.get_connection()
    conn.execute("DELETE FROM revoked_tokens WHERE exp < ?", (time.time(),))
    conn.execute(
        "INSERT OR REPLACE INTO revoked_tokens (jti, exp) VALUES (?, ?)",
        (jti, float(payload.get("exp", time.time()))),
    )
    conn.commit()
    return True


def _apply_current_account(payload):
    """Disabled accounts lose access at once; role changes apply without re-login."""
    row = db.get_connection().execute(
        "SELECT role, COALESCE(disabled, 0) AS disabled FROM users WHERE id=?",
        (payload.get("sub"),),
    ).fetchone()
    if row is None:
        return None
    if row["disabled"]:
        return None
    return {**payload, "role": row["role"]}


def verify_token(token):
    # Database lookup failures must reject the session, never trust stale JWT roles.
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload["exp"] < time.time():
            return None
        if _is_revoked(payload.get("jti")):
            return None
        return _apply_current_account(payload)
    except Exception:
        return None


# ── Short-lived WebSocket tickets ────────────────────────────
# Browsers cannot set headers on a WebSocket, so the session token used to travel in the
# URL (and end up in proxy logs). A ticket is a one-time, 30 second stand-in for it.
WS_TICKET_TTL_SECONDS = 30
WS_MAX_PENDING_TICKETS = 10000
_ws_tickets = {}


def issue_ws_ticket(token):
    now = time.monotonic()
    for k in [k for k, (_, exp) in _ws_tickets.items() if exp <= now]:
        _ws_tickets.pop(k, None)
    if len(_ws_tickets) >= WS_MAX_PENDING_TICKETS:
        return None
    ticket = secrets.token_urlsafe(24)
    _ws_tickets[ticket] = (token, now + WS_TICKET_TTL_SECONDS)
    return ticket


def redeem_ws_ticket(ticket):
    """Return the session token behind a ticket (single use), or None."""
    entry = _ws_tickets.pop(ticket, None)
    if not entry or entry[1] <= time.monotonic():
        return None
    return entry[0]
