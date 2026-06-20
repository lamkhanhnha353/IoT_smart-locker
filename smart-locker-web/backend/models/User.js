
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true // Không cho phép 2 người trùng tên đăng nhập
  },
  password: { 
    type: String, 
    required: true 
  },
  role: {
    type: String,
    default: 'user' // Có thể nâng cấp thành 'admin' sau này
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);