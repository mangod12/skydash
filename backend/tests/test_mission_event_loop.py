"""Blocking mission store work must not pause unrelated API/telemetry work."""
import asyncio
import threading
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

import main
from routes import missions


class TestMissionEventLoop(unittest.TestCase):
    def test_mission_store_routes_leave_other_requests_responsive(self):
        cases = [
            ('get', '/api/missions', 'list_missions', [], None),
            ('get', '/api/missions/one', 'get_mission', None, None),
            ('post', '/api/missions', 'create_mission', {'id': 'one', 'name': 'One'}, {'name': 'One'}),
            ('put', '/api/missions/one', 'update_mission', {'id': 'one'}, {'name': 'One'}),
            ('delete', '/api/missions/one', 'delete_mission', True, None),
            ('post', '/api/missions/one/entities', 'get_mission', None, {'entity_id': 'two'}),
            ('delete', '/api/missions/one/entities/two', 'remove_entity_from_mission', True, None),
            ('post', '/api/missions/one/notes', 'add_note', {'id': 'note'}, {'content': 'Note'}),
            ('get', '/api/missions/one/notes', 'get_mission', None, None),
            ('delete', '/api/missions/one/notes/two', 'delete_note', True, None),
        ]
        for method, path, name, value, body in cases:
            entered, release, finished = threading.Event(), threading.Event(), threading.Event()
            def slow(*args, **kwargs):
                entered.set()
                try:
                    release.wait(2)
                    return value
                finally:
                    finished.set()
            async def exercise():
                async with AsyncClient(transport=ASGITransport(app=main.app), base_url='http://test') as client:
                    pending = asyncio.create_task(client.request(method, path, json=body))
                    try:
                        self.assertTrue(await asyncio.to_thread(entered.wait, 1))
                        response = await client.get('/api/connectors/status')
                        self.assertEqual(response.status_code, 200)
                        self.assertFalse(finished.is_set(), 'Mission work blocked the API event loop')
                    finally:
                        release.set()
                        response = await pending
                    self.assertIn(response.status_code, (200, 201, 404))
            with self.subTest(path=path, method=method), patch.object(missions.mission_store, name, side_effect=slow):
                asyncio.run(exercise())
