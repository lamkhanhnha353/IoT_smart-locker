import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import axios from 'axios'; // Bổ sung import axios

const FaceRegistration = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  
  const stepRef = useRef(0); 
  const firstDescriptorRef = useRef(null);

  const [step, setStep] = useState(0); 
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [statusText, setStatusText] = useState("Đang tải AI...");
  const [progress, setProgress] = useState(0);
  
  const updateStep = (newStep) => {
    stepRef.current = newStep;
    setStep(newStep);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const vibrate = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
        setStatusText("Sẵn sàng! Vui lòng làm theo hướng dẫn.");
      } catch (error) {
        setStatusText("Lỗi tải AI. Vui lòng tải lại trang.");
      }
    };
    loadModels();
  }, []);

  const startProcess = () => {
    updateStep(1);
    setStatusText("Đang quét lần 1. Hãy nhìn thẳng vào camera.");
    vibrate(100);
    
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => alert("Vui lòng cấp quyền Camera!"));
  };

  const handleVideoPlay = () => {
    const scanInterval = setInterval(async () => {
      const currentStep = stepRef.current;
      
      if (currentStep === 0 || currentStep === 1.5 || currentStep === 3 || !videoRef.current) return;

      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const score = detection.detection.score;
        setProgress(score); 

        if (score > 0.85) {
          if (currentStep === 1) {
            clearInterval(scanInterval); 
            firstDescriptorRef.current = Array.from(detection.descriptor);
            vibrate([200, 100, 200]);
            
            updateStep(1.5); 
            setStatusText("Đã lưu lần 1. Nghỉ 3 giây... Hãy chớp mắt hoặc nhúc nhích nhẹ.");
            
            setTimeout(() => {
              updateStep(2);
              setStatusText("Đang quét lần 2 để xác thực...");
              handleVideoPlay(); 
            }, 3000); 
          } 
          
          else if (currentStep === 2 && firstDescriptorRef.current) {
            clearInterval(scanInterval); 
            const secondDescriptor = Array.from(detection.descriptor);
            
            let distance = 0;
            for (let i = 0; i < 128; i++) {
              distance += Math.pow(firstDescriptorRef.current[i] - secondDescriptor[i], 2);
            }
            distance = Math.sqrt(distance);

         
            if (distance < 0.45) {
         
              try {
                const token = localStorage.getItem('token'); 
                
                // ĐÃ SỬA: Thêm tên miền Backend (Render) vào phía trước
                await axios.post('https://iot-smart-locker.onrender.com/api/auth/register-face', {
                  descriptor: firstDescriptorRef.current
                }, {
                  headers: { Authorization: `Bearer ${token}` } 
                });

                localStorage.setItem('hasFaceId', 'true');

                vibrate([500]); 
                speak("Xác thực thành công. Đã lưu vào hệ thống an toàn."); 
                updateStep(3);
                setStatusText("Đăng ký thành công! Đang vào hệ thống...");
                setProgress(1);

                const stream = videoRef.current.srcObject;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                setTimeout(() => {
                  navigate('/dashboard'); 
                }, 2000);
                
              } catch (error) {
                // Nếu Backend báo lỗi (hết hạn token, lỗi DB...)
                vibrate([100, 50, 100]);
                updateStep(1.5);
                setStatusText("Lỗi máy chủ! Không thể lưu dữ liệu. Thử lại...");
                setTimeout(() => {
                  updateStep(2);
                  handleVideoPlay();
                }, 3000);
              }

            } else {
              vibrate([100, 50, 100, 50, 100]);
              updateStep(1.5);
              setStatusText("Không khớp. Chuẩn bị thử lại trong 3 giây...");
              
              setTimeout(() => {
                updateStep(2);
                setStatusText("Đang quét lại lần 2...");
                handleVideoPlay();
              }, 3000);
            }
          }
        }
      } else {
        setProgress(0);
      }
    }, 500);
  };

  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full flex flex-col items-center text-center border border-slate-700">
        
        <h2 className="text-2xl font-black text-blue-400 mb-2">ĐĂNG KÝ FACE ID</h2>
        <p className={`text-sm h-10 ${step === 1.5 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
          {statusText}
        </p>

        <div className="relative w-64 h-64 my-6 flex justify-center items-center">
          {step > 0 && step < 3 && (
            <svg className="absolute top-0 left-0 w-full h-full -rotate-90 z-10" viewBox="0 0 256 256">
              <circle cx="128" cy="128" r={radius} stroke="#334155" strokeWidth="12" fill="none" />
              <circle 
                cx="128" cy="128" r={radius} 
                stroke={step === 1.5 ? "#64748b" : (step === 1 ? "#3b82f6" : "#f59e0b")} 
                strokeWidth="12" fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
          )}

          {step === 3 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-800 rounded-full border-8 border-emerald-500 animate-pulse">
              <span className="text-6xl">✅</span>
            </div>
          )}

          <div className={`w-[200px] h-[200px] rounded-full overflow-hidden bg-black z-0 border-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors ${step === 1.5 ? 'border-amber-500/50 opacity-50' : 'border-slate-700'}`}>
            {step > 0 && step < 3 ? (
              <video 
                ref={videoRef} 
                onPlay={handleVideoPlay} 
                autoPlay muted playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>
            )}
          </div>
        </div>

        {step === 0 && (
          <button 
            onClick={startProcess}
            disabled={!isModelLoaded}
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg text-lg ${isModelLoaded ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
          >
            {isModelLoaded ? "BẮT ĐẦU ĐĂNG KÝ" : "ĐANG TẢI AI..."}
          </button>
        )}
        
        {step === 0 && (
          <button onClick={() => navigate('/dashboard')} className="mt-4 text-slate-400 hover:text-white underline text-sm">
            Quay lại trang chủ
          </button>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;