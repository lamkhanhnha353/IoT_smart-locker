import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify'; 
import axios from 'axios';
import { io } from 'socket.io-client';

const BACKEND_URL = "https://iot-smart-locker.onrender.com"; // [1. DEPLOY LÊN MẠNG]
// const BACKEND_URL = "http://192.168.1.25:5000";             // [2. CHẠY TEST LOCAL]

const socket = io(BACKEND_URL, {
  transports: ['websocket'] 
});

const Dashboard = () => {
  const navigate = useNavigate();

  const username = localStorage.getItem('username') || 'Student';
  const [hasFaceId] = useState(localStorage.getItem('hasFaceId') === 'true');

  const [logs, setLogs] = useState([]);
  const [lockerStatus, setLockerStatus] = useState({ 
    temp: 0, 
    humidity: 0, 
    isFull: false, 
    isDoorOpen: false 
  });

  const [isFireAlert, setIsFireAlert] = useState(false);
  const audioRef = useRef(null);

  // --- STATE DÀNH CHO PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 5; // Hiển thị 5 dòng mỗi trang

  useEffect(() => {
    audioRef.current = new Audio('/alarm.mp3');
    audioRef.current.loop = true;

    socket.on('connect', () => {
      console.log('✅ [SOCKET] Connected to Backend successfully! ID:', socket.id);
    });

    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${BACKEND_URL}/api/locker/logs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data);
      } catch (error) {
        console.error("❌ Error fetching activity logs", error);
      }
    };
    fetchLogs();

    socket.on('co_nguoi_mo_tu', (newLog) => {
      console.log('🔥 [SOCKET RECEIVED] Locker recently accessed:', newLog);
      setLogs((prevLogs) => [newLog, ...prevLogs]); 
    });

    socket.on('sensor_update', (data) => {
      setLockerStatus({
        temp: data.temp,
        humidity: data.humidity,
        isFull: data.isFull,
        isDoorOpen: data.isDoorOpen
      });

      if (data.isFireWarning) {
        setIsFireAlert(true);
        if (audioRef.current) {
          audioRef.current.play().catch(err => console.log("Browser temporarily blocked audio:", err));
        }
      } else {
        setIsFireAlert(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    });

    return () => {
      socket.off('connect');
      socket.off('co_nguoi_mo_tu');
      socket.off('sensor_update');
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    
    toast.success('Logged out successfully!', {
      style: { borderRadius: '10px', background: '#334155', color: '#fff' },
      icon: '👋',
    });

    setTimeout(() => {
      navigate('/'); 
    }, 1000);
  };

  const handleEmergencyOpen = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/locker/control`, { command: 'OPEN_DOOR' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.warn('Emergency unlock command sent to locker!');
      
      setIsFireAlert(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch (error) {
      console.error("Error triggering emergency unlock", error);
      toast.error('Failed to send unlock command!');
    }
  };

  const handleDismissAlert = () => {
    setIsFireAlert(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    toast.info('Emergency alert dismissed.');
  };

  // --- LOGIC TÍNH TOÁN PHÂN TRANG ---
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // --- HELPER FUNCTION: Translate Log Actions ---
  // Dịch các thông báo log từ DB trả về (nếu DB đang lưu tiếng Việt)
  const getTranslatedAction = (actionStr) => {
    if (!actionStr) return "";
    const str = actionStr.toLowerCase();
    if (str.includes('sai') || str.includes('cảnh báo')) return 'Alert: Invalid Access';
    if (str.includes('cháy') || str.includes('khẩn cấp')) return 'Emergency Action';
    if (str.includes('mở khóa')) return 'Unlocked Successfully';
    return actionStr; // Trả về nguyên bản nếu không khớp
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans relative">
      
      {!hasFaceId && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-rose-500/30">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2">Security Requirement</h2>
            <p className="text-slate-400 mb-6">No facial data configured. Please register your Face ID to access the secure locker system.</p>
            <button 
              onClick={() => navigate('/register-face')} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              ENABLE CAMERA REGISTRATION
            </button>
          </div>
        </div>
      )}

      <div className={`max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 ${!hasFaceId ? 'opacity-20 pointer-events-none blur-sm transition-all' : ''}`}>
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-400 tracking-wide">myCTU LOCKER</h1>
            <p className="text-sm text-slate-400 mt-1">Welcome, <span className="text-emerald-400 font-bold text-base">{username}</span> 👋</p>
          </div>
          <div className="flex w-full md:w-auto gap-3">
            <button onClick={() => navigate('/register-face')} className="hidden md:flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/50 px-4 py-2 rounded-xl font-bold hover:bg-blue-500 hover:text-white transition-all">
              👤 Update Face ID
            </button>
            <button onClick={handleLogout} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-slate-700 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-transparent hover:border-rose-500/50 px-4 py-2 rounded-xl transition-all font-semibold">
              🚪 Log Out
            </button>
          </div>
        </div>

        {/* SENSOR METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Environment</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{lockerStatus.temp}°C</span>
                <span className="text-xl text-blue-400">{lockerStatus.humidity}%</span>
              </div>
            </div>
            <div className="text-4xl">🌡️</div>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Capacity Status</p>
              <span className={`text-2xl font-black ${lockerStatus.isFull ? 'text-rose-400' : 'text-emerald-400'}`}>
                {lockerStatus.isFull ? 'OCCUPIED' : 'EMPTY'}
              </span>
            </div>
            <div className="text-4xl">{lockerStatus.isFull ? '📦' : '🪹'}</div>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-semibold mb-1">Door Status</p>
              <span className={`text-2xl font-black ${lockerStatus.isDoorOpen ? 'text-amber-400' : 'text-emerald-400'}`}>
                {lockerStatus.isDoorOpen ? 'UNLOCKED' : 'SECURELY LOCKED'}
              </span>
            </div>
            <div className="text-4xl">{lockerStatus.isDoorOpen ? '🚪' : '🔒'}</div>
          </div>
        </div>

        {/* ACTIVITY LOGS TABLE */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4">Activity Logs</h2>
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                  <th className="py-3 px-4 font-semibold">Device</th>
                  <th className="py-3 px-4 font-semibold">Action Taken</th>
                  <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {currentLogs.length > 0 ? currentLogs.map((log) => {
                  const isAlert = log.hanh_dong.toLowerCase().includes('sai') || log.hanh_dong.toLowerCase().includes('cảnh báo') || log.hanh_dong.toLowerCase().includes('cháy') || log.hanh_dong.toLowerCase().includes('khẩn cấp');
                  return (
                  <tr key={log._id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="py-4 px-4 font-medium text-blue-300">
                      {log.thiet_bi === "Tủ Khóa Chính" ? "Main Locker" : log.thiet_bi}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${isAlert ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {getTranslatedAction(log.hanh_dong)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-400 text-sm">
                      {new Date(log.thoi_gian).toLocaleString('en-US')}
                    </td>
                  </tr>
                )}) : (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-slate-500">No activity data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
              <span className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={prevPage} 
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentPage === 1 ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                >
                  ◀ Prev
                </button>
                <button 
                  onClick={nextPage} 
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentPage === totalPages ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* EMERGENCY ALARM MODAL */}
      {isFireAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-red-600 text-white p-8 md:p-10 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.8)] w-full max-w-xl text-center animate-pulse border-4 border-red-300 space-y-6">
            <div className="text-7xl">🔥</div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider text-yellow-300">
              CRITICAL OVERHEAT!
            </h1>
            <p className="text-lg md:text-xl font-medium leading-relaxed">
              Internal temperature has reached a dangerous level <span className="font-bold underline">({lockerStatus.temp}°C)</span>! Risk of electronic damage or fire. Immediate action required!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button 
                onClick={handleEmergencyOpen}
                className="bg-white text-red-700 hover:bg-slate-100 font-extrabold py-4 px-6 rounded-2xl text-lg transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                🔓 EMERGENCY UNLOCK
              </button>
              <button 
                onClick={handleDismissAlert}
                className="bg-red-900/80 hover:bg-red-900 text-white font-bold py-4 px-6 rounded-2xl text-lg transition-all border border-red-400 active:scale-95 flex items-center justify-center gap-2"
              >
                ✅ ACKNOWLEDGE (MUTE)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;