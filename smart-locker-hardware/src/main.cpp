#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Keypad.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <ESP32Servo.h> // Thư viện Servo

// --- THÔNG TIN MẠNG ---
const char *ssid = "Co Thanh";
const char *password = "66666666";
const char *serverName = "http://192.168.1.25:5000/api/locker/test";

// --- CẤU HÌNH MQTT BROKER ---
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char *mqtt_topic_control = "myCTU/locker/control";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- CẤU HÌNH PHẦN CỨNG ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define BUZZER_PIN 18
#define SERVO_PIN 19 // Chân tín hiệu Servo
Servo lockServo;     // Khởi tạo đối tượng Servo

// --- CẤU HÌNH BÀN PHÍM ---
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

// --- HÀM ÂM THANH ---
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

void playKeyClickSound()
{
  customTone(BUZZER_PIN, 1800, 20);
}

// --- HÀM MỞ KHÓA TỦ ---
void openLockerAction()
{
  Serial.println(">>> [LOCKER] Dang mo chot cua!");
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(15, 20);
  display.println("UNLOCKED!");
  display.display();

  // 1. Kéo chốt ra (Mở cửa)
  lockServo.write(90);
  playSuccessSound();

  // 2. Chờ sinh viên thao tác (5 giây)
  delay(5000);

  // 3. Đẩy chốt lại (Khóa tự động)
  lockServo.write(0);

  currentState = LOCKED;
  enteredPIN = "";
  display.clearDisplay();
  display.setCursor(25, 20);
  display.println("LOCKED");
  display.display();
  Serial.println(">>> [LOCKER] Da khoa tu tu dong!");
}

// --- HÀM LẮNG NGHE LỆNH MQTT ---
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (unsigned int i = 0; i < length; i++)
  {
    message += (char)payload[i];
  }
  Serial.print(">>> [MQTT] Nhan lenh tu Node.js: ");
  Serial.println(message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error)
    return;

  const char *command = doc["command"];
  if (strcmp(command, "OPEN_DOOR") == 0)
  {
    Serial.println(">>> [XÁC NHẬN] AI nhan dien dung, tien hanh mo tu!");
    openLockerAction();
  }
}

// --- HÀM GIỮ KẾT NỐI MQTT ---
void reconnectMQTT()
{
  while (!mqttClient.connected())
  {
    Serial.print(">>> [MQTT] Dang ket noi lai...");
    String clientId = "ESP32Locker-" + String(random(0, 1000));
    if (mqttClient.connect(clientId.c_str()))
    {
      Serial.println(" Thanh cong!");
      mqttClient.subscribe(mqtt_topic_control);
    }
    else
    {
      delay(5000);
    }
  }
}

// --- HÀM GỬI DATA LÊN SERVER NODE.JS ---
void sendDataToServer(bool isSuccess, String pinAttempt)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["thiet_bi"] = "Tủ Khóa Chính";
    doc["hanh_dong"] = isSuccess ? "Mở Khóa Bằng PIN" : "Cảnh Báo: Sai Mật Khẩu";
    doc["ma_pin_da_nhap"] = pinAttempt;

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0)
      Serial.println(">>> [SERVER] Da gui Log thanh cong.");
    http.end();
  }
}

void drawInputScreen()
{
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Vui long nhap ma PIN:");
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

  // KHỞI TẠO SERVO
  ESP32PWM::allocateTimer(0);
  lockServo.setPeriodHertz(50);
  lockServo.attach(SERVO_PIN, 500, 2400);
  lockServo.write(0); // Vừa bật máy là khóa liền

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    for (;;)
      ;

  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(10, 25);
  display.println("CONNECTING WIFI...");
  display.display();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Da ket noi!");

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);

  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(25, 20);
  display.println("LOCKED");
  display.display();
}

void loop()
{
  if (!mqttClient.connected())
    reconnectMQTT();
  mqttClient.loop();

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
          openLockerAction();
        else
        {
          display.clearDisplay();
          display.setTextSize(2);
          display.setCursor(15, 20);
          display.println("SAI PASS!");
          display.display();
          playErrorSound();
          delay(1500);
          currentState = LOCKED;
          enteredPIN = "";
          display.clearDisplay();
          display.setCursor(25, 20);
          display.println("LOCKED");
          display.display();
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