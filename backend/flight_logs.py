"""Bounded, immutable single-aircraft training log archive in the shared SQLite DB."""
import hashlib
import json
import math
import re
import sqlite3
import uuid
from datetime import datetime, timezone

import database as db

LOG_VERSION = 'skydash-flight-csv-v1'
LOG_HEADER = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct'
MAX_BYTES = 1024 * 1024
MAX_SAMPLES = 10000
MAX_LOGS = 50
_NUMBER = re.compile(r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?', re.ASCII)
_LIMITS = [(0, 21600), (-85, 85), (-180, 180), (-1000, 100000), (0, 500), (0, 100)]


def parse_flight_csv(text):
    if len(text.encode('utf-8')) > MAX_BYTES:
        raise ValueError('CSV must be at most 1MiB.')
    lines = text.removeprefix('\ufeff').strip().split('\n')
    if lines[0].strip() != LOG_HEADER:
        raise ValueError('Unsupported header. Use the SkyDash six-column numeric CSV template, not binary MAVLink/ULog.')
    if not 3 <= len(lines) <= MAX_SAMPLES + 1:
        raise ValueError('Provide 2 to 10,000 samples with no blank rows.')
    fields = LOG_HEADER.split(',')
    samples = []
    for row, line in enumerate(lines[1:], 2):
        cells = [cell.strip() for cell in line.split(',')]
        if len(cells) != len(fields):
            raise ValueError(f'Row {row}: expected six numeric columns, no quoted cells.')
        values = []
        for column, cell in enumerate(cells):
            if not cell and column >= 3:
                values.append(None)
                continue
            value = float(cell) if _NUMBER.fullmatch(cell) else float('nan')
            lower, upper = _LIMITS[column]
            if not math.isfinite(value) or not lower <= value <= upper:
                raise ValueError(f'Row {row}: invalid {fields[column]} ({lower} to {upper}).')
            values.append(value)
        sample = dict(zip(fields, values))
        if not samples and sample['time_s'] != 0:
            raise ValueError('First time_s must be 0, relative seconds, not an epoch timestamp.')
        if samples:
            if sample['time_s'] <= samples[-1]['time_s']:
                raise ValueError(f'Row {row}: time_s must strictly increase. Samples are not sorted or deduplicated silently.')
            if abs(sample['longitude'] - samples[-1]['longitude']) > 180:
                raise ValueError('Tracks crossing the dateline are not supported.')
        samples.append(sample)
    return samples


class FlightLogStore:
    def __init__(self):
        conn = db.get_connection()
        conn.execute('''CREATE TABLE IF NOT EXISTS flight_logs (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
            notes TEXT NOT NULL, sha256 TEXT UNIQUE NOT NULL, model_version TEXT NOT NULL,
            csv_text TEXT NOT NULL, samples TEXT NOT NULL, sample_count INTEGER NOT NULL,
            duration_s REAL NOT NULL, created_at TEXT NOT NULL)''')
        conn.commit()

    def create(self, title, filename, notes, csv_text):
        samples = parse_flight_csv(csv_text)
        record = {'id': str(uuid.uuid4()), 'title': title, 'filename': filename, 'notes': notes,
                  'sha256': hashlib.sha256(csv_text.encode('utf-8')).hexdigest(),
                  'model_version': LOG_VERSION, 'csv_text': csv_text, 'samples': samples,
                  'sample_count': len(samples), 'duration_s': samples[-1]['time_s'],
                  'created_at': datetime.now(timezone.utc).isoformat()}
        try:
            conn = db.get_connection()
            with db.get_lock(), conn:
                if conn.execute('SELECT COUNT(*) FROM flight_logs').fetchone()[0] >= MAX_LOGS:
                    raise OverflowError('Archive full (50 logs). Download and delete an old record first.')
                conn.execute('INSERT INTO flight_logs VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                             tuple(json.dumps(record[key], allow_nan=False) if key == 'samples' else record[key]
                                   for key in ('id', 'title', 'filename', 'notes', 'sha256', 'model_version',
                                               'csv_text', 'samples', 'sample_count', 'duration_s', 'created_at')))
        except sqlite3.IntegrityError as exc:
            raise FileExistsError('This exact CSV is already archived. Refresh and reopen its existing record.') from exc
        return record

    def list(self):
        return [dict(row) for row in db.get_connection().execute(
            'SELECT id,title,filename,sha256,model_version,sample_count,duration_s,created_at '
            'FROM flight_logs ORDER BY created_at DESC, id DESC').fetchall()]

    def get(self, log_id):
        row = db.get_connection().execute('SELECT * FROM flight_logs WHERE id=?', (log_id,)).fetchone()
        if row is None:
            return None
        result = dict(row)
        result['samples'] = json.loads(result['samples'])
        return result

    def delete(self, log_id):
        return db.execute('DELETE FROM flight_logs WHERE id=?', (log_id,), commit=True).rowcount > 0
