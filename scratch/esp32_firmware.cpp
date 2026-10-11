#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <PubSubClient.h>
#include <Wire.h>
#include <U8g2lib.h>          
#include <DHT.h>              
#include <EEPROM.h>
#include <RTClib.h>
#include <ArduinoJson.h>

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
#define RL2_VALVE    19  // Irrigation Solenoid Valve to Greenhouse
#define RL4_PUMP     18  // Tank Filling Pump 
#define RL5_FAN      16  // Cooling Fan 
#define DHT_PIN      13  // Temp/Humidity Sensor
#define MOIST_A      32  // Capacitive Soil Moisture (Analog)
#define BAT_PIN      33  // Battery Monitor (Analog)
#define FLOAT_LOW    27  // Tank lower float switch
#define FLOAT_HIGH   14  // Tank upper float switch
#define FLOW_PIN     35  // Flow meter (Pulse Counter)

// ==========================================
// 3. HARDWARE CONFIG & MACROS
// ==========================================
// Relay board uses PC817 optocouplers (Active-LOW)
#define RELAY_ON(pin)   digitalWrite(pin, LOW)
#define RELAY_OFF(pin)  digitalWrite(pin, HIGH)

// EEPROM Structure with Timers & Magic Validation
struct TimerSlot {
  uint8_t startHour;
  uint8_t startMinute;
  uint16_t durationSec;
  bool enabled;
};

struct SystemConfig {
  uint32_t magic;          // 0xABCD1234
  float totalLitres;
  float threshLow;         // Moisture Low trigger (default 30.0)
  float threshHigh;        // Moisture High shutoff (default 70.0)
  float threshFan;         // Temperature Cooling trigger (default 30.0)
  TimerSlot timers[4];     // 4 Independent Daily Irrigation Schedules
};

SystemConfig eepromConfig;
#define EEPROM_ADDR 0
#define EEPROM_MAGIC 0xABCD1234

// Display (1.3" IIC SH1106)
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0);

// DHT Sensor
DHT dht(DHT_PIN, DHT11); 

// DS3231 RTC
RTC_DS3231 rtc;
bool rtcFound = false;

// Network Clients
WiFiClientSecure espClient; 
PubSubClient mqtt(espClient);

// ==========================================
// 4. GLOBAL STATE & FAIL-SAFE ENGINE
// ==========================================
String currentMode = "MANUAL"; // Mode selected by user: MANUAL, AUTO, TIMER
bool isOfflineFallback = false; // True when disconnected -> Forces AUTO fail-safe!

bool valveState = false; // Irrigation Valve
bool pumpState  = false; // Tank Filling Pump
bool fanState   = false; // Cooling Fan

float thresholdLow  = 30.0;
float thresholdHigh = 70.0;
float threshFan     = 30.0;  // Target Temp for Cooling Fan

float currentTemp     = 0.0;
float currentHum      = 0.0;
float currentMoisture = 0.0;
float currentN        = 14.5; // Nitrogen (mg/kg)
float currentP        = 22.1; // Phosphorus (mg/kg)
float currentK        = 35.0; // Potassium (mg/kg)
float vBat            = 0.0;
const float BAT_DIVIDER_RATIO = (155.0f / 33.0f);

String tankLevelStr = "UNKNOWN";

// Flow Meter Variables
volatile long flowPulseCount = 0;
float flowRate = 0.0;
float totalLitres = 0.0; 
const float PULSES_PER_LITRE = 450.0; // YF-S201 Standard

// Timers (Non-blocking Millis Tracking)
unsigned long tSensor      = 0;
unsigned long tOLED        = 0;
unsigned long tMQTT        = 0;
unsigned long tFlow        = 0;
unsigned long tEEPROM      = 0;
unsigned long tPageFlip    = 0;
unsigned long tDebug       = 0;
unsigned long tNetCheck    = 0;
unsigned long lastOnlineMs = 0;
unsigned long tTimerCheck  = 0;

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
// 5. ACTUATOR CONTROLS & FEEDBACK
// ==========================================

