# SkyDash - High-Performance Drone Dashboard

A real-time drone telemetry dashboard built with FastAPI and React, featuring a "High-Voltage / Dark Mode" aesthetic with glass morphism design.

![SkyDash Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.12-blue) ![React](https://img.shields.io/badge/react-18.3-61dafb)

## Features

- 🚁 **Real-time Telemetry**: 50ms polling for live drone data
- 📊 **Interactive Charts**: Altitude history with Recharts
- 🎨 **Glass Morphism UI**: Modern dark theme with blur effects
- 🔋 **Battery Monitoring**: Color-coded voltage display (red < 14V)
- 🌐 **MAVLink Support**: Compatible with ArduPilot, PX4 drones
- 📡 **WebSocket Ready**: High-frequency data streaming
- 🎯 **Bento Grid Layout**: Responsive dashboard design

## Dashboard Components

- **Attitude Indicator**: Live Roll, Pitch, Yaw values
- **3D View/Map**: Central display with altitude and flight metrics
- **System Status**: Battery, connection status, flight mode
- **Altitude History**: Real-time graph with 50-point history

## Quick Start

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Server runs on `http://localhost:8000`

### Frontend (React + Vite)

```bash
cd skydash/frontend
npm install
npm run dev
```

Dashboard runs on `http://localhost:5173`

## Project Structure

```
skydash/
├── backend/
│   ├── main.py                    # FastAPI server with drone simulator
│   ├── mavlink_adapter.py         # MAVLink integration
│   ├── dji_adapter.py             # DJI drone adapter
│   ├── requirements.txt           # Python dependencies
│   └── requirements_real_drone.txt
├── skydash/frontend/
│   ├── src/
│   │   ├── App.jsx               # Main dashboard component
│   │   ├── index.css             # Global styles
│   │   └── main.jsx              # Entry point
│   ├── tailwind.config.js        # Tailwind + glass utilities
│   └── package.json
└── INTEGRATION_GUIDE.md          # Real drone integration guide
```

## Real Drone Integration

### MAVLink Drones (ArduPilot, PX4)

```python
from mavlink_adapter import MAVLinkDrone

# USB/Serial connection
drone = MAVLinkDrone("COM3")  # Windows
drone = MAVLinkDrone("/dev/ttyUSB0")  # Linux

# WiFi/Network
drone = MAVLinkDrone("tcp:192.168.1.100:5760")

drone.connect()
```

### DJI Drones

Requires DJI SDK bridge - see `dji_adapter.py` and `INTEGRATION_GUIDE.md`

### Testing with SITL

```python
drone = MAVLinkDrone("udp:127.0.0.1:14550")
drone.connect()
```

## API Endpoints

- `GET /` - API information
- `GET /telemetry` - Current drone telemetry (JSON)
- `POST /reset` - Reset simulation
- `GET /docs` - Interactive API documentation (Swagger)

## Tech Stack

**Backend:**
- FastAPI 0.115.6
- Uvicorn (ASGI server)
- Pydantic (data validation)
- PyMAVLink (drone communication)

**Frontend:**
- React 18.3
- Vite 7.2
- Tailwind CSS 3.4
- Recharts 2.15
- Framer Motion 11.15

## Telemetry Data Format

```json
{
  "timestamp": 162.75,
  "altitude": 48.7,
  "battery_voltage": 14.86,
  "status": "ARMED",
  "attitude": {
    "roll": 0.39,
    "pitch": -0.67,
    "yaw": 93.76
  },
  "gps": {
    "satellites": 11,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 48.7
  },
  "signal_strength": 93,
  "ground_speed": 1.45,
  "armed": true,
  "flight_mode": "STABILIZE"
}
```

## Configuration

### CORS Settings

Backend allows connections from:
- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`

### Polling Rate

Frontend polls at **50ms** intervals (20Hz) - configurable in `App.jsx`:

```javascript
const POLL_INTERVAL = 50; // milliseconds
```

## Development

### Backend Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload

# Or use the main script
python main.py
```

### Frontend Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Design System

### Colors

- **Background**: Zinc-950 (#09090b)
- **Text**: Zinc-100
- **Brand**: Indigo-500 (#6366f1)
- **Accent**: Emerald (battery good), Red (battery low)

### Glass Utility

```css
.glass {
  backdrop-filter: blur(12px);
  background-color: rgba(9, 9, 11, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

## Performance

- **Memory Leak Prevention**: Proper cleanup of intervals on unmount
- **50 Data Point Limit**: Altitude history capped for performance
- **Animation Disabled**: Charts use `isAnimationActive={false}` for smoothness

## Security Notes

⚠️ **For Production Use:**

1. Add authentication (JWT, API keys)
2. Enable HTTPS/WSS
3. Implement rate limiting
4. Validate all inputs
5. Never expose control commands without auth

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Use different port
uvicorn main:app --port 8001
```

### Frontend shows "DISCONNECTED"
- Verify backend is running on port 8000
- Check CORS configuration
- Test API: `curl http://localhost:8000/telemetry`

### MAVLink connection fails
- Verify connection string
- Check USB permissions (Linux: add user to dialout group)
- Test with MAVProxy first

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- MAVLink protocol for drone communication
- ArduPilot/PX4 communities
- Tailwind CSS team
- Recharts library


---

Built with ❤️ for the drone community
