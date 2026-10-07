# DC Monitoring System - Complete Implementation Guide

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 REMOTE SENSORS                     │
│  (Multiple WiFi devices, MQTT data transmission)            │
└─────────────────┬──────────────────────────────┬────────────┘
                  │                              │
                  ▼                              ▼
         ┌─────────────────┐          ┌──────────────────┐
         │  WiFi Network   │          │  Sensor Data     │
         │  (802.11 b/g/n) │          │  (Temperature,   │
         └────────┬────────┘          │   Humidity, etc) │
                  │                   └────────┬─────────┘
                  └──────────┬─────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   MQTT Broker (Mosquitto)    │
              │   Port: 1883                 │
              │   QoS: 1                     │
              └──────────────┬───────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐         ┌──────────────────┐
     │   InfluxDB 2.x  │         │  Alert Engine    │
     │  Time-series    │         │  (Node.js)       │
     │  Storage        │         │  - Thresholds    │
     └────────┬────────┘         │  - Alerts        │
              │                  │  - Notifications │
              │                  └────────┬─────────┘
              └──────────┬────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
   ┌─────────────────┐          ┌──────────────────┐
   │  REST API       │          │  WebSocket       │
   │  (Express.js)   │◄─────────┤  (Real-time      │
   │  • Sensors      │          │   Updates)       │
   │  • Alerts       │          └──────────────────┘
   │  • Export       │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │  React Frontend │
   │  Modern UI      │
   │  • Dashboard    │
   │  • Charts       │
   │  • Configurator │
   │  • Export       │
   └─────────────────┘
```

---

## Hardware Setup

### ESP32 Development Board
- **Model**: ESP32-WROOM-32D
- **RAM**: 520 KB SRAM
- **Flash**: 4 MB
- **GPIO**: 34 pins
- **WiFi**: 802.11 b/g/n @ 2.4GHz
- **Cost**: ~$10-15 per unit

### Sensors per ESP32
```
Sensor Type              GPIO Pin    Protocol      Cost
─────────────────────────────────────────────────────
DHT22 (Temp+Humidity)    GPIO 4      1-Wire       $3-5
DS18B20 (Temperature)    GPIO 5      1-Wire       $1-2
Analog Input (0-3.3V)    GPIO 34     ADC          Free
Battery Voltage          GPIO 35     ADC          Free
Door Contact             GPIO 27     Digital I/O  $1-2
Relay Control            GPIO 26     Digital I/O  Free (in code)
```

### Wiring Diagram
```
ESP32                    DHT22
─────────────────────────────────
GPIO 4 (Data) ────────── Pin 2
3.3V ───────────────────── Pin 1
GND ───────────────────── Pin 4

ESP32                    DS18B20
─────────────────────────────────
GPIO 5 (Data) ────────── Pin 1
3.3V ───────────────────── Pin 3
GND ───────────────────── Pin 2
[4.7k pullup on GPIO5]

ESP32                    Door Sensor
──────────────────────────────────
GPIO 27 ────────────────── Signal
GND ───────────────────── Ground
[10k pullup]

ESP32                    Battery (LiPo)
──────────────────────────────────
GPIO 35 (via voltage divider)
    [2.2k] ────┬──── 3.3V
               │
            [10k]
               │
              GND
```

---

## Software Installation

### 1. Arduino IDE Setup (ESP32 Firmware)

```bash
# Install Arduino IDE
sudo apt install arduino

# Add ESP32 board manager:
# File → Preferences → Additional Boards Manager URLs:
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

# Tools → Board → Board Manager → Search "ESP32" → Install

# Install Required Libraries:
# Sketch → Include Library → Manage Libraries
- DHT22 by Adafruit
- Dallas Temperature (OneWire)
- ArduinoJson
- PubSubClient
```

### 2. Arduino Sketch Configuration

Edit `esp32-sensor.ino`:

```cpp
// WiFi Configuration
const char* WIFI_SSID = "YourNetworkSSID";
const char* WIFI_PASS = "YourNetworkPassword";
const char* DEVICE_ID = "sensor_room_a1";

