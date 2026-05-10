// src/RemoteSkeleton.jsx
import React, { useRef, useEffect } from "react";
import { POSE_CONNECTIONS } from "@mediapipe/holistic";
import { drawConnectors } from "@mediapipe/drawing_utils";

const EXCLUDED_INDICES = [9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PROFESSOR_HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [17, 18], [18, 19], [19, 20], [17, 0],
  [2, 5], [5, 9], [9, 13], [13, 17]
];

export default function RemoteSkeleton({ poseData, isLowEnd = false, colorPose = "#ff6bff", colorHand = "#ff9fff" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !poseData) return;

    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
            
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const { poseLandmarks, leftHandLandmarks, rightHandLandmarks } = poseData;
    if (!poseLandmarks) return;

    const lineW = isLowEnd ? 3 : 6;

    ctx.save();
    // 鏡像翻轉（對方視角）
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    // ── 身體骨架 ──────────────────────────────────────────────
    const poseSafeConnections = POSE_CONNECTIONS.filter(([a, b]) =>
      !EXCLUDED_INDICES.includes(a) || !EXCLUDED_INDICES.includes(b)
    );
    drawConnectors(ctx, poseLandmarks, poseSafeConnections, { color: colorPose, lineWidth: lineW });

    // ── 手部骨架 + 前臂橋接 ───────────────────────────────────
    const drawBridgeForearm = (elbowIdx, wristIdx, handLandmarks) => {
      const elbow = poseLandmarks?.[elbowIdx];
      const poseWrist = poseLandmarks?.[wristIdx];
      if (!elbow) return;
      ctx.beginPath();
      ctx.lineWidth = lineW;
      ctx.strokeStyle = colorPose;
      ctx.lineCap = "round";
      ctx.moveTo(elbow.x * w, elbow.y * h);
      if (handLandmarks?.[0]) {
        ctx.lineTo(handLandmarks[0].x * w, handLandmarks[0].y * h);
        ctx.stroke();
      } else if (poseWrist && poseWrist.visibility > 0.5) {
        ctx.lineTo(poseWrist.x * w, poseWrist.y * h);
        ctx.stroke();
      }
    };

    drawBridgeForearm(13, 15, leftHandLandmarks);
    if (leftHandLandmarks) {
      drawConnectors(ctx, leftHandLandmarks, PROFESSOR_HAND_CONNECTIONS, { color: colorHand, lineWidth: lineW - 1 });
    }

    drawBridgeForearm(14, 16, rightHandLandmarks);
    if (rightHandLandmarks) {
      drawConnectors(ctx, rightHandLandmarks, PROFESSOR_HAND_CONNECTIONS, { color: colorHand, lineWidth: lineW - 1 });
    }

    ctx.restore();

    // ── REMOTE 標示 ───────────────────────────────────────────
    const nose = poseLandmarks[0];
    if (nose) {
      const nx = (1 - nose.x) * w;
      const ny = nose.y * h - 20;
      ctx.fillStyle = "rgba(255,107,255,0.85)";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("● REMOTE", nx, ny);
    }

  }, [poseData, isLowEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 2,
        background: "transparent",
      }}
    />
  );
}