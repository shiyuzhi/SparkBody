// AffectiveLogger.js - v5.3
// 修改摘要（相較 v5.2）：
//    1. log() 的 entry 新增 lh_x / lh_y / rh_x / rh_y / ls_x / ls_y / rs_x / rs_y 欄位
//       → 由 logActivity() 呼叫端傳入，或由新增的 logActivityWithPose() 一次帶入
//    2. 新增 logActivityWithPose(activityData, poseData) 便利函式
//       → 自動從 poseData 解構座標，不需手動組 note JSON
//    3. batchSize 從 40 調降為 20，避免 Google Apps Script 單次 payload 過大
//    4. 版本號升至 v5.3，console 標示更新

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRj1BOCJeSh_L8kDCrW010mW8LHxNrzIQEFcEFygz5qSvGE3AVyu47v5d2t4KkIc81/exec";
const LOCAL_KEY  = "LMA_LOG_BUFFER";

class AffectiveLogger {
  constructor(userId) {
    this.userId        = userId || "anonymous";
    this.sessionId     = this.generateSessionId();
    this.buffer        = [];
    this.batchSize     = 20;       // ✅ v5.3：從 40 降為 20，減少單批 payload
    this.flushInterval = 5000;
    this.lastFlushTime = Date.now();
    this.lastLogTime   = 0;
    this.retryDelay    = 2000;
    this.maxRetry      = 30000;

    this._localSaveTimer = null;

    this.loadLocal();
    window.addEventListener("beforeunload", () => this.flushBeacon());
    this._timer = setInterval(() => this.checkFlush(), 2000);

    console.log("[Logger v5.3] 初始化, User:", this.userId, "Session:", this.sessionId);
  }

  generateSessionId() {
    return "sess_" + Math.random().toString(36).substr(2, 9);
  }

  // ── Local Storage ──────────────────────────────────────
  saveLocalThrottled() {
    if (this._localSaveTimer) return;
    this._localSaveTimer = setTimeout(() => {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(this.buffer)); } catch {}
      this._localSaveTimer = null;
    }, 1000);
  }

  loadLocal() {
    try {
      const data = localStorage.getItem(LOCAL_KEY);
      if (data) {
        this.buffer = JSON.parse(data);
        console.log("[Logger] 從本地恢復", this.buffer.length, "筆");
      }
    } catch {}
  }

  clearLocal() { localStorage.removeItem(LOCAL_KEY); }

  // ── Log ────────────────────────────────────────────────
  log(data) {
    const now = Date.now();
    if (now - this.lastLogTime < 200) return; // 5Hz 限制
    this.lastLogTime = now;

    // ✅ v5.3：新增 8 個座標欄位，供事後動作還原使用
    //    值來源：呼叫端直接傳入 lh_x / lh_y … 或透過 logActivityWithPose() 自動解構
    const p = (v) => (v !== undefined && v !== null) ? +parseFloat(v).toFixed(4) : "";

    const entry = {
      sessionId:     this.sessionId,
      userId:        this.userId,
      timestamp:     new Date().toISOString(),
      mode:          data.mode          ?? "",
      activity:      data.activity      ?? "",
      shape_n:       data.shape_n       ?? "",
      weight_n:      data.weight_n      ?? "",
      flow_n:        data.flow_n        ?? "",
      kt:            data.kt            ?? "",
      baselineReady: data.baselineReady ?? "",
      // ✅ 新增座標欄位（normalized 0-1，對應 MediaPipe 座標系）
      lh_x:          p(data.lh_x),
      lh_y:          p(data.lh_y),
      rh_x:          p(data.rh_x),
      rh_y:          p(data.rh_y),
      ls_x:          p(data.ls_x),
      ls_y:          p(data.ls_y),
      rs_x:          p(data.rs_x),
      rs_y:          p(data.rs_y),
      // note 保留給自訂用途
      note:          data.note          ?? "",
    };

    this.buffer.push(entry);
    this.saveLocalThrottled();

    console.log("[Logger] buffered:", entry.activity,
      `lh=(${entry.lh_x},${entry.lh_y}) rh=(${entry.rh_x},${entry.rh_y})`,
      "| 共", this.buffer.length, "筆");

    if (this.buffer.length >= this.batchSize) this.flush();
  }

  // ── Flush ──────────────────────────────────────────────
  async flush() {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    this.lastFlushTime = Date.now();

    this.dispatch("FLUSHING", { count: batch.length, lastFlush: this.lastFlushTime });

    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode:   "no-cors",
        cache:  "no-cache",
        body:   JSON.stringify({ batch }),
      });

      this.retryDelay = 2000;
      this.saveLocalThrottled();
      console.log(`✅ [Logger] 送出 ${batch.length} 筆`);
      this.dispatch("SUCCESS", { batchCount: batch.length, lastFlush: this.lastFlushTime });

    } catch (err) {
      console.warn("[Logger] 上傳失敗，等待重試");
      this.buffer = batch.concat(this.buffer);
      this.saveLocalThrottled();

      const jitter = Math.random() * 500;
      this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetry);
      setTimeout(() => this.flush(), this.retryDelay + jitter);

      this.dispatch("ERROR", { retryDelay: this.retryDelay, pending: this.buffer.length });
    }
  }

  flushBeacon() {
    if (this.buffer.length === 0) return;
    navigator.sendBeacon(SCRIPT_URL, JSON.stringify({ batch: this.buffer }));
    this.clearLocal();
  }

  checkFlush() {
    if (this.buffer.length > 0 && Date.now() - this.lastFlushTime > this.flushInterval) {
      this.flush();
    }
  }

  destroy() { clearInterval(this._timer); }

  dispatch(status, extra = {}) {
    window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
      detail: { status, pendingCount: this.buffer.length, ...extra }
    }));
  }
}

