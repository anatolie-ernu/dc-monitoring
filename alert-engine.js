/**
 * DC MONITORING - ALERT ENGINE
 * Multi-channel alert processing with threshold evaluation, cooldown, hysteresis
 * 
 * Features:
 * - Threshold evaluation (min/max/warning/critical)
 * - Hysteresis prevention (alert flapping)
 * - Cooldown periods (suppress duplicate alerts)
 * - Rate-of-change detection
 * - Compound conditions (AND/OR logic)
 * - Notification channels (email, Slack, SMS, webhook, dashboard)
 * - Alert history & acknowledgment
 * - Scheduled suppression windows
 */

const EventEmitter = require('events');
const axios = require('axios');
const nodemailer = require('nodemailer');

class AlertEngine extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.alertRules = [];
    this.alertState = new Map(); // Track sensor state for hysteresis
    this.alertCooldown = new Map(); // Track cooldown periods
    this.alertHistory = [];
    this.notificationChannels = new Map();
    this.suppressionRules = [];
    this.sensorHistory = new Map(); // Track historical values for rate-of-change
    
    this.initializeNotificationChannels();
  }

  /**
   * Initialize notification channels with providers
   */
  initializeNotificationChannels() {
    this.notificationChannels.set('email', this.sendEmail.bind(this));
    this.notificationChannels.set('slack', this.sendSlack.bind(this));
    this.notificationChannels.set('sms', this.sendSMS.bind(this));
    this.notificationChannels.set('webhook', this.sendWebhook.bind(this));
    this.notificationChannels.set('dashboard', this.sendDashboard.bind(this));
    this.notificationChannels.set('log', this.logAlert.bind(this));
  }

  /**
   * Load alert rules from configuration
   */
  loadRules(rulesConfig) {
    this.alertRules = rulesConfig;
    console.log(`[AlertEngine] Loaded ${this.alertRules.length} alert rules`);
  }

  /**
   * Load suppression rules (maintenance windows)
   */
  loadSuppressionRules(suppressionRulesConfig) {
    this.suppressionRules = suppressionRulesConfig;
    console.log(`[AlertEngine] Loaded ${this.suppressionRules.length} suppression rules`);
  }

  /**
   * Main entry point: Process sensor reading and evaluate all rules
   */
  processSensorReading(sensorId, value, timestamp = Date.now()) {
    // Store historical value for rate-of-change detection
    this.updateSensorHistory(sensorId, value, timestamp);

    // Evaluate all applicable alert rules
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check if rule applies to this sensor
      const appliesTo = this.ruleAppliesToSensor(rule, sensorId);
      if (!appliesTo) continue;

      // Evaluate condition
      const conditionMet = this.evaluateCondition(rule.condition, sensorId, value, timestamp);

      // Check if alert is suppressed
      const isSuppressed = this.checkSuppression(rule, sensorId);
      if (isSuppressed && rule.suppress_all) {
        console.log(`[AlertEngine] Alert ${rule.rule_id} suppressed by maintenance window`);
        continue;
      }

      // Get current alert state for this rule+sensor
      const stateKey = `${rule.rule_id}:${sensorId}`;
      const currentState = this.alertState.get(stateKey) || {
        isAlerting: false,
        triggeredAt: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
      };

      // Determine next state based on condition and hysteresis
      const nextState = this.calculateNextState(
        currentState,
        conditionMet,
        rule,
        sensorId,
        value,
        timestamp
      );

      // State transition logic
      if (nextState.isAlerting && !currentState.isAlerting) {
        // Alert triggered
        console.log(`[AlertEngine] ALERT TRIGGERED: ${rule.rule_id} for sensor ${sensorId}`);
        this.triggerAlert(rule, sensorId, value, timestamp, nextState);
      } else if (!nextState.isAlerting && currentState.isAlerting) {
        // Alert resolved
        console.log(`[AlertEngine] ALERT RESOLVED: ${rule.rule_id} for sensor ${sensorId}`);
        this.resolveAlert(rule, sensorId, timestamp, currentState);
      }

      // Update state
      this.alertState.set(stateKey, nextState);
    }
  }

  /**
   * Check if rule applies to this sensor (single or multiple)
   */
  ruleAppliesToSensor(rule, sensorId) {
    if (rule.condition.sensor_id && rule.condition.sensor_id === sensorId) {
      return true;
    }
    if (rule.condition.sub_conditions) {
      return rule.condition.sub_conditions.some(c => c.sensor_id === sensorId);
    }
    return false;
  }

  /**
   * Evaluate alert condition (single or compound)
   */
  evaluateCondition(condition, sensorId, value, timestamp) {
    // Single condition
    if (condition.sensor_id) {
      return this.evaluateSimpleCondition(condition, value, timestamp);
    }

    // Compound condition (AND/OR)
    if (condition.sub_conditions) {
      const logic = condition.logic || 'AND';
      const results = condition.sub_conditions.map(subCond => {
        // For compound conditions, get current value from sensor history
        const sensorValue = this.getSensorCurrentValue(subCond.sensor_id);
        return this.evaluateSimpleCondition(subCond, sensorValue, timestamp);
      });

      if (logic === 'AND') {
        return results.every(r => r);
      } else if (logic === 'OR') {
        return results.some(r => r);
      }
    }

    return false;
  }

  /**
   * Evaluate simple numeric/binary condition
   */
  evaluateSimpleCondition(condition, value, timestamp) {
    // Binary conditions (contact, smoke, etc.)
    if (condition.type === 'binary' || condition.unit === 'state') {
      return value === condition.value;
    }

    // No-data detection
    if (condition.type === 'no_data') {
      const lastReading = this.getSensorLastReadingTime(condition.sensor_id);
      if (!lastReading) return true;
      const timeSinceReading = (timestamp - lastReading) / 1000; // seconds
      return timeSinceReading > condition.duration_seconds;
    }

    // Rate-of-change detection
    if (condition.type === 'rate_of_change') {
      const ratePerSecond = this.calculateRateOfChange(
        condition.sensor_id,
        timestamp,
        condition.time_window_seconds
      );
      return Math.abs(ratePerSecond) > condition.threshold;
    }

    // Numeric comparison with duration requirement
    const threshold = condition.value;
    const durationSeconds = condition.duration_seconds || 0;

    let conditionMet = false;
    switch (condition.operator) {
      case '>':
        conditionMet = value > threshold;
        break;
      case '>=':
        conditionMet = value >= threshold;
        break;
      case '<':
        conditionMet = value < threshold;
        break;
      case '<=':
        conditionMet = value <= threshold;
        break;
      case '==':
        conditionMet = value === threshold;
        break;
      case '!=':
        conditionMet = value !== threshold;
        break;
    }

    // If duration required, check if condition sustained
    if (durationSeconds > 0 && conditionMet) {
      const conditionStart = this.getConditionStartTime(condition.sensor_id, condition);
      if (!conditionStart) {
        this.setConditionStartTime(condition.sensor_id, condition, timestamp);
        return false; // Not sustained yet
      }
      const durationMet = (timestamp - conditionStart) / 1000 >= durationSeconds;
      return durationMet;
    }

    return conditionMet;
  }

  /**
   * Calculate state transition with hysteresis
   */
  calculateNextState(currentState, conditionMet, rule, sensorId, value, timestamp) {
    const stateKey = `${rule.rule_id}:${sensorId}`;
    const hysteresis = rule.thresholds?.hysteresis || {};

    if (!currentState.isAlerting && conditionMet) {
      // Entering alert state
      return {
        isAlerting: true,
        triggeredAt: timestamp,
        triggeredValue: value,
        acknowledgedBy: null,
        acknowledgedAt: null,
      };
    }

    if (currentState.isAlerting && !conditionMet) {
      // Check hysteresis margin before exiting
      if (hysteresis.enabled && hysteresis.lower_margin) {
        const exitThreshold = rule.condition.value - hysteresis.lower_margin;
        if (value > exitThreshold) {
          return currentState; // Hysteresis: stay in alert state
        }
      }
      return {
        isAlerting: false,
        triggeredAt: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
      };
    }

    return currentState;
  }

  /**
   * Trigger alert: execute all configured actions
   */
  async triggerAlert(rule, sensorId, value, timestamp, state) {
    // Check if in cooldown period
    const cooldownKey = `${rule.rule_id}:${sensorId}`;
    const lastAlertTime = this.alertCooldown.get(cooldownKey);
    if (lastAlertTime && (timestamp - lastAlertTime) / 1000 < rule.cooldown_seconds) {
      console.log(`[AlertEngine] Alert in cooldown period: ${rule.rule_id}`);
      return;
    }

    // Create alert record
    const alert = {
      alert_id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rule_id: rule.rule_id,
      rule_name: rule.name,
      sensor_id: sensorId,
      timestamp_triggered: new Date(timestamp).toISOString(),
      sensor_value: value,
      threshold_value: rule.condition.value,
      severity: rule.severity,
      status: 'active',
      actions_executed: [],
      acknowledged_by: null,
      acknowledged_at: null,
      resolved_at: null,
    };

    // Execute notification actions
    for (const action of rule.actions) {
      const actionResult = await this.executeAction(action, alert, rule);
      alert.actions_executed.push(actionResult);
    }

    // Save to history
    this.alertHistory.push(alert);
    this.alertCooldown.set(cooldownKey, timestamp);

    // Emit event for subscribers
    this.emit('alert', { alert, rule });
  }

  /**
   * Execute single notification action
   */
  async executeAction(action, alert, rule) {
    const result = {
      type: action.type,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    try {
      switch (action.type) {
        case 'email':
          await this.sendEmail(action, alert, rule);
          result.status = 'sent';
          break;
        case 'slack':
          await this.sendSlack(action, alert, rule);
          result.status = 'sent';
          break;
        case 'sms':
          await this.sendSMS(action, alert, rule);
          result.status = 'sent';
          break;
        case 'webhook':
          await this.sendWebhook(action, alert, rule);
          result.status = 'sent';
          break;
        case 'dashboard':
          await this.sendDashboard(action, alert, rule);
          result.status = 'displayed';
          break;
        case 'log':
          this.logAlert(alert);
          result.status = 'logged';
          break;
      }
    } catch (error) {
      console.error(`[AlertEngine] Action ${action.type} failed:`, error.message);
      result.status = 'failed';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Resolve alert
   */
  resolveAlert(rule, sensorId, timestamp, previousState) {
    const alertEntry = this.alertHistory.find(a => 
      a.rule_id === rule.rule_id && 
      a.sensor_id === sensorId && 
      a.status === 'active'
    );

    if (alertEntry) {
      alertEntry.status = 'resolved';
      alertEntry.resolved_at = new Date(timestamp).toISOString();
      if (previousState.triggeredAt) {
        alertEntry.resolution_time_minutes = 
          (timestamp - previousState.triggeredAt) / 1000 / 60;
      }
    }

    this.emit('alert-resolved', { rule, sensorId, timestamp });
  }

  /**
   * Acknowledge alert (manual action)
   */
  acknowledgeAlert(alertId, acknowledgedBy, note = '') {
    const alert = this.alertHistory.find(a => a.alert_id === alertId);
    if (alert) {
      alert.acknowledged_by = acknowledgedBy;
      alert.acknowledged_at = new Date().toISOString();
      alert.acknowledged_note = note;
    }
  }

  /**
   * Notification channel implementations
   */

  async sendEmail(action, alert, rule) {
    // In production, use actual SMTP
    console.log(`[Email] To: ${action.recipients?.join(', ')}`);
    console.log(`[Email] Subject: ${action.subject}`);
    console.log(`[Email] Body: Alert ${alert.alert_id} - ${rule.name}`);
  }

  async sendSlack(action, alert, rule) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || action.webhook_url;
    if (!webhookUrl) {
      console.warn('[Slack] Webhook URL not configured');
      return;
    }

    const payload = {
      channel: action.channel,
      username: 'DC Monitor',
      text: `${this.getSeverityEmoji(alert.severity)} ${alert.rule_name}`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Sensor', value: alert.sensor_id, short: true },
            { title: 'Value', value: `${alert.sensor_value}`, short: true },
            { title: 'Threshold', value: `${alert.threshold_value}`, short: true },
            { title: 'Severity', value: alert.severity, short: true },
          ],
        },
      ],
    };

    try {
      await axios.post(webhookUrl, payload);
      console.log(`[Slack] Message sent to ${action.channel}`);
    } catch (error) {
      console.error('[Slack] Failed to send:', error.message);
      throw error;
    }
  }

  async sendSMS(action, alert, rule) {
    console.log(`[SMS] To: ${action.recipients?.join(', ')}`);
    console.log(`[SMS] Message: ${rule.name} - Value: ${alert.sensor_value}`);
    // In production, use Twilio or similar
  }

  async sendWebhook(action, alert, rule) {
    const payload = {
      alert_id: alert.alert_id,
      rule_id: alert.rule_id,
      sensor_id: alert.sensor_id,
      severity: alert.severity,
      timestamp: alert.timestamp_triggered,
      value: alert.sensor_value,
    };

    try {
      await axios.post(action.url, payload, {
        timeout: action.timeout_seconds * 1000 || 10000,
      });
      console.log(`[Webhook] Sent to ${action.url}`);
    } catch (error) {
      console.error('[Webhook] Failed:', error.message);
      throw error;
    }
  }

  async sendDashboard(action, alert, rule) {
    // Emit to connected WebSocket clients
    this.emit('dashboard-notification', {
      alert_id: alert.alert_id,
      message: rule.name,
      severity: alert.severity,
      timestamp: alert.timestamp_triggered,
      auto_dismiss: action.auto_dismiss_seconds,
    });
    console.log(`[Dashboard] Notification queued: ${alert.alert_id}`);
  }

  logAlert(alert) {
    console.log(`[AlertLog] ${JSON.stringify(alert)}`);
  }

  /**
   * Suppression checking
   */
  checkSuppression(rule, sensorId) {
    const now = new Date();
    for (const suppression of this.suppressionRules) {
      if (!suppression.enabled) continue;

      // Check if sensor affected
      if (suppression.affected_sensors !== '*') {
        if (!suppression.affected_sensors.includes(sensorId)) continue;
      }

      // Check time windows
      if (suppression.schedule) {
        const isInWindow = this.isInSuppression Window(suppression.schedule, now);
        if (isInWindow) {
          // Check severity exclusion
          if (suppression.exclude_severities?.includes(rule.severity)) {
            return false; // Don't suppress
          }
          return suppression.suppress_all || !suppression.suppress_all;
        }
      }
    }
    return false;
  }

  isInSuppressionWindow(schedule, now) {
    // Recurring (days + time)
    if (schedule.days) {
      const dayNum = now.getDay();
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayNum];
      if (schedule.days.includes(dayName)) {
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0');
        const [startH, startM] = schedule.start_time.split(':');
        const [endH, endM] = schedule.end_time.split(':');
        const start = parseInt(startH) * 60 + parseInt(startM);
        const end = parseInt(endH) * 60 + parseInt(endM);
        const current = now.getHours() * 60 + now.getMinutes();
        return current >= start && current <= end;
      }
    }

    // One-time (datetime)
    if (schedule.start_datetime && schedule.end_datetime) {
      const startDt = new Date(schedule.start_datetime);
      const endDt = new Date(schedule.end_datetime);
      return now >= startDt && now <= endDt;
    }

    return false;
  }

  /**
   * Helper: Sensor history tracking
   */
  updateSensorHistory(sensorId, value, timestamp) {
    if (!this.sensorHistory.has(sensorId)) {
      this.sensorHistory.set(sensorId, []);
    }
    const history = this.sensorHistory.get(sensorId);
    history.push({ value, timestamp });

    // Keep last 100 readings
    if (history.length > 100) {
      history.shift();
    }
  }

  getSensorCurrentValue(sensorId) {
    const history = this.sensorHistory.get(sensorId) || [];
    return history.length > 0 ? history[history.length - 1].value : null;
  }

  getSensorLastReadingTime(sensorId) {
    const history = this.sensorHistory.get(sensorId) || [];
    return history.length > 0 ? history[history.length - 1].timestamp : null;
  }

  calculateRateOfChange(sensorId, currentTime, timeWindowSeconds) {
    const history = this.sensorHistory.get(sensorId) || [];
    if (history.length < 2) return 0;

    const cutoff = currentTime - timeWindowSeconds * 1000;
    const relevantReadings = history.filter(h => h.timestamp >= cutoff);

    if (relevantReadings.length < 2) return 0;

    const oldest = relevantReadings[0];
    const newest = relevantReadings[relevantReadings.length - 1];
    const valueChange = newest.value - oldest.value;
    const timeChange = (newest.timestamp - oldest.timestamp) / 1000; // seconds

    return timeChange > 0 ? valueChange / timeChange : 0;
  }

  /**
   * Helper: Tracking condition duration
   */
  getConditionStartTime(sensorId, condition) {
    // Implementation depends on state storage
    return null;
  }

  setConditionStartTime(sensorId, condition, timestamp) {
    // Implementation depends on state storage
  }

  /**
   * Helper: UI formatting
   */
  getSeverityEmoji(severity) {
    const emojis = {
      'critical': '🔴',
      'warning': '🟡',
      'info': '🔵',
    };
    return emojis[severity] || '⚪';
  }

  getSeverityColor(severity) {
    const colors = {
      'critical': '#ff0000',
      'warning': '#ffcc00',
      'info': '#0066cc',
    };
    return colors[severity] || '#cccccc';
  }

  /**
   * API methods
   */

  getActiveAlerts() {
    return this.alertHistory.filter(a => a.status === 'active');
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit).reverse();
  }

  getSensorAlertHistory(sensorId) {
    return this.alertHistory.filter(a => a.sensor_id === sensorId);
  }

  getAlertStats() {
    return {
      total_alerts: this.alertHistory.length,
      active_alerts: this.getActiveAlerts().length,
      critical: this.alertHistory.filter(a => a.severity === 'critical').length,
      warning: this.alertHistory.filter(a => a.severity === 'warning').length,
      resolved: this.alertHistory.filter(a => a.status === 'resolved').length,
    };
  }
}

module.exports = AlertEngine;
