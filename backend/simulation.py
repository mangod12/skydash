"""
Multi-drone flight simulator with dramatic, demo-worthy flight patterns.
Larger orbits, wider grids, longer waypoint routes for visual impact.
"""
import math
import random
import time
from typing import Dict, List

SUPPORTED_MODES = {"ORBIT", "GRID", "WAYPOINT", "HOLD", "RTL", "LAND"}
SUPPORTED_COMMANDS = {
    "set_mode",
    "adjust_altitude",
    "set_altitude",
    "adjust_yaw",
    "set_speed",
    "set_orbit_radius",
    "emergency_stop",
}
MIN_ALTITUDE_M = 0
MAX_ALTITUDE_M = 400
MIN_SPEED_SCALE = 0.1
MAX_SPEED_SCALE = 3.0
MIN_RADIUS_M = 100
MAX_RADIUS_M = 3000


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


class DroneSimulator:
    def __init__(self, drone_id: str, pattern: str = "orbit", base_lat: float = 37.7749, base_lng: float = -122.4194):
        self.drone_id = drone_id
        self.initial_pattern = pattern
        self.pattern = pattern
        self.start_time = time.time()
        self.initial_battery = 16.8
        self.request_count = 0
        self.base_lat = base_lat
        self.base_lng = base_lng
        self.base_altitude = 40.0 + random.uniform(0, 30)

        # BIGGER patterns for visual impact
        self.orbit_radius = 0.006  # ~600m - very visible on map
        self.orbit_speed = 0.15    # slower, smoother
        self.waypoints = self._generate_waypoints()
        self.mode = pattern.upper()
        self.commanded_altitude = None
        self.yaw_offset = 0.0
        self.speed_scale = 1.0
        self.hold_position = None
        self.emergency_stopped = False
        self.last_command = None

        self.wind_speed = random.uniform(1, 4)
        self.wind_direction = random.uniform(0, 360)

    def _generate_waypoints(self) -> List[Dict]:
        # Large patrol route around the area
        offsets = [
            (0.008, 0.002), (0.005, 0.010), (-0.003, 0.008),
            (-0.008, 0.003), (-0.006, -0.005), (-0.001, -0.008),
            (0.006, -0.006), (0.009, -0.001),
        ]
        return [{
            "lat": self.base_lat + dlat,
            "lng": self.base_lng + dlng,
            "alt": random.uniform(35, 90),
        } for dlat, dlng in offsets]

    def get_telemetry(self) -> Dict:
        self.request_count += 1
        elapsed = time.time() - self.start_time

        lat, lng, heading = self._compute_position(elapsed)
        altitude = self._compute_altitude(elapsed)

        battery_voltage = max(14.0, self.initial_battery - (0.0002 * elapsed))
        battery_pct = int(((battery_voltage - 14.0) / 2.8) * 100)

        if self.emergency_stopped:
            status = "EMERGENCY_STOP"
        elif self.mode == "LAND":
            status = "LANDING"
        elif battery_voltage > 14.2:
            status = "ARMED"
        else:
            status = "RTL"
        wind_effect = self.wind_speed * math.sin(elapsed * 0.1)

        roll = round(random.gauss(0, 0.5) + wind_effect * 0.3, 2)
        pitch = round(random.gauss(0, 0.5) + wind_effect * 0.2, 2)
        yaw = round((heading + self.yaw_offset) % 360, 2)

        gps_noise = 0.000001
        signal = max(0, min(100, 92 + random.randint(-8, 8) - int(altitude / 25)))
        ground_speed = 0.0 if self.mode in {"HOLD", "LAND"} or self.emergency_stopped else random.uniform(3.0, 12.0) * self.speed_scale

        return {
            "drone_id": self.drone_id,
            "timestamp": round(elapsed, 2),
            "altitude": round(altitude, 2),
            "battery_voltage": round(battery_voltage, 2),
            "battery_percentage": battery_pct,
            "status": status,
            "attitude": {"roll": roll, "pitch": pitch, "yaw": yaw},
            "gps": {
                "satellites": random.randint(9, 14),
                "latitude": round(lat + random.gauss(0, gps_noise), 7),
                "longitude": round(lng + random.gauss(0, gps_noise), 7),
                "altitude": round(altitude, 2),
            },
            "signal_strength": signal,
            "ground_speed": round(ground_speed, 2),
            "armed": status == "ARMED",
            "flight_mode": self.mode if status != "RTL" else "RTL",
            "pattern": self.pattern,
            "command_state": self.get_command_state(),
            "wind": {
                "speed": round(self.wind_speed + random.gauss(0, 0.3), 1),
                "direction": round(self.wind_direction, 0),
            },
        }

    def _compute_position(self, t: float):
        if self.emergency_stopped or self.mode == "HOLD":
            if not self.hold_position:
                lat, lng, heading = self._pattern_position(t)
                self.hold_position = (lat, lng, heading)
            return self.hold_position

        if self.mode == "RTL":
            lat, lng, heading = self._pattern_position(t)
            frac = min(1.0, (time.time() - (self.last_command or self.start_time)) / 20)
            return (
                lat + (self.base_lat - lat) * frac,
                lng + (self.base_lng - lng) * frac,
                heading,
            )

        return self._pattern_position(t * self.speed_scale)

    def _pattern_position(self, t: float):
        if self.pattern == "orbit":
            angle = t * self.orbit_speed
            lat = self.base_lat + self.orbit_radius * math.cos(angle)
            lng = self.base_lng + self.orbit_radius * 1.3 * math.sin(angle)
            heading = (math.degrees(angle) + 90) % 360
            return lat, lng, heading

        if self.pattern == "grid":
            # Larger grid search pattern
            speed = 0.0008  # degrees per second
            leg_time = 12  # seconds per leg
            cycle = t % (leg_time * 10)
            leg = int(cycle / leg_time)
            frac = (cycle % leg_time) / leg_time

            row = leg // 2
            going_east = leg % 2 == 0

            lat = self.base_lat + row * 0.002
            if going_east:
                lng = self.base_lng + frac * 0.012
                heading = 90
            else:
                lng = self.base_lng + (1 - frac) * 0.012
                heading = 270
            return lat, lng, heading

        if self.pattern == "waypoint":
            if not self.waypoints:
                return self.base_lat, self.base_lng, 0
            segment_time = 12  # seconds between waypoints
            total_time = segment_time * len(self.waypoints)
            cycle_t = t % total_time
            idx = int(cycle_t / segment_time)
            frac = (cycle_t % segment_time) / segment_time
            # Smooth easing
            frac = frac * frac * (3 - 2 * frac)

            wp = self.waypoints[idx]
            next_wp = self.waypoints[(idx + 1) % len(self.waypoints)]
            lat = wp["lat"] + (next_wp["lat"] - wp["lat"]) * frac
            lng = wp["lng"] + (next_wp["lng"] - wp["lng"]) * frac
            heading = math.degrees(math.atan2(
                next_wp["lng"] - wp["lng"],
                next_wp["lat"] - wp["lat"]
            )) % 360
            return lat, lng, heading

        return self.base_lat, self.base_lng, 0

    def _compute_altitude(self, t: float) -> float:
        base = self.base_altitude
        if self.pattern == "waypoint" and self.waypoints:
            seg_time = 12
            total = seg_time * len(self.waypoints)
            cycle_t = t % total
            idx = int(cycle_t / seg_time)
            frac = (cycle_t % seg_time) / seg_time
            wp = self.waypoints[idx]
            next_wp = self.waypoints[(idx + 1) % len(self.waypoints)]
            base = wp["alt"] + (next_wp["alt"] - wp["alt"]) * frac
        natural = base + 3 * math.sin(t * 0.4) + random.gauss(0, 0.2)
        if self.mode == "LAND" or self.emergency_stopped:
            return round(_clamp(natural * 0.25, MIN_ALTITUDE_M, MAX_ALTITUDE_M), 2)
        if self.commanded_altitude is not None:
            return round(_clamp(self.commanded_altitude, MIN_ALTITUDE_M, MAX_ALTITUDE_M), 2)
        return natural

    def get_command_state(self) -> Dict:
        return {
            "mode": self.mode,
            "altitude_target": self.commanded_altitude,
            "yaw_offset": round(self.yaw_offset, 2),
            "speed_scale": round(self.speed_scale, 2),
            "orbit_radius_m": round(self.orbit_radius * 111_000),
            "emergency_stopped": self.emergency_stopped,
            "last_command_at": self.last_command,
        }

    def apply_command(self, command: str, params: Dict | None = None) -> Dict:
        params = params or {}
        command = command.lower().strip()
        if command not in SUPPORTED_COMMANDS:
            raise ValueError(f"Unsupported command: {command}")

        now = time.time()
        if command == "set_mode":
            mode = str(params.get("mode", "")).upper()
            if mode not in SUPPORTED_MODES:
                raise ValueError(f"Unsupported mode: {mode}")
            self.mode = mode
            self.emergency_stopped = False
            self.hold_position = None
            if mode in {"ORBIT", "GRID", "WAYPOINT"}:
                self.pattern = mode.lower()
            if mode == "LAND":
                self.commanded_altitude = MIN_ALTITUDE_M

        elif command == "adjust_altitude":
            current = self._compute_altitude(time.time() - self.start_time)
            delta = float(params.get("delta", 0))
            self.commanded_altitude = round(
                _clamp(current + delta, MIN_ALTITUDE_M, MAX_ALTITUDE_M),
                2,
            )

        elif command == "set_altitude":
            value = float(params.get("value", params.get("altitude", 0)))
            self.commanded_altitude = round(
                _clamp(value, MIN_ALTITUDE_M, MAX_ALTITUDE_M),
                2,
            )

        elif command == "adjust_yaw":
            delta = float(params.get("delta", 0))
            self.yaw_offset = (self.yaw_offset + delta) % 360

        elif command == "set_speed":
            value = float(params.get("value", params.get("speed", 5.0)))
            self.speed_scale = round(
                _clamp(value / 5.0, MIN_SPEED_SCALE, MAX_SPEED_SCALE),
                2,
            )

        elif command == "set_orbit_radius":
            value = float(params.get("value", params.get("radius", 600)))
            radius_m = _clamp(value, MIN_RADIUS_M, MAX_RADIUS_M)
            self.orbit_radius = radius_m / 111_000

        elif command == "emergency_stop":
            self.mode = "HOLD"
            self.emergency_stopped = True
            self.hold_position = None
            self.speed_scale = MIN_SPEED_SCALE

        self.last_command = now
        return self.get_command_state()


