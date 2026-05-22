# SkyDash Real Drone Integration Guide

## Overview
This guide shows you how to connect SkyDash to real drone hardware instead of the simulator.

---

## Option 1: MAVLink Drones (ArduPilot, PX4)

### Step 1: Install Dependencies
```bash
pip install pymavlink pyserial
```

### Step 2: Update `backend/main.py`
Replace the simulation code:

```python
from mavlink_adapter import MAVLinkDrone

# Choose your connection:
# - Serial: drone = MAVLinkDrone("/dev/ttyUSB0")  # Linux
# - Serial: drone = MAVLinkDrone("COM3")          # Windows
# - UDP: drone = MAVLinkDrone("udp:127.0.0.1:14550")  # SITL simulator
# - TCP: drone = MAVLinkDrone("tcp:192.168.1.100:5760")  # WiFi telemetry

drone = MAVLinkDrone("udp:127.0.0.1:14550")  # Change this!
drone.connect()

@app.get("/telemetry")
async def get_telemetry():
    return drone.get_telemetry()
```

### Step 3: Connection Examples

**Physical Serial Connection:**
```python
# Linux with USB telemetry radio
drone = MAVLinkDrone("/dev/ttyUSB0")

# Windows with USB telemetry radio
drone = MAVLinkDrone("COM3")
```

**WiFi/Network Connection:**
```python
# Connect to drone over WiFi
drone = MAVLinkDrone("tcp:192.168.1.100:5760")
```

**SITL Simulator (for testing):**
```python
# Connect to ArduPilot SITL
drone = MAVLinkDrone("udp:127.0.0.1:14550")
```

---

## Option 2: DJI Drones

DJI requires a **bridge application** because they don't use MAVLink.

### Approach A: DJI Mobile SDK (Android/iOS)
1. Create an Android/iOS app using [DJI Mobile SDK](https://developer.dji.com/mobile-sdk/)
2. Implement HTTP endpoints in your app to expose telemetry
3. Use `dji_adapter.py` to fetch data from your mobile app

### Approach B: DJI Onboard SDK
1. Install DJI Onboard SDK on companion computer (Raspberry Pi, etc.)
2. Create a bridge service that exposes telemetry via HTTP
3. Configure `DJIDrone` class with your bridge URL

---

## Option 3: Custom UART/Serial Protocol

For custom drones with proprietary protocols:

```python
import serial
import json

class CustomDrone:
    def __init__(self, port="/dev/ttyUSB0", baudrate=115200):
        self.serial = serial.Serial(port, baudrate)
    
    def get_telemetry(self):
        # Read from your drone's serial protocol
        line = self.serial.readline().decode('utf-8')
        data = json.loads(line)  # Adjust based on your format
        
        # Map to SkyDash format
        return {
            "altitude": data['alt'],
            "battery_voltage": data['bat'],
            "attitude": {
                "roll": data['roll'],
                "pitch": data['pitch'],
                "yaw": data['yaw']
            },
            # ... map other fields
        }
```

---

## Option 4: ROS/ROS2 Integration

For drones using ROS:

```python
import rclpy
from sensor_msgs.msg import NavSatFix, BatteryState
from geometry_msgs.msg import PoseStamped

class ROSDrone:
    def __init__(self):
        rclpy.init()
        self.node = rclpy.create_node('skydash_bridge')
        self.latest_data = {}
        
        # Subscribe to ROS topics
        self.node.create_subscription(
            NavSatFix, 
            '/mavros/global_position/global', 
            self.gps_callback, 
            10
        )
        # Add more subscriptions...
    
    def get_telemetry(self):
        return self.latest_data
```

---

## Testing with ArduPilot SITL

Best way to test without real hardware:

### Step 1: Install ArduPilot SITL
```bash
# Linux/Mac
git clone https://github.com/ArduPilot/ardupilot.git
cd ardupilot
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile
cd ArduCopter
sim_vehicle.py -w
```

### Step 2: Connect SkyDash
```python
# In main.py
from mavlink_adapter import MAVLinkDrone

drone = MAVLinkDrone("udp:127.0.0.1:14550")
drone.connect()
```

### Step 3: Run
```bash
python backend/main.py
```

---

## Configuration Reference

### Connection Strings

| Type | Example | Use Case |
|------|---------|----------|
| Serial | `COM3` or `/dev/ttyUSB0` | Direct USB/Radio connection |
| UDP | `udp:127.0.0.1:14550` | SITL simulator |
| TCP | `tcp:192.168.1.100:5760` | WiFi telemetry |
| UDP Broadcast | `udpout:127.0.0.1:14550` | Send MAVLink commands |

### Baud Rates (Serial)

- **57600**: Common for 3DR radios
- **115200**: Most modern telemetry radios
- **921600**: High-speed serial (short cables)

---

## Troubleshooting

### "No heartbeat received"
- Check connection string
- Verify drone is powered on
- Check firewall/port settings
- Try different baud rate (serial)

### "Permission denied" (Linux)
```bash
sudo usermod -a -G dialout $USER
# Logout and login
```

### CORS errors in browser
Already configured for `localhost:5173-5175`. If using different port:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:YOUR_PORT"],
    # ...
)
```

---

## Security Notes

⚠️ **Important for Production:**

1. **Never expose control commands** without authentication
2. **Use HTTPS** in production (not HTTP)
3. **Implement rate limiting** on API endpoints
4. **Validate all inputs** before sending to drone
5. **Add authentication** (JWT tokens, API keys)

---

## Next Steps

1. Choose your drone type from options above
2. Install required dependencies
3. Update `main.py` with appropriate adapter
4. Test connection
5. Start SkyDash dashboard

For questions, refer to:
- **MAVLink**: https://mavlink.io/
- **ArduPilot**: https://ardupilot.org/
- **PX4**: https://px4.io/
- **DJI SDK**: https://developer.dji.com/
