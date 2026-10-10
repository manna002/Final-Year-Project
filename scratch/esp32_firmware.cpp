#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <PubSubClient.h>
#include <Wire.h>
#include <U8g2lib.h>          
#include <DHT.h>              
#include <EEPROM.h>

// ==========================================
// 1. KIT CONFIGURATION
// ==========================================
// MUST MATCH DASHBOARD DATABASE EXACTLY
const String KIT_ID = "FUNAAB-KIT-001"; 

const char* ssid = "REVOSMART XE";
const char* password = "REVOSMART.";

// HiveMQ Cloud Credentials
const char* mqtt_server = "38e05df215734611956c17df00ca7e24.s1.eu.hivemq.cloud";
const int mqtt_port = 8883; 
const char* mqtt_user = "REVOSMART_ADMIN"; 
const char* mqtt_pass = "REVOSMARTADMIN.";

// ==========================================
// 2. HARDWARE PINS (PCB Definition)
// ==========================================
#define RL2_VALVE    19  // Irrigation Valve to Greenhouse
#define RL4_PUMP     18  // Tank Filling Pump 
#define RL5_FAN      16  // Cooling Fan 
#define DHT_PIN      13  // Temp/Humidity
#define MOIST_A      32  // Soil Moisture
#define BAT_PIN      33  // Battery Monitor
#define FLOAT_LOW    27  // Tank lower float switch
#define FLOAT_HIGH   14  // Tank upper float switch
#define FLOW_PIN     35  // Flow meter (needs external 10k pull-up)

// ==========================================
// 3. HARDWARE CONFIG & MACROS
// ==========================================
// Relay board uses PC817 optocouplers (Active-LOW)
#define RELAY_ON(pin)   digitalWrite(pin, LOW)
#define RELAY_OFF(pin)  digitalWrite(pin, HIGH)

// EEPROM Structure
struct SystemConfig {
  float totalLitres;
  float threshLow;
  float threshHigh;
  float threshFan; // Replaced 4 fan thresholds with a single target threshold to match React Dashboard
};
SystemConfig eepromConfig;
#define EEPROM_ADDR 0

// Display (1.3" IIC SH1106)
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0);

// DHT
DHT dht(DHT_PIN, DHT11); 

WiFiClientSecure espClient; 
PubSubClient mqtt(espClient);

// ==========================================
// 4. GLOBAL STATE
// ==========================================
String currentMode = "MANUAL";
bool valveState = false; // Irrigation Valve
bool pumpState  = false; // Tank Filling Pump
bool fanState   = false; // Cooling Fan

float thresholdLow = 30.0;
float thresholdHigh = 70.0;
float threshFan = 30.0;  // Target Temp for Fan

float currentTemp = 0.0;
float currentHum  = 0.0;
float currentMoisture = 0.0;
float currentN = 14.5;
float currentP = 22.1;
float currentK = 35.0;
float vBat = 0.0;
const float BAT_DIVIDER_RATIO = (155.0f / 33.0f);

String tankLevelStr = "UNKNOWN";

// Flow Meter
volatile long flowPulseCount = 0;
float flowRate = 0.0;
float totalLitres = 0.0; 
const float PULSES_PER_LITRE = 450.0; // YF-S201 Standard

// Timers (Non-blocking)
unsigned long tSensor = 0;
unsigned long tOLED   = 0;
unsigned long tMQTT   = 0;
unsigned long tFlow   = 0;
unsigned long tEEPROM = 0;
unsigned long tPageFlip = 0;
unsigned long tDebug  = 0;

uint8_t oledPage = 0;
#define PAGE_COUNT 4

// Flow Meter Interrupt
void IRAM_ATTR flowCounter() {
  flowPulseCount++;
}

String getTopic(String path) {
  return KIT_ID + "/" + path;
}

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================

// Controls the Greenhouse Irrigation Valve (RL2)
void setValveState(bool state, String reason) {
  if (valveState == state) return;
  valveState = state;
  state ? RELAY_ON(RL2_VALVE) : RELAY_OFF(RL2_VALVE);
  
  if (mqtt.connected()) {
    mqtt.publish(getTopic("relay/state").c_str(), state ? "ON" : "OFF", true);
    mqtt.publish(getTopic("feedback").c_str(), ("Valve turned " + String(state ? "ON" : "OFF") + " (" + reason + ")").c_str());
  }
}

// Controls the Tank Filling Pump (RL4)
void setPumpState(bool state) {
  if (pumpState == state) return;
  pumpState = state;
  state ? RELAY_ON(RL4_PUMP) : RELAY_OFF(RL4_PUMP);
  
  if (mqtt.connected()) {
    // Aligned to React Dashboard topic "tank/state"
    mqtt.publish(getTopic("tank/state").c_str(), state ? "ON" : "OFF", true);
  }
}

