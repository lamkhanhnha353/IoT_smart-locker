# 🔐 myCTU Smart Locker — ESP32 IoT Locker with Keypad, Face ID & Fire Safety

An ESP32-based smart locker that combines **keypad PIN access**, **temperature/humidity monitoring**, **occupancy sensing**, and **MQTT-based remote control**, paired with a cloud dashboard for live status, activity logs, Face ID unlock, and automatic fire-safety alerts.

---

## 🧠 What It Does

The locker is unlocked either by entering a **6-digit PIN** on a physical keypad, or remotely by the server (via **Face ID** recognized in a companion web app, or an **emergency unlock** button). A servo motor drives the latch, an OLED screen shows live status, and a DHT11 sensor continuously watches the internal temperature — if it gets dangerously hot, the buzzer sounds an alarm, the OLED shows a warning, and the ESP32 reports the event to the cloud so it can trigger a remote alert and allow emergency unlocking. An IR sensor also detects whether the locker currently has something stored inside it.

All sensor data and remote commands travel over **MQTT** (public HiveMQ broker), so the locker can be controlled and monitored from anywhere with an internet connection — no port forwarding or local network access required.

---

## 🛠️ Hardware

### Components Used

| Component | Role |
|---|---|
| **ESP32 Dev Board** | Main controller — WiFi, MQTT client, HTTP client |
| **SSD1306 OLED (128×64, I²C)** | Displays lock state, PIN entry, temperature/humidity, warnings |
| **4×4 Matrix Keypad** | Manual PIN entry |
| **SG90 Micro Servo** | Drives the door latch (0° locked / 90° unlocked) |
| **DHT11 Sensor** | Temperature & humidity readings, used for fire/overheat detection |
| **IR Obstacle Sensor** | Detects whether an item is currently inside the locker |
| **Active Buzzer** | Audio feedback — key clicks, success/error tones, alarm siren |

### Wiring / Pin Mapping

| ESP32 GPIO | Connected To | Notes |
|---|---|---|
| `21` / `22` | OLED SDA / SCL | I²C, address `0x3C` |
| `13, 12, 14, 27` | Keypad Rows (R1–R4) | |
| `26, 25, 33, 32` | Keypad Columns (C1–C4) | |
| `18` | Buzzer | Driven with software-generated square-wave tones |
| `19` | Servo signal | PWM, 500–2400 µs pulse range |
| `4` | DHT11 data | Digital sensor |
| `5` | IR sensor output | `LOW` = object detected |

> Power the servo and OLED from a stable 5V/3.3V rail as appropriate for your modules — avoid drawing servo current directly from the ESP32's onboard regulator on larger servos.

### How the Circuit Behaves

- **Idle / Locked state:** OLED shows `LOCKED`, occupancy status, and live temp/humidity, refreshed every 2 seconds.
- **PIN entry:** pressing a key on the keypad switches the OLED to a masked PIN-entry screen (`_ _ _ _ _ _`). `*` clears the entry, `#` submits it.
- **Correct PIN:** servo rotates to 90° (unlocked), a rising 3-tone success sound plays, and the door **automatically re-locks after 5 seconds**.
- **Wrong PIN:** a low-pitched double-beep error tone plays and the OLED flashes `WRONG PIN!`.
- **Overheat detected:** OLED shows a `WARNING!` screen with the live temperature, and the buzzer plays a repeating two-tone alarm until the temperature drops back down.
- **Remote command received (over MQTT):** the ESP32 can be told to `OPEN_DOOR` (same as a correct PIN — used for Face ID unlock or emergency unlock from the web dashboard) or to `ALARM` (sounds a 15-second police-siren pattern, used when the server detects repeated failed unlock attempts — a basic tamper/intrusion deterrent).

---

## 📡 Data Flow (MQTT)

| Topic | Direction | Payload |
|---|---|---|
| `myCTU/locker/sensor` | ESP32 → Server | `{ temp, humidity, isFull, isDoorOpen, isFireWarning }` — published every 2 seconds |
| `myCTU/locker/control` | Server → ESP32 | `{ command: "OPEN_DOOR" }` or `{ command: "ALARM" }` |

Every PIN attempt is also reported once, over a simple HTTP POST, to a logging server so it shows up in the activity history on the web dashboard.

---

## 💻 Firmware Stack

Built with **Arduino framework on PlatformIO**, targeting the `esp32dev` board. Key libraries:

- `Adafruit GFX` + `Adafruit SSD1306` — OLED display
- `Keypad` — 4×4 matrix keypad scanning
- `ESP32Servo` — door-lock servo control
- `DHT sensor library` — temperature/humidity
- `PubSubClient` — MQTT client
- `ArduinoJson` — building/parsing JSON payloads
- `HTTPClient` / `WiFiClientSecure` — reporting PIN-attempt logs to the backend

---

## ☁️ Companion Web App (brief)

The hardware is paired with a small web dashboard (Node.js/Express backend + React frontend) that:

- Shows live temperature, humidity, occupancy, and door state
- Keeps a searchable log of every unlock attempt
- Lets a registered user unlock the locker with **Face ID** through the browser's camera
- Sends **Telegram alerts** and allows a **remote emergency unlock** if the locker overheats
- Escalates repeated failed unlock attempts into a **remote siren command** sent back down to the ESP32

This part is optional for anyone replicating just the physical locker — the ESP32 firmware works standalone with PIN-only access even without the web app, as long as it can still publish sensor data over MQTT.

---

##  Full source code: [github.com/lamkhanhnha353/IoT_smart-locker](https://github.com/lamkhanhnha353/IoT_smart-locker)

## 🎥 Demo & Simulation

Check out our system in action:
* **[Full Hardware System Demo](https://youtu.be/zN_ErLPZej4)**
* **[Wokwi Virtual Simulation Demo](https://youtu.be/IRWvt_YTOhE)**

You can also view and test the logic of the hardware circuit directly in your browser:
👉 **[Open Wokwi Simulation](https://wokwi.com/projects/471486052908005377)**
*(Note: The link is view-only. Your interactions will not affect the original project).*