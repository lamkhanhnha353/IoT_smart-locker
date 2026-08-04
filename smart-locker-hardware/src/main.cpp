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
#define SERVO_PIN 19
Servo lockServo;

// --- CẤU HÌNH CẢM BIẾN MỚI ---
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define IR_PIN 5

// --- BIẾN LƯU TRỮ TRẠNG THÁI ---
unsigned long lastSensorUpdate = 0;
float currentTemp = 0.0;
float currentHum = 0.0;
bool isLockerFull = false;

// BẠN SỬA MỨC NHIỆT ĐỘ TEST Ở ĐÂY (TEST XONG ĐỔI THÀNH 45.0)
float TEMP_THRESHOLD = 33.8;

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

// --- CÁC HÀM ÂM THANH ---
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

// HÀM TIẾNG CÒI HÚ BÁO ĐỘNG
void playAlarmSound()
{
  customTone(BUZZER_PIN, 1000, 300);
  delay(100);
  customTone(BUZZER_PIN, 2000, 300);
  delay(100);
}

// --- HÀM GIAO DIỆN CHỜ THÔNG MINH ---
void drawLockedScreen()
{
  display.clearDisplay();

  // GÓC TRÊN: Trạng thái tủ
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  if (isLockerFull)
  {
    display.print("Tu: DANG CO DO");
  }
  else
  {
    display.print("Tu: TRONG");
  }

  // GIỮA: Chữ LOCKED to rõ
  display.setTextSize(2);
  display.setCursor(25, 25);
  display.print("LOCKED");

  // GÓC DƯỚI: Nhiệt độ & Độ ẩm
  display.setTextSize(1);
  display.setCursor(0, 55);
  display.print(currentTemp > 0 ? String(currentTemp, 1) : "--");
  display.print("C | ");
  display.print(currentHum > 0 ? String(currentHum, 0) : "--");
  display.print("%");

  display.display();
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

  // BẮN TIN BÁO WEB: CỬA ĐANG MỞ!
  String payloadOpen = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": true, \"isFireWarning\": false}";
  mqttClient.publish("myCTU/locker/sensor", payloadOpen.c_str());

  // 2. Chờ sinh viên lấy đồ (5 giây)
  delay(5000);

  // 3. Đẩy chốt lại (Khóa tự động)
  lockServo.write(0);
  currentState = LOCKED;
  enteredPIN = "";
  Serial.println(">>> [LOCKER] Da khoa tu tu dong!");

  // BẮN TIN BÁO WEB: CỬA ĐÃ KHÓA!
  String payloadClosed = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": false, \"isFireWarning\": false}";
  mqttClient.publish("myCTU/locker/sensor", payloadClosed.c_str());

  drawLockedScreen();
}

// --- HÀM LẮNG NGHE LỆNH MQTT TỪ WEB (ĐÃ ĐƯỢC CHỈNH SỬA AN TOÀN) ---
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (unsigned int i = 0; i < length; i++)
  {
    message += (char)payload[i];
  }

  Serial.print(">>> [MQTT] Nhan lenh tu Topic: ");
  Serial.println(topic);
  Serial.println(">>> Noi dung: " + message);

  // Đảm bảo chỉ xử lý khi nhận lệnh từ đúng kênh điều khiển
  if (String(topic) == mqtt_topic_control)
  {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error)
    {
      Serial.println(">>> [LỖI] Khong the doc JSON tu Web!");
      return;
    }

    // Dùng kiểu String thay vì char* để tránh lỗi Crash
    String command = doc["command"].as<String>();

    if (command == "OPEN_DOOR")
    {
      Serial.println("🚨 [XÁC NHẬN] NHAN LENH MO CUA KHAN CAP TU WEB!");
      openLockerAction();
    }
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
      mqttClient.subscribe(mqtt_topic_control); // Lắng nghe kênh điều khiển
    }
    else
    {
      delay(5000);
    }
  }
}

// --- HÀM GỬI LỊCH SỬ LÊN NODE.JS ---
// --- HÀM GỬI LỊCH SỬ LÊN NODE.JS (ĐÃ NÂNG CẤP HTTPS) ---
void sendDataToServer(bool isSuccess, String pinAttempt)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    // Tạo client bảo mật và bỏ qua check chứng chỉ SSL
    WiFiClientSecure *client = new WiFiClientSecure;
    client->setInsecure();

    HTTPClient http;
    http.begin(*client, serverName);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["thiet_bi"] = "Tủ Khóa Chính";
    doc["hanh_dong"] = isSuccess ? "Mở Khóa Bằng PIN" : "Cảnh Báo: Sai Mật Khẩu";
    doc["ma_pin_da_nhap"] = pinAttempt;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0)
    {
      Serial.println(">>> [SERVER] Da gui Log len Render thanh cong!");
    }
    else
    {
      Serial.println(">>> [LỖI] Khong the gui Log. Ma loi: " + String(httpResponseCode));
    }

    http.end();
    delete client; // Giải phóng bộ nhớ
  }
}

// --- HÀM VẼ GIAO DIỆN NHẬP PIN ---
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

  // KHỞI TẠO CẢM BIẾN
  dht.begin();
  pinMode(IR_PIN, INPUT);

  // KHỞI TẠO SERVO
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

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Da ket noi!");

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);

  drawLockedScreen();
}

void loop()
{
  if (!mqttClient.connected())
    reconnectMQTT();
  mqttClient.loop();

  // --- CẬP NHẬT CẢM BIẾN NGẦM & CẢNH BÁO ---
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

      // Xử lý Cảnh báo nhiệt độ
      bool isFireWarning = false;
      if (currentTemp >= TEMP_THRESHOLD)
      {
        isFireWarning = true;
        Serial.println(">>> [CẢNH BÁO] Nhiệt độ trong tủ quá cao! Hú còi!");

        display.clearDisplay();
        display.setTextColor(WHITE);
        display.setTextSize(2);
        display.setCursor(20, 10);
        display.println("WARNING!");
        display.setTextSize(1);
        display.setCursor(15, 40);
        display.print("Nhiet do: ");
        display.print(currentTemp);
        display.print(" C");
        display.display();

        playAlarmSound();
      }
      else
      {
        drawLockedScreen();
      }

      // Đóng gói data gửi lên Web
      String payload = "{\"temp\":" + String(currentTemp) + ",\"humidity\":" + String(currentHum) + ",\"isFull\":" + (isLockerFull ? "true" : "false") + ",\"isDoorOpen\": false, \"isFireWarning\": " + (isFireWarning ? "true" : "false") + "}";
      mqttClient.publish("myCTU/locker/sensor", payload.c_str());
      Serial.println(">>> [MQTT] Đã gửi data: " + payload);
    }
  }

  // --- XỬ LÝ BÀN PHÍM ---
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
          display.println("SAI PASS!");
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