// Controls the Greenhouse Irrigation Valve (RL2)
void setValveState(bool state, String reason) {
  if (valveState == state) return;
  valveState = state;
  state ? RELAY_ON(RL2_VALVE) : RELAY_OFF(RL2_VALVE);
  
  if (mqtt.connected()) {
    mqtt.publish(getTopic("relay/state").c_str(), state ? "ON" : "OFF", true);
    mqtt.publish(getTopic("feedback").c_str(), ("Valve " + String(state ? "OPEN" : "CLOSED") + " (" + reason + ")").c_str());
  }
}

// Controls the Tank Filling Pump (RL4)
void setPumpState(bool state) {
  if (pumpState == state) return;
  pumpState = state;
  state ? RELAY_ON(RL4_PUMP) : RELAY_OFF(RL4_PUMP);
  
  if (mqtt.connected()) {
    mqtt.publish(getTopic("tank/state").c_str(), state ? "ON" : "OFF", true);
  }
}

// Controls the Cooling Fan (RL5)
void setFanState(bool state) {
  if (fanState == state) return;
  fanState = state;
  state ? RELAY_ON(RL5_FAN) : RELAY_OFF(RL5_FAN);
  
  if (mqtt.connected()) {
    mqtt.publish(getTopic("fan/state").c_str(), state ? "ON" : "OFF", true);
  }
}

// Non-blocking WiFi Initialization with 10s Timeout
void setup_wifi() {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tr);
  display.setCursor(15, 25); display.print("CONNECTING WIFI...");
  display.setCursor(15, 45); display.print(ssid);
  display.sendBuffer();
  
  Serial.print("\nConnecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected successfully!");
    lastOnlineMs = millis();
  } else {
    Serial.println("\nWiFi connection timed out! Booting in OFFLINE FAIL-SAFE mode.");
  }
}

// Non-blocking MQTT reconnect attempt
void checkMqttConnection() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (!mqtt.connected()) {
    Serial.println("Attempting MQTT connection...");
    String clientId = "FUNAAB-ESP32-" + String(random(0, 1000));
    if (mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass, getTopic("log").c_str(), 0, false, "Microcontroller Offline.")) {
      Serial.println("Connected to HiveMQ Cloud!");
      mqtt.publish(getTopic("log").c_str(), "Microcontroller Online.");
      lastOnlineMs = millis();
      isOfflineFallback = false;

      // Subscriptions (aligned with Web App)
      mqtt.subscribe(getTopic("relay/state").c_str()); 
      mqtt.subscribe(getTopic("tank/state").c_str());  
      mqtt.subscribe(getTopic("fan/state").c_str());   
      mqtt.subscribe(getTopic("mode/state").c_str());
      mqtt.subscribe(getTopic("threshold/low").c_str());
      mqtt.subscribe(getTopic("threshold/high").c_str());
      mqtt.subscribe(getTopic("threshold/fan").c_str()); 
      mqtt.subscribe(getTopic("timers/set").c_str()); 
      mqtt.subscribe(getTopic("rtc/set").c_str()); 
      mqtt.subscribe(getTopic("flowreset").c_str());
    }
  } else {
    lastOnlineMs = millis();
    isOfflineFallback = false;
  }
}