// MQTT Configuration
const char* MQTT_SERVER = "192.168.1.100";  // Central mini-PC IP
const char* MQTT_USER = "monitoring";
const char* MQTT_PASS = "secure_password";

// Sensor Configuration
#define DHT_PIN 4
#define ONEWIRE_PIN 5
#define BATTERY_PIN 35
```

### 3. Upload to ESP32

```bash
# Select Board: Tools → Board → ESP32 → ESP32-WROOM-DA
# Select Port: Tools → Port → /dev/ttyUSB0 (or COMx on Windows)
# Select Upload Speed: 921600
# Click Upload (or Ctrl+U)

# Monitor Serial Output: Tools → Serial Monitor (115200 baud)
```

---

## Backend Setup (Mini-PC)

### 1. Install Dependencies

```bash
# Node.js & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs npm

# Docker & Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Additional packages
sudo apt install -y git curl wget mosquitto mosquitto-clients
```

### 2. Docker Compose Stack

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
      - mosquitto-data:/mosquitto/data
    networks:
      - monitoring

  influxdb:
    image: influxdb:2.6
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: securepassword
      DOCKER_INFLUXDB_INIT_ORG: dc-monitoring
      DOCKER_INFLUXDB_INIT_BUCKET: sensors
      DOCKER_INFLUXDB_INIT_RETENTION: 30d
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: my-super-secret-token
    ports:
      - "8086:8086"
    volumes:
      - influxdb-data:/var/lib/influxdb2
    networks:
      - monitoring

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      MQTT_SERVER: mosquitto:1883
      INFLUXDB_URL: http://influxdb:8086
      INFLUXDB_TOKEN: my-super-secret-token
    ports:
      - "3000:3000"
    depends_on:
      - mosquitto
      - influxdb
    networks:
      - monitoring
    volumes:
      - ./config:/app/config

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring

volumes:
  mosquitto-data:
  influxdb-data:
  grafana-data:

networks:
  monitoring:
    driver: bridge
```

### 3. Start Services

```bash
# Navigate to project directory
cd /path/to/dc-monitoring

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### 4. Verify Connectivity

```bash
# Check MQTT connection
mosquitto_sub -h localhost -u monitoring -P secure_password -t "sensors/#"

# Check InfluxDB
curl -X GET "http://localhost:8086/api/v2/buckets" \
  -H "Authorization: Token my-super-secret-token"

# Check API
curl http://localhost:3000/api/health
```

---

## Frontend Setup (React Dashboard)

### 1. Install Dependencies

```bash
npx create-react-app dc-monitoring-dashboard
cd dc-monitoring-dashboard

npm install recharts axios socket.io-client exceljs pdfkit
npm install -D tailwindcss
```

### 2. File Structure

```
src/
├── components/
│   ├── Dashboard.jsx
│   ├── AlertConfigurator.jsx
│   ├── SensorCard.jsx
│   └── ChartsTab.jsx
├── pages/
│   ├── DashboardPage.jsx
│   └── ExportPage.jsx
├── services/
│   ├── api.js
│   └── websocket.js
├── styles/
│   ├── Dashboard.css
│   └── theme.css
└── App.jsx
```

### 3. API Service (`src/services/api.js`)

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const api = {
  // Sensors
  getSensors: () => fetch(`${API_BASE}/api/sensors`).then(r => r.json()),
  getSensorData: (sensorId, range = '24h') => 
    fetch(`${API_BASE}/api/data/${sensorId}?range=${range}`).then(r => r.json()),

  // Alerts
  getAlerts: () => fetch(`${API_BASE}/api/alerts/active`).then(r => r.json()),
  acknowledgeAlert: (alertId, note) =>
    fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    }).then(r => r.json()),

  // Export
  exportExcel: () => 
    fetch(`${API_BASE}/api/export/excel`).then(r => r.blob()),
  exportPDF: () => 
    fetch(`${API_BASE}/api/export/pdf`).then(r => r.blob()),
};
```

