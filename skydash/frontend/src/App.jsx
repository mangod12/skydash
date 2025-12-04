import { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [altitudeHistory, setAltitudeHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let intervalId = null;

    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://localhost:8000/telemetry');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        setTelemetry(data);
        setIsConnected(true);
        
        // Update altitude history (keep only last 50 points)
        setAltitudeHistory((prev) => {
          const newHistory = [
            ...prev,
            {
              time: data.timestamp,
              altitude: data.altitude,
            }
          ];
          
          // Keep only the last 50 data points
          return newHistory.slice(-50);
        });
      } catch (error) {
        console.error('Failed to fetch telemetry:', error);
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchTelemetry();

    // Poll every 50ms
    intervalId = setInterval(fetchTelemetry, 50);

    // Cleanup function to prevent memory leaks
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Empty dependency array - run once on mount

  // Determine battery color based on voltage
  const getBatteryColor = (voltage) => {
    if (!voltage) return 'text-zinc-400';
    return voltage < 14.0 ? 'text-red-500' : 'text-emerald-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 p-6 h-screen bg-zinc-950">
      {/* Cell 1: Attitude Indicator */}
      <div className="glass rounded-2xl p-6 flex flex-col">
        <h2 className="text-zinc-400 text-sm font-semibold mb-4 tracking-wider">ATTITUDE</h2>
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <div>
            <div className="text-zinc-500 text-xs mb-1">ROLL</div>
            <div className="text-4xl font-bold text-cyan-400 font-mono">
              {telemetry?.attitude.roll.toFixed(2) ?? '--'}°
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs mb-1">PITCH</div>
            <div className="text-4xl font-bold text-blue-400 font-mono">
              {telemetry?.attitude.pitch.toFixed(2) ?? '--'}°
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs mb-1">YAW</div>
            <div className="text-2xl font-medium text-zinc-400 font-mono">
              {telemetry?.attitude.yaw.toFixed(1) ?? '--'}°
            </div>
          </div>
        </div>
      </div>

      {/* Cell 2: Main Visualizer (Center - spans 2 columns) */}
      <div className="glass rounded-2xl p-6 flex flex-col md:col-span-2">
        <h2 className="text-zinc-400 text-sm font-semibold mb-4 tracking-wider">3D VIEW / MAP</h2>
        <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-xl bg-zinc-900/30">
          {/* Animated grid background */}
          <div className="absolute inset-0 opacity-20">
            <div 
              className="absolute inset-0" 
              style={{
                backgroundImage: 'linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }} 
            />
          </div>
          
          {/* Placeholder for 3D drone view */}
          <div className="z-10 text-center space-y-4">
            <div className="text-7xl font-bold text-brand font-mono">
              {telemetry?.altitude.toFixed(1) ?? '--'}m
            </div>
            <div className="text-zinc-500 text-sm tracking-wider">ALTITUDE MSL</div>
            <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-zinc-500 text-xs mb-1">GPS SATS</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {telemetry?.gps.satellites ?? '--'}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs mb-1">SPEED</div>
                <div className="text-2xl font-bold text-blue-400">
                  {telemetry?.ground_speed.toFixed(1) ?? '--'} m/s
                </div>
              </div>
              <div>
                <div className="text-zinc-500 text-xs mb-1">MODE</div>
                <div className="text-2xl font-bold text-purple-400">
                  {telemetry?.flight_mode ?? '--'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cell 3: System Status (Right column) */}
      <div className="glass rounded-2xl p-6 flex flex-col">
        <h2 className="text-zinc-400 text-sm font-semibold mb-4 tracking-wider">SYSTEM STATUS</h2>
        <div className="flex-1 space-y-6">
          {/* Battery Voltage */}
          <div className="bg-zinc-900/50 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-2">BATTERY VOLTAGE</div>
            <div className={`text-4xl font-bold font-mono ${getBatteryColor(telemetry?.battery_voltage)}`}>
              {telemetry?.battery_voltage.toFixed(2) ?? '--'}V
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Status: {telemetry?.status ?? 'UNKNOWN'}
            </div>
          </div>

          {/* Connection Status */}
          <div className="bg-zinc-900/50 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-2">CONNECTION</div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <div className={`text-xl font-bold ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            </div>
            {!isConnected && (
              <div className="mt-2 text-xs text-red-400">
                ⚠️ Backend offline
              </div>
            )}
          </div>

          {/* Signal Strength */}
          <div className="bg-zinc-900/50 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-2">SIGNAL</div>
            <div className="text-2xl font-bold text-blue-400">
              {telemetry?.signal_strength ?? '--'}%
            </div>
          </div>
        </div>
      </div>

      {/* Cell 4: Telemetry Graph (Bottom - wide span) */}
      <div className="glass rounded-2xl p-6 flex flex-col md:col-span-3">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-zinc-400 text-sm font-semibold tracking-wider">ALTITUDE HISTORY</h2>
          <div className="text-zinc-500 text-xs">
            {altitudeHistory.length} samples
          </div>
        </div>
        
        <div className="flex-1 relative min-h-[150px]">
          {altitudeHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={altitudeHistory}>
                <defs>
                  <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="altitude"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#altitudeGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-zinc-600">Waiting for telemetry data...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
