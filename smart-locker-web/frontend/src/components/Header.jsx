
import { useNavigate } from 'react-router-dom';

const Header = ({ onRefresh }) => {
  const navigate = useNavigate();
  // Lấy tên người dùng từ ví (localStorage)
  const username = localStorage.getItem('username') || 'Admin';

  // Hàm xử lý Đăng xuất
  const handleLogout = () => {
    // 1. Xóa sạch vé và thông tin trong ví
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // 2. Đá văng ra lại màn hình Đăng nhập
    navigate('/');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-t-2xl border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
      <div>
        <h1 className="text-2xl font-black text-blue-400 tracking-tight">SMART LOCKER DASHBOARD</h1>
        <p className="text-slate-400 text-sm mt-1">
          Xin chào, <span className="font-bold text-slate-200">{username}</span>
        </p>
      </div>
      
      <div className="flex items-center space-x-3">
        <button 
          onClick={onRefresh} 
          className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-4 py-2 rounded-xl font-semibold shadow hover:bg-blue-600 hover:text-white transition active:scale-95"
        >
          Làm mới log
        </button>
        <button 
          onClick={handleLogout} 
          className="bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl font-semibold shadow hover:bg-red-500 hover:text-white transition active:scale-95"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

export default Header;