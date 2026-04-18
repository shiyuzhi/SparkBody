// src/Fireworks.jsx
import React, { useRef, useEffect } from "react";
import { drumKit } from "./Audio";
import { extractLMA, resetLMA } from "./lmaEngine";
import { logActivity } from "./AffectiveLogger";

// ─── Particle class ────────────────────────────────────────────────────────────
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

  // ✅ save/restore 已移除，由 render loop 批次管理 compositeOperation
  draw(ctx) {
    if (this.alpha <= 0.05) return;
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;

    if (this.isLowEnd) {
      ctx.globalCompositeOperation = "source-over";
      if (this.type === "explosion" || this.type === "ray") {
        ctx.beginPath();
        ctx.moveTo(this.x - this.size, this.y); ctx.lineTo(this.x + this.size, this.y);
        ctx.moveTo(this.x, this.y - this.size); ctx.lineTo(this.x, this.y + this.size);
        ctx.strokeStyle = this.color; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ─── Bird template ─────────────────────────────────────────────────────────────
function createBirdTemplate() {
  const t = [];
  for (let i = 0; i < 120; i++) {
    const r = Math.random();
    const halfW = Math.sin(r * Math.PI) * 14;
    t.push({ baseX: (r - 0.45) * 45, baseY: (Math.random() - 0.5) * halfW, color: r < 0.6 ? "#FFFFFF" : "#D0D0D0" });
  }
  for (let i = 0; i < 80; i++) {
    const tt = Math.random();
    const x = 20 + tt * 25;
    const fanAngle = tt * tt * 20;
    t.push({ baseX: x, baseY: (Math.random() - 0.5) * fanAngle, color: tt > 0.6 ? "#AAAAAA" : "#DDDDDD" });
  }
  for (let i = 0; i < 50; i++) {
    const rad = Math.random() * Math.PI * 2; const dist = Math.random();
    t.push({ baseX: -22 + Math.cos(rad) * 11 * dist, baseY: -8 + Math.sin(rad) * 11 * dist, color: "#FFFFFF" });
  }
  for (let i = 0; i < 15; i++)
    t.push({ baseX: -33 - Math.random() * 18, baseY: -7 + (Math.random() - 0.5) * 2.5, color: "#FFCC00" });
  for (let i = 0; i < 10; i++) {
    t.push({ baseX: -28 + Math.random() * 8, baseY: -15 + Math.random() * 8, color: "#222222" });
  }
  for (let i = 0; i < 180; i++) {
    const distX = Math.random() * 95; const tt = distX / 95;
    const arcY = Math.sin(tt * Math.PI) * -55;
    const spread = (1 - tt) * 10 + tt * 1.5;
    t.push({ baseX: -8 - distX, baseY: arcY + (Math.random() - 0.5) * spread, color: tt > 0.5 ? "#CCCCCC" : "#EEEEEE" });
  }
  for (let i = 0; i < 180; i++) {
    const distX = Math.random() * 95; const tt = distX / 95;
    const arcY = Math.sin(tt * Math.PI) * -55;
    const spread = (1 - tt) * 10 + tt * 1.5;
    t.push({ baseX: 8 + distX, baseY: arcY + (Math.random() - 0.5) * spread, color: tt > 0.5 ? "#CCCCCC" : "#EEEEEE" });
  }
  return t;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Fireworks({ poseDataRef, gestureDataRef, isLowEnd, showDebug = false, mode = "B", onLMAUpdate, onFrameReady }) {
  const canvasRef    = useRef(null);
  const particles    = useRef([]);
  const lmaRef       = useRef(null);
  const baselineLoggedRef = useRef(false);
  const lastContinuousLogTime = useRef(Date.now());
  const lastVictoryLogTime = useRef({ left: 0, right: 0 });
  const onFrameReadyRef = useRef(onFrameReady);
  useEffect(() => { onFrameReadyRef.current = onFrameReady; }, [onFrameReady]);

  const isLowEndRef = useRef(isLowEnd);
  const pendingLowEndRef = useRef(null);

  useEffect(() => {
    const next = isLowEnd;
    const curr = isLowEndRef.current;
    if (next === curr) return;
    if (!next) {
      pendingLowEndRef.current = false;
    } else {
      isLowEndRef.current = true;
    }
  }, [isLowEnd]);

  const showDebugRef = useRef(showDebug);
  useEffect(() => { showDebugRef.current = showDebug; }, [showDebug]);

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
    const soundPath = `${baseUrl}/sounds/FWSnare.mp3`.replace(/\/+/g, "/");
    drumKit.loadBuffer("boom", soundPath);
    const birdPath = `${baseUrl}/sounds/bird.mp3`.replace(/\/+/g, "/");
    drumKit.loadBuffer("bird", birdPath);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;

    // ✅ ResizeObserver 取代每幀 DOM read
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      canvas.width  = width;
      canvas.height = height;
    });
    ro.observe(canvas);

    const log = (activity, note = "", coords = {}) => {
      const lma = lmaRef.current;
      if (!lma) return;
      logActivity({
        activity,
        shape_n:       lma.n.shape  || 0,
        weight_n:      lma.n.weight || 0,
        flow_n:        lma.n.flow   || 0,
        kt:            lma.kt       || 0,
        baselineReady: lma.baselineReady,
        note,
        lh_x: coords.lh_x ?? null, lh_y: coords.lh_y ?? null,
        rh_x: coords.rh_x ?? null, rh_y: coords.rh_y ?? null,
        ls_x: coords.ls_x ?? null, ls_y: coords.ls_y ?? null,
        rs_x: coords.rs_x ?? null, rs_y: coords.rs_y ?? null,
      });
      if (showDebugRef.current)
        console.log(`[Logger] ${activity} | lh:(${coords.lh_x?.toFixed(3)}, ${coords.lh_y?.toFixed(3)})`);
    };

    let nowCoords = {};

    const createSmallHeart = (centerX, centerY, screenScale = 1) => {
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
        p.vx = (Math.random() - 0.5) * 0.5 * screenScale; p.vy = (Math.random() - 0.5) * 0.5 * screenScale;
        particles.current.push(p);
      }
      const _p = poseDataRef.current;
      log("Heart", "", {
        lh_x: typeof _p?.leftHand?.x      === "number" ? _p.leftHand.x      : null,
        lh_y: typeof _p?.leftHand?.y      === "number" ? _p.leftHand.y      : null,
        rh_x: typeof _p?.rightHand?.x     === "number" ? _p.rightHand.x     : null,
        rh_y: typeof _p?.rightHand?.y     === "number" ? _p.rightHand.y     : null,
        ls_x: typeof _p?.leftShoulder?.x  === "number" ? _p.leftShoulder.x  : null,
        ls_y: typeof _p?.leftShoulder?.y  === "number" ? _p.leftShoulder.y  : null,
        rs_x: typeof _p?.rightShoulder?.x === "number" ? _p.rightShoulder.x : null,
        rs_y: typeof _p?.rightShoulder?.y === "number" ? _p.rightShoulder.y : null,
      });
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    const lastFrameTime = { t: 0 };

    const render = (timestamp) => {
      // ✅ Frame budget：33.3ms 上限保護，超過 60fps 才跳幀
      if (timestamp - lastFrameTime.t < 33.3) {
        raf = requestAnimationFrame(render);
        return;
      }
      lastFrameTime.t = timestamp;

      // LITE → HD 延遲切換
      if (pendingLowEndRef.current === false) {
        particles.current = [];
        isLowEndRef.current = false;
        pendingLowEndRef.current = null;
      }

      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(render); return; }
      const scale = Math.min(w, h) / 900;

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = isLowEndRef.current ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);

      const currentPose = poseDataRef.current;
      const hasLeftHand  = currentPose?.leftHand  && currentPose.leftHand.visibility  > 0.5;
      const hasRightHand = currentPose?.rightHand && currentPose.rightHand.visibility > 0.5;
      if (!currentPose || (!hasLeftHand && !hasRightHand)) {
        raf = requestAnimationFrame(render);
        return;
      }

      const { leftHand, rightHand, leftKnee, rightKnee,
              leftElbow, rightElbow, leftShoulder, rightShoulder } = currentPose;

      nowCoords = {
        lh_x: typeof leftHand?.x      === "number" ? leftHand.x      : null,
        lh_y: typeof leftHand?.y      === "number" ? leftHand.y      : null,
        rh_x: typeof rightHand?.x     === "number" ? rightHand.x     : null,
        rh_y: typeof rightHand?.y     === "number" ? rightHand.y     : null,
        ls_x: typeof leftShoulder?.x  === "number" ? leftShoulder.x  : null,
        ls_y: typeof leftShoulder?.y  === "number" ? leftShoulder.y  : null,
        rs_x: typeof rightShoulder?.x === "number" ? rightShoulder.x : null,
        rs_y: typeof rightShoulder?.y === "number" ? rightShoulder.y : null,
      };

      // ── LMA ─────────────────────────────────────────────────────────────
      const lma = extractLMA(currentPose);
      if (lma) {
        lmaRef.current = lma;
        onLMAUpdate?.(lma);
        if (lma.baselineReady && !baselineLoggedRef.current) {
          baselineLoggedRef.current = true;
          log("Baseline_End", "baseline calibrated", nowCoords);
        }
        const now = Date.now();
        if (lma.baselineReady && (now - lastContinuousLogTime.current > 30000)) {
          log("Dance_Continuous", "30s_Interval_AutoLog", nowCoords);
          lastContinuousLogTime.current = now;
        }
      }

      // ── 手部粒子 + 手勢（✅ forEach → if block）────────────────────────
      // LEFT
      const lPos = currentPose?.leftHand;
      if (lPos && lPos.visibility > 0.45) {
        const lx = (1 - lPos.x) * w, ly = lPos.y * h;
        const pan = (lx / w) * 2 - 1;
        const gesture = currentPose?.leftHandGesture;
        if (!status.current.leftColor) status.current.leftColor = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
        particles.current.push(new Particle(lx, ly, status.current.leftColor, "normal", isLowEndRef.current));

        if (gesture === "Victory") {
          if (Math.random() > 0.8) drumKit.play("boom", { volume: 0.2, detune: 1000, pan });
          const now = Date.now();
          if (now - lastVictoryLogTime.current.left > 2000) { log("Victory", "left", nowCoords); lastVictoryLogTime.current.left = now; }
          for (let i = 0; i < (isLowEndRef.current ? 1 : 3); i++) {
            const p = new Particle(lx, ly, i % 2 === 0 ? "#FFF" : "#00FFFF", "ray", isLowEndRef.current);
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * 10 * scale; p.vy = Math.sin(a) * 10 * scale;
            particles.current.push(p);
          }
          status.current.leftCount = 0; status.current.leftReady = false;
        } else if (gesture === "Closed_Fist") {
          status.current.leftCount = (status.current.leftCount || 0) + 1;
          if (status.current.leftCount > 5) status.current.leftReady = true;
        } else if (gesture === "Open_Palm") {
          status.current.leftCount = 0;
          if (status.current.leftReady) {
            status.current.leftColor = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
            drumKit.play("boom", { volume: 0.6, detune: 0, pan });
            const lmaC = lmaRef.current;
            const kt = lmaC?.kt ?? 0.5, weight = lmaC?.n?.weight ?? 0.5, spread = lmaC?.n?.shape ?? 0.5;
            const count = Math.round(20 + kt * 60), speedSc = 0.5 + weight * 1.5, angleR = Math.PI * (0.5 + spread * 1.5);
            for (let i = 0; i < (isLowEndRef.current ? 8 : count); i++) {
              const p = new Particle(lx, ly, status.current.leftColor, "explosion", isLowEndRef.current);
              const angle = (Math.random() - 0.5) * angleR * 2, speed = (Math.random() * 4 + 4) * speedSc;
              p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
              particles.current.push(p);
            }
            log("Fireworks_Explosion", "left", nowCoords);
            status.current.leftReady = false;
          }
        } else {
          status.current.leftCount = 0; status.current.leftReady = false;
        }
      }

      // RIGHT
      const rPos = currentPose?.rightHand;
      if (rPos && rPos.visibility > 0.45) {
        const rx = (1 - rPos.x) * w, ry = rPos.y * h;
        const pan = (rx / w) * 2 - 1;
        const gesture = currentPose?.rightHandGesture;
        if (!status.current.rightColor) status.current.rightColor = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
        particles.current.push(new Particle(rx, ry, status.current.rightColor, "normal", isLowEndRef.current));

        if (gesture === "Victory") {
          if (Math.random() > 0.8) drumKit.play("boom", { volume: 0.2, detune: 1000, pan });
          const now = Date.now();
          if (now - lastVictoryLogTime.current.right > 2000) { log("Victory", "right", nowCoords); lastVictoryLogTime.current.right = now; }
          for (let i = 0; i < (isLowEndRef.current ? 1 : 3); i++) {
            const p = new Particle(rx, ry, i % 2 === 0 ? "#FFF" : "#00FFFF", "ray", isLowEndRef.current);
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * 10 * scale; p.vy = Math.sin(a) * 10 * scale;
            particles.current.push(p);
          }
          status.current.rightCount = 0; status.current.rightReady = false;
        } else if (gesture === "Closed_Fist") {
          status.current.rightCount = (status.current.rightCount || 0) + 1;
          if (status.current.rightCount > 5) status.current.rightReady = true;
        } else if (gesture === "Open_Palm") {
          status.current.rightCount = 0;
          if (status.current.rightReady) {
            status.current.rightColor = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;
            drumKit.play("boom", { volume: 0.6, detune: 0, pan });
            const lmaC = lmaRef.current;
            const kt = lmaC?.kt ?? 0.5, weight = lmaC?.n?.weight ?? 0.5, spread = lmaC?.n?.shape ?? 0.5;
            const count = Math.round(20 + kt * 60), speedSc = 0.5 + weight * 1.5, angleR = Math.PI * (0.5 + spread * 1.5);
            for (let i = 0; i < (isLowEndRef.current ? 8 : count); i++) {
              const p = new Particle(rx, ry, status.current.rightColor, "explosion", isLowEndRef.current);
              const angle = (Math.random() - 0.5) * angleR * 2, speed = (Math.random() * 4 + 4) * speedSc;
              p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
              particles.current.push(p);
            }
            log("Fireworks_Explosion", "right", nowCoords);
            status.current.rightReady = false;
          }
        } else {
          status.current.rightCount = 0; status.current.rightReady = false;
        }
      }

      // ── 雙手碰 → 愛心 ────────────────────────────────────────────────────
      if (leftHand?.visibility > 0.7 && rightHand?.visibility > 0.7) {
        const lx = (1 - leftHand.x) * w, ly = leftHand.y * h;
        const rx = (1 - rightHand.x) * w, ry = rightHand.y * h;
        const distance2D = Math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2);
        if (distance2D < 90) {
          if (!status.current.handsTouching) {
            status.current.touchCounter++;
            if (status.current.touchCounter >= 3) {
              createSmallHeart((lx + rx) / 2, (ly + ry) / 2, scale);
              status.current.handsTouching = true;
              status.current.touchCounter = 0;
            }
          }
        } else if (distance2D > 130) {
          status.current.touchCounter = 0;
          status.current.handsTouching = false;
        }
      }

      // ── 🦅 Gull Flap ──────────────────────────────────────────────────────
      if (leftHand.visibility > 0.8 && rightHand.visibility > 0.8 && leftShoulder && rightShoulder) {
        const now = Date.now();
        const bStatus = birdStatus.current;
        const leftDY = (bStatus.prevLY ?? leftHand.y) - leftHand.y;
        const rightDY = (bStatus.prevRY ?? rightHand.y) - rightHand.y;
        bStatus.prevLY = leftHand.y; bStatus.prevRY = rightHand.y;

        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 0.1;
        const wingspan = Math.abs(leftHand.x - rightHand.x);
        const leftArmExt = Math.abs(leftHand.x - leftShoulder.x);
        const rightArmExt = Math.abs(rightHand.x - rightShoulder.x);
        const isExtended = leftArmExt > shoulderWidth * 1.1 && rightArmExt > shoulderWidth * 1.1;
        const MIN_WINGSPAN = shoulderWidth * 2.5;
        const handsAreHigh = leftHand.y < leftShoulder.y && rightHand.y < rightShoulder.y;
        const FLAP_SPEED = shoulderWidth * 0.12;
        const avgDY = (leftDY + rightDY) / 2;

        if (handsAreHigh && wingspan > MIN_WINGSPAN && isExtended && avgDY < -FLAP_SPEED) {
          if (now - (bStatus.lastTriggerTime || 0) > 1000) {
            bStatus.lastTriggerTime = now;
            drumKit.play("bird", { volume: 0.8, detune: -200, duration: 1.5 });
            log("Gull_Flap", "", nowCoords);
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

      // ── 膝蓋粒子（✅ forEach → if block）────────────────────────────────
      if (leftKnee?.visibility > 0.3)
        particles.current.push(new Particle((1 - leftKnee.x) * w, leftKnee.y * h, "#00FF00", "normal", isLowEndRef.current));
      if (rightKnee?.visibility > 0.3)
        particles.current.push(new Particle((1 - rightKnee.x) * w, rightKnee.y * h, "#FF8C00", "normal", isLowEndRef.current));

      // 粒子上限
      const maxP = isLowEndRef.current ? 150 : 1000;
      if (particles.current.length > maxP) particles.current.length = maxP;

      // ✅ swap-and-pop：單次 pass，無 splice，無陣列搬移
      let alive = 0;
      for (let i = 0; i < particles.current.length; i++) {
        const p = particles.current[i];
        p.update();
        if (p.alpha > 0.05) {
          p.draw(ctx);
          particles.current[alive++] = p;
        }
      }
      particles.current.length = alive;

      // ── HUD（手勢 + LMA）────────────────────────────────────────────────
      if (currentPose) {
        const leftG  = currentPose.leftHandGesture  || "None";
        const rightG = currentPose.rightHandGesture || "None";
        const toolbarH = 75, panelH = 60;
        const panelY = h - toolbarH - panelH;

        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(15, panelY, 210, 60);
        ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
        ctx.strokeRect(15, panelY, 210, 60);

        ctx.font = "bold 12px monospace"; ctx.textAlign = "left";
        ctx.fillStyle = "#888"; ctx.fillText("LEFT", 25, panelY + 20);
        ctx.fillStyle = leftG !== "None" && leftG !== "Lost" ? "#ffcc00" : "#555";
        ctx.fillText(leftG, 25, panelY + 42);
        ctx.fillStyle = "#333"; ctx.fillRect(100, panelY + 10, 1, 40);
        ctx.fillStyle = "#888"; ctx.fillText("RIGHT", 115, panelY + 20);
        ctx.fillStyle = rightG !== "None" && rightG !== "Lost" ? "#00e5ff" : "#555";
        ctx.fillText(rightG, 115, panelY + 42);

        if (showDebugRef.current && lmaRef.current) {
          const lma = lmaRef.current;
          const lmaX = 15, lmaW = 260, lmaH2 = 175;
          const lmaTop = h - toolbarH - lmaH2;

          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(lmaX, lmaTop, lmaW, lmaH2);
          ctx.strokeStyle = lma.baselineReady ? "#0ef" : "#f80";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(lmaX, lmaTop, lmaW, lmaH2);

          ctx.font = "bold 15px monospace";
          ctx.fillStyle = lma.baselineReady ? "#0ef" : "#ffd";
          ctx.fillText(
            lma.baselineReady ? "✓ LMA READY" : `⏳ CALIBRATING ${Math.round(lma.baselineProgress * 100)}%`,
            lmaX + 10, lmaTop + 22
          );

          if (!lma.baselineReady) {
            ctx.fillStyle = "#333"; ctx.fillRect(lmaX + 10, lmaTop + 28, lmaW - 20, 8);
            ctx.fillStyle = "#f80"; ctx.fillRect(lmaX + 10, lmaTop + 28, (lmaW - 20) * lma.baselineProgress, 8);
          }

          // ✅ drawRow 內冗餘的 const w/h 宣告已移除，使用外層 w/h
          const drawRow = (label, val, color, y) => {
            ctx.font = "13px monospace"; ctx.fillStyle = "#aaa";
            ctx.fillText(label, lmaX + 10, y);
            ctx.font = "bold 13px monospace"; ctx.fillStyle = "#fff";
            ctx.fillText((val || 0).toFixed(3), lmaX + lmaW - 48, y);
            ctx.fillStyle = "#333"; ctx.fillRect(lmaX + 10, y + 5, lmaW - 20, 9);
            ctx.fillStyle = color;
            ctx.fillRect(lmaX + 10, y + 5, Math.min(lmaW - 20, (val || 0) * (lmaW - 20)), 9);
          };

          drawRow("SPACE",  lma.n.shape,  "#4ef", lmaTop + 52);
          drawRow("WEIGHT", lma.n.weight, "#f84", lmaTop + 90);
          drawRow("FLOW",   lma.n.flow,   "#8f8", lmaTop + 128);
          ctx.fillStyle = "#f9a"; ctx.font = "bold 15px monospace";
          ctx.fillText(`KT  ${lma.kt.toFixed(3)}`, lmaX + 10, lmaTop + 163);
        }
      }

      onFrameReadyRef.current?.(canvas);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      id="fireworks-canvas"
      style={{
        position: "absolute", top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 10,
        mixBlendMode: "screen",
        filter: "contrast(1.2) brightness(1.1)",
      }}
    />
  );
}