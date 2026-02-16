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
  const lastResultsRef = useRef(null);

  // 距離計算輔助函數：$d = \sqrt{(x_1-x_2)^2 + (y_1-y_2)^2}$
  const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

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
  }, [isLowEnd]);

  useEffect(() => {
    let isMounted = true;
    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}?v=1`,
    });
    holisticRef.current = holistic;

    // 排除前臂與掌部索引，避免重複連線
    const EXCLUDED_INDICES = [9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    //  手
    const PROFESSOR_HAND_CONNECTIONS = [
      // 大拇指 (維持不變)
      [0, 1], [1, 2], [2, 3], [3, 4],
      // 四指 (去掉 5-0，改為  17-0 保持基座連線)
      [5, 6], [6, 7], [7, 8],     // 食指
      [9, 10], [10, 11], [11, 12], 
      [13, 14], [14, 15], [15, 16],
      [17, 18], [18, 19], [19, 20], [17, 0], 
      [2, 5], 
      
      // 補上掌骨橫向連線
      [5, 9], [9, 13], [13, 17]
    ];

    const draw = (results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (hideCanvas || !ctx || !results) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0); 
      ctx.scale(-1, 1);

      const lineW = isLowEndRef.current ? 3 : 6;
      const colorPose = "#e6ffdf"; 
      const colorHand = "#ffffff"; 

      // 1. 繪製身體骨架
      if (results.poseLandmarks) {
        const poseSafeConnections = POSE_CONNECTIONS.filter(([a, b]) => 
          !EXCLUDED_INDICES.includes(a) || !EXCLUDED_INDICES.includes(b)
        );
        drawConnectors(ctx, results.poseLandmarks, poseSafeConnections, { color: colorPose, lineWidth: lineW });
        
        // 繪製笑臉
        drawSmile(ctx, results.poseLandmarks, canvas.width, canvas.height);
      }

      // 2. 強化版橋接邏輯：防止斷肢
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
          ctx.lineTo(handLandmarks[0].x * canvas.width, handLandmarks[0].y * canvas.height);
          ctx.stroke();
        } else if (poseWrist && poseWrist.visibility > 0.5) {
          // 手掌消失時，備援連到手腕點
          ctx.lineTo(poseWrist.x * canvas.width, poseWrist.y * canvas.height);
          ctx.stroke();
          // 手腕關節點
          ctx.beginPath();
          ctx.arc(poseWrist.x * canvas.width, poseWrist.y * canvas.height, lineW * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = colorPose;
          ctx.fill();
        }
      };

      // 左右手與橋接
      drawBridgeForearm(13, 15, results.leftHandLandmarks);
      if (results.leftHandLandmarks) {
        // 這裡原本是 HAND_CONNECTIONS，現在換成我們自定義的規則
        drawConnectors(ctx, results.leftHandLandmarks, PROFESSOR_HAND_CONNECTIONS, { 
          color: colorHand, 
          lineWidth: lineW - 1 
        });
      }
      drawBridgeForearm(14, 16, results.rightHandLandmarks);
      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, PROFESSOR_HAND_CONNECTIONS, { 
          color: colorHand,
           lineWidth: lineW - 1 
        });
      }
      ctx.restore();
    };

    holistic.onResults((results) => {
      if (!isMounted) return;
      lastResultsRef.current = results;

      // 手勢辨識的核心優化：距離基準 + 拓樸結構 + Y 軸判定
      const detectGesture = (handLM) => {
        if (!handLM) return "None";
        const palmBase = dist(handLM[0], handLM[5]);
        const indexRatio = dist(handLM[8], handLM[0]) / palmBase;
        const middleRatio = dist(handLM[12], handLM[0]) / palmBase;
        const ringRatio = dist(handLM[16], handLM[0]) / palmBase;
        const isCurled = dist(handLM[8], handLM[0]) < dist(handLM[6], handLM[0]);
        // Y 座標判定 (垂直時反應最快)
        const indexUpY = handLM[8].y < handLM[5].y - 0.03;
        const middleUpY = handLM[12].y < handLM[9].y - 0.03;
        const ringUpY = handLM[16].y < handLM[13].y - 0.03;

        //  Victory (保持原樣)
        if (indexRatio > 1.6 && middleRatio > 1.6 && ringRatio < 1.4) return "Victory"
        // Open_Palm (修改點：增加距離比例判定，防止倒手掌時 Y 軸失效)
        // 只要 (三指 Y 軸都向上) 或者 (三指比例都夠長)，就判定為張開
        if ((indexUpY && middleUpY && ringUpY) || (indexRatio > 1.7 && middleRatio > 1.7 && ringRatio > 1.6)) {
          return "Open_Palm";
        }
        // 3. Closed_Fist (修改點：只有當「食指或中指」真的縮短時，才算握拳)
        // 這樣你單伸食指時，indexRatio 很大但 middleRatio 很小，會進入這裡維持蓄力
        if (indexRatio < 1.5 || middleRatio < 1.5 || isCurled) {
          return "Closed_Fist";
        }
        return "None";
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
      ctx.lineWidth = isLowEndRef.current ? 4 : 6;
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
          } else if (lastResultsRef.current) {
            // 跳幀時持續重繪最後數據，消除閃爍
            draw(lastResultsRef.current);
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
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain", background: "transparent", pointerEvents: "none", zIndex: 1, display: hideCanvas ? "none" : "block" }} />
    </div>
  );
}