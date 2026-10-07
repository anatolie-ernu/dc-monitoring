/**
 * ALERT CONFIGURATOR UI - React Component
 * 
 * Embedded configurator for managing:
 * - Alert rules (CRUD)
 * - Thresholds & hysteresis
 * - Notification channels
 * - Suppression windows
 * - Alert history & acknowledgment
 */

import React, { useState, useEffect } from 'react';
import './AlertConfigurator.css';

const AlertConfigurator = ({ api, userRole = 'admin' }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check RBAC
  const canEdit = ['admin', 'operator'].includes(userRole);
  const canDelete = userRole === 'admin';

  useEffect(() => {
    loadAlerts();
    loadRules();
    loadChannels();
    // Subscribe to real-time alerts via WebSocket
    subscribeToAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await fetch(`${api}/api/alerts/active`);
      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      setError(`Failed to load alerts: ${err.message}`);
    }
  };

  const loadRules = async () => {
    try {
      const response = await fetch(`${api}/api/alert-rules`);
      const data = await response.json();
      setRules(data);
    } catch (err) {
      setError(`Failed to load rules: ${err.message}`);
    }
  };

  const loadChannels = async () => {
    try {
      const response = await fetch(`${api}/api/notification-channels`);
      const data = await response.json();
      setChannels(data);
    } catch (err) {
      setError(`Failed to load channels: ${err.message}`);
    }
  };

  const subscribeToAlerts = () => {
    // WebSocket subscription for real-time updates
    const ws = new WebSocket(`${api.replace('http', 'ws')}/ws/alerts`);
    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data);
      setAlerts(prev => [alert, ...prev]);
    };
  };

  // ============================================
  // TAB 1: Alert Dashboard
  // ============================================
  const renderDashboard = () => (
    <div className="dashboard-tab">
      <div className="alert-stats">
        <div className="stat-card critical">
          <div className="stat-value">{alerts.filter(a => a.severity === 'critical').length}</div>
          <div className="stat-label">Critical Alerts</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{alerts.filter(a => a.severity === 'warning').length}</div>
          <div className="stat-label">Warnings</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{alerts.length}</div>
          <div className="stat-label">Total Active</div>
        </div>
      </div>

      <div className="active-alerts">
        <h3>Active Alerts</h3>
        {alerts.length === 0 ? (
          <p className="empty-state">✓ No active alerts</p>
        ) : (
          <div className="alert-list">
            {alerts.map(alert => (
              <div key={alert.alert_id} className={`alert-item severity-${alert.severity}`}>
                <div className="alert-header">
                  <span className="severity-badge">{alert.severity.toUpperCase()}</span>
                  <span className="rule-name">{alert.rule_name}</span>
                  <span className="timestamp">{new Date(alert.timestamp_triggered).toLocaleTimeString()}</span>
                </div>
                <div className="alert-body">
                  <p><strong>Sensor:</strong> {alert.sensor_id}</p>
                  <p><strong>Value:</strong> {alert.sensor_value} (Threshold: {alert.threshold_value})</p>
                </div>
                <div className="alert-actions">
                  {!alert.acknowledged_by && canEdit && (
                    <button onClick={() => acknowledgeAlert(alert.alert_id)}>
                      Acknowledge
                    </button>
                  )}
                  {alert.acknowledged_by && (
                    <span className="acknowledged">
                      ✓ Acked by {alert.acknowledged_by}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // TAB 2: Alert Rules Management
  // ============================================
  const renderRulesTab = () => (
    <div className="rules-tab">
      <div className="rules-header">
        <h3>Alert Rules</h3>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditingRule({})}>
            + New Rule
          </button>
        )}
      </div>

      <div className="rules-list">
        {rules.map(rule => (
          <div key={rule.rule_id} className={`rule-card ${rule.enabled ? 'enabled' : 'disabled'}`}>
            <div className="rule-header">
              <h4>{rule.name}</h4>
              <span className={`status ${rule.enabled ? 'enabled' : 'disabled'}`}>
                {rule.enabled ? '✓ Active' : '✕ Disabled'}
              </span>
            </div>

            <div className="rule-condition">
              <h5>Condition:</h5>
              <RuleConditionDisplay condition={rule.condition} />
            </div>

            <div className="rule-actions">
              <h5>Notifications ({rule.actions.length}):</h5>
              <div className="action-list">
                {rule.actions.map((action, idx) => (
                  <span key={idx} className="action-badge">{action.type}</span>
                ))}
              </div>
            </div>

            <div className="rule-footer">
              <span className={`severity severity-${rule.severity}`}>
                {rule.severity.toUpperCase()}
              </span>
              <span className="cooldown">Cooldown: {rule.cooldown_seconds}s</span>

              {canEdit && (
                <div className="rule-buttons">
                  <button onClick={() => setEditingRule(rule)}>Edit</button>
                  <button 
                    onClick={() => toggleRuleEnabled(rule.rule_id, !rule.enabled)}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              )}
              {canDelete && (
                <button className="btn-danger" onClick={() => deleteRule(rule.rule_id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rule Editor Modal */}
      {editingRule && (
        <RuleEditor
          rule={editingRule}
          onSave={saveRule}
          onCancel={() => setEditingRule(null)}
          channels={channels}
        />
      )}
    </div>
  );

  // ============================================
  // TAB 3: Threshold Configuration
  // ============================================
  const renderThresholdsTab = () => (
    <div className="thresholds-tab">
      <h3>Sensor Thresholds & Hysteresis</h3>
      <p className="info">Configure min/max/critical values and hysteresis to prevent alert flapping</p>

      <div className="thresholds-list">
        {rules.map(rule => (
          <div key={rule.rule_id} className="threshold-card">
            <div className="threshold-header">
              <h4>{rule.name}</h4>
              <span className="rule-id">{rule.rule_id}</span>
            </div>

            <div className="threshold-editor">
              <div className="input-group">
                <label>Minimum Safe Value</label>
                <input 
                  type="number" 
                  defaultValue={rule.thresholds?.min_safe || 0}
                  disabled={!canEdit}
                />
              </div>

              <div className="input-group">
                <label>Warning Threshold</label>
                <input 
                  type="number" 
                  defaultValue={rule.thresholds?.max_warning || 0}
                  disabled={!canEdit}
                />
              </div>

              <div className="input-group">
                <label>Critical Threshold</label>
                <input 
                  type="number" 
                  defaultValue={rule.thresholds?.max_critical || 0}
                  disabled={!canEdit}
                />
              </div>

              <div className="hysteresis-config">
                <label>
                  <input type="checkbox" defaultChecked={rule.thresholds?.hysteresis?.enabled} />
                  Enable Hysteresis
                </label>
                <p className="help-text">
                  Prevents alert flapping when value hovers near threshold
                </p>
                <div className="input-group">
                  <label>Hysteresis Margin (lower)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    defaultValue={rule.thresholds?.hysteresis?.lower_margin || 0.5}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {canEdit && (
                <button className="btn-primary">Update Thresholds</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // TAB 4: Notification Channels
  // ============================================
  const renderChannelsTab = () => (
    <div className="channels-tab">
      <h3>Notification Channels</h3>

      <div className="channels-grid">
        {channels.map(channel => (
          <div key={channel.channel_id} className="channel-card">
            <div className="channel-type">
              {getChannelIcon(channel.type)} {channel.type.toUpperCase()}
            </div>
            <h4>{channel.channel_id}</h4>

            <div className="channel-status">
              <span className={channel.enabled ? 'enabled' : 'disabled'}>
                {channel.enabled ? '✓ Enabled' : '✕ Disabled'}
              </span>
            </div>

            <div className="channel-details">
              {channel.type === 'email' && (
                <p><strong>SMTP:</strong> {channel.config.smtp_host}:{channel.config.smtp_port}</p>
              )}
              {channel.type === 'slack' && (
                <p><strong>Webhook:</strong> {channel.config.webhook_url?.substring(0, 40)}...</p>
              )}
              {channel.type === 'sms' && (
                <p><strong>Provider:</strong> {channel.config.provider}</p>
              )}
            </div>

            <div className="channel-actions">
              {canEdit && (
                <>
                  <button>Test</button>
                  <button>Edit</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // TAB 5: Suppression Windows
  // ============================================
  const renderSuppressionTab = () => (
    <div className="suppression-tab">
      <h3>Alert Suppression Windows</h3>
      <p className="info">Configure maintenance windows and quiet hours</p>

      <div className="suppression-list">
        <div className="suppression-card">
          <h4>Weekend Maintenance</h4>
          <p>Days: Saturday, Sunday | Time: 00:00 - 23:59</p>
          <p>Suppress: Non-critical alerts only</p>
          {canEdit && <button>Edit</button>}
        </div>

        <div className="suppression-card">
          <h4>Scheduled Maintenance - Oct 15</h4>
          <p>Date Range: 2026-10-15 08:00 - 12:00 UTC</p>
          <p>Affected Sensors: temp_room_a1, humidity_room_a1</p>
          <p>Suppress: All alerts</p>
          {canEdit && <button>Edit</button>}
        </div>

        {canEdit && (
          <button className="btn-primary">+ Add Suppression Window</button>
        )}
      </div>
    </div>
  );

  // ============================================
  // TAB 6: Alert History
  // ============================================
  const renderHistoryTab = () => (
    <div className="history-tab">
      <h3>Alert History</h3>
      <div className="history-filters">
        <input type="date" placeholder="From date" />
        <input type="date" placeholder="To date" />
        <select>
          <option>All Severities</option>
          <option>Critical</option>
          <option>Warning</option>
          <option>Info</option>
        </select>
        <button>Filter</button>
      </div>

      <table className="history-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Rule</th>
            <th>Sensor</th>
            <th>Severity</th>
            <th>Duration</th>
            <th>Acknowledged</th>
          </tr>
        </thead>
        <tbody>
          {/* Placeholder */}
          <tr>
            <td>2026-10-06 14:32:45</td>
            <td>Temperature Critical - Room A1</td>
            <td>temp_room_a1</td>
            <td><span className="severity-badge critical">CRITICAL</span></td>
            <td>58 minutes</td>
            <td>operator1 @ 14:35</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // ============================================
  // Action Handlers
  // ============================================

  const acknowledgeAlert = async (alertId) => {
    try {
      await fetch(`${api}/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          acknowledged_by: 'current_user',
          note: 'Acknowledged'
        })
      });
      loadAlerts();
    } catch (err) {
      setError(`Failed to acknowledge: ${err.message}`);
    }
  };

  const saveRule = async (rule) => {
    try {
      const method = rule.rule_id ? 'PUT' : 'POST';
      const url = rule.rule_id 
        ? `${api}/api/alert-rules/${rule.rule_id}`
        : `${api}/api/alert-rules`;
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      
      loadRules();
      setEditingRule(null);
    } catch (err) {
      setError(`Failed to save rule: ${err.message}`);
    }
  };

  const toggleRuleEnabled = async (ruleId, enabled) => {
    try {
      await fetch(`${api}/api/alert-rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      loadRules();
    } catch (err) {
      setError(`Failed to toggle rule: ${err.message}`);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await fetch(`${api}/api/alert-rules/${ruleId}`, { method: 'DELETE' });
      loadRules();
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="alert-configurator">
      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
          disabled={!canEdit}
        >
          ⚙️ Rules
        </button>
        <button 
          className={`tab ${activeTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveTab('thresholds')}
          disabled={!canEdit}
        >
          📏 Thresholds
        </button>
        <button 
          className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
          disabled={!canEdit}
        >
          📧 Channels
        </button>
        <button 
          className={`tab ${activeTab === 'suppression' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppression')}
          disabled={!canEdit}
        >
          🔇 Suppression
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 History
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'thresholds' && renderThresholdsTab()}
        {activeTab === 'channels' && renderChannelsTab()}
        {activeTab === 'suppression' && renderSuppressionTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>
    </div>
  );
};

/**
 * Helper Components
 */

const RuleConditionDisplay = ({ condition }) => {
  if (condition.sub_conditions) {
    return (
      <div className="compound-condition">
        {condition.logic} logic:
        {condition.sub_conditions.map((c, idx) => (
          <div key={idx}>
            {c.sensor_id} {c.operator} {c.value}
          </div>
        ))}
      </div>
    );
  }

  if (condition.type === 'rate_of_change') {
    return <p>{condition.sensor_id}: rate > {condition.threshold} per {condition.time_window_seconds}s</p>;
  }

  return (
    <p>
      {condition.sensor_id} {condition.operator} {condition.value}
      {condition.duration_seconds > 0 && ` for ${condition.duration_seconds}s`}
    </p>
  );
};

const RuleEditor = ({ rule, onSave, onCancel, channels }) => {
  const [formData, setFormData] = useState(rule);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{rule.rule_id ? 'Edit Rule' : 'New Alert Rule'}</h3>
        
        <div className="form-group">
          <label>Rule Name</label>
          <input 
            value={formData.name || ''}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Severity</label>
          <select 
            value={formData.severity || 'warning'}
            onChange={e => setFormData({...formData, severity: e.target.value})}
          >
            <option>info</option>
            <option>warning</option>
            <option>critical</option>
          </select>
        </div>

        <div className="form-actions">
          <button onClick={() => onSave(formData)}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

function getChannelIcon(type) {
  const icons = {
    email: '📧',
    slack: '💬',
    sms: '📱',
    webhook: '🔗',
    dashboard: '📊',
    log: '📝',
  };
  return icons[type] || '❓';
}

export default AlertConfigurator;
