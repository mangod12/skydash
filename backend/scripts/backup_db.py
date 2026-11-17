"""Create a consistent SQLite snapshot, including committed WAL data.

This module never imports the app or seeds/modifies the source database.
"""

import argparse
import contextlib
import os
from pathlib import Path
import sqlite3
import sys


def backup_database(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).absolute()
    if not source.is_file():
        raise ValueError("Source must be a database file")
    # O_EXCL also rejects source aliases, existing backups and dangling symlinks.
    # Create with private permissions before SQLite opens the file.
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        with contextlib.closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as original:
            with contextlib.closing(sqlite3.connect(destination)) as snapshot:
                original.backup(snapshot, pages=256)
                result = snapshot.execute("PRAGMA integrity_check").fetchall()
                if result != [("ok",)]:
                    raise ValueError("Snapshot failed SQLite integrity check")
                # Make the finished snapshot self-contained, with no WAL sidecar.
                snapshot.execute("PRAGMA journal_mode=DELETE")
        with destination.open("rb") as completed:
            os.fsync(completed.fileno())
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", help="New private backup file; must not exist")
    parser.add_argument("--source", default=os.getenv("SKYDASH_DB_PATH", "skydash.db"))
    args = parser.parse_args(argv)
    try:
        result = backup_database(args.source, args.destination)
    except (OSError, sqlite3.Error, ValueError) as exc:
        print(f"Backup failed: {exc}", file=sys.stderr)
        return 1
    print(f"Verified backup saved: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
