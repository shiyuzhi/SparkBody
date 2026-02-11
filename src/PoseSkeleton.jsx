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

    // 將繪圖邏輯獨立出來
    // 【橋接手腕與手掌，解決斷裂感】
    const draw = (results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (hideCanvas || !ctx || !results) return;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      const lineW = isLowEndRef.current ? 3 : 6;
      const colorPose = "#e6ffdf"; // 身體顏色 (淡綠)
      const colorHand = "#ffffff"; // 手部顏色 (純白)

      // 先畫身體骨架
      if (results.poseLandmarks) {
        const palmIndices = [9, 10, 17, 18, 19, 20, 21, 22];
        const poseNoPalm = POSE_CONNECTIONS.filter(([a, b]) => !palmIndices.includes(a) && !palmIndices.includes(b));
        drawConnectors(ctx, results.poseLandmarks, poseNoPalm, { color: colorPose, lineWidth: lineW });
        
        if (!isLowEndRef.current && results.poseLandmarks[0]) {
          drawSmile(ctx, results.poseLandmarks, canvas.width, canvas.height);
        }
      }

      // ⚡【新增邏輯：強制畫出銜接線】
      // 目的：把 Pose 模型的手腕 (15, 16) 跟 Hand 模型的手掌起點 (0) 連起來
      const bridgeWrist = (poseIdx, handLandmarks) => {
        if (results.poseLandmarks?.[poseIdx] && handLandmarks?.[0]) {
          const pWrist = results.poseLandmarks[poseIdx]; // 身體模型的手腕
          const hPalm = handLandmarks[0];               // 手部模型的手掌根
          
          ctx.beginPath();
          ctx.moveTo(pWrist.x * canvas.width, pWrist.y * canvas.height);
          ctx.lineTo(hPalm.x * canvas.width, hPalm.y * canvas.height);
          ctx.strokeStyle = colorPose; // 使用身體色作為連接色
          ctx.lineWidth = lineW;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      };

      // 畫左手橋接
      if (results.leftHandLandmarks) {
        bridgeWrist(15, results.leftHandLandmarks); // 連接左手腕
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: colorHand, lineWidth: lineW - 1 });
      }

      // 右手橋接
      if (results.rightHandLandmarks) {
        bridgeWrist(16, results.rightHandLandmarks); // 連接右手腕
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: colorHand, lineWidth: lineW - 1 });
      }

      ctx.restore();
    };
    holistic.onResults((results) => {
      if (!isMounted) return;
      
      // ⚡【註解：更新緩衝】只要 AI 有產出，就存進緩衝區
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
            // ⚡【註解：補幀渲染】
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