//recognizer.jsx
import React, { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default function Recognizer({ onGestureData }) {
  const videoRef = useRef(null);
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const requestRef = useRef();

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

  const predict = () => {
    // 即使影片隱藏，readyState 依然要是 4 (HAVE_ENOUGH_DATA) 才能辨識
    if (gestureRecognizer && videoRef.current?.readyState === 4) {
      const nowInMs = performance.now();
      const results = gestureRecognizer.recognizeForVideo(videoRef.current, nowInMs);
      if (onGestureData) onGestureData(results.gestures);
    }
    if (webcamRunning) requestRef.current = requestAnimationFrame(predict);
  };

  const toggleWebcam = async () => {
    if (!videoRef.current) return;
    
    if (webcamRunning) {
      const stream = videoRef.current.srcObject;
      if (stream) stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setWebcamRunning(false);
      if (onGestureData) onGestureData(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setWebcamRunning(true);
        };
      } catch (err) {
        alert("無法開啟相機: " + err.message);
      }
    }
  };

  useEffect(() => {
    if (webcamRunning) requestRef.current = requestAnimationFrame(predict);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, [webcamRunning]);

  return (
    <div className="d-flex align-items-center">
      {/* 關鍵：video 必須存在於 DOM 中，但我們把它徹底隱藏 */}
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