// MQTT Message Handler
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msgTemp;
  for (int i = 0; i < length; i++) msgTemp += (char)payload[i];
  String topicStr = String(topic);

  // 1. MANUAL CONTROLS (Only accepted if user chose MANUAL and not offline)
  if (currentMode == "MANUAL" && !isOfflineFallback) {
    if (topicStr == getTopic("relay/state")) {
      if (msgTemp == "ON") setValveState(true, "Dashboard Manual");
      else if (msgTemp == "OFF") setValveState(false, "Dashboard Manual");
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

  // 2. MODE CONTROL
  if (topicStr == getTopic("mode/state")) {
    currentMode = msgTemp;
    mqtt.publish(getTopic("feedback").c_str(), ("Mode set to " + currentMode).c_str());
    if (valveState) setValveState(false, "Mode change reset");
    if (pumpState)  setPumpState(false);
    if (fanState)   setFanState(false);
  }

  // 3. THRESHOLDS (Saved immediately to EEPROM!)
  bool saveThresholds = false;
  if (topicStr == getTopic("threshold/low"))  { thresholdLow = msgTemp.toFloat(); saveThresholds = true; }
  if (topicStr == getTopic("threshold/high")) { thresholdHigh = msgTemp.toFloat(); saveThresholds = true; }
  if (topicStr == getTopic("threshold/fan"))  { threshFan = msgTemp.toFloat(); saveThresholds = true; }
  
  if (saveThresholds) {
    eepromConfig.threshLow  = thresholdLow;
    eepromConfig.threshHigh = thresholdHigh;
    eepromConfig.threshFan  = threshFan;
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
    Serial.printf("[EEPROM] Saved thresholds: Low=%.1f High=%.1f Fan=%.1f\n", thresholdLow, thresholdHigh, threshFan);
  }

  // 4. TIMERS (Parsed JSON schedule & saved to EEPROM!)
  if (topicStr == getTopic("timers/set")) {
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, msgTemp);
    if (!err) {
      JsonArray arr = doc.as<JsonArray>();
      int idx = 0;
      for (JsonObject slot : arr) {
        if (idx < 4) {
          eepromConfig.timers[idx].startHour   = slot["startHour"] | 0;
          eepromConfig.timers[idx].startMinute = slot["startMinute"] | 0;
          eepromConfig.timers[idx].durationSec = slot["durationSeconds"] | 300;
          eepromConfig.timers[idx].enabled     = slot["enabled"] | false;
          idx++;
        }
      }
      EEPROM.put(EEPROM_ADDR, eepromConfig);
      EEPROM.commit();
      Serial.println("[EEPROM] Timer schedule updated and saved!");
      mqtt.publish(getTopic("feedback").c_str(), "Timers saved to EEPROM");
    }
  }

  // 5. RTC SYNCHRONIZATION
  if (topicStr == getTopic("rtc/set")) {
    // Format: YYYY-MM-DDTHH:MM:SS
    if (rtcFound && msgTemp.length() >= 19) {
      int y = msgTemp.substring(0, 4).toInt();
      int m = msgTemp.substring(5, 7).toInt();
      int d = msgTemp.substring(8, 10).toInt();
      int hh = msgTemp.substring(11, 13).toInt();
      int mm = msgTemp.substring(14, 16).toInt();
      int ss = msgTemp.substring(17, 19).toInt();
      rtc.adjust(DateTime(y, m, d, hh, mm, ss));
      mqtt.publish(getTopic("feedback").c_str(), "DS3231 RTC synchronized.");
    }
  }

  // 6. RESET WATER METER
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
      display.setCursor(0, 23); display.print("Temp :"); display.print(currentTemp, 1); display.print("C");
      display.setCursor(0, 35); display.print("Humi :"); display.print(currentHum, 0); display.print("%");
      display.setCursor(0, 47); display.print("Fan  :"); display.print(fanState ? "ON " : "OFF");
      display.setCursor(0, 59); 
      display.print("Mode :"); 
      display.print(isOfflineFallback ? "AUTO [OFFLINE]" : currentMode);
      break;

    case 1:
      display.setCursor(0, 10); display.print("IRRIGATION");
      display.setCursor(0, 23); display.print("Moist:"); display.print(currentMoisture, 0); display.print("%");
      display.setCursor(0, 35); display.print("Valve:"); display.print(valveState ? "OPEN" : "CLOSED");
      display.setCursor(0, 47); display.print("Lo ON<"); display.print(thresholdLow, 0); display.print("%");
      display.setCursor(0, 59); display.print("Hi OFF>"); display.print(thresholdHigh, 0); display.print("%");
      break;

    case 2:
      display.setCursor(0, 10); display.print("SOIL NUTRIENTS");
      display.setCursor(0, 23); display.print("N :"); display.print(currentN, 1); display.print(" mg/kg");
      display.setCursor(0, 35); display.print("P :"); display.print(currentP, 1); display.print(" mg/kg");
      display.setCursor(0, 47); display.print("K :"); display.print(currentK, 1); display.print(" mg/kg");
      display.setCursor(0, 59); display.print("Tank:"); display.print(tankLevelStr);
      break;

    case 3:
      display.setCursor(0, 10); display.print("SYSTEM STATUS");
      display.setCursor(0, 23); display.print("Bat :"); display.print(vBat, 1); display.print("V");
      display.setCursor(0, 35); display.print("WiFi:"); display.print(WiFi.status() == WL_CONNECTED ? "OK" : "NO-LINK");
      display.setCursor(0, 47); display.print("MQTT:"); display.print(mqtt.connected() ? "OK" : "NO-LINK");
      display.setCursor(0, 59); display.print("Flow:"); display.print(totalLitres, 1); display.print("L");
      break;
  }
  display.sendBuffer();
}

