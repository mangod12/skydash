"""Recorded flight training logs. Existing shared auth/RBAC applies to this archive."""
from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from deps import flight_log_store

router = APIRouter()
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class FlightLogCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    title: ShortText
    filename: ShortText
    notes: Annotated[str, StringConstraints(max_length=4000)] = ''
    csv_text: Annotated[str, StringConstraints(min_length=1, max_length=1024 * 1024)]


@router.post('/api/flight-logs', status_code=201)
def create_log(body: FlightLogCreate):
    try:
        data = flight_log_store.create(body.title, body.filename, body.notes, body.csv_text)
        return {'success': True, 'data': data}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (FileExistsError, OverflowError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get('/api/flight-logs')
def list_logs():
    return {'success': True, 'data': flight_log_store.list()}


@router.get('/api/flight-logs/{log_id}')
def get_log(log_id: str):
    data = flight_log_store.get(log_id)
    if data is None:
        raise HTTPException(status_code=404, detail='Flight log not found')
    return {'success': True, 'data': data}


@router.delete('/api/flight-logs/{log_id}')
def delete_log(log_id: str):
    if not flight_log_store.delete(log_id):
        raise HTTPException(status_code=404, detail='Flight log not found')
    return {'success': True, 'data': {'deleted': log_id}}
