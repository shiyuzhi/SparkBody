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
      this.decay = 0.05; 
    } else if (type === "explosion") {
      this.decay = 0.08;   
    } else {
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
    
    // 手機端 (isLowEnd) 跳過 shadowBlur 以提升效能
    if (this.isLowEnd) {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    
    if (this.type === "heart" || this.type === "explosion") {
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
    const numPoints = 40; // 增加點的密度，解決碎裂感
    const scale = 5;
    const offsetY = centerY - 80; 

    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * Math.PI * 2;
      const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
      const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
      
      const p = new Particle(centerX + xOffset, offsetY + yOffset, color, "heart", isLowEnd);
      
      // 不要亂噴
      p.vx = (Math.random() - 0.5) * 0.5; // 降低初始隨機速度
      p.vy = (Math.random() - 0.5) * 0.5; 
      
      particles.current.push(p);
    }
  };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

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

        //✌️ YA 閃爍星辰射線
        if (gesture === "Victory") {
            for (let i = 0; i < 3; i++) {
            const color = i % 2 === 0 ? "#FFF" : "#00FFFF";
            const p = new Particle(x, y, color, "ray", isLowEnd);
            const randAngle = Math.random() * Math.PI * 2;
            const speed = 10;
            p.vx = Math.cos(randAngle) * speed;
            p.vy = Math.sin(randAngle) * speed;
            particles.current.push(p);
          }
        } 

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
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const dx = rx - lx;
        const dy = ry - ly;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 80 && !status.current.handsTouching) {
          createSmallHeart((lx + rx) / 2, (ly + ry) / 2);
          status.current.handsTouching = true;
        } else if (dist >= 80) {
          status.current.handsTouching = false;
        }
      }

      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.5) {
          const kx = (1 - knee.x) * w;
          const ky = knee.y * h;
          particles.current.push(new Particle(kx, ky, i === 0 ? "#00ff66" : "#FFA500", "normal", isLowEnd));
        }
      });

      const maxP = isLowEnd ? 200 : 400;
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