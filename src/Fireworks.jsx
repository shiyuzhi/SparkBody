// Fireworks.jsx
import React, { useRef, useEffect } from "react";

class Particle {
  constructor(x, y, color, type = "normal") {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.alpha = 1;
    this.friction = 0.94;
    this.decay = type === "heart" ? 0.02 : 0.07;

    if (type === "explosion") {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 6;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 3 + 2;
    } else if (type === "heart") {
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = -Math.random() * 1.2;
      this.size = 2.5;
    } else {
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.size = Math.random() * 4 + 2;
    }
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    if (this.type === "explosion") this.vy += 0.15;
    if (this.type === "heart") this.vy -= 0.15;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    if (this.type === "heart" || this.type === "explosion") {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 10;
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
  const lastActionTime = useRef({ Left: 0, Right: 0, Heart: 0 });
  const gestureStartTime = useRef({ Left: 0, Right: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;

    const createSmallHeart = (centerX, centerY) => {
      const numPoints = 30; // 點數多一點，輪廓更明顯
      const scale = 6;
      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const colors = ["#fb2424", "#f74d85", "#ecebda"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.current.push(new Particle(centerX + xOffset, centerY + yOffset, color, "heart"));
      }
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, w, h);
      const now = Date.now();
      const { leftHand, rightHand, nose } = poseData || {};
      ["leftHand", "rightHand"].forEach((key) => {
        const pos = poseData?.[key];
        if (!pos || pos.visibility <= 0.6) return;

        const x = pos.x * w, y = pos.y * h;
        const side = key === "leftHand" ? "Left" : "Right";
        const color = side === "Left" ? "#FF69B4" : "#00FFFF";

        // 基礎追蹤粒子（不間斷）
        particles.current.push(new Particle(x, y, color, "normal"));

        const gesture = side === "Left" ? poseData?.leftHandGesture : poseData?.rightHandGesture;

        if (gesture === "Open_Palm") {
          if (gestureStartTime.current[side] === 0) {
            gestureStartTime.current[side] = now;
          }

          // 計算目前張開了多久
          const openDuration = now - gestureStartTime.current[side];

          // 只有在 0.2 秒內 (300ms) 才噴發
          if (openDuration < 200) {
            // 這裡維持原本的間隔（每 100ms 噴一次大陣仗）
            if (now - lastActionTime.current[side] > 180) {
              for (let i = 0; i < 40; i++) {
                particles.current.push(new Particle(x, y, color, "explosion"));
              }
              lastActionTime.current[side] = now;
            }
          } 
        } else {
          // 重置計時器，下次張開才能再次噴
          gestureStartTime.current[side] = 0;
        }
      });
      // 雙手接觸觸發愛心（向上飄版本）
      if (leftHand?.visibility > 0.5 && rightHand?.visibility > 0.5) {
        const dx = (rightHand.x - leftHand.x) * w;
        const dy = (rightHand.y - leftHand.y) * h;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 當距離小於 100 像素時觸發
        if (distance < 80 && now - lastActionTime.current.Heart > 400) {
          const centerX = ((leftHand.x + rightHand.x) / 2) * w;
          const centerY = ((leftHand.y + rightHand.y) / 2) * h;

          // 呼叫產生函式
          createSmallHeart(centerX, centerY);
          lastActionTime.current.Heart = now;
        }
      }
     //  加膝蓋粒子
      const leftKnee = poseData?.leftKnee;
      const rightKnee = poseData?.rightKnee;

      if (leftKnee && leftKnee.visibility > 0.5) {
        const x = leftKnee.x * canvas.width;
        const y = leftKnee.y * canvas.height;
        particles.current.push(new Particle(x, y, "#00ff66", false)); // 左膝
      }

      if (rightKnee && rightKnee.visibility > 0.5) {
        const x = rightKnee.x * canvas.width;
        const y = rightKnee.y * canvas.height;
        particles.current.push(new Particle(x, y, "#FFA500", false)); // 右膝橘色
      }

      

      // 限制最大粒子數 200
      if (particles.current.length > 200) {
        particles.current.splice(0, particles.current.length - 200);
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
  }, [poseData]);

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
