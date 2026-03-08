// src/Fireworks.jsx
import React, { useRef, useEffect } from "react";
import { drumKit } from "./Audio";
import { extractLMA, resetLMA } from "./lmaEngine";
import { logLMAData } from "./AffectiveLogger";

// ─── Particle class（原版完整保留）────────────────────────────────────────────
class Particle {
  constructor(x, y, color, type = "normal", isLowEnd = false) {
    this.x = x; this.y = y; this.color = color;
    this.type = type; this.isLowEnd = isLowEnd;
    this.alpha = 1; this.friction = 0.94;

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
    this.vx *= this.friction; this.vy *= this.friction;
    if (this.type === "explosion") this.vy += 0.15;
    if (this.type === "heart")     this.vy -= 0.05;
    this.x += this.vx; this.y += this.vy;
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
        ctx.moveTo(this.x - this.size, this.y); ctx.lineTo(this.x + this.size, this.y);
        ctx.moveTo(this.x, this.y - this.size); ctx.lineTo(this.x, this.y + this.size);
        ctx.strokeStyle = this.color; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.save();
      ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
      ctx.globalCompositeOperation = "lighter";
      if (this.type === "heart" || this.type === "explosion") {
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
      }
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ─── Bird template（原版完整保留）─────────────────────────────────────────────
function createBirdTemplate() {
  const t = [];
  for (let i = 0; i < 120; i++) {
    const r = Math.random(); const halfW = Math.sin(r * Math.PI) * 18;
    t.push({ baseX: (r - 0.4) * 85, baseY: (Math.random() - 0.5) * halfW, color: r < 0.6 ? "#FFFFFF" : "#D0D0D0" });
  }
  for (let i = 0; i < 30; i++) {
    const x = 45 + Math.random() * 20;
    t.push({ baseX: x, baseY: (Math.random() - 0.5) * (65 - x) * 1.2, color: "#999999" });
  }
  for (let i = 0; i < 50; i++) {
    const rad = Math.random() * Math.PI * 2; const dist = Math.random();
    t.push({ baseX: -42 + Math.cos(rad) * 13 * dist, baseY: -11 + Math.sin(rad) * 13 * dist, color: "#FFFFFF" });
  }
  for (let i = 0; i < 15; i++)
    t.push({ baseX: -55 - Math.random() * 18, baseY: -11 + (Math.random() - 0.5) * 3, color: "#FFCC00" });
  for (let i = 0; i < 120; i++) {
    const distX = Math.random() * 130; const tt = distX / 130;
    t.push({ baseX: -12 - distX, baseY: Math.sin(tt * Math.PI * 1.1) * -28, color: tt > 0.75 ? "#333333" : "#B0B0B0" });
  }
  for (let i = 0; i < 120; i++) {
    const distX = Math.random() * 130; const tt = distX / 130;
    t.push({ baseX: 12 + distX, baseY: Math.sin(tt * Math.PI * 1.1) * -28, color: tt > 0.75 ? "#333333" : "#B0B0B0" });
  }
  return t;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Fireworks({ poseData, isLowEnd, showDebug = false, mode = "B" }) {
  const canvasRef    = useRef(null);
  const debugRef     = useRef(null);  // overlay div
  const particles    = useRef([]);
  const latestPose   = useRef(poseData);
  const lmaRef       = useRef(null);  // ← 最新 LMA 計算結果
  const baselineLoggedRef = useRef(false);
  const lastContinuousLogTime = useRef(Date.now());
  const lastVictoryLogTime = useRef({ left: 0, right: 0 });

  useEffect(() => { latestPose.current = poseData; }, [poseData]);

  // Mode 切換 → 重設 LMA baseline（避免 Mode A 的 baseline 污染 Mode B）
  useEffect(() => {
    resetLMA();
    baselineLoggedRef.current = false;
    console.log("[Fireworks] Mode switched to", mode, "— LMA reset");
  }, [mode]);

  const status = useRef({
    leftReady: false, rightReady: false,
    leftOpen: false,  rightOpen: false,
    handsTouching: false,
  });

  const birdStatus   = useRef({ lastTriggerTime: 0, prevLY: null, prevRY: null, prevLVY: null, prevRVY: null, prevTime: null, phase: "IDLE", upFrames: 0, risingStartTime: null, wingsMissFrames: 0 });
  const birdTemplate = useRef(createBirdTemplate());

  useEffect(() => {
    const baseUrl   = import.meta.env.BASE_URL;
    const soundPath = `${baseUrl}/sounds/FWSnare.wav`.replace(/\/+/g, "/");
    drumKit.loadBuffer("boom", soundPath);
    const birdPath = `${baseUrl}/sounds/bird.wav`.replace(/\/+/g, "/");
    drumKit.loadBuffer("bird", birdPath);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;

    // ── Helper: log LMA shorthand ────────────────────────────────────────────
    const log = (activity, note = "") => {
      const lma = lmaRef.current;
      if (!lma) return;
      logLMAData({
        activity,
        shape:    lma.shape,
        weight:   lma.weight,
        flow:     lma.flow,
        kt:       lma.kt,
        shape_n:  lma.n.shape,
        weight_n: lma.n.weight,
        flow_n:   lma.n.flow,
        baselineReady: lma.baselineReady,
        note,
      });
    };

    // ── Heart helper（原版保留）──────────────────────────────────────────────
    const createSmallHeart = (centerX, centerY) => {
      const pan = (centerX / canvas.width) * 2 - 1;
      drumKit.play("boom", { volume: 0.3, detune: 600, pan });
      const numPoints = isLowEnd ? 20 : 40;
      const scale = 5; const offsetY = centerY - 80;
      for (let i = 0; i < numPoints; i++) {
        const t       = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
        const p = new Particle(centerX + xOffset, offsetY + yOffset, color, "heart", isLowEnd);
        p.vx = (Math.random() - 0.5) * 0.5; p.vy = (Math.random() - 0.5) * 0.5;
        particles.current.push(p);
      }
      // ★ Log heart event
      log("Heart");
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    const render = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
      }
      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(render); return; }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = isLowEnd ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const currentPose = latestPose.current;

      // 第一道防線：如果沒抓到人，直接跳過，不執行後續邏輯
      if (!currentPose || !currentPose.leftHand || !currentPose.rightHand) {
        raf = requestAnimationFrame(render);
        return; 
      }

      // 安全取出座標
      const { leftHand, rightHand, leftKnee, rightKnee,
              leftElbow, rightElbow, leftShoulder, rightShoulder } = currentPose;

      // ══════════════════════════════════════════════════════════════════════
      // ★ 區塊一：LMA 計算與數據紀錄 (不影響煙火)
      // ══════════════════════════════════════════════════════════════════════
      const lma = extractLMA(currentPose);
      if (lma) {
        lmaRef.current = lma;

        if (lma.baselineReady && !baselineLoggedRef.current) {
          baselineLoggedRef.current = true;
          log("Baseline_End", "30s baseline calibrated");
        }

        const now = Date.now();
        if (lma.baselineReady && (now - lastContinuousLogTime.current > 30000)) {
          log("Dance_Continuous", "30s_Interval_AutoLog");
          lastContinuousLogTime.current = now;
        }

        if (showDebug && debugRef.current) {
          const pct = Math.round(lma.baselineProgress * 100);
          const row = (label, raw, norm) =>
            `<div style="display:flex;gap:8px;justify-content:space-between">` +
            `<span style="color:#888">${label}</span>` +
            `<span>raw <b>${raw}</b></span>` +
            `<span style="color:${lma.baselineReady ? '#0ef' : '#666'}">norm <b>${norm}</b></span>` +
            `</div>`;
          debugRef.current.innerHTML =
            `<div style="color:${lma.baselineReady ? '#afa' : '#ffd'};margin-bottom:4px">` +
            `${lma.baselineReady ? '✓ Baseline ready' : `⏳ Calibrating... ${pct}%`}</div>` +
            row("S Space ",  lma.shape.toFixed(3),  lma.n.shape.toFixed(3))  +
            row("W Weight",  lma.weight.toFixed(3), lma.n.weight.toFixed(3)) +
            row("F Flow  ",  lma.flow.toFixed(3),   lma.n.flow.toFixed(3))   +
            `<div style="color:#f9a;margin-top:4px">KT composite &nbsp;<b>${lma.kt.toFixed(3)}</b></div>`;
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // 手部粒子 + 手勢（原版邏輯保留，Explosion 新增 log）
      // ══════════════════════════════════════════════════════════════════════
      ["leftHand", "rightHand"].forEach((key) => {
        const pos  = currentPose?.[key];
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
          
          const sideKey = side; // "left" 或 "right"
          const now = Date.now();
          
          // 每 2 秒才允許紀錄一次比 Ya，避免數據塞車
          if (now - lastVictoryLogTime.current[sideKey] > 2000) {
            log("Victory", sideKey);
            lastVictoryLogTime.current[sideKey] = now;
          }

          for (let i = 0; i < (isLowEnd ? 1 : 3); i++) {
            const rayColor = i % 2 === 0 ? "#FFF" : "#00FFFF";
            const p = new Particle(x, y, rayColor, "ray", isLowEnd);
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * 10; p.vy = Math.sin(a) * 10;
            particles.current.push(p);
          }
        }

        if (gesture === "Closed_Fist") {
          status.current[side + "Count"] = (status.current[side + "Count"] || 0) + 1;
          if (status.current[side + "Count"] > 8) status.current[side + "Ready"] = true; // 大约 8 帧（约 0.25 秒）
        } else {
          status.current[side + "Count"] = 0;
          if (gesture === "Open_Palm") {
            if (status.current[side + "Ready"]) {
              const newHue = Math.floor(Math.random() * 360);
              status.current[side + "Color"] = `hsl(${newHue}, 100%, 60%)`;
              const explosionColor = status.current[side + "Color"];
              drumKit.play("boom", { volume: 0.6, detune: 0, pan });
              for (let i = 0; i < (isLowEnd ? 15 : 40); i++)
                particles.current.push(new Particle(x, y, explosionColor, "explosion", isLowEnd));

              // ★ Log Explosion
              log("Fireworks_Explosion", side);
              status.current[side + "Ready"] = false;
            }
          } else {
            status.current[side + "Ready"] = false;
          }
        }
      });

      // ══════════════════════════════════════════════════════════════════════
      // 雙手碰 → 愛心（精準判定版）
      // ══════════════════════════════════════════════════════════════════════
      if (leftHand?.visibility > 0.7 && rightHand?.visibility > 0.7) {
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const distance2D = Math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2);
        
        // 距离够近 (d < 60) 且 深度相近 (depth < 0.05)
        if (distance2D < 60 ) {
          if (!status.current.handsTouching) {
            status.current.touchCounter++;
            
            if (status.current.touchCounter > 8) {  // 持续约 0.25 秒以上才算真正碰到
              createSmallHeart((lx + rx) / 2, (ly + ry) / 2);
              status.current.handsTouching = true;
            }
          }
        } else {
          if (distance2D > 100) {
            status.current.touchCounter = 0;
            status.current.handsTouching = false;
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // 🦅 Gull Flap (海鷗拍翅) - 終極防誤觸版
      if (leftHand.visibility > 0.8 && rightHand.visibility > 0.8 && leftShoulder && rightShoulder) {
        const now = Date.now();
        const bStatus = birdStatus.current;
        const leftDY = (bStatus.prevLY ?? leftHand.y) - leftHand.y;
        const rightDY = (bStatus.prevRY ?? rightHand.y) - rightHand.y;
        bStatus.prevLY = leftHand.y; bStatus.prevRY = rightHand.y;

        // ★ 動態比例尺
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 0.1; 
        const wingspan = Math.abs(leftHand.x - rightHand.x);
        const leftArmExt = Math.abs(leftHand.x - leftShoulder.x);
        const rightArmExt = Math.abs(rightHand.x - rightShoulder.x);

        // ★ 判定區域：手要伸得夠開 (1.1 倍) 且 總寬度夠 (2.5 倍)
        const isExtended = leftArmExt > shoulderWidth * 1.1 && rightArmExt > shoulderWidth * 1.1; 
        const MIN_WINGSPAN = shoulderWidth * 2.5; 

        // ★ 關鍵修正 1：手必須高於肩膀 (y 軸越小越高)
        // 這能擋掉平推、慢動作在腰部晃動的誤觸
        const handsAreHigh = leftHand.y < leftShoulder.y && rightHand.y < rightShoulder.y;

        // ★ 關鍵修正 2：速度門檻設在 0.12 (剛好不難也不簡單)
        const FLAP_SPEED = shoulderWidth * 0.12; 
        const avgDY = (leftDY + rightDY) / 2;

        // 最終判定：必須 [手舉高] + [夠開] + [往下揮得夠快]
        if (handsAreHigh && wingspan > MIN_WINGSPAN && isExtended && avgDY < -FLAP_SPEED) {
          if (now - (bStatus.lastTriggerTime || 0) > 1000) {
            bStatus.lastTriggerTime = now;
            drumKit.play("bird", { volume: 0.8, detune: -200, duration: 1.5 });
            log("Gull_Flap");

            const birdX = (1 - (leftHand.x + rightHand.x) / 2) * w;
            const birdY = ((leftHand.y + rightHand.y) / 2) * h;
            const tmpl = birdTemplate.current;
            for (let i = 0; i < tmpl.length; i += (isLowEnd ? 4 : 2)) {
              const item = tmpl[i];
              const p = new Particle(birdX + item.baseX * 0.9, birdY + item.baseY * 0.9, item.color, "normal", isLowEnd);
              p.vx = item.baseX * 0.005; p.vy = -0.8; p.decay = 0.015; p.friction = 0.995; p.size = 1.6;
              particles.current.push(p);
            }
          }
        }
      }

      // 膝蓋粒子（原版保留）
      [leftKnee, rightKnee].forEach((knee, i) => {
        if (knee?.visibility > 0.3) {
          const kneeColor = i === 0 ? "#00FF00" : "#FF8C00";
          particles.current.push(new Particle((1 - knee.x) * w, knee.y * h, kneeColor, "normal", isLowEnd));
        }
      });

      // 粒子上限
      const maxP = isLowEnd ? 400 : 1000;
      if (particles.current.length > maxP)
        particles.current.splice(0, particles.current.length - maxP);

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0.05) particles.current.splice(i, 1);
        else p.draw(ctx);
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [isLowEnd, showDebug, mode]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10, // 煙火粒子在中間層
          mixBlendMode: "screen",
          filter: "contrast(1.2) brightness(1.1)",
        }}
      />

      {/* ★ 修改重點：確保 zIndex 高於所有元件 */}
      {showDebug && (
        <div
          ref={debugRef}
          style={{
            position: "absolute",
            bottom: "150px", // 改成 bottom，距離底部 150px（避開工具列）
            left: "15px",
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            color: "#0ef",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "10px",
            borderRadius: "8px",
            lineHeight: "1.6",
            pointerEvents: "none",
            border: "1px solid #0ef",
            boxShadow: "0 0 10px rgba(0, 239, 255, 0.3)"
          }}
        >
          {/* 這裡初始可以放個 Loading，直到 render 第一次更新 innerHTML */}
          LMA Initialization...
        </div>
      )}
    </>
  );
}