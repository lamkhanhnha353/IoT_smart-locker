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


exports.controlLocker = async (req, res) => {
  try {
    const { command } = req.body;

    if (command === 'OPEN_DOOR') {
      console.log(`\n>>> [BÁO ĐỘNG] Gửi lệnh MỞ CỬA KHẨN CẤP xuống Tủ (ESP32)!`);

      // 1. Bắn lệnh qua MQTT xuống phần cứng
      if (req.mqttClient) {
        req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'OPEN_DOOR', user: 'Khẩn cấp' }));
      } else {
        console.log("Cảnh báo: MQTT Client chưa sẵn sàng!");
      }

      // 2. Lưu luôn hành động này vào Database để làm bằng chứng
      const newLog = new Log({
        thiet_bi: "Tủ Khóa Chính",
        hanh_dong: "🔓 MỞ CỬA KHẨN CẤP (QUÁ NHIỆT)"
      });
      await newLog.save();
      
      // 3. Bắn Socket ra ngoài Web để bảng Lịch sử tự động thêm 1 dòng mới
      if (req.io) {
        req.io.emit('co_nguoi_mo_tu', newLog);
      }

      return res.json({ success: true, message: "Đã gửi lệnh mở cửa khẩn cấp thành công!" });
    }

    return res.status(400).json({ success: false, message: "Lệnh không hợp lệ!" });
  } catch (error) {
    console.error("Lỗi điều khiển tủ:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend!" });
  }
};

exports.verifyFaceAndUnlock = async (req, res) => {
  try {
    const { liveDescriptor } = req.body;
    
    // Lấy tất cả user đã có dữ liệu khuôn mặt trong Database
    const users = await User.find({ faceDescriptor: { $exists: true, $ne: [] } });

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: "Hệ thống chưa có dữ liệu khuôn mặt nào!" });
    }

    let bestMatch = { username: null, distance: 1 }; // 1 là sai số tối đa

    // Vòng lặp: Đem khuôn mặt vừa quét so sánh với từng người trong DB
    for (const user of users) {
      let distance = 0;
      for (let i = 0; i < 128; i++) {
        distance += Math.pow(user.faceDescriptor[i] - liveDescriptor[i], 2);
      }
      distance = Math.sqrt(distance);

      // Nếu tìm thấy người giống hơn, cập nhật lại bestMatch
      if (distance < bestMatch.distance) {
        bestMatch = { username: user.username, distance: distance };
      }
    }

    // Nếu sai số của người giống nhất <= 0.45 (tức là giống > 55%) -> Cho phép mở 0.38
   if (bestMatch.distance <= 0.45) {
      const matchedUser = bestMatch.username;
      console.log(`\n>>> [AI TỰ ĐỘNG] Nhận diện thành công. Chủ nhân: ${matchedUser}`);
      
     
      req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'OPEN_DOOR', user: matchedUser }));
 
      try {
        const newLog = new Log({
          thiet_bi: "Camera AI",
          hanh_dong: `Mở Khóa Bằng Khuôn Mặt (${matchedUser})`
        });
        await newLog.save();
        
      
        if (req.io) {
          req.io.emit('co_nguoi_mo_tu', newLog);
        }
      } catch (logErr) {
        console.error(">>> [DATABASE] Lỗi lưu lịch sử Face ID:", logErr);
      }
    

      return res.json({ success: true, username: matchedUser });
      
    } else {
      
      console.log("\n>>> [CẢNH BÁO AI] Phát hiện khuôn mặt lạ!");
      return res.status(400).json({ success: false, message: "Khuôn mặt lạ hoặc không nhìn rõ!" });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend!" });
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