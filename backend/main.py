from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import random
import time
from typing import Dict

app = FastAPI(title="SkyDash Drone Simulator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DroneState:
    """
    Simulates realistic drone flight telemetry data.
    Updates state values each time telemetry is requested.
    """
    
    def __init__(self):
        self.start_time = time.time()
        self.initial_battery = 16.8
        self.battery_drain_rate = 0.001  # 0.001V per request as per spec
        self.request_count = 0
        self.base_altitude = 50.0  # Center point for hovering
        self.altitude_variance = 5.0  # ±5m for 50m ± 5m range
        
    def get_telemetry(self) -> Dict:
        """
        Generate current telemetry data with realistic simulation.
        
        Returns:
            Dict containing altitude, battery, roll, pitch, and other metrics
        """
        self.request_count += 1
        elapsed_time = time.time() - self.start_time
        
        # Simulate altitude using sine wave (hovering/drifting 50m ± 5m)
        # Period of ~10 seconds for realistic hovering oscillation
        altitude = self.base_altitude + (
            self.altitude_variance * math.sin(elapsed_time * 0.6)
        )
        
        # Battery voltage decreases linearly per request (0.001V per request)
        battery_voltage = max(
            14.0,  # Minimum safe voltage (4S LiPo cutoff)
            self.initial_battery - (self.battery_drain_rate * self.request_count)
        )
        
        # Calculate battery percentage (4S LiPo: 14.0V-16.8V range)
        battery_percentage = int(((battery_voltage - 14.0) / 2.8) * 100)
        
        # Determine flight status based on battery
        status = "ARMED" if battery_voltage > 14.0 else "RTL"
        
        # Generate Gaussian noise for Roll/Pitch (±2 degrees) - wind buffeting
        roll = round(random.gauss(0, 0.67), 2)  # ~95% within ±2 degrees
        pitch = round(random.gauss(0, 0.67), 2)
        
        # Yaw slowly drifts over time
        yaw = round((elapsed_time * 5) % 360, 2)
        
        # GPS satellites (stable between 10-14)
        gps_satellites = random.randint(10, 14)
        
        # Signal strength (varies slightly)
        signal_strength = random.randint(85, 100)
        
        # Ground speed with slight variation
        ground_speed = round(random.uniform(0.5, 2.5), 2)
        
        return {
            "timestamp": round(elapsed_time, 2),
            "altitude": round(altitude, 2),
            "battery_voltage": round(battery_voltage, 2),
            "status": status,
            "attitude": {
                "roll": roll,
                "pitch": pitch,
                "yaw": yaw
            },
            "gps": {
                "satellites": gps_satellites,
                "latitude": 37.7749 + (random.uniform(-0.0001, 0.0001)),
                "longitude": -122.4194 + (random.uniform(-0.0001, 0.0001)),
                "altitude": round(altitude, 2)
            },
            "signal_strength": signal_strength,
            "ground_speed": ground_speed,
            "armed": status == "ARMED",
            "flight_mode": "STABILIZE" if status == "ARMED" else "RTL"
        }


# Create a single instance of DroneState
drone = DroneState()


class TelemetryResponse(BaseModel):
    """Response model for telemetry data"""
    timestamp: float
    altitude: float
    battery_voltage: float
    status: str
    attitude: Dict[str, float]
    gps: Dict
    signal_strength: int
    ground_speed: float
    armed: bool
    flight_mode: str


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "SkyDash Drone Simulator API",
        "version": "1.0.0",
        "endpoints": {
            "/telemetry": "Get current drone telemetry data",
            "/docs": "Interactive API documentation"
        }
    }


@app.get("/telemetry", response_model=TelemetryResponse)
async def get_telemetry() -> Dict:
    """
    Get current drone telemetry data.
    
    Returns simulated real-time flight data including:
    - Altitude (hovering 50m ± 5m using sine wave)
    - Battery voltage (4S LiPo: 16.8V decaying at 0.001V per request)
    - Attitude (roll, pitch, yaw with Gaussian noise for wind buffeting)
    - GPS data
    - Signal strength
    - Ground speed
    - Flight status (ARMED if battery > 14V, else RTL)
    """
    return drone.get_telemetry()


@app.post("/reset")
async def reset_simulation():
    """Reset the drone simulation to initial state"""
    global drone
    drone = DroneState()
    return {"message": "Simulation reset successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
