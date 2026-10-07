/**
 * DC MONITORING - ALERT SYSTEM USAGE EXAMPLES
 * Practical scenarios for temperature, power, and access control alerts
 */

const AlertEngine = require('./alert-engine');

// ============================================
// EXAMPLE 1: Initialize Alert Engine
// ============================================

const alertConfig = {
  // Email configuration
  smtp: {
    host: 'mail.company.md',
    port: 587,
    user: 'alerts@company.md',
    pass: process.env.SMTP_PASSWORD
  },
  // Slack webhook
  slack: {
    webhook: process.env.SLACK_WEBHOOK_URL
  }
};

const alertEngine = new AlertEngine(alertConfig);

// ============================================
// EXAMPLE 2: Load Alert Rules Configuration
// ============================================

const alertRulesConfig = [
  // Rule 1: Temperature Critical
  {
    rule_id: 'rule_001_temp_critical',
    name: 'Temperature Critical - Room A1',
    enabled: true,
    condition: {
      sensor_id: 'temp_room_a1',
      operator: '>',
      value: 32.0,
      duration_seconds: 60
    },
    severity: 'critical',
    cooldown_seconds: 300,
    thresholds: {
      min_safe: 16.0,
      max_warning: 26.0,
      max_critical: 32.0,
      max_shutdown: 40.0,
      hysteresis: {
        enabled: true,
        lower_margin: 2.0,
        upper_margin: 2.0
      }
    },
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md', 'cto@company.md'],
        subject: '🔴 CRITICAL: Room A1 Temperature Exceeded'
      },
      {
        type: 'slack',
        channel: '#datacenter-alerts',
        mention: '@ops-team'
      },
      {
        type: 'sms',
        recipients: ['+373-123-456-789'],
        message: 'CRITICAL: Room A1 temp {sensor_value}°C'
      },
      {
        type: 'dashboard',
        show_notification: true
      }
    ]
  },

  // Rule 2: Temperature Warning
  {
    rule_id: 'rule_002_temp_warning',
    name: 'Temperature Warning - Room A1',
    enabled: true,
    condition: {
      sensor_id: 'temp_room_a1',
      operator: '>',
      value: 26.0,
      duration_seconds: 120
    },
    severity: 'warning',
    cooldown_seconds: 600,
    actions: [
      {
        type: 'dashboard',
        show_notification: true,
        auto_dismiss_seconds: 300
      },
      {
        type: 'email',
        recipients: ['ops@datacenter.md'],
        send_frequency: 'once_per_hour'
      }
    ]
  },

  // Rule 3: Humidity Warning
  {
    rule_id: 'rule_003_humidity_warning',
    name: 'Humidity Warning - Room A1',
    enabled: true,
    condition: {
      sensor_id: 'humidity_room_a1',
      operator: '>',
      value: 60.0,
      duration_seconds: 180
    },
    severity: 'warning',
    cooldown_seconds: 600,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md']
      }
    ]
  },

  // Rule 4: Compound Condition - Heat + Humidity (Corrosive Environment)
  {
    rule_id: 'rule_004_corrosive_env',
    name: 'Corrosive Environment Detection',
    enabled: true,
    condition: {
      logic: 'AND',
      sub_conditions: [
        {
          sensor_id: 'temp_room_a1',
          operator: '>',
          value: 28.0,
          duration_seconds: 60
        },
        {
          sensor_id: 'humidity_room_a1',
          operator: '>',
          value: 65.0,
          duration_seconds: 60
        }
      ]
    },
    severity: 'critical',
    cooldown_seconds: 300,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md'],
        subject: '🔴 CRITICAL: Corrosive environment (heat + humidity)'
      },
      {
        type: 'slack',
        channel: '#datacenter-alerts'
      }
    ]
  },

  // Rule 5: Rate of Change - AC Failure Detection
  {
    rule_id: 'rule_005_temp_roc',
    name: 'Rapid Temperature Rise (AC Failure)',
    enabled: true,
    condition: {
      sensor_id: 'temp_room_a1',
      type: 'rate_of_change',
      threshold: 5.0, // °C per minute
      time_window_seconds: 60
    },
    severity: 'warning',
    cooldown_seconds: 600,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md'],
        subject: '⚠️ WARNING: Rapid temperature rise detected (AC failure?)'
      },
      {
        type: 'slack',
        channel: '#datacenter-alerts'
      }
    ]
  },

  // Rule 6: Door Open Too Long
  {
    rule_id: 'rule_006_door_open',
    name: 'Main Entrance Door Open',
    enabled: true,
    condition: {
      sensor_id: 'door_main_entrance',
      operator: '==',
      value: 'open',
      duration_seconds: 300
    },
    severity: 'warning',
    cooldown_seconds: 600,
    actions: [
      {
        type: 'email',
        recipients: ['security@datacenter.md'],
        subject: '⚠️ Main Entrance Door Open > 5 Minutes'
      },
      {
        type: 'slack',
        channel: '#security-alerts'
      }
    ]
  },

  // Rule 7: Smoke Detection
  {
    rule_id: 'rule_007_smoke_detected',
    name: 'Smoke Detection - Critical',
    enabled: true,
    condition: {
      sensor_id: 'smoke_detector_a1',
      operator: '==',
      value: 'triggered',
      duration_seconds: 0
    },
    severity: 'critical',
    cooldown_seconds: 0,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md', 'fire-dept@city.md'],
        subject: '🔴 EMERGENCY: Smoke Detection Active'
      },
      {
        type: 'sms',
        recipients: ['+373-911', '+373-123-456-789'],
        message: 'EMERGENCY: Smoke detected in DC - Room A1'
      },
      {
        type: 'slack',
        channel: '#emergency',
        mention: '@everyone'
      }
    ]
  },

  // Rule 8: Sensor Offline Detection
  {
    rule_id: 'rule_008_sensor_offline',
    name: 'Sensor Offline - Temperature A1',
    enabled: true,
    condition: {
      sensor_id: 'temp_room_a1',
      type: 'no_data',
      duration_seconds: 300
    },
    severity: 'warning',
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md'],
        subject: '⚠️ Sensor Offline: Temperature Room A1'
      }
    ]
  },

  // Rule 9: Power Current High
  {
    rule_id: 'rule_009_current_high',
    name: 'High Current - Phase 1',
    enabled: true,
    condition: {
      sensor_id: 'current_phase_1',
      operator: '>',
      value: 16.0,
      duration_seconds: 120
    },
    severity: 'warning',
    cooldown_seconds: 600,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md'],
        subject: '⚠️ High Current Detected - Phase 1'
      }
    ]
  },

  // Rule 10: Power Failure / Blackout
  {
    rule_id: 'rule_010_power_failure',
    name: 'Power Failure Detected',
    enabled: true,
    condition: {
      sensor_id: 'ups_battery_mode',
      operator: '==',
      value: 'active',
      duration_seconds: 30
    },
    severity: 'critical',
    cooldown_seconds: 0,
    actions: [
      {
        type: 'email',
        recipients: ['ops@datacenter.md', 'power-team@company.md'],
        subject: '🔴 CRITICAL: Power Failure - UPS Active'
      },
      {
        type: 'sms',
        recipients: ['+373-123-456-789'],
        message: 'CRITICAL: Power failure detected, UPS active'
      },
      {
        type: 'slack',
        channel: '#emergency'
      }
    ]
  }
];

