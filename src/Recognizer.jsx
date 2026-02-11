// Recognizer.jsx 
import React, { useEffect, useRef } from "react";
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default function Recognizer({ onGestureData, isLowEnd = false }) {
  const videoRef = useRef(null);
  const recognizerRef = useRef(null);
  const requestRef = useRef();
  const isInitializing = useRef(false);
  const frameCount = useRef(0);
  const isLowEndRef = useRef(isLowEnd);
  
  // 【新增：穩定器】紀錄上一次成功的數據，用來緩衝消失的瞬間
  const lastValidData = useRef([]);
  const emptyFrameCount = useRef(0);

  useEffect(() => {
    isLowEndRef.current = isLowEnd;
    // 切換時不要立刻清空，改為讓 predict 自己判斷
    console.log(`🚀 效能模式已熱切換為: ${isLowEnd ? "Lite" : "High"}`);
  }, [isLowEnd]);

  useEffect(() => {
    const initRecognizer = async () => {
      if (recognizerRef.current || isInitializing.current) return;
      isInitializing.current = true;

      try {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: isLowEndRef.current ? "CPU" : "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        recognizerRef.current = recognizer;
        startWebcam();
      } catch (err) {
        console.error("❌ Recognizer 初始化失敗:", err);
      } finally {
        isInitializing.current = false;
      }
    };

    initRecognizer();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (recognizerRef.current) recognizerRef.current.close();
      stopWebcam();
    };
  }, []); 

  const startWebcam = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        requestRef.current = requestAnimationFrame(predict);
      };
    } catch (err) {
      console.error("相機存取失敗:", err);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const predict = () => {
    if (recognizerRef.current && videoRef.current?.readyState === 4) {
      frameCount.current++;
      const skipFrames = isLowEndRef.current ? 3 : 1;
      if (frameCount.current % skipFrames === 0) {
        const nowInMs = performance.now();
        try {
          const results = recognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);
          
          if (onGestureData) {
            if (!results.gestures || results.gestures.length === 0) {
              emptyFrameCount.current++;
              if (emptyFrameCount.current > 2) { 
                onGestureData([]);
                lastValidData.current = [];
              }
            } else {
              emptyFrameCount.current = 0;
              lastValidData.current = results.gestures;
              onGestureData(results.gestures);
            }
          }
        } catch (e) { /* 靜默 */ }
      }
    }
    requestRef.current = requestAnimationFrame(predict);
  };

  return (
    <video ref={videoRef} autoPlay playsInline muted style={{ position: "absolute", width: "1px", height: "1px", opacity: 0 }} />
  );
}