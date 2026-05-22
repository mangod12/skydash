"""SQLite-backed mission store for operational mission management.
Missions group entities, notes, and map context for coordinated operations."""
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

DB_PATH = "skydash.db"


class MissionStore:
    def __init__(self, db_path: str = DB_PATH):
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_tables()

    def _init_tables(self):
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS missions (
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
            );
            CREATE TABLE IF NOT EXISTS mission_entities (
                mission_id TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                PRIMARY KEY (mission_id, entity_id),
                FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS mission_notes (
                id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
            );
        """)
        self.db.commit()

    # ─── Helpers ──────────────────────────────────────────────

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _new_id() -> str:
        return str(uuid.uuid4())[:8]

    def _row_to_mission(self, row) -> Dict:
        d = dict(row)
        d["tags"] = json.loads(d["tags"])
        return d

    def _row_to_note(self, row) -> Dict:
        return dict(row)

    def count(self) -> int:
        return self.db.execute("SELECT COUNT(*) FROM missions").fetchone()[0]

    # ─── Mission CRUD ─────────────────────────────────────────

    def create_mission(self, data: dict) -> dict:
        mid = self._new_id()
        now = self._now_iso()
        mission = {
            "id": mid,
            "name": data.get("name", "Untitled Mission"),
            "description": data.get("description", ""),
            "status": data.get("status", "active"),
            "created_at": now,
            "updated_at": now,
            "center_lat": data.get("center_lat"),
            "center_lng": data.get("center_lng"),
            "zoom_level": data.get("zoom_level"),
            "tags": data.get("tags", []),
        }
        self.db.execute(
            "INSERT INTO missions (id, name, description, status, created_at, updated_at, center_lat, center_lng, zoom_level, tags) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (mid, mission["name"], mission["description"], mission["status"],
             mission["created_at"], mission["updated_at"],
             mission["center_lat"], mission["center_lng"],
             mission["zoom_level"], json.dumps(mission["tags"])),
        )
        self.db.commit()
        return mission

    def get_mission(self, mission_id: str) -> Optional[dict]:
        row = self.db.execute(
            "SELECT * FROM missions WHERE id = ?", (mission_id,)
        ).fetchone()
        return self._row_to_mission(row) if row else None

    def list_missions(self, status: Optional[str] = None) -> list:
        if status:
            rows = self.db.execute(
                "SELECT * FROM missions WHERE status = ? ORDER BY updated_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = self.db.execute(
                "SELECT * FROM missions ORDER BY updated_at DESC"
            ).fetchall()
        return [self._row_to_mission(r) for r in rows]

    def update_mission(self, mission_id: str, data: dict) -> Optional[dict]:
        existing = self.get_mission(mission_id)
        if not existing:
            return None

        updatable = ["name", "description", "status", "center_lat", "center_lng", "zoom_level", "tags"]
        for key in updatable:
            if key in data:
                existing[key] = data[key]
        existing["updated_at"] = self._now_iso()

        self.db.execute(
            "UPDATE missions SET name=?, description=?, status=?, updated_at=?, center_lat=?, center_lng=?, zoom_level=?, tags=? WHERE id=?",
            (existing["name"], existing["description"], existing["status"],
             existing["updated_at"], existing["center_lat"], existing["center_lng"],
             existing["zoom_level"], json.dumps(existing["tags"]), mission_id),
        )
        self.db.commit()
        return existing

    def delete_mission(self, mission_id: str) -> bool:
        if not self.get_mission(mission_id):
            return False
        self.db.execute("DELETE FROM mission_notes WHERE mission_id = ?", (mission_id,))
        self.db.execute("DELETE FROM mission_entities WHERE mission_id = ?", (mission_id,))
        self.db.execute("DELETE FROM missions WHERE id = ?", (mission_id,))
        self.db.commit()
        return True

    # ─── Mission-Entity Junction ──────────────────────────────

    def add_entity_to_mission(self, mission_id: str, entity_id: str) -> bool:
        if not self.get_mission(mission_id):
            return False
        try:
            self.db.execute(
                "INSERT INTO mission_entities (mission_id, entity_id) VALUES (?,?)",
                (mission_id, entity_id),
            )
            self.db.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (self._now_iso(), mission_id),
            )
            self.db.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def remove_entity_from_mission(self, mission_id: str, entity_id: str) -> bool:
        cursor = self.db.execute(
            "DELETE FROM mission_entities WHERE mission_id = ? AND entity_id = ?",
            (mission_id, entity_id),
        )
        if cursor.rowcount == 0:
            return False
        self.db.execute(
            "UPDATE missions SET updated_at = ? WHERE id = ?",
            (self._now_iso(), mission_id),
        )
        self.db.commit()
        return True

    def get_mission_entities(self, mission_id: str) -> list:
        rows = self.db.execute(
            "SELECT entity_id FROM mission_entities WHERE mission_id = ?",
            (mission_id,),
        ).fetchall()
        return [r["entity_id"] for r in rows]

    # ─── Mission Notes ────────────────────────────────────────

    def add_note(self, mission_id: str, content: str) -> Optional[dict]:
        if not self.get_mission(mission_id):
            return None
        nid = self._new_id()
        now = self._now_iso()
        self.db.execute(
            "INSERT INTO mission_notes (id, mission_id, content, created_at) VALUES (?,?,?,?)",
            (nid, mission_id, content, now),
        )
        self.db.execute(
            "UPDATE missions SET updated_at = ? WHERE id = ?",
            (now, mission_id),
        )
        self.db.commit()
        return {"id": nid, "mission_id": mission_id, "content": content, "created_at": now}

    def get_notes(self, mission_id: str) -> list:
        rows = self.db.execute(
            "SELECT * FROM mission_notes WHERE mission_id = ? ORDER BY created_at DESC",
            (mission_id,),
        ).fetchall()
        return [self._row_to_note(r) for r in rows]

    def delete_note(self, note_id: str) -> bool:
        row = self.db.execute(
            "SELECT mission_id FROM mission_notes WHERE id = ?", (note_id,)
        ).fetchone()
        if not row:
            return False
        mission_id = row["mission_id"]
        self.db.execute("DELETE FROM mission_notes WHERE id = ?", (note_id,))
        self.db.execute(
            "UPDATE missions SET updated_at = ? WHERE id = ?",
            (self._now_iso(), mission_id),
        )
        self.db.commit()
        return True