### 4. Build & Deploy

```bash
# Development
npm start

# Production build
npm run build

# Serve production build
npm install -g serve
serve -s build -l 3000
```

---

## Data Flow Example

### Temperature Reading Cycle (30-second interval)

```
ESP32 Sensor
├─ Read DHT22 (async, 2 seconds)
├─ Read DS18B20 (async, 750ms)
├─ Read Analog Inputs
├─ Prepare JSON payload
│  └─ {"timestamp": 1696607225, "temperature": 23.5, "humidity": 45.2, ...}
├─ Publish to MQTT
│  └─ sensors/sensor_room_a1/data
└─ Loop repeats every 30 seconds

MQTT Broker
├─ Receive message
├─ Route to subscribers
└─ Store in message queue

Alert Engine
├─ Subscribe to sensors/#
├─ Receive temperature: 23.5°C
├─ Evaluate all alert rules
│  └─ rule_001_temp_critical: 23.5 > 32? NO
│  └─ rule_002_temp_warning: 23.5 > 26? NO
│  └─ rule_004_corrosive: heat+humidity? NO
├─ No alerts triggered
└─ Log reading to history

InfluxDB
├─ Receive measurement via line protocol
├─ Store in sensors bucket
│  └─ {sensor_id, room, temperature, humidity, timestamp}
└─ Retention: 30 days (configurable)

React Dashboard
├─ WebSocket connection (real-time)
├─ Receive sensor update
├─ Update SensorCard component
│  └─ Re-render with new value
├─ Update chart data
├─ Add to 1-hour history
└─ Display on screen
```

---

## Configuration Files

### MQTT Configuration (`mosquitto.conf`)

```
port 1883
listener 1883
protocol mqtt

# Authentication
allow_anonymous false
password_file /mosquitto/config/passwd

# Message settings
max_inflight_messages 20
max_queued_messages 1000

# Persistence
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest stdout
log_type all
log_timestamp true
```

### Alert Rules Configuration (`config/alert-rules.json`)

```json
{
  "alert_rules": [
    {
      "rule_id": "rule_001_temp_critical",
      "name": "Temperature Critical",
      "condition": {
        "sensor_id": "temp_*",
        "operator": ">",
        "value": 32.0,
        "duration_seconds": 60
      },
      "severity": "critical",
      "cooldown_seconds": 300,
      "actions": [
        { "type": "email", "recipients": ["ops@company.md"] },
        { "type": "slack", "channel": "#datacenter-alerts" },
        { "type": "dashboard" }
      ]
    }
  ]
}
```

---

## Monitoring & Maintenance

### System Health Checks

```bash
# Check ESP32 connectivity
mosquitto_sub -h localhost -u monitoring -P secure_password \
  -t "sensors/+/data" -v

# View InfluxDB disk usage
du -sh /var/lib/docker/volumes/influxdb-data/_data/

# Check API logs
docker-compose logs api --tail 100

# Monitor resource usage
watch 'docker stats --no-stream'
```

### Common Issues & Fixes

