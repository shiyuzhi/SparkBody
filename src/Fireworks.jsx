// Fireworks.jsx
import React, { useRef, useEffect } from "react";
// 引入音訊控制實例（Singleton 模式）
import { drumKit } from "./Audio"; 
class Particle {
  constructor(x, y, color, type = "normal", isLowEnd = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.isLowEnd = isLowEnd;
    this.alpha = 1;
    this.friction = 0.94; // 摩擦力，讓粒子逐漸減速

    // 根據不同類型設定消失速度
    if (type === "heart") {
      this.decay = 0.06;
    } else if (type === "explosion") {
      this.decay = 0.09;
    } else {
      this.decay = 0.04;
    }

    // 初始化粒子的速度與大小
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

  // 更新粒子物理狀態
  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    if (this.type === "explosion") this.vy += 0.15; // 爆炸粒子有重力下墜
    if (this.type === "heart") this.vy -= 0.05;     // 愛心粒子輕微上升
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  // 在 Canvas 上繪製粒子
  draw(ctx) {
    if (this.alpha <= 0.1) return;

    if (this.isLowEnd) {
      // 效能模式：使用簡單的繪圖方式
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
      // 高效能模式：增加發光與光暈效果
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.globalCompositeOperation = "lighter"; // 顏色疊加變亮
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

export default function Fireworks({ poseData, isLowEnd }) {
  const canvasRef = useRef(null);
  const particles = useRef([]); // 存儲所有活動粒子
  // 用於記錄手勢狀態，防止音效與粒子重複觸發
  const status = useRef({ leftOpen: false, rightOpen: false, handsTouching: false });

  // 1. 組件掛載時：預載入音效檔案
  useEffect(() => {
    // 1. 自動獲取 Vite 設定的 Base URL (在此案例中會是 "/SparkBody/")
    const baseUrl = import.meta.env.BASE_URL; 
    const soundPath = `${baseUrl}/sounds/FWSnare.wav`.replace(/\/+/g, '/');
    console.log("🔗 最終載入路徑:", soundPath); // 這行會印出 /SparkBody/sounds/FWSnare.wav
    drumKit.loadBuffer('boom', soundPath);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;

    /**
     * 輔助函式：建立愛心爆炸效果並播放音效
     */
    const createSmallHeart = (centerX, centerY) => {
      // 音效觸發：雙手合心播放「清脆高音」
      const pan = (centerX / canvas.width) * 2 - 1; // 計算水平方位
      drumKit.play('boom', { volume: 0.3, detune: 600, pan });

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

    /**
     * 主渲染循環
     */
    const render = () => {
      // 自動調整畫布解析度
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      // 繪製半透明背景產生殘影效果
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = isLowEnd ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const { leftHand, rightHand, leftKnee, rightKnee } = poseData || {};

      // 遍歷左右手座標
      ["leftHand", "rightHand"].forEach((key) => {
        const pos = poseData?.[key];
        if (!pos || pos.visibility <= 0.6) return;

        // 將 MediaPipe 歸一化座標 (0-1) 轉為 Canvas 物理座標
        // 註：MediaPipe 的 X 是鏡像的，所以用 (1 - pos.x)
        const x = (1 - pos.x) * w;
        const y = pos.y * h;
        const side = key === "leftHand" ? "left" : "right";
        const gesture = poseData?.[side + "HandGesture"];
        const color = side === "left" ? "#FF69B4" : "#00FFFF";
        
        // 2. 音訊方位：-1 (全左) 到 1 (全右)
        const pan = (x / w) * 2 - 1;

        // 一般移動時產生的微小火花
        particles.current.push(new Particle(x, y, color, "normal", isLowEnd));

        // 勝利手勢 (Victory)：噴射射線
        if (gesture === "Victory") {
          // 音效觸發：高頻能量感
          if (Math.random() > 0.8) { // 限制頻率避免刺耳
            drumKit.play('boom', { volume: 0.2, detune: 1000, pan });
          }
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

        // 張開手掌 (Open_Palm)：觸發大爆炸
        if (gesture === "Open_Palm") {
          // 狀態鎖定：確保張開一次只響一聲，直到關閉再張開
          if (!status.current[side + "Open"]) {
            // 音效觸發：標準煙火重低音爆炸
            drumKit.play('boom', { volume: 0.6, detune: 0, pan });

            for (let i = 0; i < (isLowEnd ? 15 : 40); i++) {
              particles.current.push(new Particle(x, y, color, "explosion", isLowEnd));
            }
            status.current[side + "Open"] = true;
          }
        } else {
          status.current[side + "Open"] = false;
        }
      });

      // 雙手接觸判定 (合心)
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

      // 膝蓋座標：產生追蹤火花
      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.5) {
          particles.current.push(new Particle((1 - knee.x) * w, knee.y * h, i === 0 ? "#00ff66" : "#FFA500", "normal", isLowEnd));
        }
      });

      // 粒子數量優化，避免過多導致卡頓
      const maxP = isLowEnd ? 200 : 500;
      if (particles.current.length > maxP) {
        particles.current.splice(0, particles.current.length - maxP);
      }

      // 更新並繪製所有粒子
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
    return () => cancelAnimationFrame(raf); // 清理動畫幀，防止記憶體洩漏
  }, [poseData, isLowEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        pointerEvents: "none", // 讓鼠標事件穿透
        zIndex: 10, 
        mixBlendMode: "screen", // 螢幕濾色：讓黑色背景透明，顏色更亮
        filter: "contrast(1.2) brightness(1.1)", // 增加色彩飽和度
      }}
    />
  );
}