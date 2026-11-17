"""Server-side audit trail: who did what, when, from where, and the outcome.

Every state-changing request (and every auth attempt) is recorded with the
authenticated user, method, path, status and client address. Request bodies are
never stored, so passwords and tokens cannot leak into the log.
"""

import logging
import os
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


_PURGE_EVERY = 3600.0
_last_purge = 0.0


def retention_days() -> float:
    """SKYDASH_AUDIT_RETENTION_DAYS; 0 or unset keeps everything."""
    try:
        return max(0.0, float(os.getenv("SKYDASH_AUDIT_RETENTION_DAYS", "0")))
    except ValueError:
        return 0.0


def purge_old(now=None) -> int:
    """Delete rows older than the retention window. Returns rows removed."""
    days = retention_days()
    if not days:
        return 0
    _ensure_table()
    cutoff = (now or time.time()) - days * 86400
    cur = db.execute("DELETE FROM audit_log WHERE ts < ?", (cutoff,), commit=True)
    return getattr(cur, "rowcount", 0) or 0


def _maybe_purge():
    global _last_purge
    now = time.time()
    if now - _last_purge < _PURGE_EVERY:
        return
    _last_purge = now
    purge_old(now)


def record(method, path, status, user=None, client=None):
    try:
        _ensure_table()
        _maybe_purge()
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


def query(limit=100, username=None, since=None, max_limit=1000):
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
    params.append(max(1, min(int(limit), max_limit)))
    return [dict(r) for r in db.execute(sql, tuple(params)).fetchall()]


CSV_COLUMNS = ("id", "time_utc", "username", "role", "method", "path", "status", "client")


def _safe_cell(value) -> str:
    """Neutralise spreadsheet formula injection (a leading = + - @ or control char)."""
    text = "" if value is None else str(value)
    return "\'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def to_csv(rows) -> str:
    import csv
    import io
    from datetime import datetime, timezone

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for r in rows:
        ts = datetime.fromtimestamp(r["ts"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        writer.writerow([_safe_cell(v) for v in (
            r["id"], ts, r["username"], r["role"], r["method"], r["path"], r["status"], r["client"])])
    return out.getvalue()
