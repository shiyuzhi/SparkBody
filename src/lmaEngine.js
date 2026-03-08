// src/lmaEngine.js

const CFG = {
  EMA_ALPHA:       0.15,
  BASELINE_FRAMES: 900,
  MAX_JERK:        0.025,
  MAX_TELEPORT:    0.15,   //  新增：防止座標跳轉的閾值 (150px 或 0.15 視座標系而定)
  MIN_VISIBILITY:  0.5     //  新增：更嚴格的追蹤檢查
};

let _ema  = {};
let _prev = null;

const _bl = {
  buf:   { shape: [], weight: [], flow: [] },
  stats: null,
  ready: false,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vis = (lm) => (lm?.visibility ?? 0) >= CFG.MIN_VISIBILITY;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function ema(key, raw) {
  _ema[key] = _ema[key] === undefined
    ? raw
    : CFG.EMA_ALPHA * raw + (1 - CFG.EMA_ALPHA) * _ema[key];
  return _ema[key];
}

// Baseline 防污染防護 ──────────────────────────────
function buildBaseline(s, w, f) {
  if (_bl.ready) return;
  
  // 【防呆】如果動作太小（像在發呆），就不計入 Baseline，避免 mean 被拉低
  if (s < 0.2 && w < 0.001) return; 

  _bl.buf.shape.push(s);
  _bl.buf.weight.push(w);
  _bl.buf.flow.push(f);
  
  if (_bl.buf.shape.length >= CFG.BASELINE_FRAMES) {
    const stat = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) || 1e-6;
      return { mean, std };
    };
    _bl.stats = { shape: stat(_bl.buf.shape), weight: stat(_bl.buf.weight), flow: stat(_bl.buf.flow) };
    _bl.ready = true;
    console.log("📊 [LMA] Baseline Ready:", JSON.stringify(_bl.stats));
  }
}

function normalise(key, v) {
  if (!_bl.ready) return 0.5; // 未就緒時給予中性值
  const { mean, std } = _bl.stats[key];
  // Z-Score 正規化：對齊到 0-1 區間
  return clamp((v - mean) / (std * 4) + 0.5, 0, 1);
}

export function extractLMA(poseData) {
  const { leftHand: LH, rightHand: RH, leftShoulder: LS, rightShoulder: RS } = poseData || {};

  // 🚀 修正 2：第一道防線 — 追蹤遺失檢查 ────────────────────────
  if (!vis(LH) || !vis(RH)) {
    _prev = null; // 清除前一幀記錄，防止手回來時發生「瞬移爆發」
    return {
      shape: 0, weight: 0, flow: 0.5, kt: 0,
      n: { shape: 0, weight: 0, flow: 0.5, kt: 0 },
      trackingLost: true,
      baselineReady: _bl.ready,
      baselineProgress: _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES
    };
  }

  // Shape 尺度不變性 (Scale Invariance) ────────────
  // 使用「翼展 / 肩寬」比例，避免因受試者站得遠近而失效
  const shoulderSpan = (LS && RS) ? dist2(LS, RS) : 0.2; 
  const rawShape = dist2(LH, RH) / (shoulderSpan || 1);
  const sShape = ema("shape", rawShape);

  // 瞬間移動 (Teleportation) 檢查 ──────────────────
  if (_prev) {
    const jumpL = Math.abs(LH.y - _prev.lhY);
    const jumpR = Math.abs(RH.y - _prev.rhY);
    if (jumpL > CFG.MAX_TELEPORT || jumpR > CFG.MAX_TELEPORT) {
      _prev = null; // 跳轉過大，視為誤偵測，重置計算
    }
  }

  // 🚀 修正 5：Weight 語義方向性 ────────────────────────────
  let rawWeight = 0;
  let hasVelocity = false;
  if (_prev) {
    hasVelocity = true;
    const velL = LH.y - _prev.lhY; // Y 增加 = 向下 (Strong)
    const velR = RH.y - _prev.rhY;
    // 僅取向下分量，對應 Laban 的「重力感」
    rawWeight = (Math.max(0, velL) + Math.max(0, velR)) / 2;
  }
  const sWeight = ema("weight", rawWeight);

  // Flow 邏輯反轉防護 ────────────────────────────
  let rawJerk = 0;
  if (_prev) {
    const velL  = LH.y - _prev.lhY;
    const velR  = RH.y - _prev.rhY;
    const dVelL = velL - (_prev.lhVy ?? velL);
    const dVelR = velR - (_prev.rhVy ?? velR);
    rawJerk = Math.abs((dVelL + dVelR) / 2);
    _prev.lhVy = velL;
    _prev.rhVy = velR;
  }
  // 如果沒有速度數據，Flow 給予 0.5 中性值，而不是滿分
  const flowVal = hasVelocity ? clamp(1 - rawJerk / CFG.MAX_JERK, 0, 1) : 0.5;
  const sFlow = ema("flow", flowVal);

  buildBaseline(sShape, sWeight, sFlow);

  const nShape  = normalise("shape",  sShape);
  const nWeight = normalise("weight", sWeight);
  const nFlow   = normalise("flow",   sFlow);
  
  // KT 合成公式：權重、流暢度與開展度的結合
  const kt = clamp(0.40 * nWeight + 0.35 * (1 - nFlow) + 0.25 * nShape, 0, 1);

  // 更新前一幀
  _prev = { lhY: LH.y, rhY: RH.y, lhVy: _prev?.lhVy ?? 0, rhVy: _prev?.rhVy ?? 0 };

  return {
    shape: sShape, weight: sWeight, flow: sFlow, kt,
    n: { shape: nShape, weight: nWeight, flow: nFlow, kt },
    baselineReady: _bl.ready,
    baselineProgress: _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES,
    trackingLost: false
  };
}

export function resetLMA() {
  _ema  = {};
  _prev = null;
  _bl.buf   = { shape: [], weight: [], flow: [] };
  _bl.stats = null;
  _bl.ready = false;
}