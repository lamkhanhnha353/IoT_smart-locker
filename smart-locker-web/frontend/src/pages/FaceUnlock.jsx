import  { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceUnlock = () => {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState("Đang khởi động AI...");
  const [viewState, setViewState] = useState("scanning");
  const [matchedName, setMatchedName] = useState("");
  
  // STATE MỚI: Lưu trữ điểm số nhận diện thật của AI (từ 0 đến 1)
  const [faceScore, setFaceScore] = useState(0); 
  const [circleColor, setCircleColor] = useState("#3b82f6"); // Màu vòng tròn (Mặc định: Blue)

  const scanInterval = useRef(null);
  const BACKEND_URL = "https://iot-smart-locker.onrender.com";

  // --- TOÁN HỌC CHO VÒNG TRÒN SVG ---
  const radius = 116; // Bán kính vòng tròn
  const circumference = 2 * Math.PI * radius; // Chu vi
  const strokeDashoffset = circumference - faceScore * circumference; // Độ dài đoạn bị che khuất

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
        setStatus("Sẵn sàng. Hãy nhìn thẳng vào Camera");
      } catch (error) {
        setStatus("Lỗi tải model AI!");
      }
    };
    loadModels();
    return () => clearInterval(scanInterval.current);
  }, []);

  useEffect(() => {
    if (viewState === 'scanning' && isModelLoaded) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(() => setStatus("Lỗi: Vui lòng cấp quyền Camera!"));
    }
  }, [viewState, isModelLoaded]);

  const handleVideoPlay = () => {
    // Quét mỗi 500ms để vòng tròn cập nhật liên tục và mượt mà
    scanInterval.current = setInterval(async () => {
      if (viewState !== 'scanning' || !videoRef.current) return;

      // Hạ ngưỡng xuống 0.1 để AI bắt đầu tính điểm ngay khi lờ mờ thấy mặt
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.1 }) 
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const score = detection.detection.score; // Lấy điểm thực tế từ AI
        setFaceScore(score);

        if (score >= 0.8) {
          // ĐẠT CHUẨN > 80%: Dừng quét, đổi màu vàng, gọi Backend
          clearInterval(scanInterval.current);
          setCircleColor("#facc15"); // Màu vàng
          setStatus("Khuôn mặt đạt chuẩn. Đang xác thực...");
          verifyFace(Array.from(detection.descriptor));
        } else {
          // CHƯA ĐẠT: Hiện số % để người dùng tự điều chỉnh góc mặt
          setCircleColor("#ef4444"); // Màu đỏ cảnh báo chưa đủ nét
          setStatus(`Độ rõ nét: ${(score * 100).toFixed(0)}% - Cần đạt 80%`);
        }
      } else {
        setFaceScore(0);
        setCircleColor("#3b82f6");
        setStatus("Không tìm thấy khuôn mặt!");
      }
    }, 500);
  };

  const verifyFace = async (liveDescriptor) => {
   try {
      // Đã sửa lại đường dẫn gọn gàng
      const response = await fetch(`${BACKEND_URL}/api/locker/verify-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveDescriptor })
      });
      const data = await response.json();

      if (data.success) {
        // THÀNH CÔNG
        setCircleColor("#22c55e"); // Xanh lá
        setMatchedName(data.username);
        setViewState("success");

        setTimeout(() => setViewState("options"), 3000);
      } else {
        // LỖI SAI NGƯỜI
        setCircleColor("#ef4444"); // Đỏ
        setFaceScore(1); // Cho vòng tròn đỏ đầy 100% để báo lỗi
        setStatus("Cảnh báo: Khuôn mặt lạ hoặc chưa đăng ký!");
        
        setTimeout(() => {
          setFaceScore(0);
          setStatus("Sẵn sàng. Hãy nhìn thẳng vào Camera");
          handleVideoPlay();
        }, 2500);
      }
    } catch (error) {
      setStatus("Lỗi kết nối máy chủ!");
      setTimeout(handleVideoPlay, 2000);
    }
  };

  const handleExit = () => {
    setFaceScore(0);
    setCircleColor("#3b82f6");
    setStatus("Sẵn sàng. Hãy nhìn thẳng vào Camera");
    setViewState("scanning");
  };

  if (viewState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-600 text-white p-4 text-center">
        <h1 className="text-5xl font-bold mb-6">✓ ĐÃ MỞ TỦ</h1>
        <p className="text-3xl font-semibold mb-2">Xin chào, {matchedName}!</p>
        <p className="text-lg mt-8 animate-pulse">Vui lòng cất đồ và đóng cửa tủ...</p>
      </div>
    );
  }

  if (viewState === 'options') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center">
          <h2 className="text-2xl font-bold text-white mb-8">Bạn muốn làm gì tiếp theo?</h2>
          <div className="flex flex-col w-full gap-4">
            <button onClick={() => window.location.href = '/dashboard'} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg transition-all">
              📊 VÀO TRANG CHỦ (DASHBOARD)
            </button>
            <button onClick={handleExit} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold text-lg transition-all">
              🔙 THOÁT VÀ QUÉT LẠI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-blue-400 mb-8">myCTU - SMART LOCKER</h2>
        
        {/* VÙNG CAMERA VÀ VÒNG TRÒN DỮ LIỆU THẬT */}
        <div className="relative w-64 h-64 mb-8 flex justify-center items-center">
          
          {/* Vòng tròn SVG hiển thị tỷ lệ % */}
          <svg className="absolute top-0 left-0 w-full h-full -rotate-90 z-10" viewBox="0 0 256 256">
            {/* Vòng nền mờ */}
            <circle cx="128" cy="128" r={radius} stroke="#374151" strokeWidth="12" fill="none" opacity="0.5" />
            {/* Vòng chạy thực tế */}
            <circle 
              cx="128" cy="128" r={radius} 
              stroke={circleColor} strokeWidth="12" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 ease-linear" // Cực kỳ quan trọng để vòng tròn chạy mượt
            />
          </svg>
          
          {/* Khung Video */}
          <div className="w-[240px] h-[240px] rounded-full overflow-hidden bg-black z-0">
            <video 
              ref={videoRef} 
              onPlay={handleVideoPlay} 
              autoPlay muted playsInline 
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
          </div>
        </div>
        
        <p className="text-center text-md font-semibold text-yellow-400 h-8">{status}</p>
      </div>
    </div>
  );
};

export default FaceUnlock;