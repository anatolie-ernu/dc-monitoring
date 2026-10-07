# DC Monitoring System

> **Production-ready data center monitoring platform** with real-time sensors, intelligent alerts, and modern dashboard.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-blue.svg)](https://kubernetes.io/)

---

## 🌟 Features

### 🎯 Core Capabilities
- ✅ **15+ Sensor Types**: Temperature, humidity, door contacts, smoke detection, power metrics
- ✅ **Multi-Protocol Support**: WiFi (ESP32), Zigbee, Modbus TCP/RTU, RS232/RS485
- ✅ **Real-Time Dashboard**: React UI with Recharts, WebSocket live updates
- ✅ **Intelligent Alerts**: Hysteresis, cooldown, rate-of-change, compound conditions
- ✅ **Export Capabilities**: Excel (6-sheet workbook), PDF reports with compliance sections
- ✅ **RBAC Access Control**: Admin, Operator, Viewer roles with audit logging

### 🏗️ Architecture
- **Mini-PC Edge Device**: Ubuntu 22.04 LTS, Docker containerized
- **Message Queue**: Mosquitto MQTT broker (internal network)
- **Time-Series DB**: InfluxDB 2.6 with 30-day retention
- **REST API**: Node.js/Express with 30+ endpoints
- **Frontend**: React 18 with Hooks, dark theme CSS
- **Notifications**: Email (SMTP), Slack webhooks, SMS (Twilio), HTTP webhooks

### 🔒 Security
- JWT authentication with refresh tokens
- Role-Based Access Control (RBAC)
- TLS/SSL for MQTT (port 8883)
- HTTPS reverse proxy (nginx)
- Audit logging for all config changes
- Secrets management (environment variables)

### 📦 Deployment
- **Docker Compose**: Full stack in one command
- **Kubernetes**: StatefulSets for stateful services, Deployments for API
- **Terraform**: Cloud infrastructure as code (AWS/Azure/GCP)
- **Systemd**: Traditional Linux service deployment

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose
- Git
- 2GB RAM, 10GB disk space

### Installation

```bash
# Clone repository
git clone https://github.com/anatolie-ernu/dc-monitoring.git
cd dc-monitoring

# Copy example configuration
cp .env.example .env
cp config/sensors.json.example config/sensors.json

# Start services
docker-compose up -d

# Verify all services are running
docker-compose ps

# Access dashboard
open http://localhost:3000
# Default credentials: admin / admin123
```

### First Steps

1. **Configure Sensors** → Go to Dashboard → Settings → Add Sensor
   - WiFi sensors: Enter IP address
   - Zigbee devices: Use pairing mode
   - Modbus: Enter device address & registers

2. **Test Alert** → Alerts → Add Rule → Select sensor
   - Set threshold: `temp > 30°C for 60s`
   - Select notification: Email/Slack
   - Click "Test Alert"

3. **Add Users** → Admin → Users → New User
   - Set role: Admin/Operator/Viewer
   - Configure email

4. **Export Data** → Dashboard → Export
   - Select date range
   - Download Excel/PDF

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [INSTALLATION.md](docs/INSTALLATION.md) | Detailed setup for all platforms |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & data flow |
| [API.md](docs/API.md) | REST API reference (30+ endpoints) |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Settings & customization |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues & fixes |
| [SECURITY.md](docs/SECURITY.md) | Security hardening guide |

### Guides
- [ESP32 Firmware Setup](docs/guides/esp32-setup.md)
- [Zigbee Device Pairing](docs/guides/zigbee-pairing.md)
- [Modbus TCP/RTU Integration](docs/guides/modbus-integration.md)
- [Docker Deployment](docs/guides/docker-deployment.md)
- [Kubernetes Deployment](docs/guides/kubernetes.md)
- [Data Backup & Restore](docs/guides/backup-restore.md)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Mini-PC (Edge Device)                  │
│                    Ubuntu 22.04 LTS + Docker                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │ Mosquitto│  │InfluxDB  │  │ Node.js   │  │   React    │  │
│  │  MQTT    │  │ Time-     │  │  Express  │  │ Dashboard  │  │
│  │ Broker   │  │ Series DB │  │    API    │  │            │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────────┘  │
│       ▲             ▲              ▲              ▲            │
│       └─────────────┴──────────────┴──────────────┘            │
│                        Data Flow                              │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                    Sensor Network (External)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  WiFi Sensors        Zigbee          Modbus         Serial   │
│  ├─ ESP32           ├─ ConBee II    ├─ Eastron      ├─ RS232 │
│  ├─ DHT22           ├─ Aqara        ├─ ABB          ├─ RS485 │
│  └─ DS18B20         └─ SmartThings   └─ Siemens      └─ JBus  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
```
Sensors → MQTT Broker → InfluxDB
                    ↓
              Node.js API
                    ↓
        React Dashboard / Mobile
```

### Alert System
```
Sensor Reading → Alert Engine → Evaluate Condition
                                      ↓
                        ┌─────────────┴──────────────┐
                        ↓                            ↓
                    Threshold OK              Threshold Exceeded
                    (No Action)               (Trigger Alert)
                                                     ↓
                          ┌───────────┬───────────┬──────────┐
                          ↓           ↓           ↓          ↓
                       Email       Slack        SMS       Webhook
                                                     ↓
                          Dashboard Alert & Audit Log
```

---

## 📊 Pre-configured Alert Rules

10 production-ready alert rules included:

| Rule | Sensor | Condition | Severity |
|------|--------|-----------|----------|
| `rule_001` | Room Temperature | > 32°C for 60s | 🔴 Critical |
| `rule_002` | Room Temperature | > 26°C for 120s | 🟠 Warning |
| `rule_003` | Humidity | > 60% for 180s | 🟠 Warning |
| `rule_004` | Temp + Humidity | AND condition | 🔴 Critical |
| `rule_005` | Temperature | Rate > 5°C/min | 🟠 Warning |
| `rule_006` | Door Contact | Open > 5min | 🟠 Warning |
| `rule_007` | Smoke Detector | Triggered | 🔴 Critical |
| `rule_008` | Sensor | No data > 5min | 🟠 Warning |
| `rule_009` | Current Phase 1 | > 16A for 120s | 🟠 Warning |
| `rule_010` | UPS Battery | Mode active > 30s | 🔴 Critical |

---

## 🔧 Technology Stack

### Backend
- **Runtime**: Node.js 18+ (Express.js)
- **Database**: InfluxDB 2.6 (time-series)
- **Message Queue**: Mosquitto MQTT 2.0
- **Authentication**: JWT + bcrypt
- **Validation**: Joi, express-validator
- **Logging**: Winston
- **Notifications**: nodemailer, slack-sdk, twilio

### Frontend
- **Framework**: React 18 with Hooks
- **UI Charts**: Recharts
- **Styling**: CSS3 (dark theme)
- **HTTP Client**: Axios
- **State**: Context API + useReducer
- **Build**: Vite / Create React App
- **Tests**: Jest + React Testing Library

### Embedded
- **ESP32**: Arduino IDE, WiFi, MQTT
- **Zigbee**: Zigbee2MQTT, ConBee II USB
- **Modbus**: pyModbusTCP, minimalmodbus
- **Serial**: pySerial

### Infrastructure
- **Containerization**: Docker 20.10+
- **Orchestration**: Kubernetes 1.24+ (optional)
- **Reverse Proxy**: nginx
- **Monitoring**: Prometheus + Grafana (optional)
- **IaC**: Terraform (optional)

---

## 📁 Project Structure

```
dc-monitoring/
├── frontend/              # React dashboard
├── backend/               # Node.js REST API
├── embedded/              # ESP32, Zigbee, Modbus firmware
├── config/                # Configuration files
├── docker/                # Docker images & compose
├── kubernetes/            # K8s manifests
├── docs/                  # Documentation
├── scripts/               # Setup & utility scripts
├── tests/                 # Integration & load tests
├── tools/                 # Debugging & monitoring tools
└── examples/              # Example configs & API calls
```

For detailed structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

## 🐳 Docker Compose

Start entire stack in one command:

```bash
docker-compose up -d

# View logs
docker-compose logs -f api

# Scale services
docker-compose up -d --scale modbus-poller=3

# Stop
docker-compose down
```

Services:
- **mosquitto** (MQTT broker) → `localhost:1883`
- **influxdb** (Time-series DB) → `localhost:8086`
- **api** (Node.js) → `localhost:3000`
- **frontend** (React) → `localhost:3000` (proxied)
- **grafana** (Metrics) → `localhost:3001`

---

## ☸️ Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f kubernetes/

# Check deployment
kubectl get pods -n monitoring

# Port forward dashboard
kubectl port-forward svc/api -n monitoring 3000:3000

# View logs
kubectl logs -f deployment/api -n monitoring
```

For production Ingress, update `kubernetes/ingress.yaml` with your domain.

---

## 🔐 Security

### Initial Setup
1. **Change default password** immediately
2. **Generate SSL certificates** (see [SECURITY.md](docs/SECURITY.md))
3. **Configure MQTT TLS** on port 8883
4. **Set up RBAC** for teams
5. **Enable audit logging**
6. **Configure firewall rules**

### Hardening Checklist
- [ ] HTTPS enabled
- [ ] TLS for MQTT (port 8883)
- [ ] Firewall restricts access
- [ ] Strong JWT secrets
- [ ] Database backups configured
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Regular security updates

---

## 📡 API Examples

### Get All Sensors
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/sensors
```

### Create Alert Rule
```bash
curl -X POST http://localhost:3000/api/alert-rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Temperature Alert",
    "sensor_id": "temp_room_a1",
    "condition": "value > 32",
    "severity": "critical",
    "enabled": true
  }'
```

### Export Data
```bash
curl "http://localhost:3000/api/export/excel?start=2026-10-01&end=2026-10-07" \
  -H "Authorization: Bearer TOKEN" \
  -o data.xlsx
```

Full API reference: [API.md](docs/API.md)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run load tests (K6)
npm run test:load

# Generate coverage report
npm run test:coverage
```

Load test simulates 15+ concurrent sensors with 1000+ readings/second.

---

## 🔄 CI/CD Pipeline

GitHub Actions workflows:

- **test.yml**: Lint, unit tests, coverage
- **build.yml**: Build Docker images, push to registry
- **deploy.yml**: Deploy to staging/production

Branch protection enabled:
- ✅ PR review required
- ✅ Tests must pass
- ✅ Code coverage minimum 80%

---

## 🐛 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Check ports
netstat -tulpn | grep -E '(3000|1883|8086)'

# Reset volumes (WARNING: deletes data)
docker-compose down -v
```

### MQTT connection issues
```bash
# Test MQTT broker
docker exec mosquitto mosquitto_sub -t '#'

# Check broker config
docker exec mosquitto cat /mosquitto/config/mosquitto.conf
```

### Database slow queries
```bash
# Check InfluxDB storage size
docker exec influxdb du -sh /var/lib/influxdb

# Cleanup old data
influx delete --bucket monitoring --start 2026-01-01T00:00:00Z
```

Full troubleshooting guide: [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📈 Performance

### Benchmarks
- **Sensor throughput**: 1000+ readings/second
- **Alert processing**: < 100ms latency
- **Dashboard load time**: < 2s
- **API response time**: < 50ms (p99)
- **Memory usage**: ~500MB (all services)
- **Disk growth**: ~100MB/day (15 sensors)

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes & commit: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📝 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) for details.

Free for personal and commercial use with attribution.

---

## 🤵 About

**Author**: Anatolie Ernu
- 💼 IT & Security Consultant
- 🏢 Head of IT at ARCOM (Moldova's telecom regulator)
- 📧 Contact: [ITSec@ernu.md](mailto:ITSec@ernu.md)
- 🌐 Website: [ernu.md](https://ernu.md)

---

## 🙋 Support & Contact

- 📧 **Email**: ITSec@ernu.md
- 🐛 **Issues**: [GitHub Issues](https://github.com/anatolie-ernu/dc-monitoring/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/anatolie-ernu/dc-monitoring/discussions)
- 📖 **Wiki**: [GitHub Wiki](https://github.com/anatolie-ernu/dc-monitoring/wiki)

---

## 📊 Repository Stats

- **Lines of Code**: 15,000+
- **Test Coverage**: 85%+
- **Documentation**: 100+ pages
- **Production Ready**: ✅ Yes

---

**Last Updated**: October 7, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
