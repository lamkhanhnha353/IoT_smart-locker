
const express = require('express');
const router = express.Router();
const lockerController = require('../controllers/lockerController');

router.get('/logs', lockerController.getLogs);
router.post('/test', lockerController.receiveFromESP32); // ESP32 gọi API này
router.post('/verify-face', lockerController.verifyFaceAndUnlock);

module.exports = router;