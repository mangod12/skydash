import os
import secrets
import shutil
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import auth
import database
import main
from deps import entity_store, mission_store
from routes import auth_routes, telemetry


class TestWsRecheck(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="skydash-ws-")
        database.reset(os.path.join(self.tmpdir, "skydash.db"))
        entity_store._init_tables()
        mission_store._init_tables()
        self.users = auth.UserStore()
        uid = self.users.create_user("ws-user", "tide-Harbor-" + secrets.token_hex(3), "viewer")
        self.token = auth.create_token(self.users.get_user(uid))
        self.patches = [
            patch.object(telemetry, "AUTH_ENABLED", True),
            patch.object(main, "AUTH_ENABLED", True),
            patch.object(main, "API_KEY", ""),
            patch.object(auth_routes, "AUTH_ENABLED", True),
            patch.object(telemetry, "WS_RECHECK_SECONDS", 0.0),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        database.reset()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_revoked_token_ends_stream(self):
        with self.client.websocket_connect(f"/ws/telemetry?token={self.token}") as ws:
            self.assertEqual(ws.receive_json()["type"], "telemetry")
            auth.revoke_token(auth.verify_token(self.token))
            with self.assertRaises(WebSocketDisconnect) as cm:
                for _ in range(20):
                    ws.receive_json()
            self.assertEqual(cm.exception.code, 4001)

    def test_no_token_rejected(self):
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect("/ws/telemetry") as ws:
                ws.receive_json()


class TestWsTicket(TestWsRecheck):
    def test_ticket_connects_once(self):
        r = self.client.post(
            "/api/auth/ws-ticket", headers={"Authorization": f"Bearer {self.token}"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        ticket = r.json()["data"]["ticket"]
        with self.client.websocket_connect(f"/ws/telemetry?ticket={ticket}") as ws:
            self.assertEqual(ws.receive_json()["type"], "telemetry")
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect(f"/ws/telemetry?ticket={ticket}") as ws:
                ws.receive_json()

    def test_ticket_needs_auth(self):
        self.assertEqual(self.client.post("/api/auth/ws-ticket").status_code, 401)
