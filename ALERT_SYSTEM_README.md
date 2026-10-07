# DC Monitoring - Alert System Documentation

## Overview

Complete alert management system with:
- ✅ Multi-level severity (info/warning/critical)
- ✅ Threshold-based & compound conditions
- ✅ Hysteresis & cooldown (prevent flapping)
- ✅ Rate-of-change detection
- ✅ Multi-channel notifications (email, Slack, SMS, webhook, dashboard)
- ✅ Alert suppression windows (quiet hours, maintenance)
- ✅ RBAC-enforced Web UI
- ✅ Real-time WebSocket updates

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SENSOR DATA                              │
│  (ZigBee, Modbus, RS232, TCP/IP, MQTT)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   DATA COLLECTION LAYER        │
        │  (Zigbee2MQTT, Modbus Poller)  │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   MESSAGE BROKER (MQTT)        │
        │      Mosquitto Broker          │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   TIME-SERIES DATABASE         │
        │      InfluxDB 2.x              │
        └────────────────┬───────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
    ┌──────────────────┐     ┌──────────────────┐
    │  ALERT ENGINE    │     │    GRAFANA       │
    │  (Node.js)       │     │  (Visualization) │
    │                  │     │                  │
    │  • Conditions    │     └──────────────────┘
    │  • Rules         │
    │  • Thresholds    │
    │  • Hysteresis    │
    │  • Cooldown      │
    │  • Suppression   │
    └──────────┬───────┘
               │
    ┌──────────┴──────────────────────────────┐
    │     NOTIFICATION CHANNELS               │
    ├──────────────────────────────────────────┤
    │ • Email (SMTP)                           │
    │ • Slack (Webhook)                        │
    │ • SMS (Twilio)                           │
    │ • Webhook (Custom)                       │
    │ • Dashboard (WebSocket)                  │
    │ • Log Files                              │
    └──────────────────────────────────────────┘
               │
    ┌──────────┴─────────────────────┐
    │                                │
    ▼                                ▼
┌──────────────┐            ┌──────────────────┐
│  REST API    │            │  WEB UI React    │
│ (Alert CRUD) │            │  Dashboard+      │
│              │            │  Configurator    │
│ • GET/POST   │            │  • RBAC Protected│
│ • Bulk ops   │            │  • 6 Tabs        │
│ • History    │            │  • Real-time     │
└──────────────┘            └──────────────────┘
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install express socket.io axios nodemailer
npm install influxdb-client mqtt
npm install react react-dom recharts material-ui

# Or use Docker Compose (recommended)
docker-compose up -d
```

### 2. Load Alert Rules

```javascript
const AlertEngine = require('./alert-engine');
const alertEngine = new AlertEngine(config);

// Load rules from JSON
alertEngine.loadRules(require('./alert-rules.json'));
alertEngine.loadSuppressionRules(require('./suppression-rules.json'));

// Subscribe to events
alertEngine.on('alert', ({ alert, rule }) => {
  console.log(`ALERT: ${rule.name}`);
});
```

### 3. Process Sensor Data

```javascript
// When sensor reading arrives
alertEngine.processSensorReading('temp_room_a1', 34.5);

// Engine automatically:
// 1. Evaluates all applicable rules
// 2. Checks hysteresis
// 3. Checks cooldown
// 4. Executes notifications
// 5. Tracks state & history
```

### 4. Run Web UI

```bash
# Start backend API
node server.js

# Start React frontend
npm run start

# Access at http://localhost:3000
# Login with credentials (RBAC enforced)
```

---

## Configuration Files

### Alert Rules (`alert-rules.json`)

```json
{
  "alert_rules": [
    {
      "rule_id": "rule_001_temp_critical",
      "name": "Temperature Critical - Room A1",
      "enabled": true,
      
      "condition": {
        "sensor_id": "temp_room_a1",
        "operator": ">",
        "value": 32.0,
        "duration_seconds": 60
      },
      
      "severity": "critical",
      "cooldown_seconds": 300,
      
      "thresholds": {
        "min_safe": 16.0,
        "max_warning": 26.0,
        "max_critical": 32.0,
        "hysteresis": {
          "enabled": true,
          "lower_margin": 2.0
        }
      },
      
      "actions": [
        {
          "type": "email",
          "recipients": ["ops@datacenter.md"],
          "subject": "🔴 CRITICAL: Room A1 Temperature"
        },
        {
          "type": "slack",
          "channel": "#datacenter-alerts",
          "mention": "@ops-team"
        }
      ]
    }
  ]
}
```

### Suppression Windows (`suppression-rules.json`)

```json
{
  "suppression_rules": [
    {
      "rule_id": "suppress_001",
      "name": "Weekend Maintenance",
      "enabled": true,
      "schedule": {
        "days": ["saturday", "sunday"],
        "start_time": "00:00",
        "end_time": "23:59"
      },
      "affected_sensors": ["*"],
      "suppress_until_critical": true
    }
  ]
}
```

---

## API Reference

### Alert Queries (Viewer Role)

```bash
# Get active alerts
GET /api/alerts/active

