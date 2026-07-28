import  { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';

const FaceTest = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models'; 
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Lỗi nạp model", err);
      }
    };
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => { videoRef.current.srcObject = stream; })
      .catch((err) => console.error("Lỗi camera", err));
  };

  const handleVideoOnPlay = () => {
    setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
        const canvas = canvasRef.current;
        const displaySize = { width: videoRef.current.width, height: videoRef.current.height };
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }
    }, 100);
  };

  // HÀM 1: LƯU KHUÔN MẶT
  const captureAndSaveFace = async () => {
    if (!username) return alert("Vui lòng nhập tên tài khoản trước!");

    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor(); 

    if (!detection) return alert("Không thấy rõ khuôn mặt!");

    const faceData = Array.from(detection.descriptor); 
    try {
      const res = await axios.post('http://localhost:5000/api/register-face', {
        username: username,
        descriptor: faceData
      });
      alert(res.data.message);
    } catch (error) {
      alert(error.response?.data?.message || "Lỗi lưu khuôn mặt!");
    }
  };

  // HÀM 2: XÁC THỰC KHUÔN MẶT
  const verifyFace = async () => {
    if (!username) return alert("Vui lòng nhập tên tài khoản!");

    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor(); 

    if (!detection) return alert("Không thấy rõ khuôn mặt!");

    const liveFaceData = Array.from(detection.descriptor);

    try {
      const res = await axios.post('http://localhost:5000/api/verify-face', {
        username: username,
        liveDescriptor: liveFaceData
      });
      alert(`✅ ${res.data.message}`);
    } catch (error) {
      alert(`❌ ${error.response?.data?.message || "Lỗi xác thực!"}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white space-y-4">
      <h1 className="text-2xl font-bold">PHÒNG THÍ NGHIỆM FACE ID</h1>
      
      {!isModelLoaded ? (
        <p className="text-amber-400">Đang nạp AI...</p>
      ) : (
        <button onClick={startVideo} className="bg-blue-600 px-6 py-2 rounded-xl font-bold">Bật Camera</button>
      )}

      <div className="relative border-4 border-slate-700 rounded-xl overflow-hidden bg-black">
        <video ref={videoRef} autoPlay muted width="640" height="480" onPlay={handleVideoOnPlay} />
        <canvas ref={canvasRef} className="absolute top-0 left-0 z-10" />
      </div>

      <div className="flex space-x-2 mt-4 pb-10">
        <input 
          type="text" 
          placeholder="Nhập tên tài khoản..." 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-4 py-2 text-white rounded-lg outline-none"
        />
        <button onClick={captureAndSaveFace} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold shadow">
          1. Đăng ký Mặt
        </button>
        <button onClick={verifyFace} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow animate-pulse">
          2. Quét Mở Khóa
        </button>
      </div>
    </div>
  );
};

export default FaceTest;