"""
Multi-drone flight simulator with dramatic, demo-worthy flight patterns.
Larger orbits, wider grids, longer waypoint routes for visual impact.
"""
import math
import random
import time
from typing import Dict, List


class DroneSimulator:
    def __init__(self, drone_id: str, pattern: str = "orbit", base_lat: float = 37.7749, base_lng: float = -122.4194):
        self.drone_id = drone_id
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

        status = "ARMED" if battery_voltage > 14.2 else "RTL"
        wind_effect = self.wind_speed * math.sin(elapsed * 0.1)

        roll = round(random.gauss(0, 0.5) + wind_effect * 0.3, 2)
        pitch = round(random.gauss(0, 0.5) + wind_effect * 0.2, 2)
        yaw = round(heading % 360, 2)

        gps_noise = 0.000001
        signal = max(0, min(100, 92 + random.randint(-8, 8) - int(altitude / 25)))

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
            "ground_speed": round(random.uniform(3.0, 12.0), 2),
            "armed": status == "ARMED",
            "flight_mode": self.pattern.upper() if status == "ARMED" else "RTL",
            "pattern": self.pattern,
            "wind": {
                "speed": round(self.wind_speed + random.gauss(0, 0.3), 1),
                "direction": round(self.wind_direction, 0),
            },
        }

    def _compute_position(self, t: float):
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
        return base + 3 * math.sin(t * 0.4) + random.gauss(0, 0.2)


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

    def reset(self):
        for drone_id, drone in list(self.drones.items()):
            self.drones[drone_id] = DroneSimulator(
                drone_id, drone.pattern, drone.base_lat, drone.base_lng
            )