// Load rules
alertEngine.loadRules(alertRulesConfig);

// ============================================
// EXAMPLE 3: Load Suppression Rules (Quiet Hours)
// ============================================

const suppressionRulesConfig = [
  // Weekend suppression
  {
    rule_id: 'suppress_001',
    name: 'Weekend Maintenance Window',
    enabled: true,
    schedule: {
      days: ['saturday', 'sunday'],
      start_time: '00:00',
      end_time: '23:59'
    },
    affected_sensors: ['*'],
    suppress_until_critical: true
  },

  // Scheduled maintenance
  {
    rule_id: 'suppress_002',
    name: 'Scheduled AC Maintenance - Oct 15',
    enabled: true,
    schedule: {
      start_datetime: '2026-10-15T08:00:00Z',
      end_datetime: '2026-10-15T12:00:00Z'
    },
    affected_sensors: ['temp_room_a1', 'humidity_room_a1'],
    suppress_all: true
  },

  // Night hours - warning only
  {
    rule_id: 'suppress_003',
    name: 'Night Hours - Critical Only',
    enabled: true,
    schedule: {
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      start_time: '22:00',
      end_time: '08:00'
    },
    exclude_severities: ['critical'],
    description: 'Only send critical alerts during night hours'
  }
];

alertEngine.loadSuppressionRules(suppressionRulesConfig);

