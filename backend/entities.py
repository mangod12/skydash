"""In-memory entity store for OSINT intelligence data."""
import time
import uuid
from typing import Dict, List, Optional


class EntityStore:
    def __init__(self):
        self.entities: Dict[str, Dict] = {}
        self.relationships: List[Dict] = []
        self.events: List[Dict] = []
        self._seed()

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
        for s in seeds:
            eid = str(uuid.uuid4())[:8]
            self.entities[eid] = {
                "id": eid, **s,
                "firstSeen": now - 3600, "lastSeen": now,
            }

        ids = list(self.entities.keys())
        if len(ids) >= 3:
            self.relationships.append({"from": ids[0], "to": ids[2], "type": "located_at", "confidence": 88})
            self.relationships.append({"from": ids[1], "to": ids[0], "type": "associated_with", "confidence": 55})

    def list_entities(self, entity_type: Optional[str] = None, threat: Optional[str] = None) -> List[Dict]:
        result = list(self.entities.values())
        if entity_type:
            result = [e for e in result if e.get("type") == entity_type]
        if threat:
            result = [e for e in result if e.get("threatLevel") == threat]
        return result

    def get_entity(self, entity_id: str) -> Optional[Dict]:
        return self.entities.get(entity_id)

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
            "firstSeen": now,
            "lastSeen": now,
        }
        self.entities[eid] = entity
        self.events.append({
            "id": str(uuid.uuid4())[:8],
            "time": now,
            "type": "detection",
            "description": f"Entity created: {entity['name']}",
            "entityId": eid,
            "severity": "info",
        })
        return entity

    def update_entity(self, entity_id: str, data: Dict) -> Optional[Dict]:
        if entity_id not in self.entities:
            return None
        self.entities[entity_id].update(data)
        self.entities[entity_id]["lastSeen"] = time.time()
        return self.entities[entity_id]

    def delete_entity(self, entity_id: str) -> bool:
        if entity_id in self.entities:
            del self.entities[entity_id]
            self.relationships = [
                r for r in self.relationships
                if r["from"] != entity_id and r["to"] != entity_id
            ]
            return True
        return False

    def add_relationship(self, from_id: str, to_id: str, rel_type: str, confidence: int = 50) -> Dict:
        rel = {
            "from": from_id, "to": to_id,
            "type": rel_type, "confidence": confidence,
        }
        self.relationships.append(rel)
        return rel

    def get_entity_graph(self, entity_id: str) -> Dict:
        related_rels = [
            r for r in self.relationships
            if r["from"] == entity_id or r["to"] == entity_id
        ]
        related_ids = set()
        for r in related_rels:
            related_ids.add(r["from"])
            related_ids.add(r["to"])
        nodes = [self.entities[eid] for eid in related_ids if eid in self.entities]
        return {"nodes": nodes, "edges": related_rels}

    def get_timeline(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        sorted_events = sorted(self.events, key=lambda e: e["time"], reverse=True)
        return sorted_events[offset:offset + limit]

    def add_event(self, event: Dict) -> Dict:
        eid = str(uuid.uuid4())[:8]
        evt = {"id": eid, "time": time.time(), **event}
        self.events.append(evt)
        return evt
