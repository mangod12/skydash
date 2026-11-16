"""Server-side audit trail: who did what, when, from where, and the outcome.

Every state-changing request (and every auth attempt) is recorded with the
authenticated user, method, path, status and client address. Request bodies are
never stored, so passwords and tokens cannot leak into the log.
"""

import logging
import time

import database as db

log = logging.getLogger("skydash")

_DDL = """CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    username TEXT,
    role TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER,
    client TEXT
)"""
_INDEX = "CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts)"

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def should_audit(method: str, path: str) -> bool:
    if path.startswith("/api/auth/"):
        return True
    return method.upper() not in SAFE_METHODS and not path.startswith("/ws/")


def _ensure_table():
    conn = db.get_connection()
    conn.execute(_DDL)
    conn.execute(_INDEX)
    conn.commit()


def record(method, path, status, user=None, client=None):
    try:
        _ensure_table()
        db.execute(
            "INSERT INTO audit_log (ts, username, role, method, path, status, client) "
            "VALUES (?,?,?,?,?,?,?)",
            (
                time.time(),
                (user or {}).get("username"),
                (user or {}).get("role"),
                method.upper(),
                path,
                status,
                client,
            ),
            commit=True,
        )
    except Exception as exc:  # auditing must never break the request
        log.error(f"Audit write failed: {exc}")


def query(limit=100, username=None, since=None):
    _ensure_table()
    sql = "SELECT id, ts, username, role, method, path, status, client FROM audit_log WHERE 1=1"
    params = []
    if username:
        sql += " AND username = ?"
        params.append(username)
    if since is not None:
        sql += " AND ts >= ?"
        params.append(since)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(max(1, min(int(limit), 1000)))
    return [dict(r) for r in db.execute(sql, tuple(params)).fetchall()]
