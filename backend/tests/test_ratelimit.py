import ratelimit as rl


def setup_function(_):
    rl._hits.clear()


def test_off_by_default(monkeypatch):
    monkeypatch.delenv("SKYDASH_RATE_LIMIT_PER_MIN", raising=False)
    assert all(rl.check("c", "/api/x", now=1.0) is None for _ in range(1000))


def test_limits_per_client_and_window(monkeypatch):
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "3")
    assert [rl.check("a", "/api/x", now=10.0) for _ in range(3)] == [None] * 3
    assert rl.check("a", "/api/x", now=11.0) >= 1
    assert rl.check("b", "/api/x", now=11.0) is None  # other client unaffected
    assert rl.check("a", "/api/x", now=71.0) is None  # window passed


def test_exempt_paths(monkeypatch):
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "1")
    for _ in range(5):
        assert rl.check("a", "/health", now=1.0) is None


def test_middleware_returns_429(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "2")
    c = TestClient(main.app)
    codes = [c.get("/api/entities").status_code for _ in range(4)]
    assert codes[-1] == 429
    r = c.get("/api/entities")
    assert r.headers["retry-after"]
