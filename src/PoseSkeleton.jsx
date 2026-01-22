import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
 
  //記錄上一幀頭部位置的 Ref ---
  const lastHeadPos = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const holistic = new Holistic({
       locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineLandmarks: true,
    });

    holistic.onResults((results) => {
      if (!isMounted || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // 判斷頭是否移動
      let isHeadMoving = false;
      const currentHead = results.poseLandmarks?.[0]; // 0 號點是鼻尖 (Nose)

      if (currentHead && lastHeadPos.current) {
        // 計算當前點與上一個點的距離
        const dx = currentHead.x - lastHeadPos.current.x;
        const dy = currentHead.y - lastHeadPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // 若距離大於此值，視為頭部有在動
        const THRESHOLD = 0.05; 
        if (distance > THRESHOLD) {
          isHeadMoving = true;
        }
      }

      // 更新 Ref 
      if (currentHead) {
        lastHeadPos.current = { x: currentHead.x, y: currentHead.y };
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#ebe8e8", lineWidth: 1 });
      }
      if (results.leftHandLandmarks) {
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: "white", lineWidth: 1 });
      }
      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: "white", lineWidth: 1 });
      }

      if (onPoseUpdate) {
        const flip = (lm) => (lm ? { x: 1 - lm.x, y: lm.y, visibility: lm.visibility ?? 1 } : null);
        onPoseUpdate({
          head: flip(currentHead),
          leftHand: flip(results.leftHandLandmarks?.[8] || results.poseLandmarks?.[15]),
          rightHand: flip(results.rightHandLandmarks?.[8] || results.poseLandmarks?.[16]),
          leftKnee: flip(results.poseLandmarks?.[25]),
          rightKnee: flip(results.poseLandmarks?.[26]),
          // --- 新增：將判斷結果傳給父組件 ---
          isHeadMoving: isHeadMoving, 
        });
      }
      ctx.restore();
    });

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (isMounted && videoRef.current) await holistic.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => {
      isMounted = false;
      if (camera) camera.stop();
      holistic.close();
    };
  }, [onPoseUpdate]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "black" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
       <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
