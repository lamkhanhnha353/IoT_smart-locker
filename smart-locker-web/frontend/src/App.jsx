// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// import AuthPage from './pages/AuthPage';
// import Dashboard from './pages/Dashboard';
// import FaceTest from './pages/FaceTest';

// // TRẠM KIỂM SOÁT (PROTECTED ROUTE)

// // Bất cứ ai muốn vào các trang bọc trong này đều phải qua đây xét giấy tờ
// const ProtectedRoute = ({ children }) => {
//   // Mở ví (localStorage) ra xem có thẻ token không
//   const token = localStorage.getItem('token');
  
//   if (!token) {
//     // Không có thẻ -> Đá về thẳng trang chủ (Màn hình đăng nhập)
//     return <Navigate to="/" />;
//   }
  
//   // Có thẻ -> Mở cổng cho vào Dashboard
//   return children;
// };

// function App() {
//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<AuthPage />} />

    
//         <Route 
//           path="/dashboard" 
//           element={
//             <ProtectedRoute>
//               <Dashboard />
//             </ProtectedRoute>
//           } 
//         />

//         <Route path="/test-ai" element={<FaceTest />} />

//         <Route path="*" element={<Navigate to="/" />} />
//       </Routes>
//     </Router>
//   );
// }

// export default App;



//////////////////////////////////////////////////////////////////

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// 1. IMPORT COMPONENT MỚI
// (Đảm bảo đường dẫn này đúng với nơi bạn lưu file FaceUnlock.jsx)
import FaceUnlock from './components/FaceUnlock'; 

// 2. ĐÓNG BĂNG TẠM THỜI CÁC TRANG CŨ 
// (Comment lại để nó không gọi API cũ gây ra lỗi 404 nữa)
/*
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import FaceTest from './pages/FaceTest';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" />;
  return children;
};
*/

function App() {
  return (
    <Router>
      {/* Bắt buộc phải có thẻ Routes bọc ngoài */}
      <Routes>
        
        {/* Cho trang chủ chạy thẳng vào giao diện quét khuôn mặt để test */}
        <Route path="/" element={<FaceUnlock />} />

        {/* ----- KHU VỰC CODE CŨ ĐÃ ĐƯỢC ĐÓNG BĂNG ----- */}
        {/* 
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/test-ai" element={<FaceTest />} /> 
        */}

        {/* Bắt lỗi gõ sai link -> Đẩy về trang chủ test camera */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;