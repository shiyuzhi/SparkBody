//recognizer.jsx
import React, { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default function Recognizer({ onGestureData }) {
  const videoRef = useRef(null);
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(true); // 預設開啟開關
  const requestRef = useRef();

  // 1. 初始化辨識器模型
  useEffect(() => {
    const initRecognizer = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        setGestureRecognizer(recognizer);
      } catch (err) {
        console.error("Recognizer 初始化失敗:", err);
      }
    };
    initRecognizer();
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  // 核心修改：當模型準備好後，自動啟動相機
  useEffect(() => {
    if (gestureRecognizer && webcamRunning) {
      // 這裡直接呼叫啟動相機的邏輯（不透過按鈕）
      startWebcam();
    }
  }, [gestureRecognizer]); 

  // 將開啟相機邏輯獨立出來，方便重複使用
  const startWebcam = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        setWebcamRunning(true);
      };
    } catch (err) {
      console.error("自動開啟相機失敗:", err);
    }
  };
  // ---------------------------------------------------------

  const predict = () => {
    if (gestureRecognizer && videoRef.current?.readyState === 4) {
      const nowInMs = performance.now();
      const results = gestureRecognizer.recognizeForVideo(videoRef.current, nowInMs);
      if (onGestureData) onGestureData(results.gestures);
    }
    if (webcamRunning) requestRef.current = requestAnimationFrame(predict);
  };

  // 保留手動切換功能
  const toggleWebcam = async () => {
    if (!videoRef.current) return;
    if (webcamRunning) {
      const stream = videoRef.current.srcObject;
      if (stream) stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setWebcamRunning(false);
      if (onGestureData) onGestureData(null);
    } else {
      startWebcam(); // 點擊時啟動
    }
  };

  useEffect(() => {
    if (webcamRunning) requestRef.current = requestAnimationFrame(predict);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, [webcamRunning, gestureRecognizer]); // 加入 gestureRecognizer 確保模型載入後能啟動

  return (
    <div className="d-flex align-items-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      <button 
        onClick={toggleWebcam} 
        className={`btn btn-sm ${webcamRunning ? 'btn-danger' : 'btn-success'}`}
      >
        {webcamRunning ? "Stop Detection" : "Start Detection"}
      </button>
    </div>
  );
}