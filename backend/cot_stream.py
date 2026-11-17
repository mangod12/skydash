"""Optional Cursor on Target (CoT) streaming to ATAK / WinTAK / a TAK Server.

Off by default. Set SKYDASH_COT_TARGET to udp://host:port or tcp://host:port to
send one CoT <event> per drone and per geo-located entity every
SKYDASH_COT_INTERVAL seconds (default 5, minimum 1). UDP suits multicast or a
TAK Server UDP input; TCP uses a plain streaming input. tls://host:port uses a
TAK Server TLS input (usually 8089) and reconnects with backoff. TLS settings:
SKYDASH_COT_CA (PEM CA bundle that signed the server, default system roots),
SKYDASH_COT_CERT and SKYDASH_COT_KEY (PEM client certificate and key, needed
when the server requires client auth). The server is always verified.
Nothing is received: outbound only.
"""

import asyncio
import contextlib
import logging
import math
import os
import ssl
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


def _xml_text(value: str) -> str:
    """Replace characters XML 1.0 cannot represent, including lone surrogates."""
    return "".join(
        char if (char in "\t\n\r" or 0x20 <= ord(char) <= 0xD7FF
                 or 0xE000 <= ord(char) <= 0xFFFD or 0x10000 <= ord(char) <= 0x10FFFF)
        else "\uFFFD" for char in value
    )


def _event(uid: str, cot_type: str, lat: float, lon: float, now: datetime,
           callsign: str, remarks: str = "", hae: float = 9999999.0, extra: str = "") -> bytes:
    stale = now + timedelta(seconds=STALE_SECONDS)
    uid, cot_type, callsign, remarks = map(_xml_text, (uid, cot_type, callsign, remarks))
    xml = (
        f'<event version="2.0" uid={quoteattr(uid)} type={quoteattr(cot_type)} how="m-g" '
        f'time="{_iso(now)}" start="{_iso(now)}" stale="{_iso(stale)}">'
        f'<point lat="{lat}" lon="{lon}" hae="{hae}" ce="9999999.0" le="9999999.0"/>'
        f'<detail><contact callsign={quoteattr(callsign)}/>'
        f'<remarks>{quoteattr(remarks)[1:-1]}</remarks>{extra}</detail></event>'
    )
    return xml.encode("utf-8")


def _valid(lat, lon) -> bool:
    return (type(lat) in (int, float) and type(lon) in (int, float)
            and math.isfinite(lat) and math.isfinite(lon)
            and abs(lat) <= 90 and abs(lon) <= 180)


def _finite_number(value, default):
    """Keep malformed telemetry out of numeric CoT attributes."""
    if isinstance(value, bool):
        return default
    try:
        number = float(value)
        return number if math.isfinite(number) else default
    except (TypeError, ValueError, OverflowError):
        return default


def build_events(entities: Iterable[Dict], drones: Iterable[Dict],
                 now: Optional[datetime] = None) -> List[bytes]:
    now = now or datetime.now(timezone.utc)
    out: List[bytes] = []
    for d in drones:
        gps = d.get("gps") or {}
        lat, lon = gps.get("latitude"), gps.get("longitude")
        if not _valid(lat, lon):
            continue
        attitude = d.get("attitude") or {}
        course = _finite_number(attitude.get("yaw"), None)
        speed = _finite_number(d.get("ground_speed"), None)
        altitude = _finite_number(gps.get("altitude"), 9999999.0)
        # Missing track values are unknown, not confirmed zero heading/speed.
        attributes = []
        if course is not None:
            attributes.append(f'course="{course}"')
        if speed is not None:
            attributes.append(f'speed="{speed}"')
        track = '<track ' + ' '.join(attributes) + '/>' if attributes else ''
        out.append(_event(
            f'skydash-drone-{d.get("drone_id")}', DRONE_COT_TYPE, lat, lon, now,
            str(d.get("drone_id")),
            f'status: {d.get("status")}; battery: {d.get("battery_percentage")}%',
            hae=altitude, extra=track))
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
    """Return (scheme, host, port) for udp://, tcp:// or tls:// targets, else None."""
    if not value:
        return None
    try:
        u = urlparse(value.strip())
        if u.scheme in ("udp", "tcp", "tls") and u.hostname and u.port:
            return u.scheme, u.hostname, u.port
    except ValueError:
        # Invalid ports and malformed IPv6 authorities can fail during parsing.
        pass
    log.warning("SKYDASH_COT_TARGET ignored: expected udp://, tcp:// or tls:// host:port")
    return None


def interval_from_env() -> float:
    try:
        interval = float(os.getenv("SKYDASH_COT_INTERVAL", "5"))
        return max(1.0, interval) if math.isfinite(interval) else 5.0
    except ValueError:
        return 5.0


def build_ssl_context(env=None) -> ssl.SSLContext:
    """TLS client context from SKYDASH_COT_* settings. Verifies the server by default."""
    env = os.environ if env is None else env
    ctx = ssl.create_default_context(cafile=env.get("SKYDASH_COT_CA") or None)
    cert, key = env.get("SKYDASH_COT_CERT"), env.get("SKYDASH_COT_KEY")
    if cert:
        ctx.load_cert_chain(cert, key or None)
    return ctx


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
                        ctx = build_ssl_context() if scheme == "tls" else None
                        _, writer = await asyncio.wait_for(
                            asyncio.open_connection(host, port, ssl=ctx), 10)
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
