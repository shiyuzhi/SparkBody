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
    
    // 消失速度 急速
    if (type === "heart") {
      this.decay = 0.02; 
    } else if (type === "explosion") {
      this.decay = 0.08;   // 煙火：瞬間炸開瞬間消失 (約 0.3 秒)
    } else {
      // 調到 0.02 ~ 0.03 左右。畫一個圓大約 1 秒，剛好消失
      this.decay = 0.025;  
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
      // 隨身點震動小一點，畫圖才精準
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
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    
    if (!this.isLowEnd && (this.type === "heart" || this.type === "explosion")) {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
    }
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function Fireworks({ poseData, isLowEnd }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const status = useRef({ leftOpen: false, rightOpen: false, handsTouching: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    const createSmallHeart = (centerX, centerY) => {
      const numPoints = 25;
      const scale = 5;
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
        particles.current.push(new Particle(centerX + xOffset, centerY + yOffset, color, "heart", isLowEnd));
      }
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      // 殘影調 0.2，讓背景覆蓋快一點
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, w, h);

      const { leftHand, rightHand, leftKnee, rightKnee } = poseData || {};

      ["leftHand", "rightHand"].forEach((key) => {
        const pos = poseData?.[key];
        if (!pos || pos.visibility <= 0.6) return;

        const x = (1 - pos.x) * w, y = pos.y * h;
        const side = key === "leftHand" ? "left" : "right";
        const gesture = poseData?.[side + "HandGesture"];
        const color = side === "left" ? "#FF69B4" : "#00FFFF";

        particles.current.push(new Particle(x, y, color, "normal", isLowEnd));

        if (gesture === "Open_Palm") {
          if (!status.current[side + "Open"]) {
            for (let i = 0; i < (isLowEnd ? 20 : 40); i++) {
              particles.current.push(new Particle(x, y, color, "explosion", isLowEnd));
            }
            status.current[side + "Open"] = true;
          }
        } else {
          status.current[side + "Open"] = false;
        }
      });

      if (leftHand?.visibility > 0.6 && rightHand?.visibility > 0.6) {
        const dx = (rightHand.x - leftHand.x) * w;
        const dy = (rightHand.y - leftHand.y) * h;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && !status.current.handsTouching) {
          createSmallHeart(((leftHand.x + rightHand.x) / 2) * w, ((leftHand.y + rightHand.y) / 2) * h);
          status.current.handsTouching = true;
        } else if (dist >= 80) {
          status.current.handsTouching = false;
        }
      }

      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.5) {
          particles.current.push(new Particle(knee.x * w, knee.y * h, i === 0 ? "#00ff66" : "#FFA500", "normal", isLowEnd));
        }
      });

      // 粒子上限調回正常範圍，才跑得動 
      const maxP = isLowEnd ? 200 : 500;
      if (particles.current.length > maxP) {
        particles.current.splice(0, particles.current.length - maxP);
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0) particles.current.splice(i, 1);
        else p.draw(ctx);
      }
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [poseData, isLowEnd]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100 }} />;
}