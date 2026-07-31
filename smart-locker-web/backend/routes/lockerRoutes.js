
const express = require('express');
const router = express.Router();
const lockerController = require('../controllers/lockerController');
const authMiddleware = require('../middleware/authMiddleware'); 

// Phải đăng nhập mới được xem lịch sử mở tủ
router.get('/logs', authMiddleware, lockerController.getLogs);

// Các API này dành cho tủ ESP32 gọi lên nên tạm thời để mở
router.post('/test', lockerController.receiveFromESP32); 
router.post('/verify-face', lockerController.verifyFaceAndUnlock);

module.exports = router;