# Get alert history
GET /api/alerts/history?limit=100&severity=critical

# Get statistics
GET /api/alerts/stats

# Acknowledge alert
POST /api/alerts/{alertId}/acknowledge
Body: { "note": "Investigating..." }
```

### Rule Management (Admin Role)

```bash
# List rules
GET /api/alert-rules

# Create rule
POST /api/alert-rules
Body: { "name": "...", "condition": {...}, "actions": [...] }

# Update rule
PUT /api/alert-rules/{ruleId}
Body: { "enabled": false, ... }

# Delete rule
DELETE /api/alert-rules/{ruleId}

# Bulk update
POST /api/alert-rules/bulk-update
Body: { "rule_ids": [...], "updates": { "enabled": false } }
```

### Threshold Management (Admin Role)

```bash
# Get thresholds for sensor
GET /api/thresholds/{sensorId}

# Update thresholds
PUT /api/thresholds/{sensorId}
Body: { "min_safe": 16, "max_critical": 32, ... }
```

### Notification Channels (Admin Role)

```bash
# List channels
GET /api/notification-channels

# Test channel
POST /api/notification-channels/{channelId}/test
```

### Suppression Windows (Admin Role)

```bash
# List suppression rules
GET /api/suppression-rules

# Create suppression window
POST /api/suppression-rules
Body: { "name": "...", "schedule": {...} }

# Delete suppression
DELETE /api/suppression-rules/{ruleId}
```

---

## Condition Types

### Simple Threshold

```json
{
  "condition": {
    "sensor_id": "temp_room_a1",
    "operator": ">",
    "value": 32.0,
    "duration_seconds": 60
  }
}
```

**Operators**: `>`, `>=`, `<`, `<=`, `==`, `!=`
**Duration**: Required to sustain condition N seconds before triggering

### Compound Condition (AND/OR)

```json
{
  "condition": {
    "logic": "AND",
    "sub_conditions": [
      { "sensor_id": "temp_room_a1", "operator": ">", "value": 28.0 },
      { "sensor_id": "humidity_room_a1", "operator": ">", "value": 65.0 }
    ]
  }
}
```

### Rate of Change

```json
{
  "condition": {
    "sensor_id": "temp_room_a1",
    "type": "rate_of_change",
    "threshold": 5.0,
    "time_window_seconds": 60
  }
}
```

**Example**: Alert if temperature rises > 5°C in 60 seconds (AC failure detection)

### Sensor Offline

```json
{
  "condition": {
    "sensor_id": "temp_room_a1",
    "type": "no_data",
    "duration_seconds": 300
  }
}
```

**Example**: Alert if sensor hasn't reported data for 5 minutes

---

## Notification Actions

### Email

```json
{
  "type": "email",
  "recipients": ["ops@datacenter.md"],
  "subject": "Alert Subject",
  "template": "critical_temp_alert",
  "send_frequency": "once_per_hour"
}
```

### Slack

```json
{
  "type": "slack",
  "channel": "#datacenter-alerts",
  "mention": "@ops-team",
  "webhook_url": "${SLACK_WEBHOOK_URL}"
}
```

### SMS

```json
{
  "type": "sms",
  "recipients": ["+373-123-456-789"],
  "message": "CRITICAL: {sensor_id} = {sensor_value}"
}
```

### Webhook

```json
{
  "type": "webhook",
  "url": "https://monitoring.company.md/api/webhooks/alerts",
  "method": "POST",
  "headers": { "Authorization": "Bearer token" }
}
```

### Dashboard

```json
{
  "type": "dashboard",
  "show_notification": true,
  "auto_dismiss_seconds": 300,
  "sound_enabled": true
}
```

---

## RBAC Roles

### Admin
- ✅ Create/edit/delete alert rules
- ✅ Configure thresholds
- ✅ Manage notification channels
- ✅ Create suppression windows
- ✅ Acknowledge & manage alerts
- ✅ View all history

### Operator
- ✅ Enable/disable rules
- ✅ Acknowledge alerts
- ✅ View all history
- ✅ View dashboard
- ❌ Create/delete rules
- ❌ Configure channels

### Viewer
- ✅ View dashboard
- ✅ View active alerts & history
- ❌ Acknowledge
- ❌ Modify any configuration

---

## Performance Tuning

### Alert Engine Optimization

```javascript
// Settings for high-volume scenarios
const config = {
  max_rule_evaluations_per_second: 1000,
  history_retention_days: 90,
  alert_deduplification: true,
  cooldown_default_seconds: 300
};

