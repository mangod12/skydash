import os
import shutil
import tempfile
import unittest

import database


class TestDatabaseMigrations(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-migrations-")
        self.db_path = os.path.join(self.tmpdir, "skydash.db")
        database.reset(self.db_path)
        conn = database.get_connection()
        conn.execute("DROP TABLE IF EXISTS schema_meta")
        conn.execute(
            "CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT)"
        )
        conn.execute(
            "INSERT INTO schema_meta (key, value) VALUES ('version', '2')"
        )
        conn.execute(
            """CREATE TABLE missions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                center_lat REAL,
                center_lng REAL,
                zoom_level INTEGER,
                tags TEXT DEFAULT '[]'
            )"""
        )
        conn.commit()

    def tearDown(self):
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_v3_migration_adds_mission_detections_table(self):
        database.check_migrations()
        conn = database.get_connection()
        migration_version = conn.execute(
            "SELECT value FROM schema_meta WHERE key='version'"
        ).fetchone()[0]
        self.assertEqual(migration_version, str(database.SCHEMA_VERSION))

        table_row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='mission_detections'"
        ).fetchone()
        self.assertIsNotNone(table_row, "mission_detections table missing after migration")

        indexes = conn.execute(
            """
            SELECT name FROM sqlite_master
            WHERE type='index'
            AND name IN ('idx_mission_detections_mission_id', 'idx_mission_detections_created_at')
            """
        ).fetchall()
        self.assertGreaterEqual(len(indexes), 2, "mission_detections indexes missing")


if __name__ == "__main__":
    unittest.main()
