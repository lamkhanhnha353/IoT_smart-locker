import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceUnlock = () => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Đang khởi động AI...");
  const [isSuccess, setIsSuccess] = useState(false); // Trạng thái mở tủ
  const [matchedName, setMatchedName] = useState("");
  const scanInterval = useRef(null); // Bộ đếm thời gian quét tự động

  const BACKEND_URL = "";

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setStatus("Sẵn sàng. Hãy đưa mặt vào khung hình");
        startVideo();
      } catch (error) {
        setStatus("Lỗi tải model AI!");
      }
    };
    loadModels();

    return () => {
      if (scanInterval.current) clearInterval(scanInterval.current);
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setStatus("Lỗi: Vui lòng cấp quyền Camera!"));
  };

  // HÀM: Giọng nói AI Tiếng Việt
  const speakAI = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN'; // Đặt ngôn ngữ Tiếng Việt
    utterance.rate = 1.0;     // Tốc độ đọc
    window.speechSynthesis.speak(utterance);
  };

  // HÀM: Tự động quét khi Video bắt đầu chạy
  const handleVideoPlay = () => {
    // Cứ mỗi 1.5 giây AI sẽ tự chụp 1 bức ảnh ẩn để phân tích
    scanInterval.current = setInterval(async () => {
      if (isSuccess || !videoRef.current) return;

      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        setStatus("Đang phân tích dữ liệu...");
        verifyFace(Array.from(detection.descriptor));
      } else {
        setStatus("Sẵn sàng. Hãy đưa mặt vào khung hình");
      }
    }, 1500);
  };

  // HÀM: Gửi dữ liệu xuống Backend kiểm tra
  const verifyFace = async (liveDescriptor) => {
    try {
      // Tạm dừng quét để chờ kết quả từ Server
      clearInterval(scanInterval.current);

      const response = await fetch(`${BACKEND_URL}/api/locker/verify-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveDescriptor })
      });
      const data = await response.json();

      if (data.success) {
        // 1. MỞ KHÓA THÀNH CÔNG
        setIsSuccess(true);
        setMatchedName(data.username);
        
        // 2. PHÁT GIỌNG NÓI AI
        speakAI(`Xin chào ${data.username}, tủ của bạn đã được mở.`);

        // 3. CHỜ 3 GIÂY RỒI QUAY LẠI TỪ ĐẦU
        setTimeout(() => {
          setIsSuccess(false);
          setMatchedName("");
          setStatus("Sẵn sàng. Hãy đưa mặt vào khung hình");
          handleVideoPlay(); // Tiếp tục vòng lặp quét
        }, 3000);
        
      } else {
        setStatus(data.message || "Khuôn mặt chưa đăng ký!");
        setTimeout(handleVideoPlay, 1500); // Lỗi thì 1.5s sau quét lại
      }
    } catch (error) {
      setStatus("Lỗi kết nối máy chủ!");
      setTimeout(handleVideoPlay, 2000);
    }
  };

  // NẾU THÀNH CÔNG: Hiển thị toàn màn hình màu xanh lá
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-500 text-white p-4 text-center">
        <h1 className="text-5xl font-bold mb-6">✓ MỞ KHÓA THÀNH CÔNG</h1>
        <p className="text-3xl font-semibold mb-2">Xin chào, {matchedName}!</p>
        <p className="text-lg opacity-80 mt-8">Hệ thống sẽ tự động đóng sau 3 giây...</p>
      </div>
    );
  }

  // NẾU BÌNH THƯỜNG: Hiển thị khung quét (Đã bỏ nhập tên)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-blue-400 mb-6">myCTU - SMART LOCKER</h2>
        <div className="relative w-64 h-64 bg-black rounded-full overflow-hidden border-4 border-blue-500 mb-6 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <video 
            ref={videoRef} 
            onPlay={handleVideoPlay} 
            autoPlay 
            muted 
            playsInline // Quan trọng cho điện thoại iOS
            className="absolute top-0 left-0 w-full h-full object-cover" 
          />
        </div>
        <p className="text-center text-md font-semibold text-yellow-400 h-8">{status}</p>
      </div>
    </div>
  );
};

export default FaceUnlock;