// Controls the Cooling Fan (RL5)
void setFanState(bool state) {
  if (fanState == state) return;
  fanState = state;
  state ? RELAY_ON(RL5_FAN) : RELAY_OFF(RL5_FAN);
  
  if (mqtt.connected()) {
    // Aligned to React Dashboard topic "fan/state"
    mqtt.publish(getTopic("fan/state").c_str(), state ? "ON" : "OFF", true);
  }
}

void setup_wifi() {
  display.clearBuffer();
  display.setFont(u8g2_font_ncenB10_tr);
  display.drawStr(5, 32, "Connecting WiFi");
  display.sendBuffer();
  
  Serial.print("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
}

void mqttReconnect() {
  if (!mqtt.connected()) {
    String clientId = "FUNAAB-ESP32-" + String(random(0, 1000));
    if (mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass, getTopic("log").c_str(), 0, false, "Microcontroller Offline.")) {
      mqtt.publish(getTopic("log").c_str(), "Microcontroller Online and Connected.");
      
      // Subscribe to React Dashboard commands (Aligned Topics)
      mqtt.subscribe(getTopic("relay/state").c_str()); 
      mqtt.subscribe(getTopic("tank/state").c_str());  
      mqtt.subscribe(getTopic("fan/state").c_str());   
      mqtt.subscribe(getTopic("mode/state").c_str());
      mqtt.subscribe(getTopic("threshold/low").c_str());
      mqtt.subscribe(getTopic("threshold/high").c_str());
      mqtt.subscribe(getTopic("threshold/fan").c_str()); 
      mqtt.subscribe(getTopic("flowreset").c_str());
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msgTemp;
  for (int i = 0; i < length; i++) msgTemp += (char)payload[i];
  String topicStr = String(topic);

  // MANUAL RELAY CONTROLS (Dashboard Manual Override)
  if (currentMode == "MANUAL") {
    if (topicStr == getTopic("relay/state")) {
      if (msgTemp == "ON") setValveState(true, "Manual Command");
      else if (msgTemp == "OFF") setValveState(false, "Manual Command");
    }
    else if (topicStr == getTopic("tank/state")) {
      if (msgTemp == "ON") setPumpState(true);
      else if (msgTemp == "OFF") setPumpState(false);
    }
    else if (topicStr == getTopic("fan/state")) {
      if (msgTemp == "ON") setFanState(true);
      else if (msgTemp == "OFF") setFanState(false);
    }
  }

  // MODE CONTROL
  if (topicStr == getTopic("mode/state")) {
    currentMode = msgTemp;
    mqtt.publish(getTopic("feedback").c_str(), ("Mode switched to " + currentMode).c_str());
    // Safety: Turn off all actuators on mode change to give a clean slate
    if (valveState) setValveState(false, "Mode change reset");
    if (pumpState)  setPumpState(false);
    if (fanState)   setFanState(false);
  }

  // THRESHOLDS
  bool saveThresholds = false;
  if (topicStr == getTopic("threshold/low"))  { thresholdLow = msgTemp.toFloat(); saveThresholds = true; }
  if (topicStr == getTopic("threshold/high")) { thresholdHigh = msgTemp.toFloat(); saveThresholds = true; }
  if (topicStr == getTopic("threshold/fan"))  { threshFan = msgTemp.toFloat(); saveThresholds = true; }
  
  if (saveThresholds) {
    eepromConfig.threshLow = thresholdLow;
    eepromConfig.threshHigh = thresholdHigh;
    eepromConfig.threshFan = threshFan;
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
  }
  
  // RESET WATER METER
  if (topicStr == getTopic("flowreset")) {
    totalLitres = 0.0;
    eepromConfig.totalLitres = 0.0;
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
    mqtt.publish(getTopic("feedback").c_str(), "Water flow meter reset to 0L");
  }
}

// Updates the 4-page OLED screen
void showOLED() {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tr);

  for (uint8_t i = 0; i < PAGE_COUNT; i++) {
    uint8_t x = 105 + i * 6;
    if (i == oledPage) display.drawBox(x, 1, 4, 4);
    else               display.drawFrame(x, 1, 4, 4);
  }

  switch (oledPage) {
    case 0:
      display.setCursor(0, 10); display.print("ENVIRONMENT");
      display.setCursor(0, 23); display.print("Temp:"); display.print(currentTemp, 1); display.print("C");
      display.setCursor(0, 35); display.print("Humi:"); display.print(currentHum, 0); display.print("%");
      display.setCursor(0, 47); display.print("Fan :"); display.print(fanState ? "ON " : "OFF");
      display.setCursor(0, 59); display.print("Mode:"); display.print(currentMode);
      break;
    case 1:
      display.setCursor(0, 10); display.print("IRRIGATION");
      display.setCursor(0, 23); display.print("Moist:"); display.print(currentMoisture, 0); display.print("%");
      display.setCursor(0, 35); display.print("Valve:"); display.print(valveState ? "OPEN" : "CLOSED");
      display.setCursor(0, 47); display.print("Auto ON  < "); display.print(thresholdLow, 0); display.print("%");
      display.setCursor(0, 59); display.print("Auto OFF > "); display.print(thresholdHigh, 0); display.print("%");
      break;
    case 2:
      display.setCursor(0, 10); display.print("WATER TANK");
      display.setCursor(0, 23); display.print("Lvl :"); display.print(tankLevelStr);
      display.setCursor(0, 35); display.print("Pump:"); display.print(pumpState ? "FILLING" : "IDLE");
      display.setCursor(0, 47); display.print("Flow:"); display.print(flowRate, 1); display.print(" L/m");
      display.setCursor(0, 59); display.print("Tot :"); display.print(totalLitres, 1); display.print(" L");
      break;
    case 3:
      display.setCursor(0, 10); display.print("SYSTEM");
      display.setCursor(0, 23); display.print("Bat :"); display.print(vBat, 1); display.print("V");
      display.setCursor(0, 35); display.print("WiFi:"); display.print(WiFi.status() == WL_CONNECTED ? "OK" : "FAIL");
      display.setCursor(0, 47); display.print("MQTT:"); display.print(mqtt.connected() ? "OK" : "FAIL");
      break;
  }
  display.sendBuffer();
}

// ==========================================
// 6. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  
  EEPROM.begin(64);
  EEPROM.get(EEPROM_ADDR, eepromConfig);
  
  if (!isnan(eepromConfig.totalLitres) && eepromConfig.totalLitres >= 0.0f) totalLitres = eepromConfig.totalLitres;
  else eepromConfig.totalLitres = 0.0f;

  if (eepromConfig.threshLow > 0) {
    thresholdLow = eepromConfig.threshLow;
    thresholdHigh = eepromConfig.threshHigh;
    threshFan = eepromConfig.threshFan;
  } else {
    eepromConfig.threshLow = thresholdLow;
    eepromConfig.threshHigh = thresholdHigh;
    eepromConfig.threshFan = threshFan;
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
  }

  pinMode(RL2_VALVE, OUTPUT);
  pinMode(RL4_PUMP, OUTPUT);
  pinMode(RL5_FAN, OUTPUT);
  RELAY_OFF(RL2_VALVE);
  RELAY_OFF(RL4_PUMP);
  RELAY_OFF(RL5_FAN);

  pinMode(FLOAT_LOW, INPUT_PULLUP);
  pinMode(FLOAT_HIGH, INPUT_PULLUP);
  pinMode(FLOW_PIN, INPUT); 
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowCounter, FALLING);

  Wire.begin(21, 22);
  display.begin();
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tr);
  display.setCursor(28, 20); display.print("FUNAAB SMART");
  display.setCursor(22, 35); display.print("IRRIGATION AND");
  display.setCursor(13, 50); display.print("MONITORING SYSTEM");
  display.sendBuffer();
  delay(3000);

  dht.begin();
  setup_wifi();
  
  espClient.setInsecure(); // Required for HiveMQ TLS
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);
}

