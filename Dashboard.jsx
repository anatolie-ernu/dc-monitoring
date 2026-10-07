/**
 * DC MONITORING - MODERN DASHBOARD
 * Real-time sensor visualization with charts, gauges, and alerts
 */

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Gauge } from 'recharts';
import './Dashboard.css';

const Dashboard = ({ api, userRole }) => {
  const [sensors, setSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h'); // 1h, 24h, 7d, 30d
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [loading, setLoading] = useState(true);
  const websocketRef = useRef(null);

  useEffect(() => {
    loadDashboardData();
    subscribeToUpdates();
    
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [timeRange, selectedRoom]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [sensorsRes, alertsRes, chartRes] = await Promise.all([
        fetch(`${api}/api/sensors/current`),
        fetch(`${api}/api/alerts/active`),
        fetch(`${api}/api/data/history?range=${timeRange}&room=${selectedRoom}`)
      ]);

      const sensorsData = await sensorsRes.json();
      const alertsData = await alertsRes.json();
      const chartDataPoints = await chartRes.json();

      setSensors(sensorsData);
      setAlerts(alertsData);
      setChartData(chartDataPoints);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
    setLoading(false);
  };

  const subscribeToUpdates = () => {
    const wsUrl = api.replace('http', 'ws') + '/ws/dashboard';
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'sensor_update') {
        setSensors(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(s => s.id === message.sensor.id);
          if (idx >= 0) {
            updated[idx] = message.sensor;
          } else {
            updated.push(message.sensor);
          }
          return updated;
        });

        // Add to chart data
        setChartData(prev => [...prev.slice(-119), {
          timestamp: new Date().toLocaleTimeString(),
          ...message.sensor
        }]);
      }

      if (message.type === 'alert') {
        setAlerts(prev => [message.alert, ...prev]);
      }
    };
  };

  const rooms = Array.from(new Set(sensors.map(s => s.room))).sort();
  const filteredSensors = selectedRoom === 'all' 
    ? sensors 
    : sensors.filter(s => s.room === selectedRoom);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>📊 Data Center Monitoring</h1>
          <p className="subtitle">Real-time sensor dashboard</p>
        </div>
        <div className="header-right">
          <div className="time-filters">
            {['1h', '24h', '7d', '30d'].map(range => (
              <button
                key={range}
                className={`time-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
          <div className="status-indicator">
            <span className={`online-count ${sensors.length > 0 ? 'online' : 'offline'}`}>
              ● {sensors.filter(s => s.online).length}/{sensors.length} Online
            </span>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="stats-row">
        <StatCard
          title="Active Alerts"
          value={alerts.length}
          color={alerts.length > 0 ? '#d62728' : '#2ca02c'}
          icon="🚨"
          critical={alerts.filter(a => a.severity === 'critical').length}
        />
        <StatCard
          title="Avg Temperature"
          value={`${(sensors.filter(s => s.type === 'temperature').reduce((sum, s) => sum + s.value, 0) / Math.max(sensors.filter(s => s.type === 'temperature').length, 1)).toFixed(1)}°C`}
          color="#1f77b4"
          icon="🌡️"
          status="normal"
        />
        <StatCard
          title="Avg Humidity"
          value={`${(sensors.filter(s => s.type === 'humidity').reduce((sum, s) => sum + s.value, 0) / Math.max(sensors.filter(s => s.type === 'humidity').length, 1)).toFixed(0)}%`}
          color="#1f77b4"
          icon="💧"
          status="normal"
        />
        <StatCard
          title="System Uptime"
          value="99.95%"
          color="#2ca02c"
          icon="⏱️"
          status="normal"
        />
      </section>

      {/* Room Filter */}
      <div className="filter-bar">
        <label>Filter by Room:</label>
        <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
          <option value="all">All Rooms</option>
          {rooms.map(room => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Sensor Cards */}
        <div className="sensors-column">
          <h2>Sensors</h2>
          <div className="sensors-grid">
            {filteredSensors.map(sensor => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))}
          </div>
        </div>

        {/* Right Column: Alerts & Charts */}
        <div className="alerts-column">
          {/* Active Alerts */}
          <section className="alerts-panel">
            <h3>Active Alerts</h3>
            {alerts.length === 0 ? (
              <div className="empty-state">✓ No active alerts</div>
            ) : (
              <div className="alerts-list">
                {alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                    <div className="alert-header">
                      <span className="severity-badge">{alert.severity.toUpperCase()}</span>
                      <span className="alert-title">{alert.rule_name}</span>
                      <span className="alert-time">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="alert-detail">
                      {alert.sensor_id}: {alert.sensor_value} (threshold: {alert.threshold_value})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Temperature Trend Chart */}
          <section className="chart-panel">
            <h3>Temperature Trend (Last {timeRange})</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f36" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#8b92a4"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#8b92a4" label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ background: '#1a1f26', border: '1px solid #3a3f46', borderRadius: '6px' }}
                  labelStyle={{ color: '#e4e6eb' }}
                />
                <Legend />
                {rooms.map((room, idx) => (
                  <Line
                    key={room}
                    type="monotone"
                    dataKey={`${room}_temp`}
                    stroke={['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][idx % 4]}
                    dot={false}
                    name={room}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          {/* Humidity Trend Chart */}
          <section className="chart-panel">
            <h3>Humidity Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1f77b4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1f77b4" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f36" />
                <XAxis dataKey="timestamp" stroke="#8b92a4" />
                <YAxis stroke="#8b92a4" />
                <Tooltip contentStyle={{ background: '#1a1f26', border: '1px solid #3a3f46' }} />
                <Area 
                  type="monotone" 
                  dataKey="humidity" 
                  stroke="#1f77b4" 
                  fillOpacity={1} 
                  fill="url(#colorHumidity)"
                  name="Humidity %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>

      {/* Bottom: Power & Statistics */}
      <section className="bottom-panels">
        <div className="power-panel">
          <h3>Power Consumption</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f36" />
              <XAxis dataKey="timestamp" stroke="#8b92a4" />
              <YAxis stroke="#8b92a4" label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ background: '#1a1f26', border: '1px solid #3a3f46' }} />
              <Legend />
              <Bar dataKey="power_phase1" stackId="a" fill="#1f77b4" name="Phase 1" />
              <Bar dataKey="power_phase2" stackId="a" fill="#ff7f0e" name="Phase 2" />
              <Bar dataKey="power_phase3" stackId="a" fill="#2ca02c" name="Phase 3" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="statistics-panel">
          <h3>Statistics ({timeRange})</h3>
          <div className="stats-grid">
            <StatDetail label="Avg Temperature" value="22.5°C" trend="↓ 1.2°C" />
            <StatDetail label="Max Temperature" value="26.8°C" trend="↑ from 25°C" />
            <StatDetail label="Min Temperature" value="19.2°C" trend="stable" />
            <StatDetail label="Humidity Range" value="35% - 62%" trend="normal" />
            <StatDetail label="Alert Count" value={alerts.length} trend={alerts.length === 0 ? '✓' : '!'} />
            <StatDetail label="MTTR" value="23 min" trend="avg" />
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * Sensor Card Component
 */
const SensorCard = ({ sensor }) => {
  const getStatusColor = () => {
    if (!sensor.online) return '#7f7f7f';
    if (sensor.status === 'critical') return '#d62728';
    if (sensor.status === 'warning') return '#ff7f0e';
    return '#2ca02c';
  };

  const getIcon = () => {
    switch (sensor.type) {
      case 'temperature': return '🌡️';
      case 'humidity': return '💧';
      case 'power': return '⚡';
      case 'door': return '🚪';
      case 'smoke': return '💨';
      default: return '📊';
    }
  };

  return (
    <div className="sensor-card">
      <div className="sensor-header">
        <span className="sensor-icon">{getIcon()}</span>
        <span className="sensor-name">{sensor.name}</span>
        <span 
          className={`status-dot ${sensor.online ? 'online' : 'offline'}`}
          style={{ background: getStatusColor() }}
        />
      </div>

      <div className="sensor-value">
        <div className="main-value">{sensor.value}</div>
        <div className="unit">{sensor.unit}</div>
      </div>

      <div className="sensor-details">
        <div className="detail-row">
          <span className="label">Status:</span>
          <span className={`value ${sensor.status}`}>{sensor.status}</span>
        </div>
        <div className="detail-row">
          <span className="label">Range:</span>
          <span className="value">{sensor.min} - {sensor.max}</span>
        </div>
      </div>

      <div className="sensor-footer">
        <span className="last-update">Updated {sensor.time_ago}</span>
        {sensor.battery !== undefined && (
          <span className="battery">🔋 {sensor.battery}%</span>
        )}
      </div>

      {/* Mini Sparkline */}
      <div className="sparkline">
        <svg width="100%" height="30" viewBox="0 0 100 30">
          <polyline
            points={sensor.sparkline.map((v, i) => `${i * 5},${30 - (v / 40) * 25}`).join(' ')}
            fill="none"
            stroke={getStatusColor()}
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard = ({ title, value, color, icon, status, critical }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ color }}>{icon}</div>
    <div className="stat-content">
      <div className="stat-title">{title}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {critical !== undefined && critical > 0 && (
        <div className="stat-critical">⚠️ {critical} critical</div>
      )}
    </div>
  </div>
);

/**
 * Stat Detail Component
 */
const StatDetail = ({ label, value, trend }) => (
  <div className="stat-detail">
    <div className="detail-label">{label}</div>
    <div className="detail-value">{value}</div>
    <div className={`detail-trend ${trend.includes('↑') ? 'up' : trend.includes('↓') ? 'down' : 'stable'}`}>
      {trend}
    </div>
  </div>
);

export default Dashboard;
