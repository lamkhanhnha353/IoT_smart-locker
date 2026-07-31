
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// Import thư viện Toast
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState, useEffect } from 'react';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Nếu trong ví đã có vé (tức là đã đăng nhập), thì "đá" thẳng vào Dashboard, không cho ở lại trang Đăng nhập nữa
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
     
  try {
        // Đã bổ sung http://localhost:5000 để đồng bộ với phần Đăng ký
        // const res = await axios.post('http://localhost:5000/api/auth/login', { username, password });
        // const res = await axios.post('[https://iot-smart-locker.onrender.com/api/auth/login](https://iot-smart-locker.onrender.com/api/auth/login)', { username, password });
          const res = await axios.post('https://iot-smart-locker.onrender.com/api/auth/login', { username, password });
        if (res.data.success) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('username', res.data.user.username);
          
          // CÁCH LƯU MỚI: Dùng toán tử 3 ngôi. 
          // Nếu backend trả về true thì lưu 'true', ngược lại (kể cả undefined) thì lưu 'false'. 
          // Cách này đảm bảo không bao giờ bị crash code!
          localStorage.setItem('hasFaceId', res.data.hasFaceId ? 'true' : 'false');
          
          toast.success("Đăng nhập thành công!");
          navigate('/dashboard'); 
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Lỗi kết nối đến máy chủ!");
      }

    } else {
     
      // 2. XỬ LÝ ĐĂNG KÝ
   
      if (password !== confirmPassword) {
        return toast.warn("Mật khẩu xác nhận không khớp!");
      }

      try {
        // const res = await axios.post('http://localhost:5000/api/auth/register', { username, password });
        const res = await axios.post('https://iot-smart-locker.onrender.com/api/auth/register', { username, password });
    
        if (res.data.success) {
          toast.success("Đăng ký thành công! Hãy đăng nhập nhé.");
          setIsLogin(true); 
          setPassword('');
          setConfirmPassword('');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Lỗi đăng ký!");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      {/* Component chứa thông báo (Giao diện Dark Mode) */}
      <ToastContainer theme="dark" position="top-right" autoClose={2000} />

      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-500 mb-2">myCTU Locker</h1>
          <p className="text-gray-400">
            {isLogin ? "Đăng nhập để quản lý tủ đồ" : "Tạo tài khoản sinh viên"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-300 font-semibold mb-2">Mã số sinh viên (MSSV)</label>
            <input 
              type="text" 
              placeholder="VD: B2012345"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-2">Mật khẩu</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-gray-300 font-semibold mb-2">Xác nhận mật khẩu</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30"
          >
            {isLogin ? "ĐĂNG NHẬP" : "ĐĂNG KÝ TÀI KHOẢN"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 font-semibold underline transition-all"
            >
              {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;