// ============================================
// EXAMPLE 4: Simulate Sensor Data & Alert Triggering
// ============================================

console.log('\n=== ALERT SYSTEM TEST SCENARIOS ===\n');

// Subscribe to alert events
alertEngine.on('alert', ({ alert, rule }) => {
  console.log(`\n[ALERT TRIGGERED]`);
  console.log(`  Rule: ${rule.name}`);
  console.log(`  Severity: ${alert.severity.toUpperCase()}`);
  console.log(`  Sensor: ${alert.sensor_id}`);
  console.log(`  Value: ${alert.sensor_value} (Threshold: ${alert.threshold_value})`);
  console.log(`  Actions: ${rule.actions.map(a => a.type).join(', ')}`);
});

alertEngine.on('alert-resolved', ({ rule, sensorId }) => {
  console.log(`\n[ALERT RESOLVED] ${rule.name} for ${sensorId}`);
});

// Test Scenario 1: Temperature gradually rises to critical
console.log('--- Scenario 1: Temperature Rises to Critical ---');
const tempReadings = [20, 22, 24, 26, 28, 30, 32, 34]; // Will trigger critical at 32°C
tempReadings.forEach((temp, idx) => {
  setTimeout(() => {
    console.log(`[Sensor] temp_room_a1 = ${temp}°C`);
    alertEngine.processSensorReading('temp_room_a1', temp);
  }, idx * 1000);
});

// Test Scenario 2: Smoke detection (immediate critical)
setTimeout(() => {
  console.log('\n--- Scenario 2: Smoke Detection ---');
  console.log('[Sensor] smoke_detector_a1 = triggered');
  alertEngine.processSensorReading('smoke_detector_a1', 'triggered');
}, 10000);

// Test Scenario 3: Compound condition (heat + humidity)
setTimeout(() => {
  console.log('\n--- Scenario 3: Corrosive Environment (Heat + Humidity) ---');
  console.log('[Sensor] temp_room_a1 = 30°C, humidity_room_a1 = 70%');
  alertEngine.processSensorReading('temp_room_a1', 30);
  alertEngine.processSensorReading('humidity_room_a1', 70);
}, 15000);

// Test Scenario 4: Rate of change (AC failure)
setTimeout(() => {
  console.log('\n--- Scenario 4: Rapid Temperature Rise (AC Failure) ---');
  const rapidRise = [25, 27, 29, 31, 33, 35]; // Rise > 5°C/min
  rapidRise.forEach((temp, idx) => {
    setTimeout(() => {
      console.log(`[Sensor] temp_room_a1 = ${temp}°C`);
      alertEngine.processSensorReading('temp_room_a1', temp);
    }, idx * 5000); // 5 second intervals
  });
}, 20000);

// Test Scenario 5: Sensor offline detection
setTimeout(() => {
  console.log('\n--- Scenario 5: Sensor Offline Detection ---');
  console.log('[System] No data from temp_room_a1 for > 5 minutes');
  alertEngine.processSensorReading('temp_room_a1', null); // Simulate no data
}, 25000);

// ============================================
// EXAMPLE 5: Query Alert Status
// ============================================

