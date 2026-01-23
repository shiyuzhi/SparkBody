// Fireworks.jsx
// Fireworks.jsx
import React, { useRef, useEffect } from "react";

// 粒子類別
class Particle {
  constructor(x, y, color, mode = "normal") {
    this.x = x;
    this.y = y;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 0.008 + 0.004;

    if (mode === "fist") {
      // 握拳 → 火球慢慢往上
      const baseAngle = -Math.PI / 2; 
      const spread = Math.PI / 12;    
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = Math.random() * 1.5 + 1;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    } else if (mode === "open") {
      // 手掌 → 像拋煙火往上噴散
      const baseAngle = -Math.PI / 2; // 往上
      const spread = Math.PI / 4; // ±45度
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = Math.random() * 3 + 2; // 比握拳快
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    } else {
      // 普通粒子
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.2 + 0.5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.03; // 重力
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 計算距離
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function Fireworks({ poseData }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const latestPose = useRef(poseData);

  useEffect(() => {
    latestPose.current = poseData;
  }, [poseData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    let animationFrameId;

    const render = () => {
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const data = latestPose.current;
      if (data) {
        const hand = data.rightHand;
        const index = data.rightHandIndex;
        const pinky = data.rightHandPinky;

        const isFist = hand && index && pinky && distance(hand, index) < 0.05 && distance(hand, pinky) < 0.05;
        const isOpen = hand && index && pinky && distance(hand, index) > 0.1 && distance(hand, pinky) > 0.1;

        const config = [
          ...(data.isHeadMoving ? [{ d: data.head, color: "#FF0000", mode: "normal" }] : []),
          { d: hand, color: "#FFA500", mode: isFist ? "fist" : isOpen ? "open" : "normal" },
          { d: data.rightKnee, color: "#0000FF", mode: "normal" },
          { d: data.leftKnee, color: "#00FF00", mode: "normal" },
          { d: data.leftHand, color: "#f910ab", mode: "normal" },
        ];

        config.forEach(({ d, color, mode }) => {
          if (d && d.visibility > 0.5) {
            const x = d.x * canvas.width;
            const y = d.y * canvas.height;
            const count = mode === "fist" ? 5 : mode === "open" ? 8 : 2;
            for (let i = 0; i < count; i++) {
              particles.current.push(new Particle(x, y, color, mode));
            }
          }
        });
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0) {
          particles.current.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        const { clientWidth, clientHeight } = canvasRef.current.parentElement;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />;
}