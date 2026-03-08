// src/AffectiveLogger.js (v4.3 - Production Ready)
// ═════════════════════════════════════════════════════════════════

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOFIDOoDRgOdqiprotV3etzeEHPulmPZlhcrAEnHa_1OcugfzohrP5t0gcPTF8hbZfHA/exec";

const CONFIG = {
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  LOCAL_STORAGE_PREFIX: "LMA_LOGS_",
  LAST_USER_KEY: "LMA_LAST_USER_ID",
  SESSION_ID_KEY: "LMA_SESSION_ID",
  MAX_QUEUE_SIZE: 5000,
  ACTIVITY_LOG_INTERVAL: 5000,
  VERSION: "4.3"
};

// ─── 狀態管理 ───
let _currentUserId = "";
let _currentMode = "A";
let _logQueue = [];
let _flushing = false;
let _activityCheckTimer = null;
let _isOfflineMode = false;
let _consecutiveFailures = 0;
let _lastErrorTime = null;
let _sessionId = null;

// ─────────────────────────────────────────────────────────────────
// 【Session ID 管理】
// ─────────────────────────────────────────────────────────────────

const initSessionId = () => {
  try {
    let sid = localStorage.getItem(CONFIG.SESSION_ID_KEY);
    if (!sid) {
      // ★ 使用 UTC 時間確保全球一致
      const now = new Date();
      const isoStr = now.toISOString().slice(0, 19);
      sid = isoStr.replace(/[-:T]/g, "").slice(0, 14);
      localStorage.setItem(CONFIG.SESSION_ID_KEY, sid);
    }
    return sid;
  } catch (err) {
    console.warn("[Logger] 無法使用 localStorage，使用臨時 SESSION_ID");
    return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 14);
  }
};

const getSessionId = () => _sessionId || initSessionId();

export const resetSessionId = () => {
  localStorage.removeItem(CONFIG.SESSION_ID_KEY);
  _sessionId = initSessionId();
  console.log(`[Logger] SESSION_ID 已重置: ${_sessionId}`);
};

// ─────────────────────────────────────────────────────────────────
// 【輔助函數】
// ─────────────────────────────────────────────────────────────────

const safeNum = (val) => {
  if (typeof val !== 'number' || !isFinite(val)) return 0;
  return isNaN(val) ? 0 : val;
};

const getLocalKey = (userId = _currentUserId) => {
  if (!userId) return null;
  return `${CONFIG.LOCAL_STORAGE_PREFIX}${userId}`;
};

const saveToLocal = () => {
  if (!_currentUserId) return;
  try {
    localStorage.setItem(getLocalKey(), JSON.stringify(_logQueue));
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      console.warn("[Logger] localStorage 滿了，清理舊數據");
      localStorage.clear();
    }
  }
};

const loadFromLocal = (userId) => {
  if (!userId) return [];
  try {
    const saved = localStorage.getItem(getLocalKey(userId));
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    console.warn("[Logger] 無法加載本地隊列:", err.message);
    return [];
  }
};

