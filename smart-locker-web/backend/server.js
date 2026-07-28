require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const mqttClient = require('./config/mqtt');

const authRoutes = require('./routes/authRoutes');
const lockerRoutes = require('./routes/lockerRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// KẾT NỐI DATABASE
connectDB();

app.use(cors());
app.use(express.json());

// Gắn io và mqttClient vào request để các Controller có thể lấy ra xài (ví dụ: phát loa, gửi MQTT)
app.use((req, res, next) => {
  req.io = io;
  req.mqttClient = mqttClient;
  next();
});

// ROUTING MỚI 
app.get('/api/status', (req, res) => res.json({ message: "Server Backend đang hoạt động rất tốt!" }));
app.use('/api/auth', authRoutes);
app.use('/api/locker', lockerRoutes);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Thiet bi ket noi - ID: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[SOCKET] Ngat ket noi - ID: ${socket.id}`));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`MAY CHU SMART LOCKER DA KHOI DONG`);
  console.log(`Dang chay tai cong: ${PORT}`);
  console.log(`=================================`);
});