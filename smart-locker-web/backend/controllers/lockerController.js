
const Log = require('../models/Log');
const User = require('../models/User');

exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ thoi_gian: -1 }).limit(20);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!" });
  }
};

exports.verifyFaceAndUnlock = async (req, res) => {
  try {
    const { username, liveDescriptor } = req.body;
    const user = await User.findOne({ username });
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(400).json({ success: false, message: "Tài khoản chưa đăng ký Face ID!" });
    }

    let distance = 0;
    for (let i = 0; i < 128; i++) {
      distance += Math.pow(user.faceDescriptor[i] - liveDescriptor[i], 2);
    }
    distance = Math.sqrt(distance);

   if (distance <= 0.45) {
      // BẮN LOG RA TERMINAL CHO BẠN THẤY
      console.log(`\n>>> [AI XÁC THỰC] Khuôn mặt khớp ${(1 - distance)*100}%. Chủ nhân: ${username}`);
      console.log(">>> [MQTT] Đang gửi lệnh OPEN_DOOR xuống mạch ESP32...");

      // 1. PUBLISH LỆNH MQTT XUỐNG ESP32 MỞ TỦ
      req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'OPEN_DOOR', user: username }));
      
      // 2. Ghi Log vào DB
      const newLog = new Log({ thiet_bi: "Web App", hanh_dong: "Mở Khóa Bằng Khuôn Mặt Thành Công" });
      await newLog.save();

      // 3. Báo cho ReactJS cập nhật giao diện
      req.io.emit('co_nguoi_mo_tu', newLog);

      return res.json({ success: true, message: `Khuôn mặt khớp ${((1 - distance)*100).toFixed(0)}%! Đã mở tủ.`});
    } else {
      return res.status(400).json({ success: false, message: "Khuôn mặt không trùng khớp!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
  }
};

exports.receiveFromESP32 = async (req, res) => {
  try {
    const newLog = new Log({
      thiet_bi: req.body.thiet_bi,
      hanh_dong: req.body.hanh_dong,
      ma_pin_da_nhap: req.body.ma_pin_da_nhap
    });
    await newLog.save();
    
    req.io.emit('co_nguoi_mo_tu', newLog);
    res.json({ message: "Đã lưu log ESP32!" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lưu DB!" });
  }
};