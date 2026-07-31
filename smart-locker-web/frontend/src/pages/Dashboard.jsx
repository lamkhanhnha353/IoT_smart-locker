import{ useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify'; 

const Dashboard = () => {
  const navigate = useNavigate();

  const username = localStorage.getItem('username') || 'Sinh viên';
  const [hasFaceId, setHasFaceId] = useState(localStorage.getItem('hasFaceId') === 'true');

  const handleLogout = () => {
   
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    
    toast.success('Đăng xuất thành công!', {
      style: {
        borderRadius: '10px',
        background: '#334155',
        color: '#fff',
      },
      icon: '👋',
    });

  
    setTimeout(() => {
      navigate('/'); 
    }, 1000);
  };

  const [lockerStatus, setLockerStatus] = useState({ 
    temp: 32, 
    humidity: 60, 
    isFull: false, 
    isDoorOpen: false 
  });
  
  const [mockLogs, setMockLogs] = useState([
    { id: 1, user: username, action: 'Mở cửa', time: '10:30 - Hôm nay', method: 'Face ID' },
    { id: 2, user: username, action: 'Đóng cửa', time: '10:35 - Hôm nay', method: 'Tự động' },
    { id: 3, user: 'Admin', action: 'Mở cửa', time: '08:15 - Hôm qua', method: 'Mã PIN' },
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans relative">
      
  
      {!hasFaceId && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-rose-500/30">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2">Yêu cầu bảo mật</h2>
            <p className="text-slate-400 mb-6">
              Bạn chưa thiết lập dữ liệu khuôn mặt. Vui lòng đăng ký Face ID để sử dụng tủ đồ an toàn!
            </p>
            <button 
              onClick={() => navigate('/register-face')} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              BẬT CAMERA ĐĂNG KÝ
            </button>
          </div>
        </div>
      )}

    
      <div className={`max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 ${!hasFaceId ? 'opacity-20 pointer-events-none blur-sm transition-all' : ''}`}>
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-400 tracking-wide">myCTU LOCKER</h1>
            <p className="text-sm text-slate-400 mt-1">
              Xin chào, <span className="text-emerald-400 font-bold text-base">{username}</span> 👋
            </p>
          </div>
          
          <div className="flex w-full md:w-auto gap-3">
            {/* Nút Cập nhật khuôn mặt */}
            <button 
              onClick={() => navigate('/register-face')}
              className="hidden md:flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 px-4 py-2 rounded-xl font-bold hover:bg-blue-500 hover:text-white transition-all"
            >
              👤 Cập nhật Face ID
            </button>

            {/* Nút Đăng Xuất */}
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-slate-700 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-transparent hover:border-rose-500/50 px-4 py-2 rounded-xl transition-all font-semibold"
            >
              🚪 Đăng xuất
            </button>
          </div>
        </div>

        {/* THÔNG SỐ CẢM BIẾN (3 KHỐI) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Khối Nhiệt độ / Độ ẩm */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Môi trường tủ</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{lockerStatus.temp}°C</span>
                <span className="text-xl text-blue-400">{lockerStatus.humidity}%</span>
              </div>
            </div>
            <div className="text-4xl">🌡️</div>
          </div>

          {/* Khối Tình trạng chứa đồ */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Tình trạng chứa</p>
              <span className={`text-2xl font-black ${lockerStatus.isFull ? 'text-rose-400' : 'text-emerald-400'}`}>
                {lockerStatus.isFull ? 'ĐANG CÓ ĐỒ' : 'TỦ TRỐNG'}
              </span>
            </div>
            <div className="text-4xl">{lockerStatus.isFull ? '📦' : '🪹'}</div>
          </div>

          {/* Khối Trạng thái cửa */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Trạng thái cửa</p>
              <span className={`text-2xl font-black ${lockerStatus.isDoorOpen ? 'text-amber-400' : 'text-emerald-400'}`}>
                {lockerStatus.isDoorOpen ? 'ĐANG MỞ' : 'ĐÃ KHÓA AN TOÀN'}
              </span>
            </div>
            <div className="text-4xl">{lockerStatus.isDoorOpen ? '🚪' : '🔒'}</div>
          </div>
        </div>

        {/* BẢNG NHẬT KÝ HOẠT ĐỘNG */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <h2 className="text-lg font-bold text-white mb-4">Nhật ký hoạt động gần đây</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                  <th className="py-3 px-4 font-semibold">Người dùng</th>
                  <th className="py-3 px-4 font-semibold">Hành động</th>
                  <th className="py-3 px-4 font-semibold">Phương thức</th>
                  <th className="py-3 px-4 font-semibold text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {mockLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="py-4 px-4 font-medium text-blue-300">{log.user}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === 'Mở cửa' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-300">{log.method}</td>
                    <td className="py-4 px-4 text-right text-slate-400 text-sm">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;