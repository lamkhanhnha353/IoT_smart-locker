const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Gọi model User vừa tạo

require('dotenv').config();

// Kéo cái khuôn (Model) vừa tạo vào đây
const Log = require('./models/Log'); 

const app = express();
app.use(cors()); 
app.use(express.json()); 

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(">>> [DATABASE] Da ket noi thanh cong voi MongoDB Atlas Cloud!"))
  .catch((err) => console.log(">>> [LOI DB] Ket noi that bai: ", err));

app.get('/api/status', (req, res) => {
  res.json({ message: "Server Backend dang hoat dong cuc manh!" });
});

// API Lấy lịch sử mở khóa cho Web (Lấy 20 dòng mới nhất)
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ thoi_gian: -1 }).limit(20);
    res.json(logs);
  } catch (error) {
    console.error(">>> Lỗi khi lấy dữ liệu:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});


// API ĐĂNG KÝ TÀI KHOẢN (REGISTER)

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Kiểm tra xem tên đăng nhập đã có ai xài chưa
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại!" });
    }

    // 2. Băm nát mật khẩu (Mã hóa)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Tạo tài khoản mới và lưu vào Database
    const newUser = new User({
      username,
      password: hashedPassword
    });
    await newUser.save();

    res.status(201).json({ success: true, message: "Đăng ký thành công!" });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});


// API ĐĂNG NHẬP TÀI KHOẢN (LOGIN)

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Tìm user trong Database
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: "Tài khoản không tồn tại!" });
    }

    // 2. So sánh mật khẩu nhập vào với mật khẩu đã mã hóa trong Database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Sai mật khẩu!" });
    }

    // 3. Cấp "Thẻ thông hành" JWT (Hạn sử dụng: 1 ngày)
    // Lưu ý: Chuỗi 'CHIA_KHOA_BI_MAT_CUA_BAN' sau này đem lên server thật phải giấu vào file .env
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      'CHIA_KHOA_BI_MAT_CUA_BAN', 
      { expiresIn: '1d' }
    );

    res.json({ 
      success: true, 
      message: "Đăng nhập thành công!",
      token: token,
      user: { username: user.username, role: user.role }
    });

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// --- API HỨNG VÀ LƯU DỮ LIỆU ---
// Thêm chữ 'async' vì thao tác lưu Database tốn một chút thời gian chờ
app.post('/api/test', async (req, res) => { 
  try {
    console.log(`\n[NHAN DATA TU ESP32]:`, req.body); 
    
    // Đổ dữ liệu từ ESP32 vào khuôn
    const newLog = new Log({
      thiet_bi: req.body.thiet_bi,
      hanh_dong: req.body.hanh_dong,
      ma_pin_da_nhap: req.body.ma_pin_da_nhap
    });

    // Ra lệnh lưu thẳng lên MongoDB Atlas
    await newLog.save();
    console.log(">>> Đã lưu thành công vào Database!");

    // ---> THÊM ĐÚNG 1 DÒNG NÀY ĐỂ PHÁT LOA CHO WEB BẮT TÍN HIỆU <---
    io.emit('co_nguoi_mo_tu', newLog);
    res.json({ message: "Đã nhận và lưu log vào Database!" });
    
  } catch (error) {
    console.error(">>> Lỗi khi lưu vào DB:", error);
    res.status(500).json({ message: "Lỗi server không thể lưu DB!" });
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Thiet bi ket noi - ID: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Thiet bi ngat ket noi - ID: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`MAY CHU SMART LOCKER DA KHOI DONG`);
  console.log(`Dang chay tai cong: ${PORT}`);
  console.log(`=================================`);
});