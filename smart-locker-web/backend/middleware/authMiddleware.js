const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {

  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ success: false, message: "Truy cập bị từ chối! Vui lòng đăng nhập." });
  }

  try {
 
    const decoded = jwt.verify(
      token.replace('Bearer ', ''), 
      process.env.JWT_SECRET || 'CHIA_KHOA_BI_MAT_CUA_BAN'
    );
    

    req.user = decoded;
    next(); 
  } catch (error) {
    res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn!" });
  }
};

module.exports = authMiddleware;