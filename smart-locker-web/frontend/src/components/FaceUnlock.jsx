import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceUnlock = () => {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState("Đang tải dữ liệu AI...");
  const [username, setUsername] = useState(""); // Ô nhập tên người dùng để test

  // Đổi URL này thành IP của máy tính nếu bạn test trên điện thoại (vd: http://192.168.1.25:5000)
 

//   const BACKEND_URL = "http://localhost:5000";
  const BACKEND_URL = "https://iot-smart-locker.onrender.com";
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
        setStatus("Hãy đưa khuôn mặt vào giữa khung hình");
        startVideo();
      } catch (error) {
        console.error("Lỗi tải model:", error);
        setStatus("Lỗi: Không tìm thấy thư mục models!");
      }
    };
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Lỗi bật camera:", err);
        setStatus("Lỗi: Vui lòng cấp quyền sử dụng Camera!");
      });
  };

  // HÀM 1: Lấy 128 số từ Camera
  const getFaceDescriptor = async () => {
    if (!videoRef.current) return null;
    const detection = await faceapi.detectSingleFace(
      videoRef.current,
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptor();

    return detection ? Array.from(detection.descriptor) : null;
  };

  // HÀM 2: Đăng ký khuôn mặt vào Database
  const handleRegister = async () => {
    if (!username) return setStatus("Vui lòng nhập tên tài khoản (Username) trước!");
    setStatus("Đang quét để đăng ký...");
    
    const descriptor = await getFaceDescriptor();
    if (!descriptor) return setStatus("Không tìm thấy khuôn mặt. Hãy thử lại!");

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, descriptor })
      });
      const data = await response.json();
      setStatus(data.message);
    } catch (error) {
      setStatus("Lỗi kết nối đến máy chủ Backend!");
    }
  };

  // HÀM 3: Xác thực để Mở Khóa tủ
  const handleVerify = async () => {
    if (!username) return setStatus("Vui lòng nhập Username để xác thực!");
    setStatus("Đang phân tích khuôn mặt...");
    
    const liveDescriptor = await getFaceDescriptor();
    if (!liveDescriptor) return setStatus("Không tìm thấy khuôn mặt. Hãy thử lại!");

    try {
      const response = await fetch(`${BACKEND_URL}/api/locker/verify-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, liveDescriptor })
      });
      const data = await response.json();
      setStatus(data.message);
      
      if (data.success) {
        // Tủ đã mở! Chỗ này sau này bạn có thể chuyển trang hoặc hiện hiệu ứng xanh lá cây.
        console.log("Thành công: Lệnh MQTT đã được Node.js gửi đi!");
      }
    } catch (error) {
      setStatus("Lỗi kết nối đến máy chủ Backend!");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-blue-400 mb-4">SMART LOCKER - AI FACE ID</h2>
        
        <div className="relative w-64 h-64 bg-black rounded-full overflow-hidden border-4 border-blue-500 mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <video ref={videoRef} autoPlay muted className="absolute top-0 left-0 w-full h-full object-cover" />
        </div>

        <p className="text-center text-sm font-semibold text-yellow-400 mb-4 h-8">{status}</p>

        {/* Ô nhập Username */}
        <input 
          type="text" 
          placeholder="Nhập tên đăng nhập của bạn..." 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Cụm 2 nút bấm */}
        <div className="flex w-full gap-2">
          <button 
            onClick={handleRegister} disabled={!isModelLoaded}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold disabled:opacity-50"
          >
            ĐĂNG KÝ
          </button>
          
          <button 
            onClick={handleVerify} disabled={!isModelLoaded}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold disabled:opacity-50"
          >
            MỞ TỦ
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceUnlock;