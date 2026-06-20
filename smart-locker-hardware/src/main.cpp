#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Keypad.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- THÔNG TIN MẠNG (ĐIỀN CỦA BẠN VÀO ĐÂY) ---
const char *ssid = "Co Thanh";
const char *password = "66666666";
// Nhớ đổi IP này thành IPv4 máy tính của bạn
const char *serverName = "http://192.168.1.25:5000/api/test";

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define BUZZER_PIN 18

// --- CẤU HÌNH BÀN PHÍM MA TRẬN 4x4 ---
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

// --- HÀM GỬI DATA LÊN SERVER NODE.JS ---
void sendDataToServer(bool isSuccess, String pinAttempt)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    // Đóng gói JSON
    StaticJsonDocument<200> doc;
    doc["thiet_bi"] = "Tủ Khóa Chính";
    doc["hanh_dong"] = isSuccess ? "Mở Khóa Thành Công" : "Cảnh Báo: Sai Mật Khẩu";
    doc["ma_pin_da_nhap"] = pinAttempt;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0)
    {
      Serial.print(">>> [SERVER] Đã nhận Log. Mã phản hồi: ");
      Serial.println(httpResponseCode);
    }
    else
    {
      Serial.print(">>> [LỖI] Không gửi được. Mã lỗi: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
  else
  {
    Serial.println(">>> [WIFI] Mất kết nối, không thể gửi log!");
  }
}

// --- GIAO DIỆN HIỂN THỊ ---
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
    if (i < enteredPIN.length())
    {
      display.print(enteredPIN[i]);
    }
    else
    {
      display.print("_");
    }
  }
  display.display();
}

void setup()
{
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println(F("Loi OLED!"));
    for (;;)
      ;
  }

  // Giao diện chờ bắt WiFi
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(10, 25);
  display.println("CONNECTING WIFI...");
  display.display();

  // Khởi động WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Da ket noi!");

  // Bắt xong thì vào giao diện Khóa
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(25, 20);
  display.println("LOCKED");
  display.display();
}

void loop()
{
  char customKey = customKeypad.getKey();

  if (customKey)
  {
    playKeyClickSound();
    Serial.print("[KEYMAP] Nut vua bam: ");
    Serial.println(customKey);

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
        display.clearDisplay();
        display.setTextSize(2);
        display.setCursor(15, 20);

        bool isPassCorrect = (enteredPIN == masterPIN);

        if (isPassCorrect)
        {
          display.println("PASS OK!");
          display.display();
          playSuccessSound();
        }
        else
        {
          display.println("SAI PASS!");
          display.display();
          playErrorSound();
        }

        // BẮN DATA LÊN SERVER NGAY TẠI ĐÂY
        sendDataToServer(isPassCorrect, enteredPIN);

        delay(1500);

        currentState = LOCKED;
        enteredPIN = "";
        display.clearDisplay();
        display.setCursor(25, 20);
        display.println("LOCKED");
        display.display();
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