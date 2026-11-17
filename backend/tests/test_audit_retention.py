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


def test_bad_value_keeps_everything():
    with patch.dict(os.environ, {"SKYDASH_AUDIT_RETENTION_DAYS": "abc"}):
        assert audit.retention_days() == 0.0
