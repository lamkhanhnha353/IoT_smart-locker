
const mongoose = require('mongoose');

// Tạo khuôn đúc (Schema) cho dữ liệu
const logSchema = new mongoose.Schema({
  thiet_bi: { type: String, required: true },
  hanh_dong: { type: String, required: true },
  ma_pin_da_nhap: { type: String },
  thoi_gian: { type: Date, default: Date.now } // Tự động lấy giờ hiện tại khi có người bấm
});

// Tạo Model từ Schema và xuất ra để xài
module.exports = mongoose.model('Log', logSchema);