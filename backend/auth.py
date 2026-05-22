import os
import hashlib
import secrets
import time

import jwt  # PyJWT

import database as db

SECRET_KEY = os.getenv("SKYDASH_JWT_SECRET", secrets.token_hex(32))
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

    def create_user(self, username, password, role="analyst"):
        uid = secrets.token_hex(4)
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
                (uid, username, pw_hash, role, time.strftime("%Y-%m-%dT%H:%M:%SZ")),
            )
            conn.commit()
        return uid

    def authenticate(self, username, password):
        pw_hash = hashlib.sha256(password.encode()).hexdigest()
        row = db.get_connection().execute(
            "SELECT * FROM users WHERE username=? AND password_hash=?",
            (username, pw_hash),
        ).fetchone()
        return dict(row) if row else None

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
