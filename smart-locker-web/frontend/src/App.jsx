import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import đầy đủ 4 trang của chúng ta
import AuthPage from './pages/AuthPage';     
import Dashboard from './pages/Dashboard'; 
import FaceUnlock from './pages/FaceUnlock'; 
import FaceRegistration from './pages/FaceRegistration'; // Bổ sung trang Đăng ký mặt

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/unlock" element={<FaceUnlock />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Đường dẫn mới để chuyển sang màn hình quét mặt */}
        <Route path="/register-face" element={<FaceRegistration />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;