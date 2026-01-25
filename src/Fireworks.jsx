// Fireworks.jsx
import React, { useRef, useEffect } from "react";

class Particle {
  constructor(x, y, color, isExplosion = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.isExplosion = isExplosion;
    this.alpha = 1;

    this.friction = 0.96;
    this.gravity = 0.15;
    this.decay = isExplosion ? Math.random() * 0.03 + 0.01 : 0.05;

    if (isExplosion) {
      // 爆炸粒子
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 15 + 8;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 3 + 1;
    } else {
      // 手指拖尾粒子（粗大明顯）
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.size = Math.random() * 4 + 2;
    }
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    if (this.isExplosion) this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    if (this.isExplosion) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.color;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function Fireworks({ poseData }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const lastExplosionTime = useRef({ Left: 0, Right: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    const render = () => {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();

      ["leftHand", "rightHand"].forEach((handKey) => {
        const pos = poseData?.[handKey];
        if (!pos || pos.visibility <= 0.5) return;

        const x = pos.x * canvas.width;
        const y = pos.y * canvas.height;
        const sideKey = handKey === "leftHand" ? "Left" : "Right";
        const color = sideKey === "Left" ? "#FF69B4" : "#00FFFF";

        // 手指拖尾粒子
        particles.current.push(new Particle(x, y, color, false));

        // 手掌爆炸判斷（完全吃 poseData 手勢）
        const gestureName =
          sideKey === "Left"
            ? poseData?.leftHandGesture
            : poseData?.rightHandGesture;

        if (
          gestureName === "Open_Palm" &&
          now - lastExplosionTime.current[sideKey] > 150
        ) {
          for (let i = 0; i < 40; i++) {
            particles.current.push(new Particle(x, y, color, true));
          }
          lastExplosionTime.current[sideKey] = now;
        }
      });

      // 更新並繪製所有粒子
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0) {
          particles.current.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [poseData]);

  useEffect(() => {
    const resize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 100,
      }}
    />
  );
}
