// PoseSkeleton.jsx
import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils"; 
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate, onGestureData, hideCanvas = false, isLowEnd = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const holisticRef = useRef(null);
  const isLowEndRef = useRef(isLowEnd);
  const lastResultsRef = useRef(null);

  // 距離計算輔助函數
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

 function drawSmile(ctx, landmarks, w, h) {
    const nose = landmarks[0];
    const lEye = landmarks[1];
    const rEye = landmarks[4];
    if (!nose || !lEye || !rEye) return;

    const centerX = nose.x * w;
    const eyeDist = Math.abs(lEye.x - rEye.x);
    
    // 讓嘴巴位置與寬度更接近 Mr. Happy 的誇張比例
    const mouthY = (nose.y + eyeDist * 0.75) * h;
    const mouthWidth = eyeDist * w * 1.1; 
    const mouthDepth = eyeDist * h * 0.5; // 控制 U 的深度
    const hookSize = 10; // 嘴角小勾勾的大小

    ctx.save();
    ctx.strokeStyle = "white";
    ctx.lineWidth = isLowEndRef.current ? 4 : 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // --- 2. 繪製 Mr. Happy 大寬嘴 ---
    ctx.beginPath();
    // 起點 (左嘴角)
    const leftCornerX = centerX - mouthWidth / 2;
    const rightCornerX = centerX + mouthWidth / 2;
    
    ctx.moveTo(leftCornerX, mouthY);
    // 使用貝茲曲線畫出寬闊的平底 U
    ctx.bezierCurveTo(
      leftCornerX, mouthY + mouthDepth, 
      rightCornerX, mouthY + mouthDepth, 
      rightCornerX, mouthY
    );
    ctx.stroke();

    // 左邊小勾
    ctx.beginPath();
    ctx.moveTo(leftCornerX - 2, mouthY + 5);
    ctx.quadraticCurveTo(leftCornerX - 5, mouthY - hookSize, leftCornerX - 12, mouthY - 2);
    ctx.stroke();

    // 右邊小勾
    ctx.beginPath();
    ctx.moveTo(rightCornerX + 2, mouthY + 5);
    ctx.quadraticCurveTo(rightCornerX + 5, mouthY - hookSize, rightCornerX + 12, mouthY - 2);
    ctx.stroke();

    ctx.restore();
}

  useEffect(() => {
    let isMounted = true;
    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}?v=1`,
    });
    holisticRef.current = holistic;

    const EXCLUDED_INDICES = [9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const PROFESSOR_HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [5, 6], [6, 7], [7, 8],
      [9, 10], [10, 11], [11, 12],
      [13, 14], [14, 15], [15, 16],
      [17, 18], [18, 19], [19, 20], [17, 0],
      [2, 5], [5, 9], [9, 13], [13, 17]
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

      if (results.poseLandmarks) {
        const poseSafeConnections = POSE_CONNECTIONS.filter(([a, b]) =>
          !EXCLUDED_INDICES.includes(a) || !EXCLUDED_INDICES.includes(b)
        );
        drawConnectors(ctx, results.poseLandmarks, poseSafeConnections, { color: colorPose, lineWidth: lineW });
        drawSmile(ctx, results.poseLandmarks, canvas.width, canvas.height);
      }

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
          ctx.lineTo(poseWrist.x * canvas.width, poseWrist.y * canvas.height);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(poseWrist.x * canvas.width, poseWrist.y * canvas.height, lineW * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = colorPose;
          ctx.fill();
        }
      };

      drawBridgeForearm(13, 15, results.leftHandLandmarks);
      if (results.leftHandLandmarks) {
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

      const detectGesture = (handLM) => {
        if (!handLM) return "None";
        const palmBase = dist(handLM[0], handLM[5]);
        const indexRatio = dist(handLM[8], handLM[0]) / palmBase;
        const middleRatio = dist(handLM[12], handLM[0]) / palmBase;
        const ringRatio = dist(handLM[16], handLM[0]) / palmBase;
        const okDistance = dist(handLM[8], handLM[4]) / palmBase;
        const isCurled = dist(handLM[8], handLM[0]) < dist(handLM[6], handLM[0]);
        const indexUpY = handLM[8].y < handLM[5].y - 0.03;
        const middleUpY = handLM[12].y < handLM[9].y - 0.03;
        const ringUpY = handLM[16].y < handLM[13].y - 0.03;

        if (indexRatio > 1.6 && middleRatio > 1.6 && ringRatio < 1.4) return "Victory";
        if (okDistance < 0.5 && middleRatio > 1.5) return "OK";
        if ((indexUpY && middleUpY && ringUpY) || (indexRatio > 1.7 && middleRatio > 1.7 && ringRatio > 1.6)) {
          return "Open_Palm";
        }
        if (indexRatio < 1.5 || middleRatio < 1.5 || isCurled) return "Closed_Fist";
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
          leftElbow: flip(results.poseLandmarks?.[13]),
          rightElbow: flip(results.poseLandmarks?.[14]),
          leftShoulder: flip(results.poseLandmarks?.[11]),
          rightShoulder: flip(results.poseLandmarks?.[12]),
          leftKnee: flip(results.poseLandmarks?.[25]),
          rightKnee: flip(results.poseLandmarks?.[26]),
          leftHandGesture: leftG,
          rightHandGesture: rightG
        });
      }
      draw(results);
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) await holistic.send({ image: videoRef.current });
      },
      width: 1280,
      height: 720,
    });
    camera.start();

    return () => {
      isMounted = false;
      camera.stop();
      holistic.close();
    };
  }, [onPoseUpdate, onGestureData, hideCanvas]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain", background: "transparent", pointerEvents: "none", zIndex: 1, display: hideCanvas ? "none" : "block" }} />
    </div>
  );
}
