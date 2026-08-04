require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const mqttClient = require('./config/mqtt');
const authRoutes = require('./routes/authRoutes');
const lockerRoutes = require('./routes/lockerRoutes');
const Log = require('./models/Log');

// --- CẤU HÌNH TELEGRAM (KHÔNG DÙNG THƯ VIỆN) ---
const TELEGRAM_TOKEN = '8852248223:AAE3wNrDd5-miZY-210RDyzSYwVkcVQaHBM'; 
const CHAT_ID = '8707369107';        

// Hàm gọi thẳng API gốc của Telegram siêu nhẹ
async function sendTelegramMessage(messageText) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: messageText })
    });
  } catch (err) {
    console.error(">>> [TELEGRAM] Lỗi gửi tin:", err);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

connectDB();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.io = io;
  req.mqttClient = mqttClient;
  // TRUYỀN HÀM TELEGRAM SANG CONTROLLER ĐỂ XÀI CHUNG
  req.sendTelegram = sendTelegramMessage; 
  next();
});

app.get('/api/status', (req, res) => res.json({ message: "Server Backend đang hoạt động rất tốt!" }));
app.use('/api/auth', authRoutes);
app.use('/api/locker', lockerRoutes);

io.on('connection', (socket) => {
  console.log(`\n>>> [SOCKET] WEB FRONTEND ĐÃ KẾT NỐI! ID: ${socket.id}`);
  socket.on('disconnect', () => console.log(`>>> [SOCKET] Web ngắt kết nối!`));
});

// --- XỬ LÝ DỮ LIỆU CẢM BIẾN & CẢNH BÁO CHÁY ---
let isFireNotified = false; // Biến chống spam tin nhắn Telegram

mqttClient.subscribe('myCTU/locker/sensor');
mqttClient.on('message', async (topic, message) => {
  if (topic === 'myCTU/locker/sensor') {
    try {
      const data = JSON.parse(message.toString());
      
      // LOGIC CẢNH BÁO QUÁ NHIỆT 
      if (data.temp >= 33.8) {
        data.isFireWarning = true; 
        
        // Gửi Telegram và Lưu Database (chỉ làm 1 lần khi mới bắt đầu cháy)
        if (!isFireNotified) {
          // 1. Gửi Telegram
          const alertMsg = `🚨 BÁO ĐỘNG ĐỎ: TỦ ĐỒ myCTU 🚨\nNhiệt độ hiện tại: ${data.temp}°C\nNguy cơ cháy nổ cao!`;
          sendTelegramMessage(alertMsg);
          console.log(">>> [TELEGRAM] Đã gửi tin nhắn báo cháy!");

          // 2. Lưu trực tiếp vào Database
          try {
            const newLog = new Log({
              thiet_bi: "Tủ Khóa Chính",
              hanh_dong: "🔥 CẢNH BÁO: QUÁ NHIỆT (CHÁY)",
              chi_tiet: `Nhiệt độ cao bất thường: ${data.temp}°C` 
            });
            await newLog.save();
            console.log(">>> [DATABASE] Đã lưu lịch sử cháy nổ!");

            // 3. Bắn realtime ra Web để cập nhật bảng Nhật ký
            io.emit('co_nguoi_mo_tu', newLog); 
          } catch (dbErr) {
            console.error(">>> [DATABASE] Lỗi lưu lịch sử:", dbErr);
          }

          isFireNotified = true;
        }
      } else {
        data.isFireWarning = false;
        
        if (isFireNotified) {
          const safeMsg = `✅ AN TOÀN: Nhiệt độ tủ đồ myCTU đã giảm xuống mức bình thường (${data.temp}°C).`;
          sendTelegramMessage(safeMsg);
          console.log(">>> [TELEGRAM] Đã gửi tin nhắn báo an toàn!");
          isFireNotified = false;
        }
      }

      io.emit('sensor_update', data); 
    } catch (err) {
      console.error("Lỗi parse JSON:", err);
    }
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`MAY CHU SMART LOCKER DA KHOI DONG`);
  console.log(`Dang chay tai cong: ${PORT}`);
  console.log(`=================================`);
});