import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// Import các mảnh ghép vừa tạo vào
import Header from '../components/Header';
import LogTable from '../components/LogTable';

const socket = io('http://localhost:5000'); 

function Dashboard() {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/logs');
      setLogs(response.data);
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu:", error);
    }
  };

  useEffect(() => {
    fetchLogs(); 

    socket.on('co_nguoi_mo_tu', (logMoi) => {
      setLogs((logsCu) => [logMoi, ...logsCu]); 
    });

    return () => {
      socket.off('co_nguoi_mo_tu');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Truyền hàm fetchLogs xuống cho Component Header */}
        <Header onRefresh={fetchLogs} />

        {/* Truyền cục dữ liệu logs xuống cho Component LogTable */}
        <LogTable logs={logs} />
        
      </div>
    </div>
  );
}

export default Dashboard;