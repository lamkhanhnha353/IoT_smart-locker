const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(">>> [DATABASE] Đã kết nối thành công với MongoDB Atlas Cloud!");
  } catch (error) {
    console.error(">>> [LỖI DB] Kết nối thất bại: ", error);
    process.exit(1); // Dừng server nếu không kết nối được DB
  }
};

module.exports = connectDB;