setInterval(() => {
  const stats = alertEngine.getAlertStats();
  const active = alertEngine.getActiveAlerts();

  console.log('\n--- Alert Statistics ---');
  console.log(`Total Alerts: ${stats.total_alerts}`);
  console.log(`Active: ${stats.active_alerts} | Critical: ${stats.critical} | Warning: ${stats.warning}`);
  console.log(`Active Alert IDs:`, active.map(a => `${a.rule_id}:${a.sensor_id}`));
}, 5000);

// ============================================
// EXAMPLE 6: Manual Alert Acknowledgment
// ============================================

setTimeout(() => {
  const activeAlerts = alertEngine.getActiveAlerts();
  if (activeAlerts.length > 0) {
    const alertId = activeAlerts[0].alert_id;
    console.log(`\n--- Manual Acknowledgment ---`);
    console.log(`Acknowledging alert: ${alertId}`);
    alertEngine.acknowledgeAlert(alertId, 'operator1', 'Started AC investigation');
    
    const updatedAlert = alertEngine.alertHistory.find(a => a.alert_id === alertId);
    console.log(`Alert Status: ${updatedAlert.status}`);
    console.log(`Acknowledged by: ${updatedAlert.acknowledged_by}`);
  }
}, 30000);

// ============================================
// EXAMPLE 7: API Integration Example
// ============================================

// Mock Express.js app integration
const express = require('express');
const app = express();
app.use(express.json());

// Attach alert engine to requests
app.use((req, res, next) => {
  req.alertEngine = alertEngine;
  next();
});

// GET active alerts
app.get('/api/alerts/active', (req, res) => {
  const active = req.alertEngine.getActiveAlerts();
  res.json(active);
});

// GET alert history
app.get('/api/alerts/history', (req, res) => {
  const history = req.alertEngine.getAlertHistory(100);
  res.json(history);
});

// POST acknowledge alert
app.post('/api/alerts/:alertId/acknowledge', (req, res) => {
  const { alertId } = req.params;
  const { note } = req.body;
  req.alertEngine.acknowledgeAlert(alertId, 'current_user', note);
  res.json({ success: true });
});

// GET alert rules
app.get('/api/alert-rules', (req, res) => {
  res.json(req.alertEngine.alertRules);
});

// Start server (optional)
// const server = app.listen(3000, () => {
//   console.log('Alert API listening on port 3000');
// });

// ============================================
// EXAMPLE 8: Export Alert History
// ============================================

const exportAlertHistory = (format = 'json') => {
  const history = alertEngine.getAlertHistory();

  if (format === 'json') {
    return JSON.stringify(history, null, 2);
  } else if (format === 'csv') {
    const csv = [
      'Timestamp,Rule,Sensor,Severity,Value,Threshold,Status,Acknowledged By'
    ];
    history.forEach(alert => {
      csv.push(
        `${alert.timestamp_triggered},${alert.rule_name},${alert.sensor_id},` +
        `${alert.severity},${alert.sensor_value},${alert.threshold_value},` +
        `${alert.status},${alert.acknowledged_by || 'N/A'}`
      );
    });
    return csv.join('\n');
  }
};

// ============================================
// EXAMPLE 9: Performance Testing
// ============================================

const testPerformance = async () => {
  console.log('\n--- Performance Test ---');
  const startTime = Date.now();
  
  // Process 1000 sensor readings
  for (let i = 0; i < 1000; i++) {
    alertEngine.processSensorReading(
      'temp_room_a1',
      20 + Math.random() * 15 // Random temp between 20-35°C
    );
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const rate = 1000 / (duration / 1000);

  console.log(`Processed 1000 readings in ${duration}ms`);
  console.log(`Rate: ${rate.toFixed(0)} readings/second`);
  console.log(`Active alerts: ${alertEngine.getActiveAlerts().length}`);
};

// Run performance test after scenarios
setTimeout(testPerformance, 35000);

module.exports = {
  alertEngine,
  alertRulesConfig,
  suppressionRulesConfig,
  exportAlertHistory,
  testPerformance
};
