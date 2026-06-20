import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// 1. Mảng chứa các ảnh nền (Bạn có thể tự thay bằng link ảnh thực tế của dự án sau)
const backgrounds = [
  'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?q=80&w=2059&auto=format&fit=crop', // Ảnh Smart Lock
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop', // Ảnh Cyber/IoT
  'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop', // Ảnh Mạch điện tử
];

function AuthPage() {
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  
  // 2. State quản lý hình nền hiện tại
  const [currentBg, setCurrentBg] = useState(0);

  // Hiệu ứng tự động đổi hình nền mỗi 5 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgrounds.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Bắt lỗi Form Real-time
  useEffect(() => {
    const newErrors = {};
    if (username.length > 0 && username.trim() === '') newErrors.username = 'Tên đăng nhập không hợp lệ';
    if (password.length > 0 && password.length < 6) newErrors.password = 'Mật khẩu phải từ 6 ký tự';
    if (!isLogin && confirmPassword.length > 0 && confirmPassword !== password) newErrors.confirmPassword = 'Mật khẩu không khớp';
    setErrors(newErrors);
  }, [username, password, confirmPassword, isLogin]);

  const handleToggleAuth = () => {
    setIsLogin(!isLogin);
    setUsername(''); setPassword(''); setConfirmPassword(''); setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || (!isLogin && !confirmPassword)) return alert('Điền đủ thông tin bạn nhé!');
    if (Object.keys(errors).length > 0) return alert('Sửa các lỗi đỏ trước khi gửi!');

    if (isLogin) {
      // ===== LÔGIC ĐĂNG NHẬP =====
      try {
        const response = await axios.post('http://localhost:5000/api/login', { username, password });
        
        if (response.data.success) {
          // 1. Lưu cái thẻ Token vào ví của trình duyệt (localStorage)
          localStorage.setItem('token', response.data.token);
          // 2. Lưu thêm tên người dùng để mốt hiển thị lên góc màn hình cho đẹp
          localStorage.setItem('username', response.data.user.username);
          
          alert(response.data.message);
          navigate('/dashboard'); // Đi vào trong
        }
      } catch (error) {
        // Bắt lỗi nếu nhập sai pass hoặc sai tên
        alert(error.response?.data?.message || 'Lỗi kết nối đến Server!');
      }

    } else {
      // ===== LÔGIC ĐĂNG KÝ =====
      try {
        const response = await axios.post('http://localhost:5000/api/register', { username, password });
        
        if (response.data.success) {
          alert('Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.');
          // Tự động gạt sang màn hình đăng nhập
          setIsLogin(true); 
          setConfirmPassword('');
        }
      } catch (error) {
        alert(error.response?.data?.message || 'Đăng ký thất bại!');
      }
    }
  };

  return (
    <div className="min-h-screen font-sans scroll-smooth relative bg-slate-950">
      
      {/* KHỐI 1: BACKGROUND LỚP ĐÁY CÙNG (Cố định, chuyển cảnh mờ dần) */}
      <div className="fixed inset-0 z-0">
        {backgrounds.map((bg, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentBg ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${bg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Lớp phủ đen mờ để chữ trên form không bị chìm */}
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"></div>
          </div>
        ))}
      </div>

      {/* KHỐI 2: NỘI DUNG CUỘN (Nằm đè lên trên background) */}
      <div className="relative z-10 w-full text-slate-100">
        
        {/* === SECTION 1: FORM ĐĂNG NHẬP CHUẨN 100VH === */}
        <div className="h-screen w-full flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {isLogin ? 'SMART LOCKER' : 'ĐĂNG KÝ TÀI KHOẢN'}
              </h2>
              <p className="text-slate-400 text-xs mt-2">Xác thực tập trung - Bảo mật bằng AI</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tài khoản</label>
                <input 
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập username..."
                  className={`w-full bg-slate-950/80 border ${errors.username ? 'border-red-500' : 'border-slate-800'} px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition text-sm`}
                />
                {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mật khẩu</label>
                <input 
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Từ 6 ký tự..."
                  className={`w-full bg-slate-950/80 border ${errors.password ? 'border-red-500' : 'border-slate-800'} px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition text-sm`}
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Xác nhận</label>
                  <input 
                    type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu..."
                    className={`w-full bg-slate-950/80 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-800'} px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition text-sm`}
                  />
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
                </div>
              )}

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition mt-4 text-sm">
                {isLogin ? 'ĐĂNG NHẬP' : 'TẠO MỚI'}
              </button>
            </form>

            <div className="text-center mt-6">
              <button type="button" onClick={handleToggleAuth} className="text-xs text-slate-400 hover:text-blue-400 transition">
                {isLogin ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
              </button>
            </div>
          </div>
        </div>

        {/* === SECTION 2: HƯỚNG DẪN SỬ DỤNG (Bọc nền màu tối đặc để che background cũ) === */}
        <div className="w-full bg-slate-950 border-t border-slate-800 px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-12">HƯỚNG DẪN SỬ DỤNG</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
                <div className="text-blue-500 mb-4 text-4xl font-black">01</div>
                <h4 className="text-lg font-bold mb-2">Đăng Ký & Quét Mặt</h4>
                <p className="text-slate-400 text-sm">Tạo tài khoản và cho phép hệ thống ghi nhận dữ liệu sinh trắc học khuôn mặt của bạn qua camera điện thoại.</p>
              </div>
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
                <div className="text-blue-500 mb-4 text-4xl font-black">02</div>
                <h4 className="text-lg font-bold mb-2">Đăng Ký Hộc Tủ</h4>
                <p className="text-slate-400 text-sm">Hệ thống sẽ cấp phát một hộc tủ trống tại trạm gần nhất và gửi thông tin vị trí về Dashboard của bạn.</p>
              </div>
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
                <div className="text-blue-500 mb-4 text-4xl font-black">03</div>
                <h4 className="text-lg font-bold mb-2">Đứng Vào Vùng Quét</h4>
                <p className="text-slate-400 text-sm">Đi đến trạm tủ, đứng vào vùng quét của camera tổng. AI nhận diện đúng mặt, tủ của bạn sẽ tự động bung khóa.</p>
              </div>
            </div>
          </div>
        </div>

        {/* === SECTION 3: GIỚI THIỆU HỆ THỐNG === */}
        <div className="w-full bg-slate-900 px-4 py-20 border-t border-slate-800">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h3 className="text-2xl font-bold">VỀ HỆ THỐNG AI SMART LOCKER</h3>
            <div className="h-1 w-16 bg-blue-500 mx-auto rounded-full"></div>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Khởi nguồn từ nhu cầu tự động hóa việc quản lý hành lý tại các không gian công cộng, hệ thống được thiết kế theo kiến trúc "Trạm điều khiển trung tâm - Zero Trust". Kết hợp vi điều khiển ESP32, cơ sở dữ liệu thời gian thực và đặc biệt là công nghệ nhận diện AI, chúng tôi loại bỏ hoàn toàn các rủi ro từ chìa khóa vật lý hay mã PIN truyền thống.
            </p>
          </div>
        </div>

        {/* === SECTION 4: FOOTER LIÊN HỆ === */}
        <footer className="w-full bg-black py-8 px-4 border-t border-slate-800 text-center text-xs text-slate-500">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div>
              <p className="font-semibold text-slate-300">Đồ án Hệ thống Nhúng & IoT</p>
              <p className="mt-1">Nền tảng Quản lý Tủ đồ Thông minh</p>
            </div>
            <div>
              <p>Email liên hệ: admin@smartlocker.local</p>
              <p className="mt-1">&copy; 2026 Smart Locker Team - Dân IT CTU. All rights reserved.</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default AuthPage;