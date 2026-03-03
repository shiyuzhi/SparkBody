// src/lmaEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// LMA Feature Extraction Engine — SparkBody v2
//
// 吃你現有 PoseSkeleton.jsx onPoseUpdate 回傳的格式：
//   { leftHand, rightHand, leftShoulder, rightShoulder, ... }
//   每個欄位：{ x, y, visibility }  (MediaPipe normalised 0-1)
//
// 論文數學定義（可直接貼進 System 章節）：
//   Shape  (S)  = dist(LH, RH) / dist(LS, RS)          ∈ [0, ~3]
//   Weight (W)  = |ΔyLH + ΔyRH| / 2  per frame         (normalised units/frame)
//   Flow   (F)  = 1 − clamp(jerk / MAX_JERK, 0, 1)     ∈ [0, 1]
//   KT          = 0.40·Ŵ + 0.35·(1−F̂) + 0.25·Ŝ        ∈ [0, 1]
//   (Ŵ, F̂, Ŝ = per-participant baseline-normalised values)
//
//  EMA smoothing: α = 0.15 applied to all raw features before use.
//  Baseline: first 900 frames (~30 s at 30 fps) per participant.
// ─────────────────────────────────────────────────────────────────────────────

const CFG = {
  EMA_ALPHA:       0.15,
  BASELINE_FRAMES: 900,
  MAX_JERK:        0.025,  // empirical — tune from pilot printout
};

let _ema  = {};
let _prev = null;

const _bl = {
  buf:   { shape: [], weight: [], flow: [] },
  stats: null,
  ready: false,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vis = (lm, t = 0.1) => (lm?.visibility ?? 1) >= t;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function ema(key, raw) {
  _ema[key] = _ema[key] === undefined
    ? raw
    : CFG.EMA_ALPHA * raw + (1 - CFG.EMA_ALPHA) * _ema[key];
  return _ema[key];
}

function buildBaseline(s, w, f) {
  if (_bl.ready) return;
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
    console.log("[LMA] Baseline ready →", JSON.stringify(_bl.stats));
  }
}

function normalise(key, v) {
  if (!_bl.ready) return clamp(v, 0, 1);
  const { mean, std } = _bl.stats[key];
  return clamp((v - mean) / std / 4 + 0.5, 0, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// extractLMA(poseData)  ← call this every frame inside Fireworks.jsx render loop
// ─────────────────────────────────────────────────────────────────────────────
export function extractLMA(poseData) {
  const LH = poseData?.leftHand;
  const RH = poseData?.rightHand;
  const LS = poseData?.leftShoulder;
  const RS = poseData?.rightShoulder;

  // Shape: wingspan / shoulder-span
  let rawShape = 0;
  if (vis(LH) && vis(RH) && vis(LS) && vis(RS)) {
    const wingspan    = dist2(LH, RH);
    const shoulderW   = dist2(LS, RS) || 0.001;
    rawShape = wingspan / shoulderW;
  }
  const sShape = ema("shape", rawShape);

  // Weight: mean absolute downward velocity of both wrists
  let rawWeight = 0;
  if (_prev && vis(LH) && vis(RH)) {
    rawWeight = Math.abs(((LH.y - _prev.lhY) + (RH.y - _prev.rhY)) / 2);
  }
  const sWeight = ema("weight", rawWeight);

  // Flow: 1 - jerk  (jerk = Δvelocity between consecutive frames)
  let rawJerk = 0;
  if (_prev && vis(LH) && vis(RH)) {
    const velL  = LH.y - _prev.lhY;
    const velR  = RH.y - _prev.rhY;
    const dVelL = velL - (_prev.lhVy ?? velL);
    const dVelR = velR - (_prev.rhVy ?? velR);
    rawJerk = Math.abs((dVelL + dVelR) / 2);
    _prev.lhVy = velL;
    _prev.rhVy = velR;
  }
  const sFlow = ema("flow", clamp(1 - rawJerk / CFG.MAX_JERK, 0, 1));

  // Baseline accumulation
  buildBaseline(sShape, sWeight, sFlow);

  // Normalise
  const nShape  = normalise("shape",  sShape);
  const nWeight = normalise("weight", sWeight);
  const nFlow   = normalise("flow",   sFlow);
  const kt      = clamp(0.40 * nWeight + 0.35 * (1 - nFlow) + 0.25 * nShape, 0, 1);

  // Advance prev
  if (vis(LH) && vis(RH)) {
    _prev = { lhY: LH.y, rhY: RH.y, lhVy: _prev?.lhVy ?? 0, rhVy: _prev?.rhVy ?? 0 };
  }

  return {
    shape: sShape, weight: sWeight, flow: sFlow, kt,
    n: { shape: nShape, weight: nWeight, flow: nFlow, kt },
    baselineReady:    _bl.ready,
    baselineProgress: _bl.ready ? 1 : _bl.buf.shape.length / CFG.BASELINE_FRAMES,
  };
}

export function resetLMA() {
  _ema  = {};
  _prev = null;
  _bl.buf   = { shape: [], weight: [], flow: [] };
  _bl.stats = null;
  _bl.ready = false;
  console.log("[LMA] State reset");
}
