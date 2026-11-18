from pathlib import Path
import hashlib
import concurrent.futures

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import database as db
from flight_logs import FlightLogStore, LOG_HEADER, LOG_VERSION, parse_flight_csv
from routes import flight_logs as routes
from rbac import required_role

CSV = LOG_HEADER + '\n0,0,0,,,\n2,0.001,0.001,0,0,0\n12,0.002,0.002,25,5,90\n'


@pytest.fixture
def archive(tmp_path, monkeypatch):
    original = db.DB_PATH
    db.reset(str(tmp_path / 'flight.db'))
    store = FlightLogStore()
    monkeypatch.setattr(routes, 'flight_log_store', store)
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app) as client:
        yield store, client
    db.reset(original)


def body(**changes):
    return {'title': 'Training test', 'filename': 'test.csv', 'notes': 'Review only', 'csv_text': CSV, **changes}


def test_numeric_parser_preserves_nulls_and_zero_and_bom_crlf():
    samples = parse_flight_csv('\ufeff' + CSV.replace('\n', '\r\n'))
    assert samples[0]['altitude_m'] is None
    assert samples[0]['latitude'] == 0
    assert samples[1]['battery_pct'] == 0
    assert samples[-1]['time_s'] == 12


@pytest.mark.parametrize('rows,error', [
    ('0,0,0,,,', '2 to 10,000'),
    ('0,0,0,,\n1,0,0,,,', 'six numeric'),
    ('0,,0,,,\n1,0,0,,,', 'latitude'),
    ('0,0,0,,,\n1,nan,0,,,', 'latitude'),
    ('0,0,0,,,\n1,0,181,,,', 'longitude'),
    ('0,0,0,,,\n1,85.01,0,,,', 'latitude'),
    ('0,0,0,,,\n1,0,0,inf,,', 'altitude_m'),
    ('0,0,0,,,\n1,0,0,,-1,', 'ground_speed'),
    ('0,0,0,,,\n1,0,0,,,101', 'battery_pct'),
    ('0,0,0,,,\n1,0,0,,,0x10', 'battery_pct'),
    ('0,0,0,,,\n1,0,0,,,"50"', 'battery_pct'),
    ('0,0,0,,,\n21601,0,0,,,', 'time_s'),
    ('1,0,0,,,\n2,0,0,,,', 'First time_s'),
    ('0,0,0,,,\n0,0,0,,,', 'strictly increase'),
    ('0,0,0,,,\n2,0,0,,,\n1,0,0,,,', 'strictly increase'),
    ('0,0,179,,,\n1,0,-179,,,', 'dateline'),
    ('0,0,0,,,\n\n1,0,0,,,', 'six numeric'),
])
def test_invalid_csv_rejected(rows, error):
    with pytest.raises(ValueError, match=error):
        parse_flight_csv(LOG_HEADER + '\n' + rows)


def test_unsupported_format_and_limits():
    for text in ('', 'ULog', 'time,lat,lon\n0,0,0'):
        with pytest.raises(ValueError, match='Unsupported header'):
            parse_flight_csv(text)
    with pytest.raises(ValueError, match='1MiB'):
        parse_flight_csv('é' * 600000)
    with pytest.raises(ValueError, match='10,000'):
        parse_flight_csv(LOG_HEADER + '\n' + '\n'.join(f'{i},0,0,,,' for i in range(10001)))


def test_archive_survives_connection_restart_with_exact_source_and_fixed_notes(archive):
    store, client = archive
    response = client.post('/api/flight-logs', json=body())
    assert response.status_code == 201
    record = response.json()['data']
    assert record['sha256'] == hashlib.sha256(CSV.encode()).hexdigest()
    assert record['model_version'] == LOG_VERSION
    assert record['sample_count'] == 3
    assert record['duration_s'] == 12
    db.close()
    reopened = FlightLogStore().get(record['id'])
    assert reopened == record
    assert reopened['csv_text'] == CSV
    assert reopened['notes'] == 'Review only'
    metadata = client.get('/api/flight-logs').json()['data']
    assert len(metadata) == 1
    assert 'samples' not in metadata[0] and 'csv_text' not in metadata[0] and 'notes' not in metadata[0]
    assert client.get('/api/flight-logs/' + record['id']).json()['data'] == record
    assert client.put('/api/flight-logs/' + record['id'], json={'notes': 'change'}).status_code == 405


def test_duplicate_is_not_an_overwrite_and_delete_is_scoped(archive):
    store, client = archive
    first = client.post('/api/flight-logs', json=body()).json()['data']
    assert client.post('/api/flight-logs', json=body(title='Changed', notes='Different')).status_code == 409
    assert store.get(first['id'])['title'] == 'Training test'
    second = client.post('/api/flight-logs', json=body(csv_text=CSV + '\n')).json()['data']
    assert client.delete('/api/flight-logs/' + first['id']).status_code == 200
    assert store.get(second['id']) is not None
    assert client.get('/api/flight-logs/' + first['id']).status_code == 404
    assert client.delete('/api/flight-logs/' + first['id']).status_code == 404
    assert client.get('/api/flight-logs/not-a-record').status_code == 404


@pytest.mark.parametrize('change', [{'title': ''}, {'title': ' '}, {'title': 'a' * 121}, {'notes': 'a' * 4001}, {'filename': ''}, {'csv_text': 123}, {'samples': []}, {'csv_text': LOG_HEADER + '\n0,0,0,,,'}])
def test_invalid_api_payload_leaves_no_record(archive, change):
    store, client = archive
    assert client.post('/api/flight-logs', json=body(**change)).status_code == 422
    assert store.list() == []


def test_capacity_is_bounded_under_concurrent_writes(archive, monkeypatch):
    import flight_logs
    store, client = archive
    monkeypatch.setattr(flight_logs, 'MAX_LOGS', 2)
    def create(i):
        try:
            return store.create(f'Test {i}', 'test.csv', '', CSV + '\n' * i)
        except OverflowError:
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(create, range(6)))
    assert sum(result is not None for result in results) == 2
    assert len(store.list()) == 2
    assert client.post('/api/flight-logs', json=body(csv_text=CSV + '\n' * 100)).status_code == 409


def test_existing_rbac_guards_archive_mutations():
    assert required_role('POST', '/api/flight-logs') == 'analyst'
    assert required_role('DELETE', '/api/flight-logs/id') == 'analyst'
    assert required_role('GET', '/api/flight-logs/id') is None


def test_repository_training_sample_uses_the_same_contract():
    text = (Path(__file__).resolve().parents[2] / 'examples/flight-log-training.csv').read_text()
    samples = parse_flight_csv(text)
    assert len(samples) == 6
    assert samples[3]['altitude_m'] is None
    assert samples[-1]['time_s'] == 16
