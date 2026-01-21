// Fireworks.jsx
import React, { useRef, useEffect } from "react";
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const force = Math.random() * 4 + 1;
    this.vx = Math.cos(angle) * force;
    this.vy = Math.sin(angle) * force;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.015;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // 重力
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function Fireworks({ poseData }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  // 用 useRef 儲存最新的 poseData，避免觸發 useEffect 重啟
  const latestPose = useRef(poseData);

  // 同步最新的 pose 到 ref，這非常快
  useEffect(() => {
    latestPose.current = poseData;
  }, [poseData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false }); // 優化：如果背景是不透明的，關閉 alpha 通道
    let animationFrameId;

    const render = () => {
      // 1. 清除畫布（使用半透明覆蓋達成殘影效果）
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 根據最新的 poseData 產生新粒子
      const data = latestPose.current;
      if (data) {
        const config = [
          { d: data.head, color: "#FF0000" },
          { d: data.rightHand, color: "#FFA500" },
          { d: data.rightKnee, color: "#0000FF" },
          { d: data.leftKnee, color: "#00FF00" },
          { d: data.leftHand, color: "#800080" },
        ];

        config.forEach(({ d, color }) => {
          if (d && d.visibility > 0.5) {
            const x = d.x * canvas.width;
            const y = d.y * canvas.height;
            for (let i = 0; i < 3; i++) { // 減少每影格產生數量，提升流暢度
              particles.current.push(new Particle(x, y, color));
            }
          }
        });
      }

      // 3. 批量更新與繪製
      // 使用倒序迴圈移除粒子，效率比 splice 高且不會跳過元素
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
  }, []); // 注意：依賴項為空，render 迴圈只在 mount 時啟動一次

  // 響應式畫布大小優化
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

  return <canvas ref={canvasRef} style={{ display: "block", width: '100%', height: '100%' }} />;
}