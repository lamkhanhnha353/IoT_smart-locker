#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Keypad.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include "DHT.h"
#include <WiFiClientSecure.h>

// Include your secret credentials here (WiFi SSID & Pass)
#include "secrets.h"

// ==========================================
// const char *serverName = "https://iot-smart-locker.onrender.com/api/locker/test"; // [1. RENDER CLOUD DEPLOYMENT]
const char *serverName = "http://192.168.1.25:5000/api/locker/test"; // [2. LOCAL TESTING]
// ==========================================

// --- MQTT BROKER CONFIGURATION ---
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char *mqtt_topic_control = "myCTU/locker/control";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- HARDWARE CONFIGURATION ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define BUZZER_PIN 18
#define SERVO_PIN 19
Servo lockServo;

// --- SENSOR CONFIGURATION ---
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define IR_PIN 5

// --- STATE VARIABLES ---
unsigned long lastSensorUpdate = 0;
float currentTemp = 0.0;
float currentHum = 0.0;
bool isLockerFull = false;

// ADJUST TEMPERATURE THRESHOLD FOR TESTING
float TEMP_THRESHOLD = 33.9;

// --- KEYPAD CONFIGURATION ---
const byte ROWS = 4;
const byte COLS = 4;
char hexaKeys[ROWS][COLS] = {
    {'1', '2', '3', 'A'},
    {'4', '5', '6', 'B'},
    {'7', '8', '9', 'C'},
    {'*', '0', '#', 'D'}};
byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33, 32};
Keypad customKeypad = Keypad(makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS);

enum LockerState
{
  LOCKED,
  INPUTTING_PIN
};
LockerState currentState = LOCKED;
String masterPIN = "123456";
String enteredPIN = "";

// --- AUDIO FUNCTIONS ---
void customTone(int pin, int frequency, int duration)
{
  if (frequency == 0)
    return;
  long delayValue = 1000000 / frequency / 2;
  long numCycles = frequency * duration / 1000;
  for (long i = 0; i < numCycles; i++)
  {
    digitalWrite(pin, HIGH);
    delayMicroseconds(delayValue);
    digitalWrite(pin, LOW);
    delayMicroseconds(delayValue);
  }
}

void playSuccessSound()
{
  customTone(BUZZER_PIN, 1200, 100);
  delay(50);
  customTone(BUZZER_PIN, 1600, 100);
  delay(50);
  customTone(BUZZER_PIN, 2200, 300);
}

void playErrorSound()
{
  customTone(BUZZER_PIN, 250, 400);
  delay(80);
  customTone(BUZZER_PIN, 250, 400);
}

void playKeyClickSound() { customTone(BUZZER_PIN, 1800, 20); }

void playAlarmSound()
{
  customTone(BUZZER_PIN, 1000, 300);
  delay(100);
  customTone(BUZZER_PIN, 2000, 300);
  delay(100);
}

// --- IDLE SCREEN UI ---
void drawLockedScreen()
{
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  if (isLockerFull)
  {
    display.print("Status: OCCUPIED");
  }
  else
  {
    display.print("Status: EMPTY");
  }

  display.setTextSize(2);
  display.setCursor(25, 25);
  display.print("LOCKED");

  display.setTextSize(1);
  display.setCursor(0, 55);
  display.print(currentTemp > 0 ? String(currentTemp, 1) : "--");
  display.print("C | ");
  display.print(currentHum > 0 ? String(currentHum, 0) : "--");
  display.print("%");
  display.display();
}

// --- UNLOCK ACTION ---
void openLockerAction()
{
  Serial.println(">>> [LOCKER] Opening the door!");
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(15, 20);
  display.println("UNLOCKED!");
  display.display();

  lockServo.write(90);
  playSuccessSound();

  String payloadOpen = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": true, \"isFireWarning\": false}";
  mqttClient.publish("myCTU/locker/sensor", payloadOpen.c_str());

  delay(5000);

  lockServo.write(0);
  currentState = LOCKED;
  enteredPIN = "";
  Serial.println(">>> [LOCKER] Door auto-locked!");

  String payloadClosed = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": false, \"isFireWarning\": false}";
  mqttClient.publish("myCTU/locker/sensor", payloadClosed.c_str());

  drawLockedScreen();
}

// ==========================================
// RECEIVE MQTT COMMANDS FROM BACKEND
// ==========================================
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (unsigned int i = 0; i < length; i++)
    message += (char)payload[i];

  if (String(topic) == mqtt_topic_control)
  {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error)
      return;

    String command = doc["command"].as<String>();

    if (command == "OPEN_DOOR")
    {
      Serial.println("🚨 [ACTION] EMERGENCY UNLOCK COMMAND RECEIVED!");
      openLockerAction();
    }
    else if (command == "ALARM")
    {
      Serial.println("🚨 [ALERT] INTRUSION DETECTED - 15S ALARM TRIGGERED!");

      // Display warning on OLED
      display.clearDisplay();
      display.setTextSize(2);
      display.setTextColor(WHITE);
      display.setCursor(15, 20);
      display.println("WARNING!");
      display.display();

      // ==========================================
      // ACTIVATE POLICE SIREN (15 SECONDS)
      // 1 loop takes ~0.5s -> 30 loops = 15 seconds
      // ==========================================
      for (int i = 0; i < 30; i++)
      {
        customTone(BUZZER_PIN, 3000, 250);
        delay(30);
        customTone(BUZZER_PIN, 1500, 250);
        delay(30);
      }
      // ==========================================

      // Return to locked screen after alarm
      drawLockedScreen();
    }
  }
}

