// PoseSkeleton.jsx
import React, { useRef, useEffect } from "react";
import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils";

export default function PoseSkeleton({ onPoseUpdate, hideCanvas = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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
      if (!isMounted) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      let isHeadMoving = false;
      const currentHead = results.poseLandmarks?.[0];

      if (currentHead && lastHeadPos.current) {
        const dx = currentHead.x - lastHeadPos.current.x;
        const dy = currentHead.y - lastHeadPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0.05) isHeadMoving = true;
      }
      if (currentHead) lastHeadPos.current = { x: currentHead.x, y: currentHead.y };

      // 更新 poseData
      if (onPoseUpdate) {
        const flip = (lm) => (lm ? { x: 1 - lm.x, y: lm.y, visibility: lm.visibility ?? 1 } : null);
        onPoseUpdate({
          head: flip(currentHead),
          leftHand: flip(results.leftHandLandmarks?.[8] || results.poseLandmarks?.[15]),
          rightHand: flip(results.rightHandLandmarks?.[8] || results.poseLandmarks?.[16]),
          leftKnee: flip(results.poseLandmarks?.[25]),
          rightKnee: flip(results.poseLandmarks?.[26]),
          isHeadMoving,
        });
      }

      // 若隱藏畫布，則不繪製骨架
      if (!hideCanvas && ctx) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        if (results.poseLandmarks) {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#e6ffdf", lineWidth: 8 });
        }
        if (results.leftHandLandmarks) {
          drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 6 });
        }
        if (results.rightHandLandmarks) {
          drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 6 });
        }
        ctx.restore();
      }
    });

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (isMounted && videoRef.current) {
            await holistic.send({ image: videoRef.current });
          }
        },
        width: window.innerWidth,
        height: window.innerHeight,
      });
      camera.start().catch((err) => console.warn("Camera start failed:", err));
    }

    return () => {
      isMounted = false;
      if (camera) camera.stop();
      holistic.close();
    };
  }, [onPoseUpdate, hideCanvas]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "transparent",
          pointerEvents: "none",
          zIndex: 1,
          display: hideCanvas ? "none" : "block",
        }}
      />
    </div>
  );
}
