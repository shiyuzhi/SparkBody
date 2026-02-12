// PoseSkeleton.jsx
import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate, onGestureData, hideCanvas = false, isLowEnd = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameCount = useRef(0);
  const holisticRef = useRef(null);
  const isLowEndRef = useRef(isLowEnd);

  // 緩衝最後一次有效的座標資料
  // 當 AI 因為跳幀沒運算時，Canvas 依然可以拿這個資料來畫，防止「骨架消失」導致的閃爍
  const lastResultsRef = useRef(null);

  useEffect(() => {
    isLowEndRef.current = isLowEnd;
    if (holisticRef.current) {
      holisticRef.current.setOptions({
        modelComplexity: isLowEnd ? 0 : 1,
        smoothLandmarks: !isLowEnd,
        minDetectionConfidence: isLowEnd ? 0.4 : 0.5,
        minTrackingConfidence: isLowEnd ? 0.4 : 0.5,
      });
    }
    console.log(`🦴 模式即時切換為: ${isLowEnd ? "低耗電" : "高效能"}`);
  }, [isLowEnd]);

  useEffect(() => {
    let isMounted = true;

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });
    holisticRef.current = holistic;

    // 在元件外部或 useEffect 前定義要排除的索引
    // 13-15 (左前臂), 14-16 (右前臂), 以及手掌相關點
    const EXCLUDED_INDICES = [9,10,13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    const draw = (results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (hideCanvas || !ctx || !results) return;

      // 確保畫布尺寸同步（防止變形導致的線條偏離）
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      const lineW = isLowEndRef.current ? 3 : 6;
      const colorPose = "#e6ffdf"; // 身體顏色
      const colorHand = "#ffffff"; // 手部顏色

      // --- 1. 畫身體骨架 (過濾掉前臂與手掌) ---
      if (results.poseLandmarks) {
        // 關鍵：只保留「不包含前臂端點」的連線
        const poseSafeConnections = POSE_CONNECTIONS.filter(([a, b]) => 
          !EXCLUDED_INDICES.includes(a) || !EXCLUDED_INDICES.includes(b)
        );

        drawConnectors(ctx, results.poseLandmarks, poseSafeConnections, { 
          color: colorPose, 
          lineWidth: lineW 
        });
        
        if (!isLowEndRef.current && results.poseLandmarks[0]) {
          drawSmile(ctx, results.poseLandmarks, canvas.width, canvas.height);
        }
      }

      // --- 2. 橋接邏輯函數 (單一控制權) ---
      const drawBridgeForearm = (elbowIdx, wristIdx, handLandmarks) => {
      const elbow = results.poseLandmarks?.[elbowIdx];
      const poseWrist = results.poseLandmarks?.[wristIdx];
      if (!elbow) return;

      ctx.beginPath();
      ctx.lineWidth = lineW;
      ctx.strokeStyle = colorPose;
      ctx.lineCap = "round";
      ctx.moveTo(elbow.x * canvas.width, elbow.y * canvas.height);

      if (handLandmarks?.[0]) {
        // A：偵測到手掌，直接連到手心
        ctx.lineTo(handLandmarks[0].x * canvas.width, handLandmarks[0].y * canvas.height);
        ctx.stroke();
      } else if (poseWrist && poseWrist.visibility > 0.5) {
        //  B：手掌消失，連到 Pose 模型的手腕點
        ctx.lineTo(poseWrist.x * canvas.width, poseWrist.y * canvas.height);
        ctx.stroke();

        // 在手腕處畫一個圓點，讓「手掌不見」時看起來像個關節點，而不是斷肢
        ctx.beginPath();
        ctx.arc(poseWrist.x * canvas.width, poseWrist.y * canvas.height, lineW * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = colorPose;
        ctx.fill();
      } else {
        ctx.stroke(); // 只有手肘的情況
      }
    };
      // --- 3. 畫左手與橋接 ---
      drawBridgeForearm(13, 15, results.leftHandLandmarks);
      if (results.leftHandLandmarks) {
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { 
          color: colorHand, 
          lineWidth: lineW - 1 
        });
      }

      // --- 4. 畫右手與橋接 ---
      drawBridgeForearm(14, 16, results.rightHandLandmarks);
      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { 
          color: colorHand, 
          lineWidth: lineW - 1 
        });
      }

      ctx.restore();
    };
    holistic.onResults((results) => {
      if (!isMounted) return;
      
      // 【更新緩衝】只要 AI 有產出，就存進緩衝區
      lastResultsRef.current = results;

      // --- 手勢辨識與資料回傳邏輯 ---
      const detectGesture = (handLandmarks) => {
        if (!handLandmarks) return "None";
        const thumbUp = handLandmarks[4].y < handLandmarks[2].y - 0.04;
        const indexUp = handLandmarks[8].y < handLandmarks[5].y - 0.04;
        const middleUp = handLandmarks[12].y < handLandmarks[9].y - 0.04;
        const ringUp = handLandmarks[16].y < handLandmarks[13].y - 0.04;
        if (thumbUp && !indexUp && !middleUp) return "Thumb_Up";
        if (indexUp && middleUp && !ringUp) return "Victory";
        if (indexUp && middleUp && ringUp) return "Open_Palm";
        return "Closed_Fist";
      };

      const leftG = detectGesture(results.leftHandLandmarks);
      const rightG = detectGesture(results.rightHandLandmarks);

      if (onGestureData) onGestureData([[{ categoryName: leftG }], [{ categoryName: rightG }]]);
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

      // 執行繪圖
      draw(results);
    });

    function drawSmile(ctx, landmarks, w, h) {
      const nose = landmarks[0];
      const leftEye = landmarks[1];
      const rightEye = landmarks[4];
      if (!nose || !leftEye || !rightEye) return;
      const eyeDist = Math.abs(leftEye.x - rightEye.x);
      const mouthY = (nose.y + eyeDist * 0.8) * h;
      const mouthWidth = eyeDist * w * 0.8;
      ctx.beginPath();
      ctx.moveTo(nose.x * w - mouthWidth / 2, mouthY);
      ctx.quadraticCurveTo(nose.x * w, mouthY + (eyeDist * h * 0.4), nose.x * w + mouthWidth / 2, mouthY);
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
          const skipThreshold = isLowEndRef.current ? 2 : 1;
          
          if (frameCount.current % skipThreshold === 0) {
            await holistic.send({ image: videoRef.current });
          } else {
            // 在被跳過的幀，手動調用 draw() 並傳入 lastResultsRef。
            // 這能讓 Canvas 維持在 60fps 重繪，消除低耗電模式下的「閃爍」與「分離感」。
            if (lastResultsRef.current) {
              draw(lastResultsRef.current);
            }
          }
        },
        width: 320,
        height: 240,
      });
      camera.start().catch((err) => console.warn("Camera failed:", err));
    }

    return () => {
      isMounted = false;
      if (camera) camera.stop();
      if (holistic) holistic.close();
    };
  }, [onPoseUpdate, onGestureData, hideCanvas]);

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