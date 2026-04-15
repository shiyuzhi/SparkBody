import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ── 常數與初始資料 ─────────────────────────────────────
const W_WEIGHT = 0.40, F_WEIGHT = 0.35, S_WEIGHT = 0.25;
const EMA_ALPHA = 0.15, J_MAX = 0.025, HIST_LEN = 120;

const INIT_JOINTS = {
  head: { x: 0.50, y: 0.10 }, neck: { x: 0.50, y: 0.18 },
  ls:   { x: 0.38, y: 0.24 }, rs:   { x: 0.62, y: 0.24 },
  le:   { x: 0.28, y: 0.36 }, re:   { x: 0.72, y: 0.36 },
  lh:   { x: 0.20, y: 0.48 }, rh:   { x: 0.80, y: 0.48 },
  lhip: { x: 0.43, y: 0.52 }, rhip: { x: 0.57, y: 0.52 },
  lk:   { x: 0.41, y: 0.70 }, rk:   { x: 0.59, y: 0.70 },
  lf:   { x: 0.39, y: 0.88 }, rf:   { x: 0.61, y: 0.88 },
};

const BONES = [
  ["head","neck"],["neck","ls"],["neck","rs"],["ls","le"],["le","lh"],
  ["rs","re"],["re","rh"],["neck","lhip"],["neck","rhip"],["lhip","rhip"],
  ["lhip","lk"],["lk","lf"],["rhip","rk"],["rk","rf"],
];
const DRAGGABLE = ["lh","rh","le","re","ls","rs"];

