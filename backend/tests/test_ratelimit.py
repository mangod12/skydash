import ratelimit as rl


def setup_function(_):
    rl._hits.clear()
    rl._last_sweep = 0.0


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


def test_tracking_capacity_preserves_existing_limits(monkeypatch):
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "1")
    monkeypatch.setattr(rl, "_MAX_TRACKED", 2)
    assert rl.check("a", "/api/x", now=100.0) is None
    assert rl.check("b", "/api/x", now=100.0) is None
    for i in range(10):
        assert rl.check(f"extra-{i}", "/api/x", now=101.0) == rl.WINDOW_SECONDS
    assert set(rl._hits) == {"a", "b"}
    assert rl.check("a", "/api/x", now=101.0) is not None
    assert rl.check("new", "/api/x", now=160.0) is None
    assert set(rl._hits) == {"new"}


def test_expired_entries_are_cleaned_below_capacity(monkeypatch):
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "3")
    assert rl.check("old", "/api/x", now=100.0) is None
    assert rl.check("new", "/api/x", now=160.0) is None
    assert set(rl._hits) == {"new"}


def test_middleware_returns_429(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setenv("SKYDASH_RATE_LIMIT_PER_MIN", "2")
    c = TestClient(main.app)
    codes = [c.get("/api/entities").status_code for _ in range(4)]
    assert codes[-1] == 429
    r = c.get("/api/entities")
    assert r.headers["retry-after"]