// ── 模組層級單例 ──────────────────────────────────────────
let currentLogger = null;
let currentMode   = "B";

export function initLogger(userId) {
  if (!currentLogger) {
    currentLogger = new AffectiveLogger(userId);
    window.logger = currentLogger;
  }
  return currentLogger;
}

export function getLogger()      { return currentLogger; }
export function setUserId(id)    { if (currentLogger) currentLogger.userId = id; }
export function setMode(mode)    { currentMode = mode; }

export function resetSessionId() {
  if (currentLogger) {
    currentLogger.flush().then(() => {
      currentLogger.sessionId = currentLogger.generateSessionId();
      console.log("[Logger] 新 sessionId:", currentLogger.sessionId);
    });
  }
}

export async function flushImmediately() { if (currentLogger) return currentLogger.flush(); }

export function generateNextUserId() { return `NCNU_User_${Date.now()}`; }

// 原始 logActivity：維持向下相容，note 欄位由外部組裝
export function logActivity(activityData) {
  if (!currentLogger) {
    // 使用者尚未按「Set Participant」，先用 anonymous 頂著，之後 initLogger(id) 會接手
    currentLogger = new AffectiveLogger("anonymous");
    window.logger = currentLogger;
  }
  currentLogger.log({ mode: currentMode, ...activityData });
}

// ✅ v5.3 新增：logActivityWithPose()
//    用法：logActivityWithPose({ activity, shape_n, weight_n, flow_n, kt, baselineReady }, poseData)
//    poseData 結構與 PoseSkeleton.jsx onPoseUpdate 回傳相同：
//      { leftHand, rightHand, leftShoulder, rightShoulder, ... }
export function logActivityWithPose(activityData, poseData) {
  if (!currentLogger) {
    currentLogger = new AffectiveLogger("anonymous");
    window.logger = currentLogger;
  }

  const lh = poseData?.leftHand;
  const rh = poseData?.rightHand;
  const ls = poseData?.leftShoulder;
  const rs = poseData?.rightShoulder;

  currentLogger.log({
    mode: currentMode,
    ...activityData,
    lh_x: lh?.x,
    lh_y: lh?.y,
    rh_x: rh?.x,
    rh_y: rh?.y,
    ls_x: ls?.x,
    ls_y: ls?.y,
    rs_x: rs?.x,
    rs_y: rs?.y,
  });
}

// Vite 全域掛載
setTimeout(() => {
  Object.assign(window, {
    initLogger, getLogger, setUserId, setMode,
    resetSessionId, flushImmediately, generateNextUserId,
    logActivity, logActivityWithPose,
  });
  console.log("[Logger] AffectiveLogger v5.3 已掛載到 window");
}, 0);