// PoseSkeleton.jsx
import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate, onGestureData, hideCanvas = false, isLowEnd = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameCount = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 0,
      smoothLandmarks: !isLowEnd,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineLandmarks: false,
    });

    holistic.onResults((results) => {
      if (!isMounted) return;
      const detectGesture = (handLandmarks) => {
        if (!handLandmarks) return "None";
        
        // 檢查拇指、食指、中指、無名指是否伸直
        const thumbUp = handLandmarks[4].y < handLandmarks[2].y - 0.04;
        const indexUp = handLandmarks[8].y < handLandmarks[5].y - 0.04;
        const middleUp = handLandmarks[12].y < handLandmarks[9].y - 0.04;
        const ringUp = handLandmarks[16].y < handLandmarks[13].y - 0.04;

        // 👍 讚只有拇指上
        if (thumbUp && !indexUp && !middleUp) return "Thumb_Up";
        // ✌️ YA食指中指上揚，無名指收合
        if (indexUp && middleUp && !ringUp) return "Victory";
        // 🖐️ 至少食、中、無名指都上揚
        if (indexUp && middleUp && ringUp) return "Open_Palm";

        return "Closed_Fist";
      };

      const leftG = detectGesture(results.leftHandLandmarks);
      const rightG = detectGesture(results.rightHandLandmarks);

      // Recognizer 格式回傳給 App 的 setGestureData ---
      if (onGestureData) {
        onGestureData([
          [{ categoryName: leftG }], // 左手
          [{ categoryName: rightG }]  // 右手
        ]);
      }

      // (整合手勢名稱到 poseData) ---
      if (onPoseUpdate) {
        const flip = (lm) => lm ? { x: lm.x, y: lm.y, visibility: lm.visibility ?? 1 } : null;
        onPoseUpdate({
          head: flip(results.poseLandmarks?.[0]),
          leftHand: flip(results.leftHandLandmarks?.[8] || results.poseLandmarks?.[15]),
          rightHand: flip(results.rightHandLandmarks?.[8] || results.poseLandmarks?.[16]),
          leftKnee: flip(results.poseLandmarks?.[25]),
          rightKnee: flip(results.poseLandmarks?.[26]),
          leftHandGesture: leftG,
          rightHandGesture: rightG
        });
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (hideCanvas || !ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      const lineW = isLowEnd ? 3 : 6;

      if (results.poseLandmarks) {
        const palmIndices = [9, 10, 17, 18, 19, 20, 21, 22];
        const poseNoPalm = POSE_CONNECTIONS.filter(
          ([a, b]) => !palmIndices.includes(a) && !palmIndices.includes(b)
        );
        drawConnectors(ctx, results.poseLandmarks, poseNoPalm, { color: "#e6ffdf", lineWidth: lineW });

        if (!isLowEnd && results.poseLandmarks[0]) {
          drawSmile(ctx, results.poseLandmarks, canvas.width, canvas.height);
        }
      }

      if (results.leftHandLandmarks) 
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: "#ffffff", lineWidth: lineW - 1 });
      if (results.rightHandLandmarks)
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: "#ffffff", lineWidth: lineW - 1 });

      ctx.restore();
    });

    function drawSmile(ctx, landmarks, w, h) {
      const nose = landmarks[0];
      const leftEye = landmarks[1];
      const rightEye = landmarks[4];
      if (!nose || !leftEye || !rightEye) return;
      const eyeDist = Math.abs(leftEye.x - rightEye.x);
      const mouthY = (nose.y + eyeDist * 0.8) * h;
      const mouthWidth = eyeDist * w * 0.8;
      const startX = nose.x * w - mouthWidth / 2;
      const endX = nose.x * w + mouthWidth / 2;
      const controlY = mouthY + (eyeDist * h * 0.4);
      ctx.beginPath();
      ctx.moveTo(startX, mouthY);
      ctx.quadraticCurveTo(nose.x * w, controlY, endX, mouthY);
      ctx.strokeStyle = "#e6ffdf"; 
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (!isMounted || !videoRef.current) return;
          frameCount.current++;
          const skipThreshold = isLowEnd ? 2 : 1;
          if (frameCount.current % skipThreshold === 0) {
            await holistic.send({ image: videoRef.current });
          }
        },
        width: isLowEnd ? 160 : 320,
        height: isLowEnd ? 120 : 240,
      });
      camera.start().catch((err) => console.warn("Camera failed:", err));
    }

    return () => {
      isMounted = false;
      if (camera) camera.stop();
      holistic.close();
    };
  }, [onPoseUpdate, onGestureData, hideCanvas, isLowEnd]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          width: "100%", height: "100%", objectFit: "contain",
          background: "transparent", pointerEvents: "none", zIndex: 1,
          display: hideCanvas ? "none" : "block",
        }}
      />
    </div>
  );
}