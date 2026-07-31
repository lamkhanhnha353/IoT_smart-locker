
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại!" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ success: true, message: "Đăng ký thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success: false, message: "Tài khoản không tồn tại!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Sai mật khẩu!" });

    // Lấy Key từ .env, không code cứng vào đây nữa
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      process.env.JWT_SECRET || 'CHIA_KHOA_BI_MAT_CUA_BAN', 
      { expiresIn: '1d' }
    );

    const hasFaceData = user.faceDescriptor && user.faceDescriptor.length > 0;

    res.json({ 
      success: true, 
      token, 
      user: { id: user._id, username: user.username },
      hasFaceId: hasFaceData // <--- THÊM DÒNG NÀY
    });

    } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.registerFace = async (req, res) => {
  try {
    const { descriptor } = req.body;
    const userId = req.user.userId; // Lấy ID từ Token

    if (!descriptor || descriptor.length !== 128) {
      return res.status(400).json({ success: false, message: "Dữ liệu khuôn mặt không hợp lệ!" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });

    user.faceDescriptor = descriptor;
    await user.save();
    res.json({ success: true, message: "Cập nhật dữ liệu khuôn mặt thành công!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};