// ── 輔助繪圖與 UI 元件 ─────────────────────────────────
function drawKinesphere(ctx, cx, cy, rx, ry) {
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,0.10)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry*0.25, 0, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx*0.18, ry, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function Bar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize: 11, fontFamily:"monospace", marginBottom:3 }}>
        <span style={{ fontWeight:700 }}>{label}</span>
        <span>{value.toFixed(3)}</span>
      </div>
      <div style={{ height:6, background:"#eee", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${value*100}%`, background:color, borderRadius:3, transition:"width 0.08s" }} />
      </div>
    </div>
  );
}

function Sparkline({ hist, color }) {
  const cvRef = useRef();
  useEffect(() => {
    const cv = cvRef.current; if (!cv || hist.length < 2) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    hist.forEach((v,i) => {
      const x = (i/(HIST_LEN-1))*cv.width, y = cv.height - v*cv.height;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
  }, [hist, color]);
  return <canvas ref={cvRef} width={200} height={36} style={{ width:"100%", height:36, display:"block" }} />;
}

// ── 主面板元件 ─────────────────────────────────────────
export default function LMADemoPanel({ lmaDataRef }) {
  const canvasRef = useRef(null);
  
  // 初始化物理狀態
  const jointRef = useRef(JSON.parse(JSON.stringify(INIT_JOINTS)));
  const dragRef = useRef(null);
  const physRef = useRef({
    prev: { lh:{...INIT_JOINTS.lh}, rh:{...INIT_JOINTS.rh} },
    ema:  { lhY: INIT_JOINTS.lh.y, rhY: INIT_JOINTS.rh.y },
    vel:  { lhY:0, rhY:0 }, acc: { lhY:0, rhY:0 }, jrk: { lhY:0, rhY:0 }
  });

  const [lma, setLma] = useState({ W:0, F:1, S:0.3, KT:0 });
  const [histW, setHistW] = useState([]);
  const [histF, setHistF] = useState([]);
  const [histKT, setHistKT] = useState([]);

  // ── 核心動畫與極致暴力的原生事件攔截 ──────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf, frameCount = 0;

    // 獲取滑鼠/觸控在畫布上的相對座標
    const getPos = (e) => {
      const r = cv.getBoundingClientRect();
      const cx = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX || 0);
      const cy = e.clientY !== undefined ? e.clientY : (e.touches?.[0]?.clientY || 0);
      return { x: (cx - r.left)/r.width, y: (cy - r.top)/r.height };
    };

    // 💥 絕對捕獲階段的按鈕按下事件
    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // 強制攔截，煙火絕對收不到這個點擊！

      const pos = getPos(e);
      let closest = null, minD = 0.20; // 20% 超大吸附範圍，隨便點都中
      
      DRAGGABLE.forEach(name => {
        const j = jointRef.current[name];
        const d = Math.hypot(j.x - pos.x, j.y - pos.y);
        if (d < minD) { minD = d; closest = name; }
      });

      if (closest) {
        dragRef.current = closest;
        
        // 【防護機制】：安全呼叫 setPointerCapture
        if (e.pointerId !== undefined) {
          try {
            cv.setPointerCapture(e.pointerId);
          } catch (err) {
            console.warn("Pointer capture ignored (browser unsupported or invalid ID):", err);
          }
        }
      }
    };

    // 💥 絕對捕獲階段的移動事件
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const pos = getPos(e);
      const name = dragRef.current;
      const j = jointRef.current;
      
      j[name].x = Math.max(0.05, Math.min(0.95, pos.x));
      j[name].y = Math.max(0.05, Math.min(0.95, pos.y));
      
      // 連動手肘
      if (name==="lh") { j.le.x = (j.ls.x + pos.x)*0.5; j.le.y = (j.ls.y + pos.y)*0.5; }
      if (name==="rh") { j.re.x = (j.rs.x + pos.x)*0.5; j.re.y = (j.rs.y + pos.y)*0.5; }
    };

    const onPointerUp = (e) => {
      if (dragRef.current) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // 【防護機制】：安全釋放 releasePointerCapture
        if (e.pointerId !== undefined) {
          try {
            if (cv.hasPointerCapture && cv.hasPointerCapture(e.pointerId)) {
              cv.releasePointerCapture(e.pointerId);
            }
          } catch (err) {}
        }
        dragRef.current = null;
      }
    };

    // 💥 關鍵字 { capture: true }：在事件抵達 App.jsx 裡的煙火外掛之前劫走！
    cv.addEventListener("pointerdown", onPointerDown, { capture: true, passive: false });
    cv.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    cv.addEventListener("pointerup", onPointerUp, { capture: true });
    cv.addEventListener("pointercancel", onPointerUp, { capture: true });

    // ── 動畫引擎迴圈 ──
    const loop = () => {
      const W = cv.width, H = cv.height, j = jointRef.current, phys = physRef.current;

      // 運算 LMA
      phys.ema.lhY = EMA_ALPHA * j.lh.y + (1-EMA_ALPHA) * phys.ema.lhY;
      phys.ema.rhY = EMA_ALPHA * j.rh.y + (1-EMA_ALPHA) * phys.ema.rhY;
      const dvLH = phys.ema.lhY - phys.prev.lh.y, dvRH = phys.ema.rhY - phys.prev.rh.y;
      const currW = Math.min(Math.max(Math.abs(dvLH), Math.abs(dvRH)) * 40, 1);

      const newAccL = dvLH - phys.vel.lhY, newAccR = dvRH - phys.vel.rhY;
      const J = Math.max(Math.abs(newAccL - phys.acc.lhY), Math.abs(newAccR - phys.acc.rhY));
      phys.acc.lhY = newAccL; phys.acc.rhY = newAccR; phys.vel.lhY = dvLH; phys.vel.rhY = dvRH;

      const currF = 1 - Math.min(J / J_MAX, 1);
      const currS = Math.min(Math.hypot(j.lh.x-j.rh.x, j.lh.y-j.rh.y) / (Math.abs(j.rs.x-j.ls.x)||0.24) / 2, 1);
      const currKT = W_WEIGHT*currW + F_WEIGHT*(1-currF) + S_WEIGHT*currS;

      phys.prev.lh = { x: j.lh.x, y: phys.ema.lhY };
      phys.prev.rh = { x: j.rh.x, y: phys.ema.rhY };

      // 清空與繪製
      ctx.clearRect(0, 0, W, H);
      drawKinesphere(ctx, W*0.5, H*0.42, W*0.32 + Math.abs(j.lh.x-j.rh.x)*W*0.15, H*0.38);

      ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      BONES.forEach(([a,b]) => {
        ctx.beginPath(); ctx.moveTo(j[a].x*W, j[a].y*H); ctx.lineTo(j[b].x*W, j[b].y*H); ctx.stroke();
      });

      Object.entries(j).forEach(([name, pos]) => {
        const isDrag = DRAGGABLE.includes(name), isWrist = name==="lh"||name==="rh";
        ctx.beginPath(); ctx.arc(pos.x*W, pos.y*H, isWrist?7 : isDrag?5 : 3.5, 0, Math.PI*2);
        ctx.fillStyle = isWrist ? "#111" : isDrag ? "#555" : "#999"; ctx.fill();
        if (isDrag) { ctx.strokeStyle="#111"; ctx.lineWidth=1.5; ctx.stroke(); }
      });

      ctx.setLineDash([4,5]); ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(j.lh.x*W, j.lh.y*H); ctx.lineTo(j.rh.x*W, j.rh.y*H); ctx.stroke();
      ctx.setLineDash([]);

      frameCount++;
      if (frameCount % 5 === 0) {
        setLma({ W: currW, F: currF, S: currS, KT: currKT });
        setHistW(h => [...h.slice(-(HIST_LEN-1)), currW]);
        setHistF(h => [...h.slice(-(HIST_LEN-1)), currF]);
        setHistKT(h => [...h.slice(-(HIST_LEN-1)), currKT]);
        
        // 如果外部有傳 lmaDataRef 進來（例如用來觸發聲音或煙火），就更新它
        if (lmaDataRef && dragRef.current) {
          lmaDataRef.current = { W: currW, F: currF, S: currS, KT: currKT };
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onPointerDown, { capture: true });
      cv.removeEventListener("pointermove", onPointerMove, { capture: true });
      cv.removeEventListener("pointerup", onPointerUp, { capture: true });
      cv.removeEventListener("pointercancel", onPointerUp, { capture: true });
    };
  }, [lmaDataRef]); // 加入依賴項

  // ── 畫面渲染 (傳送門技術：掛載到 body 最頂層，無視 App.jsx 的層級) ────────
  const panelContent = (
    <div 
      onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} // 再次防護整個面板
      style={{
        position:"fixed", top:20, right:20, zIndex:2147483647, // 瀏覽器極限 Z-index
        background:"rgba(255,255,255,0.95)", border:"1px solid #ddd", borderRadius:10, 
        boxShadow:"0 10px 40px rgba(0,0,0,0.4)", width:340, 
        fontFamily:"monospace", userSelect:"none", touchAction:"none"
      }}
    >
      <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid #eee" }}>
        <div style={{ fontSize:11, fontWeight:700 }}>LMA DEMO — SparkBody</div>
        <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>Drag wrists / shoulders</div>
      </div>

      {/* 所有的操作都在這裡了，用原生 DOM 接管 */}
      <canvas ref={canvasRef} width={340} height={260}
        style={{ display:"block", background:"#fff", cursor:"crosshair", touchAction:"none" }}
      />

      <div style={{ padding:"10px 14px 4px", borderTop:"1px solid #eee" }}>
        <Bar label={`W Weight`} value={lma.W} color="#111" />
        <Bar label={`F Flow`} value={lma.F} color="#555" />
        <Bar label={`S Spread`} value={lma.S} color="#888" />
        <div style={{ height:1, background:"#eee", margin:"8px 0" }}/>
        <Bar label={`KT Kinetic Tension`} value={lma.KT} color="#000" />
      </div>

      <div style={{ padding:"6px 14px 12px" }}>
        <div style={{ background:"#f8f8f8", borderRadius:4, marginBottom:3 }}><Sparkline hist={histW} color="#333" /></div>
        <div style={{ background:"#f8f8f8", borderRadius:4, marginBottom:3 }}><Sparkline hist={histF} color="#888" /></div>
        <div style={{ background:"#f8f8f8", borderRadius:4 }}><Sparkline hist={histKT} color="#000" /></div>
      </div>
    </div>
  );

  // 使用 createPortal 把這個面板丟到 document.body 裡
  // 這樣它就不會受到 App.jsx 裡 Fireworks 或 MouseFireworks 的任何覆蓋影響
  return createPortal(panelContent, document.body);
}