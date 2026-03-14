// AffectiveLogger.js - v5.2 改進版

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRj1BOCJeSh_L8kDCrW010mW8LHxNrzIQEFcEFygz5qSvGE3AVyu47v5d2t4KkIc81/exec";
const LOCAL_KEY  = "LMA_LOG_BUFFER";

class AffectiveLogger {
  constructor(userId) {
    this.userId        = userId || "anonymous";
    this.sessionId     = this.generateSessionId();
    this.buffer        = [];
    this.batchSize     = 40;
    this.flushInterval = 5000;
    this.lastFlushTime = Date.now();
    this.lastLogTime   = 0;
    this.retryDelay    = 2000;
    this.maxRetry      = 30000;

    this._localSaveTimer = null;

    // ✅ 從 Local Storage 恢復未送出的資料
    this.loadLocal();

    // ✅ 頁面關閉時用 sendBeacon 送出剩餘資料
    window.addEventListener("beforeunload", () => this.flushBeacon());

    // ✅ 定時檢查 flush
    this._timer = setInterval(() => this.checkFlush(), 2000);

    console.log("[Logger v5.2] 初始化, User:", this.userId, "Session:", this.sessionId);
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

    // ✅ 5Hz sampling 限制
    if (now - this.lastLogTime < 200) return;
    this.lastLogTime = now;

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
    this.saveLocalThrottled();

    console.log("[Logger] buffered:", entry.activity, "| 共", this.buffer.length, "筆");

    if (this.buffer.length >= this.batchSize) this.flush();
  }

  // ── Flush ──────────────────────────────────────────────
  async flush() {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    const currentSession = this.sessionId;
    this.lastFlushTime = Date.now();

    this.dispatch("FLUSHING", { count: batch.length, lastFlush: this.lastFlushTime });

    try {
      // ✅ no-cors 避免 CORS preflight
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode:   "no-cors",
        cache:  "no-cache",
        body:   JSON.stringify({ batch }),
      });

      // ✅ 成功後重置 retry delay
      this.retryDelay = 2000;
      this.saveLocalThrottled();

      console.log(`✅ [Logger] 送出 ${batch.length} 筆`);
      this.dispatch("SUCCESS", { batchCount: batch.length, lastFlush: this.lastFlushTime });

    } catch (err) {
      console.warn("[Logger] 上傳失敗，等待重試");

      // ✅ 失敗塞回 buffer 頭部
      this.buffer = batch.concat(this.buffer);
      this.saveLocalThrottled();

      // ✅ Exponential backoff + jitter
      const jitter = Math.random() * 500;
      this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetry);
      setTimeout(() => this.flush(), this.retryDelay + jitter);

      this.dispatch("ERROR", { retryDelay: this.retryDelay, pending: this.buffer.length });
    }
  }

  // ✅ 頁面關閉 sendBeacon
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

export function getLogger() { return currentLogger; }

export function setUserId(id) { if (currentLogger) currentLogger.userId = id; }

export function setMode(mode) { currentMode = mode; }

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
  console.log("[Logger] ✅ AffectiveLogger v5.2 已掛載到 window");
}, 0);