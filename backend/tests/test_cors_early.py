import unittest

from fastapi.testclient import TestClient

import main
from deps import CORS_ORIGINS


class TestCorsOnEarlyResponses(unittest.TestCase):
    def test_401_carries_cors_headers(self):
        origin = CORS_ORIGINS[0]
        old = main.AUTH_ENABLED
        main.AUTH_ENABLED = True
        try:
            r = TestClient(main.app).get("/api/entities", headers={"Origin": origin})
        finally:
            main.AUTH_ENABLED = old
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.headers.get("access-control-allow-origin"), origin)


if __name__ == "__main__":
    unittest.main()
