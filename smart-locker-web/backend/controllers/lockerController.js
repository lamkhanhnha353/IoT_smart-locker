const Log = require('../models/Log');
const User = require('../models/User');

// ==========================================
// HÀM KIỂM TRA AN NINH: ĐẾM SỐ LẦN SAI TRONG 1 PHÚT
// ==========================================
const checkSecurityAlert = async (thiet_bi, req) => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // Lùi lại 1 phút

    // Đếm log "Cảnh Báo", "Sai" hoặc "lạ" trong 1 phút qua
    const failedCount = await Log.countDocuments({
      thiet_bi: thiet_bi,
      thoi_gian: { $gte: oneMinuteAgo },
      hanh_dong: { $regex: /Sai|Khuôn mặt lạ|Cảnh Báo/i }
    });

    // Nếu sai từ 5 lần trở lên -> Báo động Telegram
    if (failedCount >= 5) {
      const msg = `🚨 BÁO ĐỘNG AN NINH TỦ ĐỒ 🚨\nPhát hiện xâm nhập từ [${thiet_bi}].\nĐã thử mở khóa sai ${failedCount} lần trong 1 phút qua!`;
      
      // Gọi hàm Telegram đã được truyền từ server.js qua biến req
      if (req.sendTelegram) {
        req.sendTelegram(msg);
      }
    }
  } catch (error) {
    console.error(">>> [LỖI] Lỗi khi kiểm tra an ninh:", error);
  }
};
// ==========================================

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

      if (req.mqttClient) {
        req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'OPEN_DOOR', user: 'Khẩn cấp' }));
      }

      const newLog = new Log({
        thiet_bi: "Tủ Khóa Chính",
        hanh_dong: "🔓 MỞ CỬA KHẨN CẤP (QUÁ NHIỆT)"
      });
      await newLog.save();
      
      if (req.io) {
        req.io.emit('co_nguoi_mo_tu', newLog);
      }

      return res.json({ success: true, message: "Đã gửi lệnh mở cửa khẩn cấp thành công!" });
    }

    return res.status(400).json({ success: false, message: "Lệnh không hợp lệ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend!" });
  }
};

exports.verifyFaceAndUnlock = async (req, res) => {
  try {
    const { liveDescriptor } = req.body;
    const users = await User.find({ faceDescriptor: { $exists: true, $ne: [] } });

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: "Hệ thống chưa có dữ liệu khuôn mặt nào!" });
    }

    let bestMatch = { username: null, distance: 1 };
    
    for (const user of users) {
      let distance = 0;
      for (let i = 0; i < 128; i++) {
        distance += Math.pow(user.faceDescriptor[i] - liveDescriptor[i], 2);
      }
      distance = Math.sqrt(distance);

      if (distance < bestMatch.distance) {
        bestMatch = { username: user.username, distance: distance };
      }
    }

    if (bestMatch.distance <= 0.45) {
      const matchedUser = bestMatch.username;
      console.log(`\n>>> [AI TỰ ĐỘNG] Nhận diện thành công. Chủ nhân: ${matchedUser}`);
      
      req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'OPEN_DOOR', user: matchedUser }));
      
      // Xử lý lưu lịch sử Mở cửa Face ID
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
      
      // Lưu lịch sử thất bại vào DB để làm dữ liệu đếm 
      const errorLog = new Log({
        thiet_bi: "Camera AI",
        hanh_dong: "Cảnh Báo: Khuôn mặt lạ"
      });
      await errorLog.save();
      
      if (req.io) {
        req.io.emit('co_nguoi_mo_tu', errorLog);
      }

      // TRUYỀN req VÀO ĐỂ GỌI CHỐT KIỂM TRA AN NINH TELEGRAM
      await checkSecurityAlert("Camera AI", req);

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
    
    if (req.io) {
      req.io.emit('co_nguoi_mo_tu', newLog);
    }

    // NẾU CÓ CHỮ SAI PIN THÌ GỌI CHỐT KIỂM TRA AN NINH TELEGRAM
    if (req.body.hanh_dong.includes('Sai')) {
      await checkSecurityAlert("Tủ Khóa Chính", req);
    }

    res.json({ message: "Đã lưu log ESP32!" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lưu DB!" });
  }
};