const dispatchLoggerState = (status, message = "") => {
  const payload = {
    status,
    message,
    pendingCount: _logQueue.length,
    userId: _currentUserId,
    sessionId: getSessionId(),
    failCount: _consecutiveFailures,
    lastErrorAt: _lastErrorTime,
    isOffline: _isOfflineMode,
    timestamp: new Date().toISOString()
  };
  
  try {
    window.dispatchEvent(new CustomEvent('LMA_LOGGER_STATUS', { detail: payload }));
  } catch (err) {
    console.warn("[Logger] 無法分發事件:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────
// 【上傳邏輯】
// ─────────────────────────────────────────────────────────────────

const flushLogs = async (retries = CONFIG.MAX_RETRIES) => {
  if (_flushing || _logQueue.length === 0 || !_currentUserId) {
    return;
  }
  if (window.location.hostname === 'localhost') return;

  _flushing = true;
  dispatchLoggerState('UPLOADING', `上傳中... (${_logQueue.length} 筆待發)`);
  saveToLocal();

  let totalSuccessful = 0;

  while (_logQueue.length > 0) {
    const batch = _logQueue.slice(0, CONFIG.BATCH_SIZE);
    let batchSuccess = false;
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const result = await res.json();

        if (result.success) {
          _logQueue.splice(0, batch.length);
          saveToLocal();
          batchSuccess = true;
          totalSuccessful += batch.length;
          _consecutiveFailures = 0;
          _lastErrorTime = null;
          _isOfflineMode = false;
          console.log(`[Logger] ✓ 上傳 ${batch.length} 筆 (累計: ${totalSuccessful})`);
          break;
        } else {
          throw new Error(result.error || "GAS 返回 success=false");
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Logger] 嘗試 ${attempt + 1}/${retries} 失敗: ${err.message}`);

        if (attempt < retries - 1) {
          const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    if (!batchSuccess) {
      _consecutiveFailures++;
      _lastErrorTime = new Date().toISOString();
      _isOfflineMode = true;
      console.error(`[Logger] ✗ 批次上傳失敗 (${lastError?.message}), 保存本地`);
      dispatchLoggerState('ERROR', `上傳失敗 (${_logQueue.length} 筆待發)`);
      break;
    }
  }

  _flushing = false;

  if (_logQueue.length === 0) {
    dispatchLoggerState('IDLE', `✓ 成功同步 ${totalSuccessful} 筆`);
  } else {
    dispatchLoggerState('QUEUE', `${_logQueue.length} 筆待發送`);
  }
};

const startActivityCheck = () => {
  if (_activityCheckTimer) return;
  _activityCheckTimer = setInterval(() => {
    if (_logQueue.length > 0 && !_flushing && !_isOfflineMode) {
      flushLogs(1);
    }
  }, CONFIG.ACTIVITY_LOG_INTERVAL);
};

const stopActivityCheck = () => {
  if (_activityCheckTimer) {
    clearInterval(_activityCheckTimer);
    _activityCheckTimer = null;
  }
};

// ─────────────────────────────────────────────────────────────────
// 【Public API】
// ─────────────────────────────────────────────────────────────────

/**
 * 自動生成 ID：S20260304-001 格式
 */
export const generateNextUserId = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const storageKey = `LMA_SERIAL_${dateStr}`;
  let currentSerial = parseInt(localStorage.getItem(storageKey) || "0", 10);

  currentSerial += 1;

  if (currentSerial > 999) {
    console.warn("[Logger] 警告：今日序號已超過 999，重置為 001");
    currentSerial = 1;
  }

  localStorage.setItem(storageKey, currentSerial.toString());
  const formattedSerial = String(currentSerial).padStart(3, '0');
  const newId = `S${dateStr}-${formattedSerial}`;

  console.log(`[Logger] 自動生成 ID: ${newId}`);
  return newId;
};

/**
 * 設定當前使用者
 */
export const setUserId = (id, autoFlushOld = false) => {
  if (!id) return;  // 靜默：不跳警告

  const newId = id.trim();

  if (newId === _currentUserId) {
    return;
  }

  // 保存舊用戶的隊列
  if (_currentUserId && _logQueue.length > 0) {
    console.log(`[Logger] 保存用戶 ${_currentUserId} 的 ${_logQueue.length} 筆待發送數據`);
    saveToLocal();
  }

  _currentUserId = newId;
  localStorage.setItem(CONFIG.LAST_USER_KEY, _currentUserId);

  // 加載新用戶的舊隊列
  _logQueue = loadFromLocal(_currentUserId);

  console.log(`[Logger] ✓ 當前受試者: ${_currentUserId} (待發送: ${_logQueue.length})`);

  if (_logQueue.length > 0) {
    if (autoFlushOld) {
      console.log(`[Logger] 自動上傳舊數據...`);
      flushLogs();
    }
  }

  startActivityCheck();
  dispatchLoggerState('READY', `${_currentUserId} 已就緒`);
};

/**
 * 設定模式
 */
export const setMode = (mode) => {
  _currentMode = String(mode).toUpperCase();
  console.log(`[Logger] 模式已切換為: ${_currentMode}`);
};

/**
 * 記錄 LMA 事件
 */
export const logLMAData = (params = {}) => {
  if (!_currentUserId) return;  // 靜默：未設定受試者就不紀錄
  if (!params.activity) return;

  // 防止隊列爆炸
  if (_logQueue.length >= CONFIG.MAX_QUEUE_SIZE) {
    console.warn("[Logger] 隊列已滿，丟棄最舊的 100 筆");
    _logQueue = _logQueue.slice(-CONFIG.MAX_QUEUE_SIZE + 100);
  }

  const entry = {
    sessionId: getSessionId(),
    userId: _currentUserId,
    timestamp: new Date().toISOString(),
    mode: _currentMode,
    activity: String(params.activity).toUpperCase().trim(),
    // 原始平滑值
    shape: +safeNum(params.shape).toFixed(4),
    weight: +safeNum(params.weight).toFixed(4),
    flow: +safeNum(params.flow).toFixed(4),
    kt: +safeNum(params.kt || 0).toFixed(4),
    // 標準化值
    shape_n: +safeNum(params.shape_n || params.shape).toFixed(4),
    weight_n: +safeNum(params.weight_n || params.weight).toFixed(4),
    flow_n: +safeNum(params.flow_n || params.flow).toFixed(4),
    // 元數據
    baselineReady: params.baselineReady === true,
    trackingLost: params.trackingLost === true,
    note: String(params.note || "").slice(0, 200),
  };

  _logQueue.push(entry);

  // 觸發上傳
  if (_logQueue.length >= CONFIG.BATCH_SIZE) {
    flushLogs();
  } else {
    saveToLocal();
  }

  // ★ 關鍵事件立刻上傳
  if (params.activity.includes("END") || params.activity.includes("BASELINE")) {
    flushLogs();
  }
};

/**
 * 立刻上傳所有待發送數據
 */
export const flushImmediately = async () => {
  console.log("[Logger] 強制上傳所有待發送數據...");
  stopActivityCheck();
  await flushLogs(5);
  console.log("[Logger] ✓ 上傳完成");
};

/**
 * 取得當前狀態
 */
export const getLoggerState = () => ({
  userId: _currentUserId,
  mode: _currentMode,
  queueLength: _logQueue.length,
  isFlushing: _flushing,
  sessionId: getSessionId(),
  isOfflineMode: _isOfflineMode,
  consecutiveFailures: _consecutiveFailures,
  lastErrorAt: _lastErrorTime,
  version: CONFIG.VERSION
});

/**
 * 清除本地備份
 */
export const clearLocalBackup = (userId = _currentUserId) => {
  if (!userId) return;
  try {
    localStorage.removeItem(getLocalKey(userId));
    if (userId === _currentUserId) {
      _logQueue = [];
      console.log(`[Logger] 已清除 ${userId} 的本地備份`);
    }
  } catch (err) {
    console.warn("[Logger] 清除失敗:", err.message);
  }
};

// ─── 初始化 ───
_sessionId = initSessionId();