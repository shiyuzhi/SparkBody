// Fireworks.jsx
import React, { useRef, useEffect } from "react";

class Particle {
  constructor(x, y, color, type = "normal", isLowEnd = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.isLowEnd = isLowEnd;
    this.alpha = 1;
    this.friction = 0.94;

    if (type === "heart") {
      this.decay = 0.06;
    } else if (type === "explosion") {
      this.decay = 0.09;
    } else {
      this.decay = 0.04;
    }

    if (type === "explosion") {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 3 + 2;
    } else if (type === "heart") {
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = -Math.random() * 2 - 1;
      this.size = 3;
    } else {
      this.vx = (Math.random() - 0.5) * 1;
      this.vy = (Math.random() - 0.5) * 1;
      this.size = Math.random() * 2 + 1.5;
    }
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    if (this.type === "explosion") this.vy += 0.15;
    if (this.type === "heart") this.vy -= 0.05;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0.1) return;

    if (this.isLowEnd) {
      ctx.globalAlpha = this.alpha;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = this.color;
      
      if (this.type === "explosion" || this.type === "ray") {
        ctx.beginPath();
        ctx.moveTo(this.x - this.size, this.y);
        ctx.lineTo(this.x + this.size, this.y);
        ctx.moveTo(this.x, this.y - this.size);
        ctx.lineTo(this.x, this.y + this.size);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      // 回歸原本的發光邏輯
      ctx.globalCompositeOperation = "lighter";
      if (this.type === "heart" || this.type === "explosion") {
        ctx.shadowBlur = 10; // 稍微加強光暈
        ctx.shadowColor = this.color;
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export default function Fireworks({ poseData, isLowEnd }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const status = useRef({ leftOpen: false, rightOpen: false, handsTouching: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;

    const createSmallHeart = (centerX, centerY) => {
      const numPoints = isLowEnd ? 20 : 40;
      const scale = 5;
      const offsetY = centerY - 80;
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
        const p = new Particle(centerX + xOffset, offsetY + yOffset, color, "heart", isLowEnd);
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.5;
        particles.current.push(p);
      }
    };

    const render = () => {
      // 關鍵：確保 Canvas 解析度與物理尺寸完全一致，這解決了遠近位移問題
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      // 回歸原本的背景清理，確保煙火「飽滿」
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = isLowEnd ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const { leftHand, rightHand, leftKnee, rightKnee } = poseData || {};

      ["leftHand", "rightHand"].forEach((key) => {
        const pos = poseData?.[key];
        if (!pos || pos.visibility <= 0.6) return;

        // 精準座標對齊
        const x = (1 - pos.x) * w;
        const y = pos.y * h;
        const side = key === "leftHand" ? "left" : "right";
        const gesture = poseData?.[side + "HandGesture"];
        const color = side === "left" ? "#FF69B4" : "#00FFFF";

        particles.current.push(new Particle(x, y, color, "normal", isLowEnd));

        if (gesture === "Victory") {
          for (let i = 0; i < (isLowEnd ? 1 : 3); i++) {
            const rayColor = i % 2 === 0 ? "#FFF" : "#00FFFF";
            const p = new Particle(x, y, rayColor, "ray", isLowEnd);
            const randAngle = Math.random() * Math.PI * 2;
            const speed = 10;
            p.vx = Math.cos(randAngle) * speed;
            p.vy = Math.sin(randAngle) * speed;
            particles.current.push(p);
          }
        }

        if (gesture === "Open_Palm") {
          if (!status.current[side + "Open"]) {
            for (let i = 0; i < (isLowEnd ? 15 : 40); i++) {
              particles.current.push(new Particle(x, y, color, "explosion", isLowEnd));
            }
            status.current[side + "Open"] = true;
          }
        } else {
          status.current[side + "Open"] = false;
        }
      });

      if (leftHand?.visibility > 0.6 && rightHand?.visibility > 0.6) {
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const dist = Math.sqrt(Math.pow(rx - lx, 2) + Math.pow(ry - ly, 2));
        if (dist < 80 && !status.current.handsTouching) {
          createSmallHeart((lx + rx) / 2, (ly + ry) / 2);
          status.current.handsTouching = true;
        } else if (dist >= 80) {
          status.current.handsTouching = false;
        }
      }

      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.5) {
          particles.current.push(new Particle((1 - knee.x) * w, knee.y * h, i === 0 ? "#00ff66" : "#FFA500", "normal", isLowEnd));
        }
      });

      const maxP = isLowEnd ? 200 : 500; // 稍微增加最大粒子數提高飽滿度
      if (particles.current.length > maxP) {
        particles.current.splice(0, particles.current.length - maxP);
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0.05) { // 稍微延長消失時間
          particles.current.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [poseData, isLowEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
        mixBlendMode: "screen", // 讓畫布背景透明但粒子顏色鮮豔
        filter: "contrast(1.2) brightness(1.1)", // 微調增加飽滿感
      }}
    />
  );
}