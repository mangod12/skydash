import os
import tempfile
import time
from unittest.mock import patch

import audit
import database


def _fresh():
    database.reset(os.path.join(tempfile.mkdtemp(prefix="skydash-ret-"), "t.db"))
    audit._ensure_table()


def _count():
    return database.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]


def test_purge_disabled_by_default():
    _fresh()
    audit.record("POST", "/api/x", 200)
    database.execute("UPDATE audit_log SET ts = ?", (time.time() - 400 * 86400,), commit=True)
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("SKYDASH_AUDIT_RETENTION_DAYS", None)
        assert audit.purge_old() == 0
    assert _count() == 1


def test_purge_removes_only_old_rows():
    _fresh()
    audit.record("POST", "/api/old", 200)
    database.execute("UPDATE audit_log SET ts = ?", (time.time() - 40 * 86400,), commit=True)
    audit.record("POST", "/api/new", 200)
    with patch.dict(os.environ, {"SKYDASH_AUDIT_RETENTION_DAYS": "30"}):
        assert audit.purge_old() == 1
    paths = [r[0] for r in database.execute("SELECT path FROM audit_log").fetchall()]
    assert paths == ["/api/new"]


def test_cleanup_failure_does_not_drop_current_audit_event():
    _fresh()
    with patch.object(audit, "_last_purge", 0.0), \
            patch.object(audit, "purge_old", side_effect=RuntimeError("cleanup unavailable")) as cleanup:
        audit.record("POST", "/api/entities", 201, {"username": "analyst", "role": "analyst"})
        audit.record("DELETE", "/api/entities/example", 403, {"username": "viewer", "role": "viewer"})
        cleanup.assert_called_once()
    rows = database.execute("SELECT path, status, username FROM audit_log ORDER BY id").fetchall()
    assert [tuple(row) for row in rows] == [
        ("/api/entities", 201, "analyst"),
        ("/api/entities/example", 403, "viewer"),
    ]


def test_bad_value_keeps_everything():
    with patch.dict(os.environ, {"SKYDASH_AUDIT_RETENTION_DAYS": "abc"}):
        assert audit.retention_days() == 0.0


def test_audit_setup_waits_for_existing_writer():
    import threading
    from concurrent.futures import ThreadPoolExecutor

    _fresh()
    started = threading.Event()
    finished = threading.Event()

    def setup():
        started.set()
        try:
            audit._ensure_table()
        finally:
            finished.set()

    with ThreadPoolExecutor(max_workers=1) as executor:
        with database.get_lock():
            future = executor.submit(setup)
            assert started.wait(2)
            finished_early = finished.wait(0.1)
        future.result(timeout=2)
    assert not finished_early


def test_failed_audit_insert_cannot_be_committed_by_next_record():
    _fresh()
    conn = database.get_connection()
    conn.execute("""CREATE TRIGGER reject_audit_insert AFTER INSERT ON audit_log
                    BEGIN SELECT RAISE(FAIL, 'synthetic failure'); END""")
    conn.commit()
    audit.record("POST", "/failed", 500)
    assert not conn.in_transaction
    conn.execute("DROP TRIGGER reject_audit_insert")
    conn.commit()
    audit.record("POST", "/successful", 201)
    assert [row[0] for row in conn.execute("SELECT path FROM audit_log")] == ["/successful"]
