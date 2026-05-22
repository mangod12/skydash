"""SQLite-backed entity store for OSINT intelligence data.
Entities, relationships, and events persist across restarts."""
import json
import time
import uuid
from typing import Dict, List, Optional

import database as db


class EntityStore:
    def __init__(self):
        self._init_tables()
        if self._count("entities") == 0:
            self._seed()

    def _init_tables(self):
        conn = db.get_connection()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                coordinates TEXT,
                properties TEXT DEFAULT '{}',
                confidence INTEGER DEFAULT 50,
                source TEXT DEFAULT 'Manual',
                tags TEXT DEFAULT '[]',
                threatLevel TEXT DEFAULT 'none',
                firstSeen REAL,
                lastSeen REAL
            );
            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_entity TEXT NOT NULL,
                to_entity TEXT NOT NULL,
                type TEXT NOT NULL,
                confidence INTEGER DEFAULT 50,
                FOREIGN KEY (from_entity) REFERENCES entities(id),
                FOREIGN KEY (to_entity) REFERENCES entities(id)
            );
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                time REAL NOT NULL,
                type TEXT,
                description TEXT,
                entityId TEXT,
                severity TEXT DEFAULT 'info',
                FOREIGN KEY (entityId) REFERENCES entities(id)
            );
        """)
        conn.commit()

    _VALID_TABLES = {"entities", "relationships", "events"}

    def _count(self, table: str) -> int:
        if table not in self._VALID_TABLES:
            raise ValueError(f"Invalid table: {table}")
        return db.get_connection().execute(
            f"SELECT COUNT(*) FROM {table}"
        ).fetchone()[0]

    def _row_to_entity(self, row) -> Dict:
        d = dict(row)
        d["coordinates"] = json.loads(d["coordinates"]) if d["coordinates"] else None
        d["properties"] = json.loads(d["properties"])
        d["tags"] = json.loads(d["tags"])
        return d

    def _row_to_rel(self, row) -> Dict:
        d = dict(row)
        return {"from": d["from_entity"], "to": d["to_entity"], "type": d["type"], "confidence": d["confidence"]}

    def _row_to_event(self, row) -> Dict:
        return dict(row)

    def _seed(self):
        seeds = [
            {"type": "vehicle", "name": "SUV-Black-4892", "coordinates": [37.7755, -122.4190],
             "properties": {"plate": "4XBC892", "color": "Black", "make": "Toyota Land Cruiser"},
             "confidence": 82, "source": "Visual Detection", "tags": ["suspicious"], "threatLevel": "medium"},
            {"type": "person", "name": "Alpha-7", "coordinates": [37.7745, -122.4200],
             "properties": {"description": "Male, dark jacket", "height": "~180cm"},
             "confidence": 65, "source": "Drone Camera", "tags": ["poi"], "threatLevel": "low"},
            {"type": "building", "name": "Warehouse District B", "coordinates": [37.7760, -122.4185],
             "properties": {"address": "451 Industrial Blvd", "floors": 2, "status": "Abandoned"},
             "confidence": 95, "source": "GIS Database", "tags": ["location-of-interest"], "threatLevel": "high"},
        ]
        now = time.time()
        ids = []
        for s in seeds:
            e = self.create_entity({**s, "firstSeen": now - 3600, "lastSeen": now})
            ids.append(e["id"])

        if len(ids) >= 3:
            self.add_relationship(ids[0], ids[2], "located_at", 88)
            self.add_relationship(ids[1], ids[0], "associated_with", 55)

    # ─── CRUD ────────────────────────────────────────────────

    @property
    def entities(self) -> Dict[str, Dict]:
        """Compat property for health endpoint."""
        rows = db.get_connection().execute("SELECT * FROM entities").fetchall()
        return {r["id"]: self._row_to_entity(r) for r in rows}

    def list_entities(self, entity_type: Optional[str] = None, threat: Optional[str] = None) -> List[Dict]:
        q = "SELECT * FROM entities WHERE 1=1"
        params = []
        if entity_type:
            q += " AND type = ?"
            params.append(entity_type)
        if threat:
            q += " AND threatLevel = ?"
            params.append(threat)
        return [self._row_to_entity(r) for r in db.get_connection().execute(q, params).fetchall()]

    def get_entity(self, entity_id: str) -> Optional[Dict]:
        row = db.get_connection().execute(
            "SELECT * FROM entities WHERE id = ?", (entity_id,)
        ).fetchone()
        return self._row_to_entity(row) if row else None

    def create_entity(self, data: Dict) -> Dict:
        eid = str(uuid.uuid4())[:8]
        now = time.time()
        entity = {
            "id": eid,
            "type": data.get("type", "event"),
            "name": data.get("name", "Unknown"),
            "coordinates": data.get("coordinates"),
            "properties": data.get("properties", {}),
            "confidence": data.get("confidence", 50),
            "source": data.get("source", "Manual"),
            "tags": data.get("tags", []),
            "threatLevel": data.get("threatLevel", "none"),
            "firstSeen": data.get("firstSeen", now),
            "lastSeen": data.get("lastSeen", now),
        }
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO entities (id, type, name, coordinates, properties, confidence, source, tags, threatLevel, firstSeen, lastSeen) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (eid, entity["type"], entity["name"], json.dumps(entity["coordinates"]),
                 json.dumps(entity["properties"]), entity["confidence"], entity["source"],
                 json.dumps(entity["tags"]), entity["threatLevel"], entity["firstSeen"], entity["lastSeen"]),
            )
            self.add_event({"type": "detection", "description": f"Entity created: {entity['name']}", "entityId": eid, "severity": "info"})
            conn.commit()
        return entity

    _MUTABLE_FIELDS = {"type", "name", "coordinates", "properties", "confidence", "source", "tags", "threatLevel"}

    def update_entity(self, entity_id: str, data: Dict) -> Optional[Dict]:
        existing = self.get_entity(entity_id)
        if not existing:
            return None
        safe_data = {k: v for k, v in data.items() if k in self._MUTABLE_FIELDS}
        existing.update(safe_data)
        existing["lastSeen"] = time.time()
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "UPDATE entities SET type=?, name=?, coordinates=?, properties=?, confidence=?, source=?, tags=?, threatLevel=?, lastSeen=? WHERE id=?",
                (existing["type"], existing["name"], json.dumps(existing["coordinates"]),
                 json.dumps(existing["properties"]), existing["confidence"], existing["source"],
                 json.dumps(existing["tags"]), existing["threatLevel"], existing["lastSeen"], entity_id),
            )
            conn.commit()
        return existing

    def delete_entity(self, entity_id: str) -> bool:
        if not self.get_entity(entity_id):
            return False
        conn = db.get_connection()
        with db.get_lock():
            conn.execute("DELETE FROM relationships WHERE from_entity = ? OR to_entity = ?", (entity_id, entity_id))
            conn.execute("DELETE FROM events WHERE entityId = ?", (entity_id,))
            conn.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
            conn.commit()
        return True

    # ─── Relationships ───────────────────────────────────────

    @property
    def relationships(self) -> List[Dict]:
        return [self._row_to_rel(r) for r in db.get_connection().execute("SELECT * FROM relationships").fetchall()]

    def add_relationship(self, from_id: str, to_id: str, rel_type: str, confidence: int = 50) -> Dict:
        conn = db.get_connection()
        with db.get_lock():
            conn.execute(
                "INSERT INTO relationships (from_entity, to_entity, type, confidence) VALUES (?,?,?,?)",
                (from_id, to_id, rel_type, confidence),
            )
            conn.commit()
        return {"from": from_id, "to": to_id, "type": rel_type, "confidence": confidence}

    def get_entity_graph(self, entity_id: str) -> Dict:
        rels = db.get_connection().execute(
            "SELECT * FROM relationships WHERE from_entity = ? OR to_entity = ?",
            (entity_id, entity_id),
        ).fetchall()
        related_rels = [self._row_to_rel(r) for r in rels]
        related_ids = set()
        for r in related_rels:
            related_ids.add(r["from"])
            related_ids.add(r["to"])
        nodes = [self.get_entity(eid) for eid in related_ids]
        nodes = [n for n in nodes if n]
        return {"nodes": nodes, "edges": related_rels}

    # ─── Events ──────────────────────────────────────────────

    def get_timeline(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        rows = db.get_connection().execute(
            "SELECT * FROM events ORDER BY time DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def add_event(self, event: Dict) -> Dict:
        eid = str(uuid.uuid4())[:8]
        now = time.time()
        conn = db.get_connection()
        conn.execute(
            "INSERT INTO events (id, time, type, description, entityId, severity) VALUES (?,?,?,?,?,?)",
            (eid, now, event.get("type"), event.get("description"), event.get("entityId"), event.get("severity", "info")),
        )
        conn.commit()
        return {"id": eid, "time": now, **event}
