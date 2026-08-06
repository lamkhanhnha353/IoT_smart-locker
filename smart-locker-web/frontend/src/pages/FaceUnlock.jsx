import  { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceUnlock = () => {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState("Đang khởi động AI...");
  const [viewState, setViewState] = useState("scanning");
  const [matchedName, setMatchedName] = useState("");
  
  const [faceScore, setFaceScore] = useState(0); 
  const [circleColor, setCircleColor] = useState("#3b82f6"); 

  
  // THÊM CHỐT CHẶN CHỐNG SPAM API
  const isVerifying = useRef(false); 
  

  const scanInterval = useRef(null);
  const BACKEND_URL = "https://iot-smart-locker.onrender.com";

  const radius = 116; 
  const circumference = 2 * Math.PI * radius; 
  const strokeDashoffset = circumference - faceScore * circumference; 

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
      } catch {    //catch (error)
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
    scanInterval.current = setInterval(async () => {
      // NẾU ĐANG GỬI API RỒI THÌ RETURN LUÔN, KHÔNG QUÉT NỮA
      if (viewState !== 'scanning' || !videoRef.current || isVerifying.current) return;

      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.1 }) 
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const score = detection.detection.score; 
        setFaceScore(score);

        // KIỂM TRA ĐIỀU KIỆN ĐẠT VÀ CHƯA BỊ KHÓA
        if (score >= 0.8 && !isVerifying.current) {
          isVerifying.current = true; // KHÓA CỬA! KHÔNG CHO QUÉT LẠI
          clearInterval(scanInterval.current);
          setCircleColor("#facc15"); 
          setStatus("Khuôn mặt đạt chuẩn. Đang xác thực...");
          verifyFace(Array.from(detection.descriptor));
        } else if (!isVerifying.current) {
          setCircleColor("#ef4444"); 
          setStatus(`Độ rõ nét: ${(score * 100).toFixed(0)}% - Cần đạt 80%`);
        }
      } else {
        if (!isVerifying.current) {
          setFaceScore(0);
          setCircleColor("#3b82f6");
          setStatus("Không tìm thấy khuôn mặt!");
        }
      }
    }, 500);
  };

  const verifyFace = async (liveDescriptor) => {
   try {
      const response = await fetch(`${BACKEND_URL}/api/locker/verify-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveDescriptor })
      });
      const data = await response.json();

      if (data.success) {
        setCircleColor("#22c55e"); 
        setMatchedName(data.username);
        setViewState("success");

        setTimeout(() => setViewState("options"), 3000);
      } else {
        setCircleColor("#ef4444"); 
        setFaceScore(1); 
        setStatus("Cảnh báo: Khuôn mặt lạ hoặc chưa đăng ký!");
        
        setTimeout(() => {
          setFaceScore(0);
          setStatus("Sẵn sàng. Hãy nhìn thẳng vào Camera");
          isVerifying.current = false; // XÁC THỰC LỖI THÌ MỞ KHÓA CHO QUÉT LẠI
          handleVideoPlay();
        }, 2500);
      }
    } catch {   //catch (error)
      setStatus("Lỗi kết nối máy chủ!");
      setTimeout(() => {
        isVerifying.current = false; // MỞ KHÓA KHI LỖI MẠNG
        handleVideoPlay();
      }, 2000);
    }
  };

  const handleExit = () => {
    setFaceScore(0);
    setCircleColor("#3b82f6");
    setStatus("Sẵn sàng. Hãy nhìn thẳng vào Camera");
    setViewState("scanning");
    isVerifying.current = false; // LÀM MỚI CHỐT CHẶN
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
        
        <div className="relative w-64 h-64 mb-8 flex justify-center items-center">
          <svg className="absolute top-0 left-0 w-full h-full -rotate-90 z-10" viewBox="0 0 256 256">
            <circle cx="128" cy="128" r={radius} stroke="#374151" strokeWidth="12" fill="none" opacity="0.5" />
            <circle 
              cx="128" cy="128" r={radius} 
              stroke={circleColor} strokeWidth="12" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 ease-linear"
            />
          </svg>
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