// src/lmaEngine.js

const CFG = {
  EMA_ALPHA:       0.15,
  BASELINE_FRAMES: 300,
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
  
  // 【防呆】完全靜止才過濾（受試者跳舞時幾乎不會觸發）
  if (w < 0.0005 && f > 0.98) return;

  _bl.buf.shape.push(s);
  _bl.buf.weight.push(w);
  _bl.buf.flow.push(f);
  
  if (_bl.buf.shape.length >= CFG.BASELINE_FRAMES) {
    const stat = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const trim = Math.floor(sorted.length * 0.1);
      const sub = sorted.slice(trim, sorted.length - trim);
      const mean = sub.reduce((a, b) => a + b, 0) / sub.length;
      const std  = Math.sqrt(sub.reduce((a, b) => a + (b - mean) ** 2, 0) / sub.length) || 1e-6;
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

  // 分別檢查左右手是否可見
  const validL = vis(LH);
  const validR = vis(RH);

  // 只要有「任何一隻手」看得見，就不算 trackingLost！(兩隻都不見才歸零)
  if (!validL && !validR) {
    _prev = null;
    _ema = {}; // 兩隻手都不見才清空 EMA
    return {
      shape: 0, weight: 0, flow: 0.5, kt: 0,
      n: { shape: 0, weight: 0, flow: 0.5, kt: 0 },
      trackingLost: true,
      baselineReady: _bl.ready,
      baselineProgress: _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES
    };
  }

  // Shape 尺度不變性
  const shoulderSpan = (LS && RS) ? dist2(LS, RS) : 0.2;
  // 如果有一隻手藏在桌下，Shape 就沿用前一次的狀態，避免垃圾座標干擾
  const rawShape = (validL && validR) ? dist2(LH, RH) / (shoulderSpan || 1) : (_ema.shape ?? 0.5);
  const sShape = ema("shape", rawShape);

  let rawWeight = 0;
  let rawJerk = 0;
  let hasVelocity = false;
  let velL = 0, velR = 0;

  if (_prev) {
    hasVelocity = true;
    let dVelL = 0, dVelR = 0;

    // 只計算「看得見」的手的速度，看不見的當作 0
    if (validL && _prev.lhY !== null) {
      velL = LH.y - _prev.lhY;
      dVelL = velL - (_prev.lhVy ?? velL);
    }
    if (validR && _prev.rhY !== null) {
      velR = RH.y - _prev.rhY;
      dVelR = velR - (_prev.rhVy ?? velR);
    }

    // Teleport 檢查也只針對看得見的手
    if ((validL && Math.abs(velL) > CFG.MAX_TELEPORT) ||
        (validR && Math.abs(velR) > CFG.MAX_TELEPORT)) {
      _prev = null;
      hasVelocity = false;
    } else {
      // 計算雙向垂直動作強度 (Movement Intensity)，取主動手最大值
      rawWeight = Math.max(Math.abs(velL), Math.abs(velR));
      rawJerk = Math.max(Math.abs(dVelL), Math.abs(dVelR));
    }
  }

  const sWeight = ema("weight", rawWeight);
  const flowVal = hasVelocity ? clamp(1 - rawJerk / CFG.MAX_JERK, 0, 1) : 0.5;
  const sFlow = ema("flow", flowVal);

  buildBaseline(sShape, sWeight, sFlow);

  const nShape  = normalise("shape",  sShape);
  const nWeight = normalise("weight", sWeight);
  const nFlow   = normalise("flow",   sFlow);

  const kt = clamp(0.40 * nWeight + 0.35 * (1 - nFlow) + 0.25 * nShape, 0, 1);

  // 更新前一幀 (看不見的手存 null，避免下次拿垃圾座標來減)
  _prev = {
    lhY: validL ? LH.y : null,
    rhY: validR ? RH.y : null,
    lhVy: validL && hasVelocity ? velL : null,
    rhVy: validR && hasVelocity ? velR : null
  };

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