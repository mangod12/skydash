# SkyDash Real Drone Integration Guide

SkyDash currently runs a simulated three-drone fleet. This guide describes a
safe future path for integrating real telemetry. It is not a production
ground-control procedure.

Do not expose real vehicle command/control from SkyDash until authentication,
operator confirmation, audit logging, failsafe handling, rate limits, and
field-tested safety controls exist.

## Recommended Integration Order

1. SITL telemetry.
2. Flight-log replay.
3. Read-only MAVLink ingest.
4. Limited command/control only after a separate safety design and review.

## Current Backend Shape

The current backend is modular. Do not patch all telemetry behavior directly
into `backend/main.py`.

Relevant files:

- `backend/simulation.py`: current simulated fleet and command state.
- `backend/routes/telemetry.py`: telemetry REST, command ACK, reset, and
  WebSocket stream.
- `backend/mavlink_adapter.py`: MAVLink adapter stub/reference.
- `backend/dji_adapter.py`: DJI bridge stub/reference.
- `backend/models.py`: request/response models used by routes.

The safest first implementation is to add a read-only telemetry provider
interface that the route layer can consume instead of replacing route code.

## Option 1: MAVLink Drones

Use MAVLink for ArduPilot/PX4/SITL. Install dependencies locally:

```bash
pip install -r backend/requirements_real_drone.txt
```

Connection examples:

```python
from mavlink_adapter import MAVLinkDrone

# ArduPilot SITL
drone = MAVLinkDrone("udp:127.0.0.1:14550")

# Linux USB telemetry radio
drone = MAVLinkDrone("/dev/ttyUSB0")

# Windows USB telemetry radio
drone = MAVLinkDrone("COM3")

# Network telemetry
drone = MAVLinkDrone("tcp:192.168.1.100:5760")
```

Map incoming telemetry to the SkyDash telemetry shape used by
`FleetSimulator.get_all_telemetry()`:

- `drone_id`
- `timestamp`
- `altitude`
- `battery_voltage`
- `battery_percentage`
- `status`
- `attitude.roll`
- `attitude.pitch`
- `attitude.yaw`
- `gps.latitude`
- `gps.longitude`
- `gps.altitude`
- `gps.satellites`
- `signal_strength`
- `ground_speed`
- `armed`
- `flight_mode`
- `pattern`
- `command_state`

Keep the first integration read-only. WebSocket clients should receive telemetry
but the backend should not forward command requests to real vehicles.

## Testing With ArduPilot SITL

Install ArduPilot SITL on Linux/macOS:

```bash
git clone https://github.com/ArduPilot/ardupilot.git
cd ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
cd ArduCopter
sim_vehicle.py -w
```

Then connect a read-only MAVLink telemetry adapter to:

```text
udp:127.0.0.1:14550
```

Recommended acceptance criteria:

- Backend health stays healthy.
- `/telemetry` returns valid SkyDash-shaped records.
- `/ws/telemetry` streams valid records for at least 5 minutes.
- No `/api/drone/{drone_id}/command` request is forwarded to a real vehicle.
- Connection loss is reported as degraded telemetry, not process failure.

## Option 2: DJI Drones

DJI requires a bridge application because DJI aircraft do not expose MAVLink.

Possible paths:

- DJI Mobile SDK app that exposes a local HTTP telemetry bridge.
- DJI Onboard SDK service on a companion computer.
- Vendor-approved cloud/device bridge that normalizes telemetry into the
  SkyDash shape.

Keep the bridge read-only until the safety design exists.

## Option 3: ROS/ROS2

For ROS-based systems, subscribe to read-only topics and normalize state:

```python
import rclpy
from sensor_msgs.msg import BatteryState, NavSatFix


class ROSDroneTelemetry:
    def __init__(self):
        rclpy.init()
        self.node = rclpy.create_node("skydash_readonly_bridge")
        self.latest = {}
        self.node.create_subscription(
            NavSatFix,
            "/mavros/global_position/global",
            self.gps_callback,
            10,
        )
        self.node.create_subscription(
            BatteryState,
            "/mavros/battery",
            self.battery_callback,
            10,
        )

    def gps_callback(self, msg):
        self.latest["gps"] = {
            "latitude": msg.latitude,
            "longitude": msg.longitude,
            "altitude": msg.altitude,
        }

    def battery_callback(self, msg):
        self.latest["battery_voltage"] = msg.voltage
        self.latest["battery_percentage"] = round(msg.percentage * 100)
```

## Security And Safety Requirements

Before any real vehicle integration:

- Use HTTPS/TLS for remote access.
- Require authentication and role-based authorization.
- Require explicit operator confirmation for any command path.
- Rate-limit and validate every command input.
- Log telemetry source, command request, operator identity, result, and failure.
- Implement connection-loss and stale-telemetry handling.
- Keep a physical kill switch and native GCS fallback.
- Test in SITL before hardware.

## Troubleshooting

No heartbeat:

- Check connection string.
- Verify the simulator or vehicle is powered and emitting telemetry.
- Check firewall/UDP routing.
- Try a known SITL endpoint before hardware.

Serial permission denied on Linux:

```bash
sudo usermod -a -G dialout $USER
```

Then log out and back in.

Browser CORS errors:

- For local Vite, include `http://localhost:5173` in
  `SKYDASH_CORS_ORIGINS`.
- For production, include the Azure Static Web Apps origin.

## Next Engineering Step

Create a read-only telemetry provider interface, add SITL tests, and keep
`FleetSimulator` as the default demo provider. Only after that should a real
MAVLink provider be selectable through configuration.
