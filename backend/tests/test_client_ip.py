from types import SimpleNamespace

from client_ip import client_ip


def req(real=None, host="10.0.0.5"):
    headers = {"x-real-ip": real} if real else {}
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=host))


def test_default_ignores_forwarded_header(monkeypatch):
    monkeypatch.delenv("SKYDASH_TRUST_PROXY", raising=False)
    assert client_ip(req("203.0.113.9")) == "10.0.0.5"


def test_trust_proxy_uses_real_ip(monkeypatch):
    monkeypatch.setenv("SKYDASH_TRUST_PROXY", "1")
    assert client_ip(req("203.0.113.9")) == "203.0.113.9"
    assert client_ip(req(None)) == "10.0.0.5"