// ==========================================
// 7. LOOP
// ==========================================
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) mqttReconnect();
    mqtt.loop();
  }

  unsigned long now = millis();

  // ── 1. Read Sensors (Every 2 seconds) ──
  if (now - tSensor >= 2000) {
    tSensor = now;
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) currentTemp = t;
    if (!isnan(h)) currentHum = h;

    int rawM = analogRead(MOIST_A);
    // currentMoisture = map(rawM, 3200, 1200, 0, 100);  // Example calibration
    // For now, map generic ESP32 ADC:
    currentMoisture = map(rawM, 4095, 1200, 0, 100); 
    currentMoisture = constrain(currentMoisture, 0, 100);

    float vADC = analogRead(BAT_PIN) * (3.3f / 4095.0f);
    vBat = vADC * BAT_DIVIDER_RATIO;
  }

  // ── 2. Tank Filling Logic (Continuous) ──
  bool botUp = (digitalRead(FLOAT_LOW) == LOW);
  bool topUp = (digitalRead(FLOAT_HIGH) == LOW);
  
  if (topUp && botUp) {
    tankLevelStr = "FULL";
  } else if (!topUp && botUp) {
    tankLevelStr = "RUN_LOW";
  } else if (!topUp && !botUp) {
    tankLevelStr = "EMPTY";
  } else if (topUp && !botUp) {
    tankLevelStr = "ERROR";
  }

  // ── 3. SENSOR-DRIVEN ACTUATOR LOGIC (AUTO MODE) ──
  if (currentMode == "AUTO") {
    // Tank Pump
    if (tankLevelStr == "EMPTY") {
      setPumpState(true);
    } else if (tankLevelStr == "FULL" || tankLevelStr == "ERROR") {
      setPumpState(false);
    }

    // Irrigation Valve 
    if (tankLevelStr != "EMPTY") {
      if (currentMoisture <= thresholdLow && !valveState) {
        setValveState(true, "Auto Moisture Low");
      } else if (currentMoisture >= thresholdHigh && valveState) {
        setValveState(false, "Auto Moisture High");
      }
    }

    // Safety: Shut valve if tank goes empty
    if (tankLevelStr == "EMPTY" && valveState) {
      setValveState(false, "Safety: Tank Empty");
    }

    // Cooling Fan (Hysteresis built-in)
    if (currentTemp >= threshFan) setFanState(true);
    else if (currentTemp <= threshFan - 2.0) setFanState(false);
  }

  // ── 4. Update Flow Meter (Every 5 seconds) ──
  if (now - tFlow >= 5000) {
    tFlow = now;
    
    noInterrupts();
    long pulses = flowPulseCount;
    flowPulseCount = 0;
    interrupts();
    
    float freq = (float)pulses / 5.0;          
    flowRate = freq / 7.5;                     
    float addedLitres = (flowRate / 60.0) * 5.0;
    
    if (addedLitres > 0) {
      totalLitres += addedLitres;
      eepromConfig.totalLitres = totalLitres;
      EEPROM.put(EEPROM_ADDR, eepromConfig);
      EEPROM.commit();
    }
  }

  // ── 5. Save EEPROM (Every 60 seconds) ──
  if (now - tEEPROM >= 60000) {
    tEEPROM = now;
    eepromConfig.totalLitres = totalLitres;
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
  }

  // ── 6. OLED Refresh (Every 500ms) ──
  if (now - tOLED >= 500) {
    tOLED = now;
    showOLED();
  }

  // ── 7. OLED Page Flip (Every 4s) ──
  if (now - tPageFlip >= 4000) {
    tPageFlip = now;
    oledPage = (oledPage + 1) % PAGE_COUNT;
  }

  // ── 8. MQTT Publish (Every 3 seconds) ──
  if (now - tMQTT >= 3000) {
    tMQTT = now;
    if (mqtt.connected()) {
      mqtt.publish(getTopic("sensor/moisture").c_str(), String(currentMoisture).c_str());
      mqtt.publish(getTopic("sensor/temperature").c_str(), String(currentTemp).c_str());
      mqtt.publish(getTopic("sensor/humidity").c_str(), String(currentHum).c_str());
      mqtt.publish(getTopic("sensor/battery").c_str(), String(vBat).c_str());
      mqtt.publish(getTopic("sensor/flowrate").c_str(), String(flowRate).c_str());
      mqtt.publish(getTopic("sensor/totalflow").c_str(), String(totalLitres).c_str());
      mqtt.publish(getTopic("sensor/tank").c_str(), tankLevelStr.c_str());
      mqtt.publish(getTopic("sensor/nitrogen").c_str(), String(currentN).c_str());
      mqtt.publish(getTopic("sensor/phosphorus").c_str(), String(currentP).c_str());
      mqtt.publish(getTopic("sensor/potassium").c_str(), String(currentK).c_str());
    }
  }

  // ── 9. Serial Debug Monitor (Every 5 seconds) ──
  if (now - tDebug >= 5000) {
    tDebug = now;
    Serial.println("========================================");
    Serial.printf("[SENSOR] Temp=%.1fC  Hum=%.0f%%  Moisture=%.0f%%  Bat=%.2fV\n", currentTemp, currentHum, currentMoisture, vBat);
    Serial.printf("[OUTPUT] Valve=%s  Pump=%s  Fan=%s  Mode=%s\n", valveState ? "OPEN" : "CLOSED", pumpState ? "FILLING" : "IDLE", fanState ? "ON" : "OFF", currentMode.c_str());
    Serial.printf("[TANK]   Level=%s  FloatHigh=%s  FloatLow=%s\n", tankLevelStr.c_str(), digitalRead(FLOAT_HIGH) == LOW ? "UP" : "DOWN", digitalRead(FLOAT_LOW) == LOW ? "UP" : "DOWN");
    Serial.printf("[FLOW]   Rate=%.2f L/min  Total=%.2f L\n", flowRate, totalLitres);
    Serial.printf("[MQTT]   WiFi=%s  MQTT=%s\n", WiFi.status() == WL_CONNECTED ? "OK" : "FAIL", mqtt.connected() ? "OK" : "FAIL");
    Serial.println("========================================\n");
  }
}