**Issue**: ESP32 won't connect to WiFi
- Check SSID/password in `esp32-sensor.ino`
- Verify 2.4GHz network (ESP32 doesn't support 5GHz)
- Check WiFi power settings

**Issue**: MQTT messages not received
- Verify mosquitto is running: `docker-compose ps`
- Check credentials: `mosquitto_sub -h localhost -u monitoring -P secure_password -t "sensors/#"`
- View broker logs: `docker-compose logs mosquitto`

**Issue**: Dashboard not updating
- Check WebSocket connection in browser console
- Verify API is running: `curl http://localhost:3000/api/health`
- Check InfluxDB token in environment

**Issue**: High disk usage
- Check InfluxDB retention policy
- Archive old data: `influx delete --org dc-monitoring --bucket sensors --older-than 90d`
- Review sensor data frequency

---

## Scaling to Multiple Sensors

### ESP32 Deployment Plan

1. **Phase 1**: 3-5 sensors (proof of concept)
   - 1 per room
   - Same MQTT broker
   - Test for 1 week

2. **Phase 2**: 10-15 sensors (full coverage)
   - Temperature + humidity each room
   - Power/current monitoring
   - Door/smoke sensors
   - Backup WiFi access point

3. **Phase 3**: 20+ sensors (expansion)
   - Multiple mini-PCs for redundancy
   - Load balancing with HAProxy
   - Geo-distributed data centers

### Performance Tuning

```javascript
// Reduce data frequency during low-activity periods
if (hour >= 22 || hour <= 6) {
  PUBLISH_INTERVAL = 60000;  // 60 seconds at night
} else {
  PUBLISH_INTERVAL = 30000;  // 30 seconds during day
}

// Batch writes to InfluxDB for high-volume scenarios
async function batchWrite(readings) {
  const lines = readings.map(r => 
    `sensor_reading,sensor_id=${r.id} value=${r.value} ${r.timestamp}`
  );
  await influxdb.write(lines.join('\n'));
}
```

---

## Security Hardening

### Network Security

```bash
# Enable MQTT authentication
mosquitto_passwd -c /mosquitto/config/passwd monitoring

# Firewall rules
sudo ufw allow from 192.168.1.0/24 to any port 1883
sudo ufw allow from 192.168.1.0/24 to any port 3000

# HTTPS for API
npm install express-https-redirect
# Redirect HTTP to HTTPS, use Let's Encrypt certificate
```

### Data Security

```javascript
// Encrypt sensitive data in transit
const tls = require('tls');
const mqtt = require('mqtt');

const options = {
  key: fs.readFileSync('./certs/client-key.pem'),
  cert: fs.readFileSync('./certs/client-cert.pem'),
  ca: [fs.readFileSync('./certs/ca-cert.pem')],
  protocol: 'mqtts',
  port: 8883
};

const client = mqtt.connect('mqtts://broker.example.com', options);
```

### Access Control

```javascript
// RBAC in API
const roles = {
  admin: ['create', 'read', 'update', 'delete'],
  operator: ['read', 'acknowledge'],
  viewer: ['read']
};

app.use((req, res, next) => {
  const userRole = req.user.role;
  req.allowed = (action) => roles[userRole].includes(action);
  next();
});
```

---

## Testing & Validation

### Unit Tests

```javascript
// alert-engine.test.js
const AlertEngine = require('./alert-engine');

describe('AlertEngine', () => {
  it('should trigger critical alert when temp > 32°C', () => {
    const engine = new AlertEngine();
    engine.loadRules(testRules);
    
    let alertTriggered = false;
    engine.on('alert', () => { alertTriggered = true; });
    
    engine.processSensorReading('temp_a1', 34);
    expect(alertTriggered).toBe(true);
  });
});
```

### Load Testing

```bash
# Simulate 50 concurrent sensors sending data
npm install -g k6

cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 50,        // 50 virtual users
  duration: '5m', // 5 minute test
};

export default function() {
  let response = http.post('http://localhost:3000/api/data', {
    sensor_id: `sensor_${__VU}`,
    value: Math.random() * 40,
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

k6 run load-test.js
```

---

## Support & Documentation

For issues or questions:
- 📧 Email: ITSec@ernu.md
- 💬 GitHub Issues: anatolie-ernu/dc-monitoring
- 📖 Full docs: https://docs.ernu.md/dc-monitoring

---

**Last Updated**: Oct 6, 2026  
**Version**: 1.0  
**License**: MIT  
**Maintainer**: Anatolie Ernu
