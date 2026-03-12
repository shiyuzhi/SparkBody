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
// ✅ INP 優化版本：接收 Ref 而不是 Props，避免每秒 30 次重新渲染
export default function Fireworks({ poseDataRef, gestureDataRef, isLowEnd, showDebug = false, mode = "B", onLMAUpdate, onFrameReady }) {
  const canvasRef    = useRef(null);
  const debugRef     = useRef(null);  // overlay div
  const particles    = useRef([]);
  const lmaRef       = useRef(null);  // ← 最新 LMA 計算結果
  const baselineLoggedRef = useRef(false);
  const lastContinuousLogTime = useRef(Date.now());
  const lastVictoryLogTime = useRef({ left: 0, right: 0 });
  const onFrameReadyRef = useRef(onFrameReady);
  useEffect(() => { onFrameReadyRef.current = onFrameReady; }, [onFrameReady]);
  
  // ✅ isLowEnd / showDebug 改用 Ref，避免切換時重新初始化整個 RAF
  const isLowEndRef = useRef(isLowEnd);
  const pendingLowEndRef = useRef(null); // null = 無待切換，true/false = 待切換目標值

  useEffect(() => {
    const next = isLowEnd;
    const curr = isLowEndRef.current;
    if (next === curr) return;
    if (!next) {
      // LITE → HD：先清粒子，下一幀 render loop 裡再正式切換
      pendingLowEndRef.current = false;
    } else {
      // HD → LITE：直接切，粒子少不會爆量
      isLowEndRef.current = true;
    }
  }, [isLowEnd]);

  const showDebugRef = useRef(showDebug);
  useEffect(() => { showDebugRef.current = showDebug; }, [showDebug]);

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
      const numPoints = isLowEndRef.current ? 10 : 40;
      const scale = 5; const offsetY = centerY - 80;
      for (let i = 0; i < numPoints; i++) {
        const t       = (i / numPoints) * Math.PI * 2;
        const xOffset = scale * (16 * Math.pow(Math.sin(t), 3));
        const yOffset = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const color = i % 2 === 0 ? "#ff4d4d" : "#ff85a2";
        const p = new Particle(centerX + xOffset, offsetY + yOffset, color, "heart", isLowEndRef.current);
        p.vx = (Math.random() - 0.5) * 0.5; p.vy = (Math.random() - 0.5) * 0.5;
        particles.current.push(p);
      }
      // ★ Log heart event
      log("Heart");
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    const render = () => {
      // LITE → HD 延遲切換：等粒子陣列清空後才正式切換
      if (pendingLowEndRef.current === false) {
        particles.current = [];
        isLowEndRef.current = false;
        pendingLowEndRef.current = null;
      }

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
      }
      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(render); return; }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = isLowEndRef.current ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const currentPose = poseDataRef.current;

      // 第一道防線：兩隻手都不見才跳過（支援單手互動）
      const hasLeftHand  = currentPose?.leftHand  && currentPose.leftHand.visibility  > 0.5;
      const hasRightHand = currentPose?.rightHand && currentPose.rightHand.visibility > 0.5;
      if (!currentPose || (!hasLeftHand && !hasRightHand)) {
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
        onLMAUpdate?.(lma);

        if (lma.baselineReady && !baselineLoggedRef.current) {
          baselineLoggedRef.current = true;
          log("Baseline_End", "30s baseline calibrated");
        }

        const now = Date.now();
        if (lma.baselineReady && (now - lastContinuousLogTime.current > 30000)) {
          log("Dance_Continuous", "30s_Interval_AutoLog");
          lastContinuousLogTime.current = now;
        }

      }
      // ══════════════════════════════════════════════════════════════════════
      // 手部粒子 + 手勢（修正版：互斥判定與能見度優化）
      // ══════════════════════════════════════════════════════════════════════
      ["leftHand", "rightHand"].forEach((key) => {
        const pos = currentPose?.[key];
        // 修正：放寬門檻至 0.45，避免雙手模式下因效能波動導致單手消失
        if (!pos || pos.visibility <= 0.45) return; 

        const x = (1 - pos.x) * w;
        const y = pos.y * h;
        const side = key === "leftHand" ? "left" : "right";
        const sideKey = side;
        const gesture = currentPose?.[side + "HandGesture"];
        
        if (!status.current[side + "Color"]) {
          const hue = Math.floor(Math.random() * 360);
          status.current[side + "Color"] = `hsl(${hue}, 100%, 60%)`;
        }
        const color = status.current[side + "Color"];
        const pan = (x / w) * 2 - 1;

        // 常態粒子發散
        particles.current.push(new Particle(x, y, color, "normal", isLowEndRef.current));

        // --- 手勢邏輯判定區 (修正為互斥結構) ---
        if (gesture === "Victory") {
          // 1. 勝利手勢判定
          if (Math.random() > 0.8) drumKit.play("boom", { volume: 0.2, detune: 1000, pan });
          
          const now = Date.now();
          if (now - lastVictoryLogTime.current[sideKey] > 2000) {
            log("Victory", sideKey);
            lastVictoryLogTime.current[sideKey] = now;
          }

          for (let i = 0; i < (isLowEndRef.current ? 1 : 3); i++) {
            const rayColor = i % 2 === 0 ? "#FFF" : "#00FFFF";
            const p = new Particle(x, y, rayColor, "ray", isLowEndRef.current);
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * 10; p.vy = Math.sin(a) * 10;
            particles.current.push(p);
          }
          // 確保比 Ya 的時候，握拳狀態與 Ready 狀態被鎖定，不產生誤觸
          status.current[side + "Count"] = 0;
          status.current[side + "Ready"] = false;

        } else if (gesture === "Closed_Fist") {
          // 2. 握拳判定 (蓄力中)
          status.current[side + "Count"] = (status.current[side + "Count"] || 0) + 1;
          if (status.current[side + "Count"] > 5) { // 穩定握拳超過 3 幀才算準備好了
            status.current[side + "Ready"] = true;
          }

        } else if (gesture === "Open_Palm") {
          // 3. 張掌判定 (觸發煙火)
          status.current[side + "Count"] = 0;
          if (status.current[side + "Ready"]) {
            const newHue = Math.floor(Math.random() * 360);
            status.current[side + "Color"] = `hsl(${newHue}, 100%, 60%)`;
            const explosionColor = status.current[side + "Color"];
            drumKit.play("boom", { volume: 0.6, detune: 0, pan });
            
          for (let i = 0; i < (isLowEndRef.current ? 8 : 40); i++) {
              particles.current.push(new Particle(x, y, explosionColor, "explosion", isLowEndRef.current));
            }

            log("Fireworks_Explosion", side);
            status.current[side + "Ready"] = false;
          }
        } else {
          // 4. 其餘狀態 (None/Lost) 緩慢重置
          status.current[side + "Count"] = 0;
          status.current[side + "Ready"] = false;
        }
      });
       
      // ══════════════════════════════════════════════════════════════════════
      // 雙手碰 → 愛心（精準判定版）
      // ══════════════════════════════════════════════════════════════════════
      if (leftHand?.visibility > 0.7 && rightHand?.visibility > 0.7) {
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const distance2D = Math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2);

        if (distance2D < 90) { // 距離放寬到 90px，手晃一下不會斷
          if (!status.current.handsTouching) {
            status.current.touchCounter++;
            if (status.current.touchCounter >= 3) { // 3 幀就夠，不用等 8 幀
              createSmallHeart((lx + rx) / 2, (ly + ry) / 2);
              status.current.handsTouching = true;
              status.current.touchCounter = 0; // 重置，下次才能再觸發
            }
          }
        } else if (distance2D > 130) { // 分開夠遠才重置
          status.current.touchCounter = 0;
          status.current.handsTouching = false;
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
            for (let i = 0; i < tmpl.length; i += (isLowEndRef.current ? 8 : 2)) {
              const item = tmpl[i];
              const p = new Particle(birdX + item.baseX * 0.9, birdY + item.baseY * 0.9, item.color, "normal", isLowEndRef.current);
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
          particles.current.push(new Particle((1 - knee.x) * w, knee.y * h, kneeColor, "normal", isLowEndRef.current));
        }
      });

      // 粒子上限（低端激進降級：400 → 150，削減 62.5%）
      const maxP = isLowEndRef.current ? 150 : 1000;
      if (particles.current.length > maxP)
        particles.current.splice(0, particles.current.length - maxP);

      // ── 粒子繪製（Particle.draw() 內部已根據 p.isLowEnd 分支處理）─────────
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        if (p.alpha <= 0.05) particles.current.splice(i, 1);
        else p.draw(ctx);
      }

      // ── 手勢 + LMA 數據畫進 Canvas（錄影才抓得到）──
      if (currentPose) {
        const leftG  = currentPose.leftHandGesture  || "None";
        const rightG = currentPose.rightHandGesture || "None";
        const toolbarH = 75;
        const panelH = 60;
        const lmaH = 105;
        const panelY = h - toolbarH - panelH;
        const lmaY   = h - toolbarH - lmaH;

        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(15, panelY, 210, 60);
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.strokeRect(15, panelY, 210, 60);

        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";

        ctx.fillStyle = "#888";
        ctx.fillText("LEFT", 25, panelY + 20);
        ctx.fillStyle = leftG !== "None" && leftG !== "Lost" ? "#ffcc00" : "#555";
        ctx.fillText(leftG, 25, panelY + 42);

        ctx.fillStyle = "#333";
        ctx.fillRect(100, panelY + 10, 1, 40);

        ctx.fillStyle = "#888";
        ctx.fillText("RIGHT", 115, panelY + 20);
        ctx.fillStyle = rightG !== "None" && rightG !== "Lost" ? "#00e5ff" : "#555";
        ctx.fillText(rightG, 115, panelY + 42);

        if (showDebugRef.current && lmaRef.current) {
          const lma = lmaRef.current;
          const lmaX = 15;
          const lmaW = 260, lmaH2 = 175;
          const lmaTop = h - toolbarH - lmaH2;

          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(lmaX, lmaTop, lmaW, lmaH2);
          ctx.strokeStyle = lma.baselineReady ? "#0ef" : "#f80";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(lmaX, lmaTop, lmaW, lmaH2);

          // 標題
          ctx.font = "bold 15px monospace";
          ctx.fillStyle = lma.baselineReady ? "#0ef" : "#ffd";
          ctx.fillText(
            lma.baselineReady ? "✓ LMA READY" : `⏳ CALIBRATING ${Math.round(lma.baselineProgress * 100)}%`,
            lmaX + 10, lmaTop + 22
          );

          // 進度條（calibrating 時顯示）
          if (!lma.baselineReady) {
            ctx.fillStyle = "#333";
            ctx.fillRect(lmaX + 10, lmaTop + 28, lmaW - 20, 8);
            ctx.fillStyle = "#f80";
            ctx.fillRect(lmaX + 10, lmaTop + 28, (lmaW - 20) * lma.baselineProgress, 8);
          }

          // 各項數值 + 進度條（label 在上，bar 在下，數值右對齊）
          const drawRow = (label, val, color, y) => {
            // label 左 + 數值右，同一行
            ctx.font = "13px monospace";
            ctx.fillStyle = "#aaa";
            ctx.fillText(label, lmaX + 10, y);
            ctx.font = "bold 13px monospace";
            ctx.fillStyle = "#fff";
            ctx.fillText((val || 0).toFixed(3), lmaX + lmaW - 48, y);
            // 進度條在文字下方 4px
            ctx.fillStyle = "#333";
            ctx.fillRect(lmaX + 10, y + 5, lmaW - 20, 9);
            ctx.fillStyle = color;
            ctx.fillRect(lmaX + 10, y + 5, Math.min(lmaW - 20, (val || 0) * (lmaW - 20)), 9);
          };

          // 每行間距 38px（13px字 + 9px條 + 16px間距）
          drawRow("SPACE",  lma.n.shape,  "#4ef", lmaTop + 52);
          drawRow("WEIGHT", lma.n.weight, "#f84", lmaTop + 90);
          drawRow("FLOW",   lma.n.flow,   "#8f8", lmaTop + 128);

          ctx.fillStyle = "#f9a";
          ctx.font = "bold 15px monospace";
          ctx.fillText(`KT  ${lma.kt.toFixed(3)}`, lmaX + 10, lmaTop + 163);
        }
      }

      // 通知 CanvasRecorder 這一幀已畫完，可以合成錄影
      onFrameReadyRef.current?.(canvas);

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [mode]); // ✅ 只依賴 mode，不依賴 isLowEnd/showDebug（改用 Ref）
  
 return (
    <>
      <canvas
        ref={canvasRef}
        id="fireworks-canvas"
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
      {/* 原本在這裡的 {showDebug && <div ref={debugRef}...>} 已被刪除。
          所有的 Debug 資訊現在都透過 ctx.fillText 直接畫在上面的 canvas 裡。
          這樣 CanvasRecorder 錄製出來的 WebM 才會包含這些數據。
      */}
    </>
  );
}