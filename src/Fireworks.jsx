// Fireworks.jsx
import React, { useRef, useEffect } from "react";

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    // 隨機爆炸速度與方向
    const angle = Math.random() * Math.PI * 2;
    const force = Math.random() * 4 + 1;
    this.vx = Math.cos(angle) * force;
    this.vy = Math.sin(angle) * force;
    this.alpha = 1; // 透明度，用來做淡出
    this.decay = Math.random() * 0.02 + 0.015; // 消失速度
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // 重力效果
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function Fireworks({ poseData }) {
  const canvasRef = useRef(null);
  const particles = useRef([]); // 儲存所有畫面上的粒子

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const render = () => {
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (poseData) {
        const config = [
          { data: poseData.head, color: "#FF0000" },      // 紅
          { data: poseData.rightHand, color: "#FFA500" }, // 橙
          { data: poseData.rightKnee, color: "#0000FF" }, // 藍
          { data: poseData.leftKnee, color: "#00FF00" },  // 綠
          { data: poseData.leftHand, color: "#800080" },  // 紫
        ];

        config.forEach(({ data, color }) => {
          if (data && data.visibility > 0.5) {
            const x = data.x * canvas.width;
            const y = data.y * canvas.height;

            // 每次偵測到動作，產生 5 個新粒子
            for (let i = 0; i < 5; i++) {
              particles.current.push(new Particle(x, y, color));
            }
          }
        });
      }

      // 更新與繪製粒子
      particles.current.forEach((p, index) => {
        p.update();
        p.draw(ctx);
        // 移除看不見的粒子
        if (p.alpha <= 0) {
          particles.current.splice(index, 1);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [poseData]);

  // 響應式畫布大小
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
        canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}