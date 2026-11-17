import os
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys

import pytest

from scripts.backup_db import backup_database


def test_backup_captures_committed_wal_not_uncommitted_writes(tmp_path):
    source = tmp_path / "source.db"
    backup = tmp_path / "backup.db"
    connection = sqlite3.connect(source)
    try:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA wal_autocheckpoint=0")
        connection.execute("CREATE TABLE notes (content TEXT)")
        connection.execute("INSERT INTO notes VALUES ('committed')")
        connection.commit()
        assert Path(str(source) + "-wal").stat().st_size > 0
        connection.execute("INSERT INTO notes VALUES ('not committed')")
        backup_database(source, backup)
        with sqlite3.connect(backup) as snapshot:
            assert snapshot.execute("SELECT content FROM notes").fetchall() == [("committed",)]
            assert snapshot.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert snapshot.execute("PRAGMA journal_mode").fetchone()[0] == "delete"
        assert stat.S_IMODE(backup.stat().st_mode) == 0o600
        connection.rollback()
        connection.execute("INSERT INTO notes VALUES ('after snapshot')")
        connection.commit()
        with sqlite3.connect(backup) as snapshot:
            assert snapshot.execute("SELECT count(*) FROM notes").fetchone()[0] == 1
    finally:
        connection.close()


def test_backup_refuses_existing_destinations_and_source_aliases(tmp_path):
    source = tmp_path / "source.db"
    with sqlite3.connect(source) as connection:
        connection.execute("CREATE TABLE notes (content TEXT)")
    existing = tmp_path / "existing.db"
    existing.write_bytes(b"keep this")
    alias = tmp_path / "alias.db"
    alias.symlink_to(source)
    for destination in (existing, source, alias):
        with pytest.raises(FileExistsError):
            backup_database(source, destination)
    assert existing.read_bytes() == b"keep this"
    with sqlite3.connect(source) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"


def test_missing_or_invalid_source_leaves_no_backup(tmp_path):
    source = tmp_path / "source.db"
    destination = tmp_path / "backup.db"
    with pytest.raises(FileNotFoundError):
        backup_database(source, destination)
    assert not source.exists() and not destination.exists()
    source.write_bytes(b"not a sqlite database")
    with pytest.raises(sqlite3.DatabaseError):
        backup_database(source, destination)
    assert not destination.exists()
    assert source.read_bytes() == b"not a sqlite database"


def test_backup_cli_uses_configured_source(tmp_path):
    source = tmp_path / "source.db"
    destination = tmp_path / "backup.db"
    with sqlite3.connect(source) as connection:
        connection.execute("CREATE TABLE notes (content TEXT)")
    command = [sys.executable, "scripts/backup_db.py", str(destination)]
    result = subprocess.run(command, env={**os.environ, "SKYDASH_DB_PATH": str(source)}, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "Verified backup saved" in result.stdout
    repeat = subprocess.run(command, env={**os.environ, "SKYDASH_DB_PATH": str(source)}, capture_output=True, text=True)
    assert repeat.returncode == 1
    assert "Backup failed" in repeat.stderr
