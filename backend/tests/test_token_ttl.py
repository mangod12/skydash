import pytest

import auth


def test_ttl_default_and_env(monkeypatch):
    monkeypatch.delenv("SKYDASH_TOKEN_TTL_MINUTES", raising=False)
    assert auth._ttl_seconds() == 86400
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", "30")
    assert auth._ttl_seconds() == 1800


@pytest.mark.parametrize("value", ["junk", "-5", "0", "nan", "inf", "-inf", "1e309", "1e308", ""])
def test_invalid_ttl_uses_default_without_crashing(monkeypatch, value):
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", value)
    assert auth._ttl_seconds() == 86400


@pytest.mark.parametrize("value, seconds", [("0.001", 1), ("0.5", 30), ("1.5", 90), ("2880", 172800)])
def test_positive_fractional_and_longer_lifetimes(monkeypatch, value, seconds):
    monkeypatch.setenv("SKYDASH_TOKEN_TTL_MINUTES", value)
    assert auth._ttl_seconds() == seconds