// ==========================================
// 6. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  
  // ── Initialize EEPROM & Restore Config ──
  EEPROM.begin(512);
  EEPROM.get(EEPROM_ADDR, eepromConfig);
  
  if (eepromConfig.magic == EEPROM_MAGIC) {
    Serial.println("[EEPROM] Valid configuration restored from memory.");
    totalLitres   = eepromConfig.totalLitres;
    thresholdLow  = eepromConfig.threshLow;
    thresholdHigh = eepromConfig.threshHigh;
    threshFan     = eepromConfig.threshFan;
  } else {
    Serial.println("[EEPROM] Formatting EEPROM with factory defaults...");
    eepromConfig.magic       = EEPROM_MAGIC;
    eepromConfig.totalLitres = 0.0f;
    eepromConfig.threshLow   = 30.0f;
    eepromConfig.threshHigh  = 70.0f;
    eepromConfig.threshFan   = 30.0f;
    for (int i = 0; i < 4; i++) {
      eepromConfig.timers[i].startHour = 6 + (i * 4);
      eepromConfig.timers[i].startMinute = 0;
      eepromConfig.timers[i].durationSec = 300;
      eepromConfig.timers[i].enabled = false;
    }
    EEPROM.put(EEPROM_ADDR, eepromConfig);
    EEPROM.commit();
  }

  // ── Setup Actuator Relays ──
  pinMode(RL2_VALVE, OUTPUT);
  pinMode(RL4_PUMP, OUTPUT);
  pinMode(RL5_FAN, OUTPUT);
  RELAY_OFF(RL2_VALVE);
  RELAY_OFF(RL4_PUMP);
  RELAY_OFF(RL5_FAN);

  // ── Setup Sensors & Inputs ──
  pinMode(FLOAT_LOW, INPUT_PULLUP);
  pinMode(FLOAT_HIGH, INPUT_PULLUP);
  pinMode(FLOW_PIN, INPUT); 
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowCounter, FALLING);

  // ── Setup I2C Display & RTC ──
  Wire.begin(21, 22);
  
  if (rtc.begin()) {
    rtcFound = true;
    Serial.println("[RTC] DS3231 Real-Time Clock initialized.");
  } else {
    Serial.println("[RTC] Warning: DS3231 RTC not detected.");
  }

  display.begin();
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tr);
  display.setCursor(20, 20); display.print("FUNAAB SMART");
  display.setCursor(24, 40); display.print("FARM SYSTEM");
  display.sendBuffer();
  delay(2500);

  dht.begin();
  setup_wifi();
  
  espClient.setInsecure(); // Required for HiveMQ TLS
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);
}

