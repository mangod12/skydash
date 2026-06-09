"""SQLite-backed mission store for operational mission management.
Missions group entities, notes, and map context for coordinated operations."""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

import database as db


def _safe_json_loads(value, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


class MissionStore:
    def __init__(self):
        self._init_tables()

    def _init_tables(self):
        conn = db.get_connection()
        conn.executescript("""
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
            CREATE TABLE IF NOT EXISTS mission_detections (
                id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                source_name TEXT NOT NULL,
                model TEXT NOT NULL,
                summary TEXT NOT NULL,
                detections TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
            );
        """)
        conn.commit()

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

    def _row_to_detection(self, row) -> Dict:
        detection = dict(row)
        detection["summary"] = _safe_json_loads(detection["summary"], {})
        detection["detections"] = _safe_json_loads(detection["detections"], [])
        return detection

    def count(self) -> int:
        return db.get_connection().execute(
            "SELECT COUNT(*) FROM missions"
        ).fetchone()[0]

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
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO missions (id, name, description, status, created_at, updated_at, center_lat, center_lng, zoom_level, tags) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (mid, mission["name"], mission["description"], mission["status"],
                 mission["created_at"], mission["updated_at"],
                 mission["center_lat"], mission["center_lng"],
                 mission["zoom_level"], json.dumps(mission["tags"])),
            )
            conn.commit()
        return mission

    def get_mission(self, mission_id: str) -> Optional[dict]:
        row = db.get_connection().execute(
            "SELECT * FROM missions WHERE id = ?", (mission_id,)
        ).fetchone()
        return self._row_to_mission(row) if row else None

    def list_missions(self, status: Optional[str] = None) -> list:
        conn = db.get_connection()
        if status:
            rows = conn.execute(
                "SELECT * FROM missions WHERE status = ? ORDER BY updated_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
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

        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "UPDATE missions SET name=?, description=?, status=?, updated_at=?, center_lat=?, center_lng=?, zoom_level=?, tags=? WHERE id=?",
                (existing["name"], existing["description"], existing["status"],
                 existing["updated_at"], existing["center_lat"], existing["center_lng"],
                 existing["zoom_level"], json.dumps(existing["tags"]), mission_id),
            )
            conn.commit()
        return existing

    def delete_mission(self, mission_id: str) -> bool:
        if not self.get_mission(mission_id):
            return False
        conn = db.get_connection()
        with db.get_lock():
            conn.execute("DELETE FROM mission_notes WHERE mission_id = ?", (mission_id,))
            conn.execute("DELETE FROM mission_entities WHERE mission_id = ?", (mission_id,))
            conn.execute("DELETE FROM mission_detections WHERE mission_id = ?", (mission_id,))
            conn.execute("DELETE FROM missions WHERE id = ?", (mission_id,))
            conn.commit()
        return True

    # ─── Mission-Entity Junction ──────────────────────────────

    def add_entity_to_mission(self, mission_id: str, entity_id: str) -> bool:
        if not self.get_mission(mission_id):
            return False
        conn = db.get_connection()
        try:
            with db.get_lock():
                conn.execute(
                    "INSERT INTO mission_entities (mission_id, entity_id) VALUES (?,?)",
                    (mission_id, entity_id),
                )
                conn.execute(
                    "UPDATE missions SET updated_at = ? WHERE id = ?",
                    (self._now_iso(), mission_id),
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def remove_entity_from_mission(self, mission_id: str, entity_id: str) -> bool:
        conn = db.get_connection()
        with db.get_lock():
            cursor = conn.execute(
                "DELETE FROM mission_entities WHERE mission_id = ? AND entity_id = ?",
                (mission_id, entity_id),
            )
            if cursor.rowcount == 0:
                return False
            conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (self._now_iso(), mission_id),
            )
            conn.commit()
        return True

    def get_mission_entities(self, mission_id: str) -> list:
        rows = db.get_connection().execute(
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
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO mission_notes (id, mission_id, content, created_at) VALUES (?,?,?,?)",
                (nid, mission_id, content, now),
            )
            conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (now, mission_id),
            )
            conn.commit()
        return {"id": nid, "mission_id": mission_id, "content": content, "created_at": now}

    def get_notes(self, mission_id: str) -> list:
        rows = db.get_connection().execute(
            "SELECT * FROM mission_notes WHERE mission_id = ? ORDER BY created_at DESC",
            (mission_id,),
        ).fetchall()
        return [self._row_to_note(r) for r in rows]

    def delete_note(self, note_id: str) -> bool:
        conn = db.get_connection()
        row = conn.execute(
            "SELECT mission_id FROM mission_notes WHERE id = ?", (note_id,)
        ).fetchone()
        if not row:
            return False
        mission_id = row["mission_id"]
        with db.get_lock():
            conn.execute("DELETE FROM mission_notes WHERE id = ?", (note_id,))
            conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (self._now_iso(), mission_id),
            )
            conn.commit()
        return True

    # Mission detections

    def add_detection(self, mission_id: str, result: dict) -> Optional[dict]:
        if not self.get_mission(mission_id):
            return None

        detection_id = self._new_id()
        now = self._now_iso()
        source_name = result.get("source_name") or "uploaded-frame"
        model = result.get("model") or "unknown"
        summary = result.get("summary") or {}
        detections = result.get("detections") or []

        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                """
                INSERT INTO mission_detections
                    (id, mission_id, source_name, model, summary, detections, created_at)
                VALUES (?,?,?,?,?,?,?)
                """,
                (
                    detection_id,
                    mission_id,
                    source_name,
                    model,
                    json.dumps(summary),
                    json.dumps(detections),
                    now,
                ),
            )
            conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (now, mission_id),
            )
            conn.commit()

        return {
            "id": detection_id,
            "mission_id": mission_id,
            "source_name": source_name,
            "model": model,
            "summary": summary,
            "detections": detections,
            "created_at": now,
        }

    def get_detections(self, mission_id: str) -> list:
        rows = db.get_connection().execute(
            "SELECT * FROM mission_detections WHERE mission_id = ? ORDER BY created_at DESC",
            (mission_id,),
        ).fetchall()
        return [self._row_to_detection(row) for row in rows]

    def delete_detection(self, detection_id: str, mission_id: Optional[str] = None) -> bool:
        conn = db.get_connection()
        row = conn.execute(
            "SELECT mission_id FROM mission_detections WHERE id = ?", (detection_id,)
        ).fetchone()
        if not row:
            return False
        stored_mission_id = row["mission_id"]
        if mission_id and mission_id != stored_mission_id:
            return False
        with db.get_lock():
            conn.execute("DELETE FROM mission_detections WHERE id = ?", (detection_id,))
            conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (self._now_iso(), stored_mission_id),
            )
            conn.commit()
        return True
