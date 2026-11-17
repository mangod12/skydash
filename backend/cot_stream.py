"""Optional Cursor on Target (CoT) streaming to ATAK / WinTAK / a TAK Server.

Off by default. Set SKYDASH_COT_TARGET to udp://host:port or tcp://host:port to
send one CoT <event> per drone and per geo-located entity every
SKYDASH_COT_INTERVAL seconds (default 5, minimum 1). UDP suits multicast or a
TAK Server UDP input; TCP uses a plain streaming input (no TLS) and reconnects
with backoff. Nothing is received: this is outbound only.
"""

import asyncio
import contextlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse
from xml.sax.saxutils import quoteattr

log = logging.getLogger("skydash.cot")

TYPE_TO_COT = {"vehicle": "G-E-V", "person": "G-U-C", "building": "G-I", "device": "G-E-S"}
DRONE_COT_TYPE = "a-f-A-M-F-Q"  # friendly, air, military, fixed wing, UAV
STALE_SECONDS = 30


def affiliation_for(threat: Optional[str]) -> str:
    if threat in ("critical", "high"):
        return "h"
    if threat == "medium":
        return "u"
    return "n"


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _event(uid: str, cot_type: str, lat: float, lon: float, now: datetime,
           callsign: str, remarks: str = "", hae: float = 9999999.0, extra: str = "") -> bytes:
    stale = now + timedelta(seconds=STALE_SECONDS)
    xml = (
        f'<event version="2.0" uid={quoteattr(uid)} type={quoteattr(cot_type)} how="m-g" '
        f'time="{_iso(now)}" start="{_iso(now)}" stale="{_iso(stale)}">'
        f'<point lat="{lat}" lon="{lon}" hae="{hae}" ce="9999999.0" le="9999999.0"/>'
        f'<detail><contact callsign={quoteattr(callsign)}/>'
        f'<remarks>{quoteattr(remarks)[1:-1]}</remarks>{extra}</detail></event>'
    )
    return xml.encode("utf-8")


def _valid(lat, lon) -> bool:
    return (isinstance(lat, (int, float)) and isinstance(lon, (int, float))
            and abs(lat) <= 90 and abs(lon) <= 180)


def build_events(entities: Iterable[Dict], drones: Iterable[Dict],
                 now: Optional[datetime] = None) -> List[bytes]:
    now = now or datetime.now(timezone.utc)
    out: List[bytes] = []
    for d in drones:
        gps = d.get("gps") or {}
        lat, lon = gps.get("latitude"), gps.get("longitude")
        if not _valid(lat, lon):
            continue
        track = (f'<track course="{d.get("attitude", {}).get("yaw", 0)}" '
                 f'speed="{d.get("ground_speed", 0)}"/>')
        out.append(_event(
            f'skydash-drone-{d.get("drone_id")}', DRONE_COT_TYPE, lat, lon, now,
            str(d.get("drone_id")),
            f'status: {d.get("status")}; battery: {d.get("battery_percentage")}%',
            hae=float(gps.get("altitude") or 0.0), extra=track))
    for e in entities:
        coords = e.get("coordinates")
        if not isinstance(coords, (list, tuple)) or len(coords) < 2 or not _valid(coords[0], coords[1]):
            continue
        dim = TYPE_TO_COT.get(e.get("type"), "G")
        out.append(_event(
            str(e.get("id")), f'a-{affiliation_for(e.get("threatLevel"))}-{dim}',
            coords[0], coords[1], now, str(e.get("name") or e.get("id")),
            f'threat: {e.get("threatLevel")}; confidence: {e.get("confidence")}%'))
    return out


def parse_target(value: Optional[str]) -> Optional[Tuple[str, str, int]]:
    """Return (scheme, host, port) for udp:// or tcp:// targets, else None."""
    if not value:
        return None
    u = urlparse(value.strip())
    if u.scheme not in ("udp", "tcp") or not u.hostname or not u.port:
        log.warning("SKYDASH_COT_TARGET ignored: expected udp://host:port or tcp://host:port")
        return None
    return u.scheme, u.hostname, u.port


def interval_from_env() -> float:
    try:
        return max(1.0, float(os.getenv("SKYDASH_COT_INTERVAL", "5")))
    except ValueError:
        return 5.0


class _UdpProto(asyncio.DatagramProtocol):
    pass


async def run_stream(get_entities, get_drones, target: Tuple[str, str, int], interval: float):
    """Send CoT forever; cancel to stop. Errors are logged, never raised."""
    scheme, host, port = target
    loop = asyncio.get_running_loop()
    transport = None
    writer = None
    backoff = 1.0
    log.info("CoT streaming to %s://%s:%s every %ss", scheme, host, port, interval)
    try:
        while True:
            try:
                events = build_events(get_entities(), get_drones())
                if scheme == "udp":
                    if transport is None:
                        transport, _ = await loop.create_datagram_endpoint(
                            _UdpProto, remote_addr=(host, port))
                    for ev in events:
                        transport.sendto(ev)
                else:
                    if writer is None:
                        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), 5)
                        backoff = 1.0
                    for ev in events:
                        writer.write(ev)
                    await writer.drain()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # network trouble must not take the API down
                log.warning("CoT stream error: %s", exc)
                if writer is not None:
                    writer.close()
                    writer = None
                if transport is not None:
                    transport.close()
                    transport = None
                await asyncio.sleep(min(backoff, 30.0))
                backoff *= 2
    finally:
        if writer is not None:
            writer.close()
        if transport is not None:
            transport.close()
