import importlib

import auth


def test_ttl_default_and_env(monkeypatch):
    monkeypatch.delenv("SKYDASH_TOKEN_TTL_MINUTES", raising=False)
    assert auth._ttl_seconds() == 86400
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", "30")
    assert auth._ttl_seconds() == 1800
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", "junk")
    assert auth._ttl_seconds() == 86400
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", "-5")
    assert auth._ttl_seconds() == 86400
