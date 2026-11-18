"""Body-limit configuration must not disable startup or the default size cap."""
import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize('value', ['', 'bad', '1.5', 'NaN', 'Infinity', '0', '-1'])
def test_invalid_body_limit_keeps_default_and_warns(value, tmp_path):
    env = {**os.environ, 'SKYDASH_MAX_BODY_BYTES': value,
           'SKYDASH_DB_PATH': str(tmp_path / 'config.db')}
    result = subprocess.run([sys.executable, '-c', 'import main; print(main.MAX_BODY_BYTES)'],
                            cwd=Path(__file__).resolve().parents[1], env=env,
                            capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(25 * 1024 * 1024)
    assert 'SKYDASH_MAX_BODY_BYTES' in result.stderr


@pytest.mark.parametrize('value', ['1', '4096', ' 8192 '])
def test_positive_body_limit_is_preserved(value, tmp_path):
    env = {**os.environ, 'SKYDASH_MAX_BODY_BYTES': value,
           'SKYDASH_DB_PATH': str(tmp_path / 'config.db')}
    result = subprocess.run([sys.executable, '-c', 'import main; print(main.MAX_BODY_BYTES)'],
                            cwd=Path(__file__).resolve().parents[1], env=env,
                            capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(int(value))
