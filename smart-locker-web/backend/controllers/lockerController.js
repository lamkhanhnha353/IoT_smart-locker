const Log = require('../models/Log');
const User = require('../models/User');

// ==========================================
// HÀM KIỂM TRA AN NINH: PHÂN TẦNG CẢNH BÁO
// ==========================================
const checkSecurityAlert = async (thiet_bi, req) => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // Lùi lại 1 phút

    // Đếm log "Alert", "Sai" hoặc "lạ" trong 1 phút qua (Bắt cả log Anh/Việt)
    const failedCount = await Log.countDocuments({
      thiet_bi: thiet_bi,
      thoi_gian: { $gte: oneMinuteAgo },
      hanh_dong: { $regex: /Sai|lạ|Cảnh Báo|Alert|Invalid|Incorrect/i }
    });

    // MỨC 1: Sai đúng 3 lần -> Chỉ nhắn tin Telegram cảnh báo nhẹ
    if (failedCount === 3) {
      const msg = `⚠️ SECURITY ALERT LEVEL 1 ⚠️\nSuspicious activity detected from [${thiet_bi}].\n3 failed attempts in the last minute!`;
      if (req.sendTelegram) {
        req.sendTelegram(msg);
      }
    }

    // MỨC 2: Sai từ 5 lần trở lên -> Nhắn tin báo động đỏ + Hú còi phần cứng
    if (failedCount >= 5) {
      const msg = `🚨 RED SECURITY ALERT 🚨\nIntrusion detected from [${thiet_bi}].\n${failedCount} failed unlock attempts!\nSystem is TRIGGERING LOCAL ALARM!`;
      
      if (req.sendTelegram) {
        req.sendTelegram(msg);
      }

      // Gửi lệnh hú còi xuống phần cứng thông qua MQTT
      if (req.mqttClient) {
        req.mqttClient.publish('myCTU/locker/control', JSON.stringify({ command: 'ALARM' }));
        console.log(`\n>>> [BÁO ĐỘNG] Đã gửi lệnh HÚ CÒI xuống tủ (ESP32)!`);
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
        thiet_bi: "Main Locker",
        hanh_dong: "🔓 EMERGENCY UNLOCK (OVERHEAT)"
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
      
      try {
        const newLog = new Log({
          thiet_bi: "AI Camera",
          hanh_dong: `Unlocked via Face ID (${matchedUser})`
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
      
      const errorLog = new Log({
        thiet_bi: "AI Camera",
        hanh_dong: "Alert: Unknown Face Detected"
      });
      await errorLog.save();
      
      if (req.io) {
        req.io.emit('co_nguoi_mo_tu', errorLog);
      }

      await checkSecurityAlert("AI Camera", req);

      return res.status(400).json({ success: false, message: "Khuôn mặt lạ hoặc không nhìn rõ!" });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend!" });
  }
};

// ĐÃ SỬA HÀM NÀY ĐỂ BẮT BIẾN TIẾNG ANH TỪ ESP32
exports.receiveFromESP32 = async (req, res) => {
  try {
    // Bắt các biến (device, action, entered_pin) từ req.body (do mạch ESP32 gửi lên)
    const deviceName = req.body.device || req.body.thiet_bi || "Main Locker";
    const actionTaken = req.body.action || req.body.hanh_dong || "Unknown Action";
    const pinAttempted = req.body.entered_pin || req.body.ma_pin_da_nhap;

    console.log(`\n>>> [API LOCAL] Tủ ESP32 vừa báo cáo: ${actionTaken}`); 

    const newLog = new Log({
      thiet_bi: deviceName,
      hanh_dong: actionTaken,
      ma_pin_da_nhap: pinAttempted
    });
    await newLog.save();
    
    if (req.io) {
      req.io.emit('co_nguoi_mo_tu', newLog);
    }

    // Cập nhật điều kiện kiểm tra (sai PIN tiếng Anh)
    if (actionTaken.includes('Incorrect') || actionTaken.includes('Sai')) {
      console.log(`>>> [AN NINH] Đang kiểm tra số lần sai...`);
      await checkSecurityAlert(deviceName, req);
    }

    res.json({ message: "Đã lưu log ESP32 thành công!" });
  } catch (error) {
    console.error(">>> [LỖI DB] Lỗi lưu log ESP32:", error);
    res.status(500).json({ message: "Lỗi lưu DB!" });
  }
};