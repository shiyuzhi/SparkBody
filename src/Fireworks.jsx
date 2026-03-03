// Fireworks.jsx
import React, { useRef, useEffect } from "react";
import { drumKit } from "./Audio";

class Particle {
  constructor(x, y, color, type = "normal", isLowEnd = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.isLowEnd = isLowEnd;
    this.alpha = 1;
    this.friction = 0.94;

    if (type === "heart")          this.decay = 0.06;
    else if (type === "explosion") this.decay = 0.09;
    else                           this.decay = 0.04;

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
    if (this.type === "heart")     this.vy -= 0.05;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0.05) return;
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
      ctx.globalCompositeOperation = "lighter";
      if (this.type === "heart" || this.type === "explosion") {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function createBirdTemplate() {
  const t = [];

  for (let i = 0; i < 120; i++) {
    const r = Math.random();
    const halfW = Math.sin(r * Math.PI) * 18;
    t.push({ baseX: (r - 0.4) * 85, baseY: (Math.random() - 0.5) * halfW, color: r < 0.6 ? "#FFFFFF" : "#D0D0D0" });
  }
  for (let i = 0; i < 30; i++) {
    const x = 45 + Math.random() * 20;
    t.push({ baseX: x, baseY: (Math.random() - 0.5) * (65 - x) * 1.2, color: "#999999" });
  }
  for (let i = 0; i < 50; i++) {
    const rad = Math.random() * Math.PI * 2;
    const dist = Math.random();
    t.push({ baseX: -42 + Math.cos(rad) * 13 * dist, baseY: -11 + Math.sin(rad) * 13 * dist, color: "#FFFFFF" });
  }
  for (let i = 0; i < 15; i++) {
    t.push({ baseX: -55 - Math.random() * 18, baseY: -11 + (Math.random() - 0.5) * 3, color: "#FFCC00" });
  }
  for (let i = 0; i < 120; i++) {
    const distX = Math.random() * 130;
    const tt = distX / 130;
    t.push({ baseX: -12 - distX, baseY: Math.sin(tt * Math.PI * 1.1) * -28, color: tt > 0.75 ? "#333333" : "#B0B0B0" });
  }
  for (let i = 0; i < 120; i++) {
    const distX = Math.random() * 130;
    const tt = distX / 130;
    t.push({ baseX: 12 + distX, baseY: Math.sin(tt * Math.PI * 1.1) * -28, color: tt > 0.75 ? "#333333" : "#B0B0B0" });
  }

  return t;
}

export default function Fireworks({ poseData, isLowEnd }) {
  const canvasRef  = useRef(null);
  const particles  = useRef([]);
  const latestPose = useRef(poseData);

  useEffect(() => { latestPose.current = poseData; }, [poseData]);

  const status = useRef({
    leftReady: false, rightReady: false,
    leftOpen: false,  rightOpen: false,
    handsTouching: false,
  });

  const birdStatus = useRef({
    historyReady: false,
    historyCount: 0,
    lastTriggerTime: 0,
    // 三幀歷史
    history: [
      { y: 0, t: 0 },
      { y: 0, t: 0 },
    ],
    // 「位移防護」：記錄最近 10 幀的 avgY，用來算真實移動距離
    recentY: [],
  });

  const birdTemplate = useRef(createBirdTemplate());

  useEffect(() => {
    const baseUrl   = import.meta.env.BASE_URL;
    const soundPath = `${baseUrl}/sounds/FWSnare.wav`.replace(/\/+/g, "/");
    drumKit.loadBuffer("boom", soundPath);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;

    const createSmallHeart = (centerX, centerY) => {
      const pan = (centerX / canvas.width) * 2 - 1;
      drumKit.play("boom", { volume: 0.3, detune: 600, pan });
      const numPoints = isLowEnd ? 20 : 40;
      const scale     = 5;
      const offsetY   = centerY - 80;
      for (let i = 0; i < numPoints; i++) {
        const t       = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (
          13 * Math.cos(t) - 5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) - Math.cos(4 * t)
        );
        const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
        const p = new Particle(centerX + xOffset, offsetY + yOffset, color, "heart", isLowEnd);
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.5;
        particles.current.push(p);
      }
    };

    const render = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(render); return; }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = isLowEnd ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const currentPose = latestPose.current;
      const { leftHand, rightHand, leftKnee, rightKnee,
              leftElbow, rightElbow, leftShoulder, rightShoulder } = currentPose || {};
      
      // ==========================================
      // 🦅 藝術流·海鷗（體感優化釋放版）
      // ==========================================
      const MIN_WINGSPAN  = 0.30;    // 🚀 再放寬，只要手有離開身體就行
      const FLAP_SPEED    = 0.012;   // 🚀 靈敏度大幅提升，優雅下壓即可觸發
      const BIRD_COOLDOWN = 800;     

      if (leftHand?.visibility > 0.7 && rightHand?.visibility > 0.7) {
        const now = Date.now();
        const bStatus = birdStatus.current;

        const leftDY  = (bStatus.prevLY ?? leftHand.y) - leftHand.y;
        const rightDY = (bStatus.prevRY ?? rightHand.y) - rightHand.y;
        bStatus.prevLY = leftHand.y;
        bStatus.prevRY = rightHand.y;

        // 1. 寬度：縮短門檻
        const wingspan = Math.abs(leftHand.x - rightHand.x);
        
        // 2. 簡化伸展度：只要手腕離肩膀有一點點距離 (0.1) 即可
        const leftArmExt  = Math.abs(leftHand.x - (leftShoulder?.x || 0));
        const rightArmExt = Math.abs(rightHand.x - (rightShoulder?.x || 0));
        const isExtended  = leftArmExt > 0.3 && rightArmExt > 0.3;

        const avgDY = (leftDY + rightDY) / 2;

        // 🚀 核心判定：放寬所有限制，專注於「向下拍擊」的動作
        if (wingspan > MIN_WINGSPAN && isExtended && avgDY < -FLAP_SPEED) {
          if (now - bStatus.lastTriggerTime > BIRD_COOLDOWN) {
            bStatus.lastTriggerTime = now;
            
            drumKit.play("boom", { volume: 0.5, detune: -200 });

            const birdX = (1 - (leftHand.x + rightHand.x) / 2) * w;
            const birdY = ((leftHand.y + rightHand.y) / 2) * h;
            const tmpl  = birdTemplate.current;

            for (let i = 0; i < tmpl.length; i += (isLowEnd ? 4 : 2)) {
              const item = tmpl[i];
              const p = new Particle(
                birdX + item.baseX * 0.9, 
                birdY + item.baseY * 0.9, 
                item.color, "normal", isLowEnd
              );
              p.vx = (item.baseX * 0.005); 
              p.vy = -0.8; // 稍微增加一點上升感，讓你看得到它在動
              p.decay = 0.015;
              p.friction = 0.995;
              p.size = 1.6;
              particles.current.push(p);
            }
          }
        }
      }
      
      // ==========================================
      ["leftHand", "rightHand"].forEach((key) => {
        const pos = currentPose?.[key];
        if (!pos || pos.visibility <= 0.6) return;

        const x       = (1 - pos.x) * w;
        const y       = pos.y * h;
        const side    = key === "leftHand" ? "left" : "right";
        const gesture = currentPose?.[side + "HandGesture"];

        if (!status.current[side + "Color"]) {
          const hue = Math.floor(Math.random() * 360);
          status.current[side + "Color"] = `hsl(${hue}, 100%, 60%)`;
        }

        const color = status.current[side + "Color"];
        const pan   = (x / w) * 2 - 1;

        particles.current.push(new Particle(x, y, color, "normal", isLowEnd));

        if (gesture === "Victory") {
          if (Math.random() > 0.8) drumKit.play("boom", { volume: 0.2, detune: 1000, pan });
          for (let i = 0; i < (isLowEnd ? 1 : 3); i++) {
            const rayColor = i % 2 === 0 ? "#FFF" : "#00FFFF";
            const p = new Particle(x, y, rayColor, "ray", isLowEnd);
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * 10;
            p.vy = Math.sin(a) * 10;
            particles.current.push(p);
          }
        }

        if (gesture === "Closed_Fist") {
          status.current[side + "Count"] = (status.current[side + "Count"] || 0) + 1;
          if (status.current[side + "Count"] > 15) status.current[side + "Ready"] = true;
        } else {
          status.current[side + "Count"] = 0;
          if (gesture === "Open_Palm") {
            if (status.current[side + "Ready"]) {
              const newHue = Math.floor(Math.random() * 360);
              status.current[side + "Color"] = `hsl(${newHue}, 100%, 60%)`;
              const explosionColor = status.current[side + "Color"];
              drumKit.play("boom", { volume: 0.6, detune: 0, pan });
              for (let i = 0; i < (isLowEnd ? 15 : 40); i++) {
                particles.current.push(new Particle(x, y, explosionColor, "explosion", isLowEnd));
              }
              status.current[side + "Ready"] = false;
            }
          } else {
            status.current[side + "Ready"] = false;
          }
        }
      });

      // 雙手碰 → 愛心
      if (leftHand?.visibility > 0.6 && rightHand?.visibility > 0.6) {
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const dist = Math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2);
        if (dist < 80 && !status.current.handsTouching) {
          createSmallHeart((lx + rx) / 2, (ly + ry) / 2);
          status.current.handsTouching = true;
        } else if (dist >= 80) {
          status.current.handsTouching = false;
        }
      }

      // 膝蓋粒子
      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.3) {
          const kneeColor = i === 0 ? "#00FF00" : "#FF8C00";
          particles.current.push(new Particle((1 - knee.x) * w, knee.y * h, kneeColor, "normal", isLowEnd));
        }
      });

      // 粒子上限：鳥爆發 500 個 + 其他粒子，給足空間
      const maxP = isLowEnd ? 400 : 1000;
      if (particles.current.length > maxP) {
        particles.current.splice(0, particles.current.length - maxP);
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0.05) {
          particles.current.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [isLowEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 10,
        mixBlendMode: "screen",
        filter: "contrast(1.2) brightness(1.1)",
      }}
    />
  );
}