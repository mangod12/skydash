"""
MAVLink adapter for real drone telemetry
Supports ArduPilot, PX4, and MAVLink-compatible drones
"""
from pymavlink import mavutil
from typing import Dict, Optional
import threading
import time


class MAVLinkDrone:
    """
    Connects to a real drone via MAVLink protocol
    """
    
    def __init__(self, connection_string: str = "udp:127.0.0.1:14550"):
        """
        Args:
            connection_string: MAVLink connection string
                - Serial: "/dev/ttyUSB0" (Linux) or "COM3" (Windows)
                - UDP: "udp:127.0.0.1:14550" (for simulators like SITL)
                - TCP: "tcp:127.0.0.1:5760"
        """
        self.connection_string = connection_string
        self.master = None
        self.latest_telemetry = {}
        self.running = False
        self.thread = None
        
    def connect(self):
        """Establish connection to drone"""
        try:
            self.master = mavutil.mavlink_connection(self.connection_string)
            self.master.wait_heartbeat()
            print(f"Connected to drone (system {self.master.target_system})")
            
            # Request data streams
            self.master.mav.request_data_stream_send(
                self.master.target_system,
                self.master.target_component,
                mavutil.mavlink.MAV_DATA_STREAM_ALL,
                10,  # 10Hz update rate
                1    # Start streaming
            )
            
            # Start background thread to receive messages
            self.running = True
            self.thread = threading.Thread(target=self._receive_loop, daemon=True)
            self.thread.start()
            
        except Exception as e:
            print(f"Failed to connect: {e}")
            raise
    
    def _receive_loop(self):
        """Background thread to receive MAVLink messages"""
        while self.running:
            try:
                msg = self.master.recv_match(blocking=True, timeout=1.0)
                if msg:
                    self._process_message(msg)
            except Exception as e:
                print(f"Error receiving message: {e}")
    
    def _process_message(self, msg):
        """Process incoming MAVLink messages"""
        msg_type = msg.get_type()
        
        if msg_type == 'ATTITUDE':
            # Roll, Pitch, Yaw in radians -> convert to degrees
            self.latest_telemetry['roll'] = msg.roll * 57.2958  # rad to deg
            self.latest_telemetry['pitch'] = msg.pitch * 57.2958
            self.latest_telemetry['yaw'] = msg.yaw * 57.2958
            
        elif msg_type == 'GLOBAL_POSITION_INT':
            # Altitude in millimeters -> convert to meters
            self.latest_telemetry['altitude'] = msg.relative_alt / 1000.0
            self.latest_telemetry['latitude'] = msg.lat / 1e7
            self.latest_telemetry['longitude'] = msg.lon / 1e7
            
        elif msg_type == 'VFR_HUD':
            self.latest_telemetry['ground_speed'] = msg.groundspeed
            self.latest_telemetry['altitude_msl'] = msg.alt
            
        elif msg_type == 'SYS_STATUS':
            # Battery voltage in millivolts -> convert to volts
            self.latest_telemetry['battery_voltage'] = msg.voltage_battery / 1000.0
            self.latest_telemetry['battery_remaining'] = msg.battery_remaining
            
        elif msg_type == 'GPS_RAW_INT':
            self.latest_telemetry['gps_satellites'] = msg.satellites_visible
            self.latest_telemetry['gps_fix_type'] = msg.fix_type
            
        elif msg_type == 'HEARTBEAT':
            self.latest_telemetry['armed'] = msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED != 0
            self.latest_telemetry['flight_mode'] = mavutil.mode_string_v10(msg)
    
    def get_telemetry(self) -> Dict:
        """
        Get current telemetry in SkyDash format
        
        Returns:
            Dict compatible with SkyDash API
        """
        return {
            "timestamp": time.time(),
            "altitude": self.latest_telemetry.get('altitude', 0.0),
            "battery_voltage": self.latest_telemetry.get('battery_voltage', 0.0),
            "status": "ARMED" if self.latest_telemetry.get('armed', False) else "DISARMED",
            "attitude": {
                "roll": round(self.latest_telemetry.get('roll', 0.0), 2),
                "pitch": round(self.latest_telemetry.get('pitch', 0.0), 2),
                "yaw": round(self.latest_telemetry.get('yaw', 0.0), 2)
            },
            "gps": {
                "satellites": self.latest_telemetry.get('gps_satellites', 0),
                "latitude": self.latest_telemetry.get('latitude', 0.0),
                "longitude": self.latest_telemetry.get('longitude', 0.0),
                "altitude": self.latest_telemetry.get('altitude', 0.0)
            },
            "signal_strength": 100,  # MAVLink doesn't provide this directly
            "ground_speed": round(self.latest_telemetry.get('ground_speed', 0.0), 2),
            "armed": self.latest_telemetry.get('armed', False),
            "flight_mode": self.latest_telemetry.get('flight_mode', 'UNKNOWN')
        }
    
    def disconnect(self):
        """Close connection"""
        self.running = False
        if self.thread:
            self.thread.join()
        if self.master:
            self.master.close()


# Example usage in main.py:
# from mavlink_adapter import MAVLinkDrone
# drone = MAVLinkDrone("udp:127.0.0.1:14550")  # or your connection string
# drone.connect()
# 
# @app.get("/telemetry")
# async def get_telemetry():
#     return drone.get_telemetry()