void reconnectMQTT()
{
  while (!mqttClient.connected())
  {
    Serial.print(">>> [MQTT] Reconnecting...");
    String clientId = "ESP32Locker-" + String(random(0, 1000));
    if (mqttClient.connect(clientId.c_str()))
    {
      Serial.println(" Connected!");
      mqttClient.subscribe(mqtt_topic_control);
    }
    else
    {
      delay(5000);
    }
  }
}

/* -------------- [1. RENDER CLOUD DEPLOYMENT (HTTPS)] --------------
void sendDataToServer(bool isSuccess, String pinAttempt)
{
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure *client = new WiFiClientSecure;
    client->setInsecure();
    HTTPClient http;
    http.begin(*client, serverName);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["device"] = "Main Locker";
    doc["action"] = isSuccess ? "Unlocked via PIN" : "Alert: Incorrect PIN";
    doc["entered_pin"] = pinAttempt;

    String requestBody; serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) Serial.println(">>> [SERVER] Log sent to Render successfully!");
    else Serial.println(">>> [ERROR] Failed to send log. HTTP Code: " + String(httpResponseCode));

    http.end(); delete client;
  }
}
----------------------------------------------------------------- */

// -------------- [2. LOCAL TESTING (HTTP)] --------------
void sendDataToServer(bool isSuccess, String pinAttempt)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFiClient client;
    HTTPClient http;
    http.begin(client, serverName);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["device"] = "Main Locker";
    doc["action"] = isSuccess ? "Unlocked via PIN" : "Alert: Incorrect PIN";
    doc["entered_pin"] = pinAttempt;

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0)
      Serial.println(">>> [SERVER] Log sent to Local Server successfully!");
    else
      Serial.println(">>> [ERROR] Failed to send log. HTTP Code: " + String(httpResponseCode));

    http.end();
  }
}
// -----------------------------------------------------------------

// --- PIN INPUT SCREEN UI ---
void drawInputScreen()
{
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Please enter PIN:");
  display.setTextSize(2);
  display.setCursor(28, 30);
  for (int i = 0; i < 6; i++)
  {
    if (i < (int)enteredPIN.length())
      display.print(enteredPIN[i]);
    else
      display.print("_");
  }
  display.display();
}

void setup()
{
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();
  pinMode(IR_PIN, INPUT);

  ESP32PWM::allocateTimer(0);
  lockServo.setPeriodHertz(50);
  lockServo.attach(SERVO_PIN, 500, 2400);
  lockServo.write(0);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    for (;;)
      ;

  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(10, 25);
  display.println("CONNECTING WIFI...");
  display.display();

  WiFi.begin(SECRET_SSID, SECRET_PASS);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected!");

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);

  drawLockedScreen();
}

void loop()
{
  if (!mqttClient.connected())
    reconnectMQTT();
  mqttClient.loop();

  if (currentState == LOCKED)
  {
    if (millis() - lastSensorUpdate >= 2000)
    {
      lastSensorUpdate = millis();

      isLockerFull = (digitalRead(IR_PIN) == LOW);
      float h = dht.readHumidity();
      float t = dht.readTemperature();
      if (!isnan(h) && !isnan(t))
      {
        currentTemp = t;
        currentHum = h;
      }

      bool isFireWarning = false;
      if (currentTemp >= TEMP_THRESHOLD)
      {
        isFireWarning = true;
        display.clearDisplay();
        display.setTextColor(WHITE);
        display.setTextSize(2);
        display.setCursor(20, 10);
        display.println("WARNING!");
        display.setTextSize(1);
        display.setCursor(15, 40);
        display.print("Temp: ");
        display.print(currentTemp);
        display.print(" C");
        display.display();
        playAlarmSound();
      }
      else
      {
        drawLockedScreen();
      }

      String payload = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": false, \"isFireWarning\": " + (isFireWarning ? "true" : "false") + "}";
      mqttClient.publish("myCTU/locker/sensor", payload.c_str());
    }
  }

  char customKey = customKeypad.getKey();
  if (customKey)
  {
    playKeyClickSound();
    switch (currentState)
    {
    case LOCKED:
      if (customKey != '#' && customKey != '*')
      {
        currentState = INPUTTING_PIN;
        enteredPIN = "";
        enteredPIN += customKey;
        drawInputScreen();
      }
      break;
    case INPUTTING_PIN:
      if (customKey == '*')
      {
        enteredPIN = "";
        drawInputScreen();
      }
      else if (customKey == '#')
      {
        bool isPassCorrect = (enteredPIN == masterPIN);
        if (isPassCorrect)
        {
          openLockerAction();
        }
        else
        {
          display.clearDisplay();
          display.setTextSize(2);
          display.setCursor(15, 20);
          display.println("WRONG PIN!");
          display.display();
          playErrorSound();
          delay(1500);
          currentState = LOCKED;
          enteredPIN = "";
          drawLockedScreen();
        }
        sendDataToServer(isPassCorrect, enteredPIN);
      }
      else if (customKey >= '0' && customKey <= '9')
      {
        if (enteredPIN.length() < 6)
        {
          enteredPIN += customKey;
          drawInputScreen();
        }
      }
      break;
    }
  }
}