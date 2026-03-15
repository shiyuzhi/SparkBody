// lmaEngine.js - v2.0
// ✅ 修改摘要（相較 v1）：
//    1. extractLMA() 回傳值新增 poseSnapshot 欄位
//       → 包含 lh / rh / ls / rs 的 {x, y} 快照，供外部直接傳給 logActivityWithPose()
//    2. CFG 無異動，演算法邏輯完全不變

const CFG = {
  EMA_ALPHA:       0.15,
  BASELINE_FRAMES: 150,
  MAX_JERK:        0.025,
  MAX_TELEPORT:    0.15,
  MIN_VISIBILITY:  0.5
};

let _ema  = {};
let _prev = null;

const _bl = {
  buf:   { shape: [], weight: [], flow: [] },
  stats: null,
  ready: false,
};

const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vis    = (lm) => (lm?.visibility ?? 0) >= CFG.MIN_VISIBILITY;
const dist2  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const snap   = (lm) => lm ? { x: lm.x, y: lm.y } : null; // ✅ 新增：座標快照 helper

function ema(key, raw) {
  _ema[key] = _ema[key] === undefined
    ? raw
    : CFG.EMA_ALPHA * raw + (1 - CFG.EMA_ALPHA) * _ema[key];
  return _ema[key];
}

// Baseline ────────────────────────────────────────────────
function buildBaseline(s, w, f) {
  if (_bl.ready) return;
  if (w < 0.0005 && f > 0.98) return;

  _bl.buf.shape.push(s);
  _bl.buf.weight.push(w);
  _bl.buf.flow.push(f);

  if (_bl.buf.shape.length >= CFG.BASELINE_FRAMES) {
    const stat = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const trim = Math.floor(sorted.length * 0.1);
      const sub  = sorted.slice(trim, sorted.length - trim);
      const mean = sub.reduce((a, b) => a + b, 0) / sub.length;
      const std  = Math.sqrt(sub.reduce((a, b) => a + (b - mean) ** 2, 0) / sub.length) || 1e-6;
      return { mean, std };
    };
    _bl.stats = {
      shape:  stat(_bl.buf.shape),
      weight: stat(_bl.buf.weight),
      flow:   stat(_bl.buf.flow),
    };
    _bl.ready = true;
    console.log("📊 [LMA] Baseline Ready:", JSON.stringify(_bl.stats));
  }
}

function normalise(key, v) {
  if (!_bl.ready) return 0.5;
  const { mean, std } = _bl.stats[key];
  return clamp((v - mean) / (std * 4) + 0.5, 0, 1);
}

export function extractLMA(poseData) {
  const { leftHand: LH, rightHand: RH, leftShoulder: LS, rightShoulder: RS } = poseData || {};

  const validL = vis(LH);
  const validR = vis(RH);

  if (!validL && !validR) {
    _prev = null;
    _ema  = {};
    return {
      shape: 0, weight: 0, flow: 0.5, kt: 0,
      n: { shape: 0, weight: 0, flow: 0.5, kt: 0 },
      trackingLost:      true,
      baselineReady:     _bl.ready,
      baselineProgress:  _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES,
      // ✅ v2.0：tracking lost 時座標也記 null
      poseSnapshot: { lh: null, rh: null, ls: snap(LS), rs: snap(RS) },
    };
  }

  const shoulderSpan = (LS && RS) ? dist2(LS, RS) : 0.2;
  const rawShape     = (validL && validR) ? dist2(LH, RH) / (shoulderSpan || 1) : (_ema.shape ?? 0.5);
  const sShape       = ema("shape", rawShape);

  let rawWeight = 0, rawJerk = 0, hasVelocity = false;
  let velL = 0, velR = 0;

  if (_prev) {
    hasVelocity = true;
    let dVelL = 0, dVelR = 0;

    if (validL && _prev.lhY !== null) {
      velL  = LH.y - _prev.lhY;
      dVelL = velL - (_prev.lhVy ?? velL);
    }
    if (validR && _prev.rhY !== null) {
      velR  = RH.y - _prev.rhY;
      dVelR = velR - (_prev.rhVy ?? velR);
    }

    if ((validL && Math.abs(velL) > CFG.MAX_TELEPORT) ||
        (validR && Math.abs(velR) > CFG.MAX_TELEPORT)) {
      _prev       = null;
      hasVelocity = false;
    } else {
      rawWeight = Math.max(Math.abs(velL), Math.abs(velR));
      rawJerk   = Math.max(Math.abs(dVelL), Math.abs(dVelR));
    }
  }

  const sWeight  = ema("weight", rawWeight);
  const flowVal  = hasVelocity ? clamp(1 - rawJerk / CFG.MAX_JERK, 0, 1) : 0.5;
  const sFlow    = ema("flow", flowVal);

  buildBaseline(sShape, sWeight, sFlow);

  const nShape  = normalise("shape",  sShape);
  const nWeight = normalise("weight", sWeight);
  const nFlow   = normalise("flow",   sFlow);
  const kt      = clamp(0.40 * nWeight + 0.35 * (1 - nFlow) + 0.25 * nShape, 0, 1);

  _prev = {
    lhY:  validL ? LH.y : null,
    rhY:  validR ? RH.y : null,
    lhVy: validL && hasVelocity ? velL : null,
    rhVy: validR && hasVelocity ? velR : null,
  };

  return {
    shape: sShape, weight: sWeight, flow: sFlow, kt,
    n: { shape: nShape, weight: nWeight, flow: nFlow, kt },
    baselineReady:    _bl.ready,
    baselineProgress: _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES,
    trackingLost:     false,
    // ✅ v2.0：每幀都附帶座標快照，外部直接用，不需重新從 poseData 解構
    poseSnapshot: {
      lh: validL ? snap(LH) : null,
      rh: validR ? snap(RH) : null,
      ls: snap(LS),
      rs: snap(RS),
    },
  };
}

export function resetLMA() {
  _ema  = {};
  _prev = null;
  _bl.buf   = { shape: [], weight: [], flow: [] };
  _bl.stats = null;
  _bl.ready = false;
}