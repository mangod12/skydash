"""Blocking export store work must not pause unrelated API/telemetry work."""
import asyncio
import threading
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

import main
from routes import export as export_routes


class TestExportEventLoop(unittest.TestCase):
    def test_export_routes_leave_other_requests_responsive(self):
        cases = [
            ('post', '/api/export/geojson', 'list_entities', [], None),
            ('get', '/api/export/entities/csv', 'list_entities', [], None),
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
                        self.assertFalse(finished.is_set(), 'Export work blocked the API event loop')
                    finally:
                        release.set()
                        response = await pending
                    self.assertIn(response.status_code, (200, 201))
            with self.subTest(path=path, method=method), patch.object(export_routes.entity_store, name, side_effect=slow):
                asyncio.run(exercise())
