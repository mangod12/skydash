import password_policy as pp


def test_accepts_reasonable_password():
    assert pp.check_password("alice", "tide-Harbor-42") is None


def test_rejects_weak_passwords():
    assert pp.check_password("alice", "password123")
    assert pp.check_password("alice", "alicealice1")  # contains username
    assert pp.check_password("alice", "aaaaaaaaaa")  # repetitive, one class
    assert pp.check_password("alice", "abcdefghij")  # single class
    assert pp.check_password("alice", "short1A")  # too short


def test_min_length_env(monkeypatch):
    monkeypatch.setenv("SKYDASH_MIN_PASSWORD_LENGTH", "14")
    assert pp.min_length() == 14
    assert pp.check_password("bob", "Abcdefg-12345")  # 13 chars
    monkeypatch.setenv("SKYDASH_MIN_PASSWORD_LENGTH", "3")
    assert pp.min_length() == 8  # floor
