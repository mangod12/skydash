"""Blocking entity store work must not pause unrelated API/telemetry work."""
import asyncio
import threading
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

import main
from routes import entities


class TestEntityEventLoop(unittest.TestCase):
    def test_entity_store_routes_leave_other_requests_responsive(self):
        cases = [
            ('get', '/api/entities', 'list_entities', [], None),
            ('get', '/api/entities/graph', 'get_graph', {'nodes': [], 'edges': []}, None),
            ('get', '/api/entities/one', 'get_entity', {'id': 'one'}, None),
            ('get', '/api/entities/one/graph', 'get_entity_graph', {}, None),
            ('get', '/api/timeline', 'get_timeline', [], None),
            ('post', '/api/entities', 'create_entity', {'id': 'one', 'name': 'One'}, {'name': 'One'}),
            ('put', '/api/entities/one', 'update_entity', {'id': 'one'}, {'name': 'One'}),
            ('delete', '/api/entities/one', 'delete_entity', True, None),
            ('post', '/api/entities/one/relate', 'add_relationship', {}, {'to_entity': 'two', 'type': 'linked'}),
            ('post', '/api/events', 'add_event', {}, {'description': 'Fixture event'}),
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
                        self.assertFalse(finished.is_set(), 'Entity work blocked the API event loop')
                    finally:
                        release.set()
                        response = await pending
                    self.assertIn(response.status_code, (200, 201))
            with self.subTest(path=path, method=method), patch.object(entities.entity_store, name, side_effect=slow):
                asyncio.run(exercise())