class FleetSimulator:
    def __init__(self):
        self.drones = {
            "ALPHA-1": DroneSimulator("ALPHA-1", "orbit", 37.7749, -122.4194),
            "BRAVO-2": DroneSimulator("BRAVO-2", "grid", 37.7780, -122.4150),
            "CHARLIE-3": DroneSimulator("CHARLIE-3", "waypoint", 37.7720, -122.4220),
        }

    def get_all_telemetry(self) -> List[Dict]:
        return [d.get_telemetry() for d in self.drones.values()]

    def get_drone_telemetry(self, drone_id: str) -> Dict:
        if drone_id in self.drones:
            return self.drones[drone_id].get_telemetry()
        return {}

    def send_command(self, drone_id: str, command: str, params: Dict | None = None) -> Dict:
        if drone_id not in self.drones:
            raise KeyError(drone_id)
        state = self.drones[drone_id].apply_command(command, params)
        return {
            "drone_id": drone_id,
            "command": command,
            "params": params or {},
            "ack": "confirmed",
            "simulated": True,
            "state": state,
        }

    def reset(self):
        for drone_id, drone in list(self.drones.items()):
            self.drones[drone_id] = DroneSimulator(
                drone_id, drone.initial_pattern, drone.base_lat, drone.base_lng
            )
