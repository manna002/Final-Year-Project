#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <DHT.h>

// ---------------------------------------------------------
// 1. WiFi & MQTT Configuration
// ---------------------------------------------------------
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* mqtt_server = "j972d3fd.ala.us-east-1.emqxsl.com";
const int   mqtt_port = 8883; // 8883 is for Secure MQTT (TLS/SSL)
const char* mqtt_user = "YOUR_MQTT_USERNAME"; 
const char* mqtt_pass = "YOUR_MQTT_PASSWORD"; 

const char* kit_id = "FUNAAB-KIT-001"; // Change this if uploading to KIT-002

// ---------------------------------------------------------
// 2. Hardware Pins
// ---------------------------------------------------------
#define DHTPIN 4
#define DHTTYPE DHT11
#define MOISTURE_PIN 34
#define PUMP_RELAY_PIN 26 // Controls the water pump (Tank)
#define FAN_RELAY_PIN 27  // Controls the cooling fan

DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient client(espClient);
Preferences preferences; // For non-volatile flash memory

// ---------------------------------------------------------
// 3. System Variables (Restored from Flash on boot)
// ---------------------------------------------------------
String currentMode = "MANUAL"; // MANUAL, AUTO, TIMER
int threshLow = 20;            // Turn pump ON if moisture drops below this
int threshHigh = 60;           // Turn pump OFF if moisture goes above this
int threshFan = 30;            // Turn fan ON if temp goes above this

bool pumpState = false;
bool fanState = false;

// ---------------------------------------------------------
// 4. Preferences / Flash Memory Helpers
// ---------------------------------------------------------
void loadSettings() {
  preferences.begin("funaab", false);
  currentMode = preferences.getString("mode", "MANUAL");
  threshLow = preferences.getInt("tLow", 20);
  threshHigh = preferences.getInt("tHigh", 60);
  threshFan = preferences.getInt("tFan", 30);
  preferences.end();
  Serial.println("Settings loaded from Flash Memory.");
}

void saveSettingString(const char* key, String value) {
  preferences.begin("funaab", false);
  preferences.putString(key, value);
  preferences.end();
}

void saveSettingInt(const char* key, int value) {
  preferences.begin("funaab", false);
  preferences.putInt(key, value);
  preferences.end();
}

// ---------------------------------------------------------
// 5. MQTT Callback (When dashboard sends a command)
// ---------------------------------------------------------
void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  String t = String(topic);
  Serial.println("Command received on " + t + ": " + msg);

  if (t.endsWith("/mode/state")) {
    currentMode = msg;
    saveSettingString("mode", currentMode);
  } 
  else if (t.endsWith("/threshold/low")) {
    threshLow = msg.toInt();
    saveSettingInt("tLow", threshLow);
  } 
  else if (t.endsWith("/threshold/high")) {
    threshHigh = msg.toInt();
    saveSettingInt("tHigh", threshHigh);
  }
  else if (t.endsWith("/threshold/fan")) {
    threshFan = msg.toInt();
    saveSettingInt("tFan", threshFan);
  }
  else if (t.endsWith("/tank/state") && currentMode == "MANUAL") {
    pumpState = (msg == "ON");
    digitalWrite(PUMP_RELAY_PIN, pumpState ? HIGH : LOW);
  }
  else if (t.endsWith("/fan/state") && currentMode == "MANUAL") {
    fanState = (msg == "ON");
    digitalWrite(FAN_RELAY_PIN, fanState ? HIGH : LOW);
  }
}

// ---------------------------------------------------------
// 6. Network Setup
// ---------------------------------------------------------
void setupWifi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  // Skip SSL verification for simplicity on ESP32 (or provide EMQX Root CA)
  espClient.setInsecure(); 
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("Connected to EMQX!");
      // Re-subscribe to all relevant topics
      String base = String(kitId) + "/";
      client.subscribe((base + "mode/state").c_str());
      client.subscribe((base + "threshold/low").c_str());
      client.subscribe((base + "threshold/high").c_str());
      client.subscribe((base + "threshold/fan").c_str());
      client.subscribe((base + "tank/state").c_str());
      client.subscribe((base + "fan/state").c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" trying again in 5 seconds...");
      
      // FAIL-SAFE AUTO PILOT:
      // If we cannot connect to MQTT, we pause for 5 seconds.
      // But instead of just waiting, we manually run the Auto logic!
      runOfflineAutoPilot(); 
      delay(5000);
    }
  }
}

// ---------------------------------------------------------
// 7. Core Logic Functions
// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);
  
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, LOW);
  digitalWrite(FAN_RELAY_PIN, LOW);
  
  dht.begin();
  loadSettings(); // Restore from power outage!

  setupWifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void runOfflineAutoPilot() {
  // Overrides MANUAL mode when network drops
  Serial.println("NETWORK OFFLINE: Engaging Auto-Pilot...");
  
  float t = dht.readTemperature();
  int rawMoisture = analogRead(MOISTURE_PIN);
  int moisturePercent = map(rawMoisture, 4095, 0, 0, 100);
  
  if (isnan(t)) return;

  // Auto-Pilot Fan Control
  if (t >= threshFan) {
    digitalWrite(FAN_RELAY_PIN, HIGH);
  } else {
    digitalWrite(FAN_RELAY_PIN, LOW);
  }

  // Auto-Pilot Pump Control
  if (moisturePercent <= threshLow) {
    digitalWrite(PUMP_RELAY_PIN, HIGH);
  } else if (moisturePercent >= threshHigh) {
    digitalWrite(PUMP_RELAY_PIN, LOW);
  }
}

void loop() {
  // If WiFi drops completely, engage offline auto-pilot
  if (WiFi.status() != WL_CONNECTED) {
    runOfflineAutoPilot();
    delay(5000);
    setupWifi();
    return;
  }

  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Every 5 seconds, read sensors and apply logic if in AUTO mode
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate > 5000) {
    lastUpdate = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int rawMoisture = analogRead(MOISTURE_PIN);
    int moist = map(rawMoisture, 4095, 0, 0, 100);
    moist = constrain(moist, 0, 100);

    // Publish data to Web App
    String base = String(kitId) + "/sensor/";
    client.publish((base + "temperature").c_str(), String(temp).c_str());
    client.publish((base + "humidity").c_str(), String(hum).c_str());
    client.publish((base + "moisture").c_str(), String(moist).c_str());

    // Apply AUTO logic if authorized by dashboard
    if (currentMode == "AUTO") {
      // Fan
      if (temp >= threshFan && !fanState) {
        fanState = true;
        digitalWrite(FAN_RELAY_PIN, HIGH);
        client.publish((String(kitId) + "/fan/state").c_str(), "ON");
      } else if (temp < threshFan && fanState) {
        fanState = false;
        digitalWrite(FAN_RELAY_PIN, LOW);
        client.publish((String(kitId) + "/fan/state").c_str(), "OFF");
      }

      // Pump
      if (moist <= threshLow && !pumpState) {
        pumpState = true;
        digitalWrite(PUMP_RELAY_PIN, HIGH);
        client.publish((String(kitId) + "/tank/state").c_str(), "ON");
      } else if (moist >= threshHigh && pumpState) {
        pumpState = false;
        digitalWrite(PUMP_RELAY_PIN, LOW);
        client.publish((String(kitId) + "/tank/state").c_str(), "OFF");
      }
    }
  }
}
