import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';


// TRẠM KIỂM SOÁT (PROTECTED ROUTE)

// Bất cứ ai muốn vào các trang bọc trong này đều phải qua đây xét giấy tờ
const ProtectedRoute = ({ children }) => {
  // Mở ví (localStorage) ra xem có thẻ token không
  const token = localStorage.getItem('token');
  
  if (!token) {
    // Không có thẻ -> Đá về thẳng trang chủ (Màn hình đăng nhập)
    return <Navigate to="/" />;
  }
  
  // Có thẻ -> Mở cổng cho vào Dashboard
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />

    
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;