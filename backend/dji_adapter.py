"""
DJI SDK adapter for DJI drones (Mobile SDK / Onboard SDK)
Requires DJI SDK setup on mobile device or onboard computer
"""
import math
import requests
from typing import Dict
import time


class DJIDrone:
    """
    Adapter for DJI drones using DJI Mobile SDK bridge
    Requires a mobile app or onboard SDK bridge running HTTP server
    """
    
    def __init__(self, bridge_url: str = "http://192.168.1.100:8080"):
        """
        Args:
            bridge_url: URL of your DJI SDK bridge server
                        (you need to implement this using DJI Mobile/Onboard SDK)
        """
        self.bridge_url = bridge_url
        self.session = requests.Session()
        
    @staticmethod
    def _number(value, minimum=None, maximum=None):
        if type(value) not in (int, float) or not math.isfinite(value):
            return None
        if minimum is not None and value < minimum:
            return None
        if maximum is not None and value > maximum:
            return None
        return value

    def _read(self, path: str) -> Dict:
        response = self.session.get(f"{self.bridge_url}{path}", timeout=(3.05, 5))
        response.raise_for_status()
        return response.json()

    def get_telemetry(self) -> Dict:
        """
        Fetch telemetry from DJI bridge
        
        Your DJI bridge should expose endpoints like:
        - /api/attitude
        - /api/battery
        - /api/gps
        - /api/flight_status
        """
        try:
            # Example: fetch from your DJI bridge endpoints
            attitude = self._read("/api/attitude")
            battery = self._read("/api/battery")
            gps = self._read("/api/gps")
            status = self._read("/api/status")
            
            lat = self._number(gps.get('latitude'), -90, 90)
            lon = self._number(gps.get('longitude'), -180, 180)
            if lat is None or lon is None:
                lat = lon = None
            satellites = gps.get('satellite_count')
            if type(satellites) is not int or satellites < 0:
                satellites = None
            armed = status.get('motors_on')
            if type(armed) is not bool:
                armed = None
            return {
                "timestamp": time.time(),
                "altitude": self._number(gps.get('altitude')),
                "battery_voltage": self._number(battery.get('voltage'), 0),
                "status": status.get('flight_mode', 'UNKNOWN'),
                "attitude": {
                    "roll": self._number(attitude.get('roll')),
                    "pitch": self._number(attitude.get('pitch')),
                    "yaw": self._number(attitude.get('yaw'))
                },
                "gps": {
                    "satellites": satellites,
                    "latitude": lat,
                    "longitude": lon,
                    "altitude": self._number(gps.get('altitude'))
                },
                "signal_strength": self._number(status.get('signal_strength'), 0, 100),
                "ground_speed": self._number(gps.get('speed'), 0),
                "armed": armed,
                "flight_mode": status.get('flight_mode', 'UNKNOWN')
            }
        except Exception as e:
            print(f"Error fetching DJI telemetry: {e}")
            return self._empty_telemetry()
    
    def _empty_telemetry(self) -> Dict:
        """Return empty telemetry on error"""
        return {
            "timestamp": time.time(),
            "altitude": None,
            "battery_voltage": None,
            "status": "DISCONNECTED",
            "attitude": {"roll": None, "pitch": None, "yaw": None},
            "gps": {"satellites": None, "latitude": None, "longitude": None, "altitude": None},
            "signal_strength": None,
            "ground_speed": None,
            "armed": None,
            "flight_mode": "UNKNOWN"
        }