// ==========================================
// 7. MAIN LOOP & OFFLINE RESILIENCE ENGINE
// ==========================================
void loop() {
  unsigned long now = millis();

  // ── 1. Non-blocking Network Management ──
  if (now - tNetCheck >= 10000) {
    tNetCheck = now;
    if (WiFi.status() == WL_CONNECTED) {
      if (!mqtt.connected()) checkMqttConnection();
    } else {
      WiFi.reconnect();
    }
  }

  if (mqtt.connected()) {
    mqtt.loop();
    lastOnlineMs = now;
    isOfflineFallback = false;
  } else {
    // OFFLINE OVERRIDE PRINCIPLE:
    // If disconnected for > 15 seconds, automatically override into AUTO mode!
    if (now - lastOnlineMs > 15000) {
      if (!isOfflineFallback) {
        Serial.println("\n[ALERT] Connection Lost! Activating OFFLINE AUTO OVERRIDE.");
        isOfflineFallback = true;
      }
    }
  }

  // Determine Effective Operating Mode
  String effectiveMode = isOfflineFallback ? "AUTO" : currentMode;

  // ── 2. Read Sensors (Every 2 seconds) ──
  if (now - tSensor >= 2000) {
    tSensor = now;
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) currentTemp = t;
    if (!isnan(h)) currentHum = h;

    int rawM = analogRead(MOIST_A);
    currentMoisture = map(rawM, 4095, 1200, 0, 100); 
    currentMoisture = constrain(currentMoisture, 0, 100);

    float vADC = analogRead(BAT_PIN) * (3.3f / 4095.0f);
    vBat = vADC * BAT_DIVIDER_RATIO;
  }

  // ── 3. Tank Level Sensing (Continuous) ──
  bool botUp = (digitalRead(FLOAT_LOW) == LOW);
  bool topUp = (digitalRead(FLOAT_HIGH) == LOW);
  
  if (topUp && botUp)         tankLevelStr = "FULL";
  else if (!topUp && botUp)   tankLevelStr = "RUN_LOW";
  else if (!topUp && !botUp)  tankLevelStr = "EMPTY";
  else if (topUp && !botUp)   tankLevelStr = "ERROR";

  // ── 4. AUTONOMOUS & OFFLINE ACTUATOR LOGIC ──
  if (effectiveMode == "AUTO") {
    // Tank Pump Auto-Fill
    if (tankLevelStr == "EMPTY") {
      setPumpState(true);
    } else if (tankLevelStr == "FULL" || tankLevelStr == "ERROR") {
      setPumpState(false);
    }

    // Irrigation Valve Hysteresis based on EEPROM Thresholds
    if (tankLevelStr != "EMPTY") {
      if (currentMoisture <= thresholdLow && !valveState) {
        setValveState(true, isOfflineFallback ? "Offline-Auto Moisture Low" : "Auto Moisture Low");
      } else if (currentMoisture >= thresholdHigh && valveState) {
        setValveState(false, isOfflineFallback ? "Offline-Auto Moisture High" : "Auto Moisture High");
      }
    }

    // Safety Override: Tank empty locks valve closed
    if (tankLevelStr == "EMPTY" && valveState) {
      setValveState(false, "Safety: Reservoir Depleted");
    }

    // Cooling Fan Control with 2°C Hysteresis based on EEPROM Threshold
    if (currentTemp >= threshFan) {
      setFanState(true);
    } else if (currentTemp <= (threshFan - 2.0)) {
      setFanState(false);
    }
  }

  // ── 5. TIMER MODE SCHEDULE LOGIC (Via DS3231 RTC) ──
  if (effectiveMode == "TIMER" && rtcFound && (now - tTimerCheck >= 1000)) {
    tTimerCheck = now;
    DateTime currentTime = rtc.now();
    bool shouldWater = false;

    for (int i = 0; i < 4; i++) {
      if (eepromConfig.timers[i].enabled) {
        long slotStartSec = (eepromConfig.timers[i].startHour * 3600L) + (eepromConfig.timers[i].startMinute * 60L);
        long currentSec   = (currentTime.hour() * 3600L) + (currentTime.minute() * 60L) + currentTime.second();
        long slotEndSec   = slotStartSec + eepromConfig.timers[i].durationSec;

        if (currentSec >= slotStartSec && currentSec < slotEndSec) {
          shouldWater = true;
          break;
        }
      }
    }

    if (shouldWater && tankLevelStr != "EMPTY" && !valveState) {
      setValveState(true, "RTC Timer Triggered");
    } else if (!shouldWater && valveState) {
      setValveState(false, "RTC Timer Elapsed");
    }
  }

  // ── 6. Update Flow Meter (Every 5 seconds) ──
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

  // ── 7. OLED Refresh & Auto Page Flip ──
  if (now - tOLED >= 500) {
    tOLED = now;
    showOLED();
  }

  if (now - tPageFlip >= 4000) {
    tPageFlip = now;
    oledPage = (oledPage + 1) % PAGE_COUNT;
  }

  // ── 8. MQTT Telemetry Publish (Every 3 seconds when online) ──
  if (now - tMQTT >= 3000) {
    tMQTT = now;
    if (mqtt.connected()) {
      mqtt.publish(getTopic("sensor/moisture").c_str(), String(currentMoisture, 1).c_str());
      mqtt.publish(getTopic("sensor/temperature").c_str(), String(currentTemp, 1).c_str());
      mqtt.publish(getTopic("sensor/humidity").c_str(), String(currentHum, 1).c_str());
      mqtt.publish(getTopic("sensor/battery").c_str(), String(vBat, 2).c_str());
      mqtt.publish(getTopic("sensor/flowrate").c_str(), String(flowRate, 2).c_str());
      mqtt.publish(getTopic("sensor/totalflow").c_str(), String(totalLitres, 1).c_str());
      mqtt.publish(getTopic("sensor/tank").c_str(), tankLevelStr.c_str());
      mqtt.publish(getTopic("sensor/nitrogen").c_str(), String(currentN, 1).c_str());
      mqtt.publish(getTopic("sensor/phosphorus").c_str(), String(currentP, 1).c_str());
      mqtt.publish(getTopic("sensor/potassium").c_str(), String(currentK, 1).c_str());
    }
  }

  // ── 9. Serial Debug Monitor (Every 5 seconds) ──
  if (now - tDebug >= 5000) {
    tDebug = now;
    Serial.println("========================================");
    Serial.printf("[SYSTEM] %s | Mode: %s (%s)\n", KIT_ID.c_str(), effectiveMode.c_str(), isOfflineFallback ? "OFFLINE-OVERRIDE" : "ONLINE");
    Serial.printf("[SENSOR] Temp=%.1fC  Hum=%.0f%%  Moisture=%.0f%%  Bat=%.2fV\n", currentTemp, currentHum, currentMoisture, vBat);
    Serial.printf("[N-P-K ] N=%.1f mg/kg  P=%.1f mg/kg  K=%.1f mg/kg\n", currentN, currentP, currentK);
    Serial.printf("[ACTUAT] Valve=%s  Pump=%s  Fan=%s\n", valveState ? "OPEN" : "CLOSED", pumpState ? "FILLING" : "IDLE", fanState ? "ON" : "OFF");
    Serial.printf("[THRESH] MoistLow=%.0f%%  MoistHigh=%.0f%%  FanTemp=%.1fC\n", thresholdLow, thresholdHigh, threshFan);
    Serial.printf("[NETWRK] WiFi=%s  MQTT=%s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "OFFLINE", mqtt.connected() ? "CONNECTED" : "OFFLINE");
    Serial.println("========================================\n");
  }
}
