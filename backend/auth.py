import os
import hashlib
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
TOKEN_EXPIRE_SECONDS = 86400  # 24 hours


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
        conn.commit()
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
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
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None
