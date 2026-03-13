// AffectiveLogger.js - 2026/03 重構版（只記錄正規化後數值）

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRj1BOCJeSh_L8kDCrW010mW8LHxNrzIQEFcEFygz5qSvGE3AVyu47v5d2t4KkIc81/exec";

class AffectiveLogger {
  constructor(userId) {
    this.userId    = userId || "anonymous";
    this.sessionId = this.generateSessionId();
    this.buffer    = [];
    this.batchSize    = 50;
    this.flushInterval = 5000;
    this.lastFlushTime = Date.now();

    this._timer = setInterval(() => this.checkFlush(), 2000);
    console.log("[Logger] 初始化, User:", this.userId, "Session:", this.sessionId);
  }

  generateSessionId() {
    return "sess_" + Math.random().toString(36).substr(2, 9);
  }

  log(data) {
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
      note:          data.note          ?? "",
    };

    this.buffer.push(entry);
    console.log("[Logger] buffered:", entry.activity, "| 共", this.buffer.length, "筆");

    if (this.buffer.length >= this.batchSize) this.flush();
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];
    this.lastFlushTime = Date.now();

    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode:   "no-cors",
        cache:  "no-cache",
        body:   JSON.stringify({ batch }),
      });
      console.log(`✅ [Logger] 送出 ${batch.length} 筆`);
      window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
        detail: { status: "SUCCESS", pendingCount: this.buffer.length, isOffline: false }
      }));
    } catch (err) {
      console.error("❌ [Logger] 送出失敗:", err);
      this.buffer = batch.concat(this.buffer); // 塞回去等下次
      window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
        detail: { status: "ERROR", pendingCount: this.buffer.length, isOffline: true }
      }));
    }
  }

  checkFlush() {
    if (this.buffer.length > 0 && Date.now() - this.lastFlushTime > this.flushInterval) {
      this.flush();
    }
  }

  destroy() {
    clearInterval(this._timer);
  }
}

// ── 模組層級單例 ──────────────────────────────────────────
let currentLogger = null;
let currentMode   = "B";

export function initLogger(userId) {
  if (!currentLogger) {
    currentLogger  = new AffectiveLogger(userId);
    window.logger  = currentLogger;
  }
  return currentLogger;
}

export function getLogger() { return currentLogger; }

export function setUserId(id) {
  if (currentLogger) currentLogger.userId = id;
}

export function setMode(mode) {
  currentMode = mode;
}

export function resetSessionId() {
  if (currentLogger) {
    currentLogger.sessionId = currentLogger.generateSessionId();
    console.log("[Logger] 新 sessionId:", currentLogger.sessionId);
  }
}

export async function flushImmediately() {
  if (currentLogger) return currentLogger.flush();
}

export function generateNextUserId() {
  return `NCNU_User_${Date.now()}`;
}

export function logActivity(activityData) {
  if (!currentLogger) {
    console.warn("[Logger] 尚未初始化");
    return;
  }
  currentLogger.log({ mode: currentMode, ...activityData });
}

// Vite 全域掛載
setTimeout(() => {
  Object.assign(window, {
    initLogger, getLogger, setUserId, setMode,
    resetSessionId, flushImmediately, generateNextUserId, logActivity,
  });
  console.log("[Logger] ✅ AffectiveLogger 已掛載到 window");
}, 0);
