import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate }) { // 接收父組件傳來的 function
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results) => {
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // 1. 繪製黑色背景
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 檢查偵測結果
      if (results.poseLandmarks) {
        // 畫純白骨架線 (不要畫紅點圖)
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: "white", 
          lineWidth: 2,
        });

        // 3. 提取指定的 5 個關鍵點座標並回傳給 Fireworks
        if (onPoseUpdate) {
          onPoseUpdate({
            head: results.poseLandmarks[0],      // 鼻子
            rightHand: results.poseLandmarks[16], // 右手腕
            leftHand: results.poseLandmarks[15],  // 左手腕
            rightKnee: results.poseLandmarks[26], // 右膝
            leftKnee: results.poseLandmarks[25],  // 左膝
          });
        }
      }
      ctx.restore();
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => holistic.close();
  }, [onPoseUpdate]); // 當 function 改變時重新綁定

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ width: "100%", height: "auto", border: "1px solid #444" }}
      />
    </div>
  );
}