import concurrent.futures
import os
import sqlite3
import tempfile
import threading
import time
from unittest.mock import patch

import pytest

import database


@pytest.fixture
def isolated_db():
    with tempfile.TemporaryDirectory(prefix='skydash-transactions-') as directory:
        database.reset(os.path.join(directory, 'data.db'))
        yield
        database.reset()


def test_failed_batch_does_not_commit_its_prefix_on_later_write(isolated_db):
    database.execute('CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT)', commit=True)
    with pytest.raises(sqlite3.IntegrityError):
        database.executemany('INSERT INTO records VALUES (?, ?)', [(1, 'prefix'), (1, 'collision')])
    assert not database.get_connection().in_transaction
    database.execute('INSERT INTO records VALUES (?, ?)', (2, 'later'), commit=True)
    assert [tuple(row) for row in database.execute('SELECT * FROM records')] == [(2, 'later')]


def test_successful_batch_commits_and_uncommitted_mode_stays_explicit(isolated_db):
    database.execute('CREATE TABLE records (id INTEGER PRIMARY KEY)', commit=True)
    database.executemany('INSERT INTO records VALUES (?)', [(1,), (2,)])
    assert not database.get_connection().in_transaction
    database.executemany('INSERT INTO records VALUES (?)', [(3,)], commit=False)
    assert database.get_connection().in_transaction
    database.get_connection().rollback()
    assert [row[0] for row in database.execute('SELECT * FROM records')] == [1, 2]


def test_concurrent_first_reads_share_one_fully_initialised_connection(isolated_db):
    connect = sqlite3.connect
    barrier = threading.Barrier(8)

    def slow_connect(*args, **kwargs):
        time.sleep(0.02)
        return connect(*args, **kwargs)

    def read_connection(_):
        barrier.wait(timeout=2)
        conn = database.get_connection()
        return conn, conn.row_factory, conn.execute('PRAGMA foreign_keys').fetchone()[0]

    with patch.object(database.sqlite3, 'connect', side_effect=slow_connect) as mock:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(read_connection, range(8)))
        assert mock.call_count == 1
    assert len({id(result[0]) for result in results}) == 1
    assert all(factory is sqlite3.Row and enabled == 1 for _, factory, enabled in results)


def test_failed_connection_initialisation_closes_private_handle_and_allows_retry(isolated_db):
    from unittest.mock import MagicMock

    failed = MagicMock()
    failed.execute.side_effect = sqlite3.OperationalError('initialisation failed')
    with patch.object(database.sqlite3, 'connect', return_value=failed):
        with pytest.raises(sqlite3.OperationalError):
            database.get_connection()
    failed.close.assert_called_once()
    assert database._connection is None
    assert database.get_connection().execute('PRAGMA foreign_keys').fetchone()[0] == 1