// Profile performance
alertEngine.on('performance-stats', (stats) => {
  console.log(`Evaluations/sec: ${stats.eval_rate}`);
  console.log(`Alert queue: ${stats.pending_alerts}`);
});
```

### Database Optimization

```javascript
// InfluxDB retention policies
const influx = new InfluxDB({...});

// 7 days raw data, 90 days aggregated
influx.createRetentionPolicy('rp_raw', {
  database: 'monitoring',
  duration: '7d',
  replication: 1,
  default: true
});

influx.createRetentionPolicy('rp_archive', {
  database: 'monitoring',
  duration: '90d',
  replication: 1
});
```

---

## Troubleshooting

### Alerts Not Triggering

1. Check if rule is enabled:
   ```bash
   curl http://localhost:3000/api/alert-rules
   ```

2. Verify condition syntax:
   ```json
   { "operator": ">", "value": 32.0, "duration_seconds": 60 }
   ```

3. Check suppression windows:
   ```bash
   curl http://localhost:3000/api/suppression-rules
   ```

### Notification Not Sending

1. Test channel:
   ```bash
   curl -X POST http://localhost:3000/api/notification-channels/email_primary/test
   ```

2. Check logs:
   ```bash
   docker logs dc-monitoring-alert-engine
   tail -f /var/log/monitoring/alerts.log
   ```

3. Verify credentials:
   ```bash
   env | grep SLACK_WEBHOOK_URL
   env | grep SMTP_PASSWORD
   ```

### Alert Flapping

Enable hysteresis:
```json
{
  "thresholds": {
    "hysteresis": {
      "enabled": true,
      "lower_margin": 2.0,
      "upper_margin": 2.0
    }
  }
}
```

---

## Examples

### Example 1: Temperature Rising to Critical

```javascript
// Simulate temperature reading every 10 seconds
const temps = [20, 22, 24, 26, 28, 30, 32, 34];

temps.forEach((temp, idx) => {
  setTimeout(() => {
    alertEngine.processSensorReading('temp_room_a1', temp);
  }, idx * 10000);
});

// Console output:
// [Sensor] temp_room_a1 = 32°C
// [ALERT TRIGGERED] rule_001_temp_critical
//   Severity: CRITICAL
//   Actions: email, slack, sms, dashboard
```

### Example 2: Compound Alert (Heat + Humidity)

```javascript
// Temperature & humidity both high = corrosive environment
alertEngine.processSensorReading('temp_room_a1', 30);   // >28°C ✓
alertEngine.processSensorReading('humidity_room_a1', 70); // >65% ✓

// Console output:
// [ALERT TRIGGERED] rule_004_corrosive_env
//   Severity: CRITICAL
//   Both conditions met!
```

### Example 3: Acknowledge Alert

```javascript
const alerts = alertEngine.getActiveAlerts();
const alertId = alerts[0].alert_id;

alertEngine.acknowledgeAlert(alertId, 'operator1', 'AC technician on the way');

// Alert marked as acknowledged in history
```

---

## Integration with Main System

```javascript
// In your main Express server
const alertEngine = new AlertEngine(config);
const alertRoutes = require('./alert-routes');

app.use((req, res, next) => {
  req.alertEngine = alertEngine;
  next();
});

app.use('/', alertRoutes);

// Subscribe to MQTT sensor data
mqttClient.on('message', (topic, message) => {
  const { sensorId, value } = JSON.parse(message);
  alertEngine.processSensorReading(sensorId, value);
});

// Real-time WebSocket updates
const io = require('socket.io')(server);
alertEngine.on('alert', ({ alert, rule }) => {
  io.emit('alert-triggered', alert);
});

alertEngine.on('dashboard-notification', (notif) => {
  io.emit('dashboard-notification', notif);
});
```

---

## Files Structure

```
project/
├── alert-engine.js                # Core alert processing logic
├── alert-routes.js                # Express API endpoints
├── AlertConfigurator.jsx          # React UI component
├── alert-rules.json               # Alert rules configuration
├── suppression-rules.json         # Suppression windows
├── alert-example-usage.js         # Test scenarios & examples
├── docker-compose.yml             # Container stack
├── ALERT_SYSTEM_README.md         # This file
└── package.json
```

---

## Support & Monitoring

### Real-time Dashboard
Access at: `http://localhost:3000/alerts`
- Active alerts
- Alert statistics
- Configuration interface
- Alert history

### Log Files
```bash
# Alert audit log
tail -f /var/log/monitoring/alerts.log

# API requests
tail -f /var/log/monitoring/api.log

# System events
journalctl -u dc-monitoring -f
```

### Health Check
```bash
curl http://localhost:3000/health
# { "status": "ok", "alerts_active": 5, "uptime": 3600 }
```

---

**Version**: 1.0  
**Last Updated**: Oct 6, 2026  
**Maintainer**: Anatolie Ernu (ITSec@ernu.md)
