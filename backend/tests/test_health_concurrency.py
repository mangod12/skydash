"""Keep health's database reads from blocking unrelated request handling."""
import asyncio
import threading
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

import main


class TestHealthConcurrency(unittest.TestCase):
    def test_slow_counts_do_not_block_root(self):
        for store in (main.entity_store, main.mission_store):
            entered, release, finished = threading.Event(), threading.Event(), threading.Event()

            def slow_count():
                entered.set()
                try:
                    release.wait(2)
                    return 7
                finally:
                    finished.set()

            async def exercise():
                async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as client:
                    pending = asyncio.create_task(client.get("/health"))
                    try:
                        self.assertTrue(await asyncio.to_thread(entered.wait, 1))
                        response = await client.get("/")
                        self.assertEqual(response.status_code, 200)
                        self.assertFalse(finished.is_set(), "Health database read blocked the event loop")
                    finally:
                        release.set()
                        health = await pending
                    self.assertEqual(health.status_code, 200)
                    self.assertEqual(health.json()["entities" if store is main.entity_store else "missions"], 7)

            other = main.mission_store if store is main.entity_store else main.entity_store
            with self.subTest(store=type(store).__name__), \
                    patch.object(other, "count", return_value=0), \
                    patch.object(store, "count", side_effect=slow_count):
                asyncio.run(exercise())
