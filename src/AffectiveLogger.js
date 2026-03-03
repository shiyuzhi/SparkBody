// src/AffectiveLogger.js
// ─────────────────────────────────────────────────────────────────────────────
// Google Apps Script Web App URL
// Replace with your deployed GAS URL
// ─────────────────────────────────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOFIDOoDRgOdqiprotV3etzeEHPulmPZlhcrAEnHa_1OcugfzohrP5t0gcPTF8hbZfHA/exec";

// ─── Session ID (一次頁面載入 = 一個 session) ─────────────────────────────────
// 用時間戳產生，方便 Google Sheets 按 session 切割數據做統計分析
const SESSION_ID = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 14);
// 格式：20250603143022 → 方便 Excel/R/Python 直接 parse

let _currentUserId = "NCNU_User_01";  // 可從外部 setUserId() 覆寫
let _currentMode   = "A";             // "A" = YT passive, "B" = LMA generative

// ─── Public API ───────────────────────────────────────────────────────────────

/** 設定當前使用者 ID（在實驗開始前呼叫） */
export const setUserId = (id) => { _currentUserId = id; };

/** 切換模式（在 Mode A ↔ B 切換時呼叫） */
export const setMode = (mode) => { _currentMode = mode; };

/**
 * 記錄一筆 LMA 事件到 Google Sheets
 *
 * @param {Object} params
 * @param {string} params.activity      - "Gull_Flap" | "Fireworks_Explosion" | "Open_Palm" | "Heart" | "Baseline_End"
 * @param {number} params.shape         - wingspan / torsoLength (原始)
 * @param {number} params.weight        - avg downward velocity (原始)
 * @param {number} params.flow          - 1 - jerk_score (原始)
 * @param {number} params.kt            - Kinetic Tension composite
 * @param {number} [params.shape_n]     - baseline-normalised shape
 * @param {number} [params.weight_n]    - baseline-normalised weight
 * @param {number} [params.flow_n]      - baseline-normalised flow
 * @param {boolean}[params.baselineReady]
 * @param {string} [params.note]
 */
export const logLMAData = ({
  activity,
  shape   = 0,
  weight  = 0,
  flow    = 0,
  kt      = 0,
  shape_n = shape,
  weight_n= weight,
  flow_n  = flow,
  baselineReady = false,
  note    = "",
} = {}) => {

  const payload = {
    sessionId:     SESSION_ID,
    userId:        _currentUserId,
    timestamp:     new Date().toISOString(),
    mode:          _currentMode,
    activity,
    // raw smoothed values (for debug / calibration)
    shape:         +shape.toFixed(4),
    weight:        +weight.toFixed(4),
    flow:          +flow.toFixed(4),
    kt:            +kt.toFixed(4),
    // baseline-normalised values (for cross-participant stats)
    shape_n:       +shape_n.toFixed(4),
    weight_n:      +weight_n.toFixed(4),
    flow_n:        +flow_n.toFixed(4),
    baselineReady,
    note,
  };

  // fire-and-forget, no-cors — 不阻塞 UI
  fetch(SCRIPT_URL, {
    method:  "POST",
    mode:    "no-cors",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  }).catch((err) => console.warn("[LMA Log] fetch failed:", err.message));
};
