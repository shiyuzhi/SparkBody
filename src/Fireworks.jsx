// Fireworks.jsx
import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,      // 0 為最速，1 為平衡
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineLandmarks: true,   
    });

    holistic.onResults((results) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 鏡像模式（繪製用）
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      // 繪製身體骨架與手部線條
      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#FFFFFF44", lineWidth: 2 });
      }
      if (results.leftHandLandmarks) {
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: "white", lineWidth: 1 });
      }
      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: "white", lineWidth: 1 });
      }

      // 鏡像轉換並回傳座標給父組件
      if (onPoseUpdate) {
        const flip = (lm) => (lm ? { x: 1 - lm.x, y: lm.y, visibility: lm.visibility ?? 1 } : null);

        onPoseUpdate({
          head: flip(results.poseLandmarks?.[0]),
          // 取食指尖 (Index Tip)偵測不到則回退至手腕 (Wrist)
          leftHand: flip(results.leftHandLandmarks?.[8] || results.poseLandmarks?.[15]),
          rightHand: flip(results.rightHandLandmarks?.[8] || results.poseLandmarks?.[16]),
          leftKnee: flip(results.poseLandmarks?.[25]),
          rightKnee: flip(results.poseLandmarks?.[26]),
        });
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
  }, [onPoseUpdate]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "black" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas ref={canvasRef} width={640} height={480} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}