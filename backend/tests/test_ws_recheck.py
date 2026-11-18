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
    def setUp(self):
        super().setUp()
        auth._ws_tickets.clear()
        self.addCleanup(auth._ws_tickets.clear)

    def test_ticket_capacity_returns_429_without_invalidating_existing(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        with patch.object(auth, "WS_MAX_PENDING_TICKETS", 1):
            first = self.client.post("/api/auth/ws-ticket", headers=headers)
            ticket = first.json()["data"]["ticket"]
            second = self.client.post("/api/auth/ws-ticket", headers=headers)
            self.assertEqual(second.status_code, 429)
            self.assertEqual(second.headers["retry-after"], "30")
            self.assertEqual(len(auth._ws_tickets), 1)
            self.assertEqual(auth.redeem_ws_ticket(ticket), self.token)
            self.assertEqual(self.client.post("/api/auth/ws-ticket", headers=headers).status_code, 200)

    def test_expired_tickets_free_capacity_at_deadline(self):
        with patch.object(auth, "WS_MAX_PENDING_TICKETS", 1), \
                patch.object(auth.time, "monotonic", return_value=100.0):
            first = auth.issue_ws_ticket(self.token)
            self.assertIsNone(auth.issue_ws_ticket(self.token))
        with patch.object(auth, "WS_MAX_PENDING_TICKETS", 1), \
                patch.object(auth.time, "monotonic", return_value=130.0):
            replacement = auth.issue_ws_ticket(self.token)
            self.assertIsNotNone(replacement)
            self.assertNotIn(first, auth._ws_tickets)
            self.assertEqual(auth.redeem_ws_ticket(replacement), self.token)

    def test_ticket_cannot_be_redeemed_at_expiry(self):
        with patch.object(auth.time, "monotonic", return_value=100.0):
            ticket = auth.issue_ws_ticket(self.token)
        with patch.object(auth.time, "monotonic", return_value=130.0):
            self.assertIsNone(auth.redeem_ws_ticket(ticket))
        self.assertNotIn(ticket, auth._ws_tickets)

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


class TestWsVerificationEventLoop(unittest.TestCase):
    def test_initial_and_periodic_verification_leave_event_loop_responsive(self):
        import asyncio
        import threading
        from unittest.mock import AsyncMock

        for held_call in (1, 2):
            entered, release, finished = threading.Event(), threading.Event(), threading.Event()
            calls = []
            def verify(*args):
                calls.append(args)
                if len(calls) == held_call:
                    entered.set()
                    try:
                        release.wait(2)
                        return None
                    finally:
                        finished.set()
                return {'sub': 'fixture', 'role': 'viewer'}
            async def exercise():
                socket = AsyncMock()
                socket.query_params = {'token': 'fixture'}
                pending = asyncio.create_task(telemetry.ws_telemetry(socket))
                try:
                    self.assertTrue(await asyncio.to_thread(entered.wait, 1))
                    self.assertFalse(finished.is_set(), 'Socket verification blocked event loop')
                finally:
                    release.set()
                    await pending
                socket.close.assert_awaited_once()
                self.assertEqual(socket.close.call_args.kwargs['code'], 4001)
            with self.subTest(held_call=held_call), patch.object(telemetry, 'AUTH_ENABLED', True), \
                    patch.object(telemetry, 'WS_RECHECK_SECONDS', 0), \
                    patch.object(telemetry, 'verify_token', side_effect=verify):
                asyncio.run(exercise())
