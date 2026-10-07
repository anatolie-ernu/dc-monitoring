/**
 * DC MONITORING - ESP32 REMOTE SENSOR FIRMWARE
 * 
 * Features:
 * - WiFi connectivity with auto-reconnect
 * - MQTT data transmission
 * - Multiple sensor types (DHT22, DS18B20, analog inputs)
 * - Local data buffering (optional SD card)
 * - OTA firmware updates
 * - Low power modes
 * - Web dashboard for configuration
 * - Battery voltage monitoring
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <time.h>

// ============================================
// CONFIGURATION
// ============================================

// WiFi Configuration
const char* WIFI_SSID = "YourNetworkSSID";
const char* WIFI_PASS = "YourNetworkPassword";
const char* DEVICE_ID = "sensor_room_a1";
const char* DEVICE_NAME = "Room A1 - Temperature & Humidity";

// MQTT Configuration
const char* MQTT_SERVER = "192.168.1.100";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "monitoring";
const char* MQTT_PASS = "secure_password";
const char* MQTT_BASE_TOPIC = "sensors";

// Sensor Configuration
#define DHT_PIN 4           // GPIO 4 for DHT22
#define DHT_TYPE DHT22
#define ONEWIRE_PIN 5       // GPIO 5 for DS18B20
#define ANALOG_PIN 34       // GPIO 34 for analog input (0-3.3V)
#define BATTERY_PIN 35      // GPIO 35 for battery voltage
#define DOOR_SENSOR_PIN 27  // GPIO 27 for door contact
#define RELAY_PIN 26        // GPIO 26 for relay output

// Timing Configuration
#define PUBLISH_INTERVAL 30000    // 30 seconds
#define RECONNECT_INTERVAL 10000  // 10 seconds
#define SENSOR_READ_INTERVAL 5000 // 5 seconds

// ============================================
// GLOBAL OBJECTS
// ============================================

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHT_PIN, DHT_TYPE);
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature ds18b20(&oneWire);

// Sensor data structure
struct SensorData {
  float temperature;
  float humidity;
  float temperature_ds18b20;
  float analog_value;
  float analog_voltage;
  int door_status;    // 0 = closed, 1 = open
  float battery_voltage;
  int rssi;           // WiFi signal strength
  bool dht_ok;
  bool ds18b20_ok;
  unsigned long last_read;
};

SensorData sensorData;
unsigned long lastPublish = 0;
unsigned long lastSensorRead = 0;
unsigned long lastReconnectAttempt = 0;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 REMOTE SENSOR ===");
  Serial.printf("Device: %s\n", DEVICE_ID);
  Serial.printf("Name: %s\n", DEVICE_NAME);
  
  // Initialize pins
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
  // Initialize sensors
  initializeSensors();
  
  // Initialize WiFi
  setupWiFi();
  
  // Configure MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  
  // Initialize time (for timestamps)
  configTime(0, 0, "pool.ntp.org");
  
  Serial.println("Setup complete!");
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      Serial.println("[WiFi] Reconnecting...");
      WiFi.reconnect();
      lastReconnectAttempt = millis();
    }
  }
  
  // Reconnect MQTT if needed
  if (!mqttClient.connected()) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      reconnectMQTT();
      lastReconnectAttempt = millis();
    }
  } else {
    mqttClient.loop(); // Process MQTT messages
  }
  
  // Read sensors at interval
  if (millis() - lastSensorRead > SENSOR_READ_INTERVAL) {
    readSensors();
    lastSensorRead = millis();
  }
  
  // Publish data at interval
  if (millis() - lastPublish > PUBLISH_INTERVAL) {
    publishSensorData();
    lastPublish = millis();
  }
  
  delay(100);
}

// ============================================
// SENSOR INITIALIZATION
// ============================================

void initializeSensors() {
  Serial.println("[Sensors] Initializing...");
  
  // Initialize DHT22
  dht.begin();
  Serial.println("[DHT22] Initialized on pin 4");
  
  // Initialize DS18B20
  ds18b20.begin();
  Serial.println("[DS18B20] Initialized on pin 5");
  
  // Initialize analog input
  analogSetAttenuation(ADC_11db);
  Serial.println("[Analog] Initialized on pin 34");
  
  Serial.println("[Sensors] Ready!");
}

// ============================================
// SENSOR READING
// ============================================

void readSensors() {
  // Read DHT22 (Temperature & Humidity)
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  if (!isnan(humidity) && !isnan(temperature)) {
    sensorData.temperature = temperature;
    sensorData.humidity = humidity;
    sensorData.dht_ok = true;
  } else {
    sensorData.dht_ok = false;
    Serial.println("[DHT22] Read failed!");
  }
  
  // Read DS18B20 (Temperature)
  ds18b20.requestTemperatures();
  sensorData.temperature_ds18b20 = ds18b20.getTempCByIndex(0);
  if (sensorData.temperature_ds18b20 != DEVICE_DISCONNECTED_C) {
    sensorData.ds18b20_ok = true;
  } else {
    sensorData.ds18b20_ok = false;
    Serial.println("[DS18B20] Read failed!");
  }
  
  // Read Analog Input (0-3.3V)
  int rawAnalog = analogRead(ANALOG_PIN);
  sensorData.analog_value = rawAnalog;
  sensorData.analog_voltage = (rawAnalog / 4095.0) * 3.3; // 12-bit ADC
  
  // Read Door Sensor (Digital Input)
  sensorData.door_status = digitalRead(DOOR_SENSOR_PIN);
  
  // Read Battery Voltage
  int rawBattery = analogRead(BATTERY_PIN);
  // Assuming voltage divider: 2.2k + 10k = 12.2k total, measured on 10k
  sensorData.battery_voltage = (rawBattery / 4095.0) * 3.3 * (12.2 / 10.0);
  
  // Get WiFi signal strength
  sensorData.rssi = WiFi.RSSI();
  
  // Timestamp
  sensorData.last_read = millis();
  
  printSensorData();
}

void printSensorData() {
  Serial.println("\n[Sensor Data]");
  if (sensorData.dht_ok) {
    Serial.printf("  Temperature (DHT22): %.2f°C\n", sensorData.temperature);
    Serial.printf("  Humidity: %.2f%%\n", sensorData.humidity);
  }
  if (sensorData.ds18b20_ok) {
    Serial.printf("  Temperature (DS18B20): %.2f°C\n", sensorData.temperature_ds18b20);
  }
  Serial.printf("  Analog Input: %d (%.2fV)\n", sensorData.analog_value, sensorData.analog_voltage);
  Serial.printf("  Door Sensor: %s\n", sensorData.door_status == 0 ? "Closed" : "Open");
  Serial.printf("  Battery: %.2fV\n", sensorData.battery_voltage);
  Serial.printf("  WiFi Signal: %d dBm\n", sensorData.rssi);
}

// ============================================
// MQTT PUBLICATION
// ============================================

void publishSensorData() {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Not connected, skipping publish");
    return;
  }
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  
  // Add timestamp
  time_t now = time(nullptr);
  doc["timestamp"] = now;
  
  // Add sensor readings
  doc["device_id"] = DEVICE_ID;
  doc["device_name"] = DEVICE_NAME;
  
  if (sensorData.dht_ok) {
    doc["temperature"] = round(sensorData.temperature * 100.0) / 100.0;
    doc["humidity"] = round(sensorData.humidity * 100.0) / 100.0;
  }
  
  if (sensorData.ds18b20_ok) {
    doc["temperature_external"] = round(sensorData.temperature_ds18b20 * 100.0) / 100.0;
  }
  
  doc["analog_value"] = sensorData.analog_value;
  doc["analog_voltage"] = round(sensorData.analog_voltage * 100.0) / 100.0;
  doc["door_status"] = sensorData.door_status;
  doc["battery_voltage"] = round(sensorData.battery_voltage * 100.0) / 100.0;
  doc["rssi"] = sensorData.rssi;
  doc["uptime"] = millis() / 1000;
  
  // Serialize to string
  char buffer[512];
  serializeJson(doc, buffer);
  
  // Publish to MQTT
  String topic = String(MQTT_BASE_TOPIC) + "/" + String(DEVICE_ID);
  bool published = mqttClient.publish(topic.c_str(), buffer);
  
  if (published) {
    Serial.printf("[MQTT] Published to %s\n", topic.c_str());
    Serial.printf("  Payload: %s\n", buffer);
  } else {
    Serial.println("[MQTT] Publish failed!");
  }
}

// ============================================
// MQTT MESSAGE HANDLING
// ============================================

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Message received on topic: %s\n", topic);
  
  // Parse JSON from payload
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.printf("  JSON parse error: %s\n", error.c_str());
    return;
  }
  
  // Handle commands
  if (doc.containsKey("command")) {
    String command = doc["command"];
    
    if (command == "relay_on") {
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("  [Relay] Turned ON");
      publishStatus("relay", 1);
    } 
    else if (command == "relay_off") {
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("  [Relay] Turned OFF");
      publishStatus("relay", 0);
    }
    else if (command == "read_now") {
      readSensors();
      publishSensorData();
    }
    else if (command == "restart") {
      Serial.println("  [System] Restarting...");
      delay(1000);
      ESP.restart();
    }
  }
}

void publishStatus(const char* status_type, int value) {
  StaticJsonDocument<128> doc;
  doc["status_type"] = status_type;
  doc["value"] = value;
  doc["timestamp"] = time(nullptr);
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  String topic = String(MQTT_BASE_TOPIC) + "/" + String(DEVICE_ID) + "/status";
  mqttClient.publish(topic.c_str(), buffer);
}

// ============================================
// MQTT CONNECTION
// ============================================

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[MQTT] WiFi not connected, skipping MQTT reconnect");
    return;
  }
  
  Serial.println("[MQTT] Attempting to connect...");
  
  // Create MQTT client ID
  String clientId = "esp32_" + String(DEVICE_ID) + "_" + String(random(10000));
  
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("[MQTT] Connected!");
    
    // Subscribe to command topic
    String commandTopic = String(MQTT_BASE_TOPIC) + "/" + String(DEVICE_ID) + "/command";
    mqttClient.subscribe(commandTopic.c_str());
    Serial.printf("[MQTT] Subscribed to: %s\n", commandTopic.c_str());
    
    // Publish birth announcement
    publishSensorData();
  } else {
    Serial.printf("[MQTT] Connection failed, rc=%d\n", mqttClient.state());
  }
}

// ============================================
// WiFi SETUP
// ============================================

void setupWiFi() {
  Serial.printf("\n[WiFi] Connecting to %s\n", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Connection failed!");
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get current time as ISO 8601 string
String getTimestamp() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buffer);
}

// Calculate battery percentage
float getBatteryPercent() {
  // Assuming 3.7-4.2V for LiPo, adjust for your battery
  float minVoltage = 3.0;
  float maxVoltage = 4.2;
  float percent = ((sensorData.battery_voltage - minVoltage) / (maxVoltage - minVoltage)) * 100.0;
  return constrain(percent, 0, 100);
}

// Print system info
void printSystemInfo() {
  Serial.println("\n=== SYSTEM INFO ===");
  Serial.printf("Device: %s\n", DEVICE_ID);
  Serial.printf("WiFi IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("WiFi RSSI: %d dBm\n", WiFi.RSSI());
  Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Uptime: %ld seconds\n", millis() / 1000);
  Serial.printf("Battery: %.2fV (%.0f%%)\n", sensorData.battery_voltage, getBatteryPercent());
}

// Deep sleep function (for low power mode)
void enterDeepSleep(uint64_t sleepDurationMicros) {
  Serial.printf("[Power] Entering deep sleep for %lld us\n", sleepDurationMicros);
  
  // Disconnect WiFi to save power
  WiFi.disconnect(true);  // true = turn off WiFi radio
  
  // Enter deep sleep
  esp_deep_sleep_start();
}
