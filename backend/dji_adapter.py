"""
DJI SDK adapter for DJI drones (Mobile SDK / Onboard SDK)
Requires DJI SDK setup on mobile device or onboard computer
"""
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
            attitude = self.session.get(f"{self.bridge_url}/api/attitude").json()
            battery = self.session.get(f"{self.bridge_url}/api/battery").json()
            gps = self.session.get(f"{self.bridge_url}/api/gps").json()
            status = self.session.get(f"{self.bridge_url}/api/status").json()
            
            return {
                "timestamp": time.time(),
                "altitude": gps.get('altitude', 0.0),
                "battery_voltage": battery.get('voltage', 0.0),
                "status": status.get('flight_mode', 'UNKNOWN'),
                "attitude": {
                    "roll": attitude.get('roll', 0.0),
                    "pitch": attitude.get('pitch', 0.0),
                    "yaw": attitude.get('yaw', 0.0)
                },
                "gps": {
                    "satellites": gps.get('satellite_count', 0),
                    "latitude": gps.get('latitude', 0.0),
                    "longitude": gps.get('longitude', 0.0),
                    "altitude": gps.get('altitude', 0.0)
                },
                "signal_strength": status.get('signal_strength', 0),
                "ground_speed": gps.get('speed', 0.0),
                "armed": status.get('motors_on', False),
                "flight_mode": status.get('flight_mode', 'UNKNOWN')
            }
        except Exception as e:
            print(f"Error fetching DJI telemetry: {e}")
            return self._empty_telemetry()
    
    def _empty_telemetry(self) -> Dict:
        """Return empty telemetry on error"""
        return {
            "timestamp": time.time(),
            "altitude": 0.0,
            "battery_voltage": 0.0,
            "status": "DISCONNECTED",
            "attitude": {"roll": 0.0, "pitch": 0.0, "yaw": 0.0},
            "gps": {"satellites": 0, "latitude": 0.0, "longitude": 0.0, "altitude": 0.0},
            "signal_strength": 0,
            "ground_speed": 0.0,
            "armed": False,
            "flight_mode": "UNKNOWN"
        }
