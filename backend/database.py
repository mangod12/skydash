"""Database connection manager for SkyDash.
Provides a shared connection with migration support.
Currently uses SQLite. Designed to be swappable to PostgreSQL."""

import os
import sqlite3
import threading
import logging

log = logging.getLogger("skydash.db")

DB_PATH = os.getenv("SKYDASH_DB_PATH", "skydash.db")
DB_TYPE = os.getenv("SKYDASH_DB_TYPE", "sqlite")  # Future: "postgresql"

_lock = threading.Lock()
_connection = None


def get_connection():
    """Get the shared database connection (thread-safe)."""
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
        _connection.execute("PRAGMA foreign_keys=ON")
        log.info(f"Database connected: {DB_PATH} (WAL mode)")
    return _connection


def get_lock():
    """Get the shared write lock."""
    return _lock


def execute(query, params=(), commit=False):
    """Execute a query with the shared lock for writes."""
    conn = get_connection()
    if commit:
        with _lock:
            result = conn.execute(query, params)
            conn.commit()
            return result
    return conn.execute(query, params)


def executemany(query, params_list, commit=True):
    """Execute many with shared lock."""
    conn = get_connection()
    with _lock:
        result = conn.executemany(query, params_list)
        if commit:
            conn.commit()
        return result


def close():
    """Close the shared connection. Used for testing and shutdown."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None
        log.info("Database connection closed")


def reset(db_path=None):
    """Reset connection state. Used for testing with alternate DB paths."""
    global _connection, DB_PATH
    close()
    if db_path is not None:
        DB_PATH = db_path


# --- Migration System ---------------------------------------------------

SCHEMA_VERSION = 2  # Increment when schema changes


def get_schema_version():
    """Get current schema version from DB."""
    conn = get_connection()
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_meta "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )
        conn.commit()
        row = conn.execute(
            "SELECT value FROM schema_meta WHERE key='version'"
        ).fetchone()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def set_schema_version(version):
    """Update schema version."""
    conn = get_connection()
    with _lock:
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) "
            "VALUES ('version', ?)",
            (str(version),),
        )
        conn.commit()


def check_migrations():
    """Run any pending migrations."""
    current = get_schema_version()
    if current < SCHEMA_VERSION:
        log.info(f"Database migration needed: v{current} -> v{SCHEMA_VERSION}")
        _run_migrations(current)
        set_schema_version(SCHEMA_VERSION)
        log.info(f"Database migrated to v{SCHEMA_VERSION}")
    else:
        log.info(f"Database schema v{current} is current")


def _run_migrations(from_version):
    """Apply sequential migrations."""
    conn = get_connection()

    if from_version < 1:
        # v1: Initial schema — entities, relationships, events, missions,
        # mission_entities, mission_notes.
        # These are created by EntityStore and MissionStore _init_tables,
        # so nothing extra to do here for existing databases.
        log.info("Migration v1: initial schema (handled by stores)")

    if from_version < 2:
        # v2: Add users table for auth + schema_meta tracking
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'analyst',
            created_at TEXT
        )""")
        conn.commit()
        log.info("Migration v2: users table created")
