/**
 * DC MONITORING - ALERT API ROUTES
 * Express.js routes for alert management, RBAC enforcement
 */

const express = require('express');
const router = express.Router();

/**
 * RBAC Middleware
 */
const checkRole = (requiredRole = 'viewer') => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'viewer';
    const roleHierarchy = { admin: 3, operator: 2, viewer: 1 };

    if ((roleHierarchy[userRole] || 0) < (roleHierarchy[requiredRole] || 0)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: userRole 
      });
    }
    next();
  };
};

/**
 * GET /api/alerts/active
 * Get currently active alerts
 * Role: viewer (everyone)
 */
router.get('/api/alerts/active', (req, res) => {
  try {
    const activeAlerts = req.alertEngine.getActiveAlerts();
    res.json(activeAlerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alerts/history
 * Get alert history with optional filtering
 * Role: viewer
 */
router.get('/api/alerts/history', (req, res) => {
  try {
    const { limit = 100, sensor_id, severity, from, to } = req.query;
    let history = req.alertEngine.getAlertHistory(parseInt(limit));

    // Filter by sensor
    if (sensor_id) {
      history = history.filter(a => a.sensor_id === sensor_id);
    }

    // Filter by severity
    if (severity) {
      history = history.filter(a => a.severity === severity);
    }

    // Filter by date range
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to) : new Date();
      history = history.filter(a => {
        const alertDate = new Date(a.timestamp_triggered);
        return alertDate >= fromDate && alertDate <= toDate;
      });
    }

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alerts/stats
 * Get alert statistics
 * Role: viewer
 */
router.get('/api/alerts/stats', (req, res) => {
  try {
    const stats = req.alertEngine.getAlertStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alerts/:alertId
 * Get single alert details
 * Role: viewer
 */
router.get('/api/alerts/:alertId', (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = req.alertEngine.alertHistory.find(a => a.alert_id === alertId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/alerts/:alertId/acknowledge
 * Acknowledge an alert
 * Role: operator
 */
router.post('/api/alerts/:alertId/acknowledge', checkRole('operator'), (req, res) => {
  try {
    const { alertId } = req.params;
    const { note = '' } = req.body;
    const userId = req.user?.id || 'unknown';

    req.alertEngine.acknowledgeAlert(alertId, userId, note);

    const alert = req.alertEngine.alertHistory.find(a => a.alert_id === alertId);
    res.json({ 
      success: true, 
      alert,
      message: `Alert acknowledged by ${userId}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * ALERT RULES - CRUD Operations
 * ============================================
 */

/**
 * GET /api/alert-rules
 * List all alert rules
 * Role: viewer
 */
router.get('/api/alert-rules', (req, res) => {
  try {
    const rules = req.alertEngine.alertRules;
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/alert-rules/:ruleId
 * Get single rule
 * Role: viewer
 */
router.get('/api/alert-rules/:ruleId', (req, res) => {
  try {
    const { ruleId } = req.params;
    const rule = req.alertEngine.alertRules.find(r => r.rule_id === ruleId);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/alert-rules
 * Create new alert rule
 * Role: admin
 */
router.post('/api/alert-rules', checkRole('admin'), (req, res) => {
  try {
    const newRule = {
      rule_id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      enabled: true,
      created_at: new Date().toISOString(),
      created_by: req.user?.id || 'unknown',
      ...req.body
    };

    // Validate required fields
    if (!newRule.name || !newRule.condition || !newRule.severity || !newRule.actions) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, condition, severity, actions' 
      });
    }

    req.alertEngine.alertRules.push(newRule);
    res.status(201).json(newRule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/alert-rules/:ruleId
 * Update alert rule
 * Role: admin
 */
router.put('/api/alert-rules/:ruleId', checkRole('admin'), (req, res) => {
  try {
    const { ruleId } = req.params;
    const ruleIndex = req.alertEngine.alertRules.findIndex(r => r.rule_id === ruleId);

    if (ruleIndex === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updatedRule = {
      ...req.alertEngine.alertRules[ruleIndex],
      ...req.body,
      rule_id: ruleId, // Prevent changing ID
      updated_at: new Date().toISOString(),
      updated_by: req.user?.id || 'unknown'
    };

    req.alertEngine.alertRules[ruleIndex] = updatedRule;
    res.json(updatedRule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/alert-rules/:ruleId
 * Delete alert rule
 * Role: admin
 */
router.delete('/api/alert-rules/:ruleId', checkRole('admin'), (req, res) => {
  try {
    const { ruleId } = req.params;
    const ruleIndex = req.alertEngine.alertRules.findIndex(r => r.rule_id === ruleId);

    if (ruleIndex === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const deletedRule = req.alertEngine.alertRules.splice(ruleIndex, 1)[0];
    res.json({ 
      success: true, 
      message: `Rule ${ruleId} deleted`,
      deleted: deletedRule
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/alert-rules/:ruleId/toggle
 * Enable/disable alert rule
 * Role: operator
 */
router.post('/api/alert-rules/:ruleId/toggle', checkRole('operator'), (req, res) => {
  try {
    const { ruleId } = req.params;
    const { enabled } = req.body;

    const rule = req.alertEngine.alertRules.find(r => r.rule_id === ruleId);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    rule.enabled = enabled;
    rule.toggled_at = new Date().toISOString();
    rule.toggled_by = req.user?.id || 'unknown';

    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * THRESHOLDS - Configuration
 * ============================================
 */

/**
 * GET /api/thresholds/:sensorId
 * Get threshold configuration for sensor
 * Role: viewer
 */
router.get('/api/thresholds/:sensorId', (req, res) => {
  try {
    const { sensorId } = req.params;
    
    // Find rules that apply to this sensor
    const applicableRules = req.alertEngine.alertRules.filter(rule => {
      if (rule.condition.sensor_id === sensorId) return true;
      if (rule.condition.sub_conditions?.some(c => c.sensor_id === sensorId)) return true;
      return false;
    });

    const thresholds = applicableRules.map(rule => ({
      rule_id: rule.rule_id,
      rule_name: rule.name,
      sensor_id: sensorId,
      condition: rule.condition,
      thresholds: rule.thresholds,
      hysteresis: rule.thresholds?.hysteresis
    }));

    res.json(thresholds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/thresholds/:sensorId
 * Update threshold configuration
 * Role: admin
 */
router.put('/api/thresholds/:sensorId', checkRole('admin'), (req, res) => {
  try {
    const { sensorId } = req.params;
    const { rule_id, thresholds } = req.body;

    const rule = req.alertEngine.alertRules.find(r => r.rule_id === rule_id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    rule.thresholds = {
      ...rule.thresholds,
      ...thresholds
    };

    rule.updated_at = new Date().toISOString();
    rule.updated_by = req.user?.id || 'unknown';

    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * NOTIFICATION CHANNELS
 * ============================================
 */

/**
 * GET /api/notification-channels
 * List all notification channels
 * Role: admin
 */
router.get('/api/notification-channels', checkRole('admin'), (req, res) => {
  try {
    // Load from config or database
    const channels = req.notificationChannels || [];
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notification-channels/:channelId/test
 * Test notification channel
 * Role: admin
 */
router.post('/api/notification-channels/:channelId/test', checkRole('admin'), (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = req.notificationChannels.find(c => c.channel_id === channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Send test alert
    const testAlert = {
      alert_id: `test_${Date.now()}`,
      rule_name: 'Test Alert',
      sensor_id: 'test_sensor',
      sensor_value: 25.5,
      threshold_value: 30.0,
      severity: 'warning',
      timestamp_triggered: new Date().toISOString()
    };

    const testAction = {
      type: channelId.split('_')[0], // Extract type (email, slack, etc)
      ...channel.config
    };

    // Execute test (implementation depends on channel type)
    res.json({ 
      success: true, 
      message: `Test alert queued for ${channelId}`,
      test_alert: testAlert
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * SUPPRESSION RULES
 * ============================================
 */

/**
 * GET /api/suppression-rules
 * List all suppression windows
 * Role: admin
 */
router.get('/api/suppression-rules', checkRole('admin'), (req, res) => {
  try {
    const suppressionRules = req.alertEngine.suppressionRules || [];
    res.json(suppressionRules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suppression-rules
 * Create suppression window
 * Role: admin
 */
router.post('/api/suppression-rules', checkRole('admin'), (req, res) => {
  try {
    const newRule = {
      rule_id: `suppress_${Date.now()}`,
      enabled: true,
      created_at: new Date().toISOString(),
      ...req.body
    };

    req.alertEngine.suppressionRules.push(newRule);
    res.status(201).json(newRule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/suppression-rules/:ruleId
 * Delete suppression window
 * Role: admin
 */
router.delete('/api/suppression-rules/:ruleId', checkRole('admin'), (req, res) => {
  try {
    const { ruleId } = req.params;
    const index = req.alertEngine.suppressionRules.findIndex(r => r.rule_id === ruleId);

    if (index === -1) {
      return res.status(404).json({ error: 'Suppression rule not found' });
    }

    const deleted = req.alertEngine.suppressionRules.splice(index, 1)[0];
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * BULK OPERATIONS
 * ============================================
 */

/**
 * POST /api/alert-rules/bulk-update
 * Update multiple rules at once
 * Role: admin
 */
router.post('/api/alert-rules/bulk-update', checkRole('admin'), (req, res) => {
  try {
    const { rule_ids, updates } = req.body;

    const updated = [];
    for (const ruleId of rule_ids) {
      const rule = req.alertEngine.alertRules.find(r => r.rule_id === ruleId);
      if (rule) {
        Object.assign(rule, updates);
        updated.push(rule);
      }
    }

    res.json({ 
      success: true, 
      updated_count: updated.length,
      rules: updated 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/alerts/bulk-acknowledge
 * Acknowledge multiple alerts
 * Role: operator
 */
router.post('/api/alerts/bulk-acknowledge', checkRole('operator'), (req, res) => {
  try {
    const { alert_ids, note } = req.body;
    const userId = req.user?.id || 'unknown';

    for (const alertId of alert_ids) {
      req.alertEngine.acknowledgeAlert(alertId, userId, note);
    }

    res.json({ 
      success: true, 
      acknowledged_count: alert_ids.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
