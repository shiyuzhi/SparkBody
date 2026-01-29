// Recognizer.jsx 
import React, { useEffect, useRef } from "react";
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default function Recognizer({ onGestureData, isLowEnd = false }) {
  const videoRef = useRef(null);
  const recognizerRef = useRef(null);
  const requestRef = useRef();
  const isInitializing = useRef(false);
  const frameCount = useRef(0);

  useEffect(() => {
    const initRecognizer = async () => {
      //始化或正在處理中，則跳過
      if (recognizerRef.current || isInitializing.current) return;
      isInitializing.current = true;

      try {
        // 讓出主執行緒給 PoseSkeleton 先初始化
        // 解決 "Module.arguments" 錯誤最簡單有效的辦法
        await new Promise((resolve) => setTimeout(resolve, 2500));

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            // 文書機建議強制 CPU，因為 MediaPipe 的 GPU delegate 在無外顯機器上極不穩定
            delegate: isLowEnd ? "CPU" : "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        recognizerRef.current = recognizer;
        console.log(`✅ Recognizer 已啟動 (${isLowEnd ? "節能模式" : "高效模式"})`);
        startWebcam();
      } catch (err) {
        console.error("❌ Recognizer 初始化失敗，可能是 WASM 衝突:", err);
      } finally {
        isInitializing.current = false;
      }
    };

    initRecognizer();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (recognizerRef.current) {
        recognizerRef.current.close();
        recognizerRef.current = null;
      }
      stopWebcam();
    };
  }, [isLowEnd]); // 當效能模式切換時重新啟動

  const startWebcam = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // 文書機與手機降低解析度到 160p
        video: { 
          width: isLowEnd ? 160 : 320, 
          height: isLowEnd ? 120 : 240, 
          facingMode: "user" 
        }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        requestRef.current = requestAnimationFrame(predict);
      };
    } catch (err) {
      console.error("相機存取被拒絕:", err);
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

      // 效能分級：跳幀處理 
      // 高階機 1:1 辨識 (60fps)
      // 文書機 1:4 辨識 (約 15fps)，煙火觸發，且 CPU 佔用降低 
      const skipFrames = isLowEnd ? 4 : 1;

      if (frameCount.current % skipFrames === 0) {
        const nowInMs = performance.now();
        try {
          const results = recognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);
          if (onGestureData && results.gestures) {
            onGestureData(results.gestures);
          }
        } catch (e) {
          // 捕捉熱更新或切換時的短暫 WASM 錯誤
        }
      }
    }
    requestRef.current = requestAnimationFrame(predict);
  };

  return (
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
  );
}