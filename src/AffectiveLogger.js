// AffectiveLogger.js - ✅ 完整修正版本
// ⚠️ 重要：將下面的 SCRIPT_URL 換成你最新部署後的 URL

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOFIDOoDRgOdqiprotV3etzeEHPulmPZlhcrAEnHa_1OcugfzohrP5t0gcPTF8hbZfHA/exec";

class AffectiveLogger {
    constructor(userId) {
        this.userId = userId || "anonymous";
        this.sessionId = this.generateSessionId();
        this.buffer = [];
        this.batchSize = 50;
        this.flushInterval = 5000; 
        this.lastFlushTime = Date.now();

        // 每 2 秒檢查一次是否需要補送資料
        setInterval(() => this.checkFlush(), 2000);
        console.log("[Logger] 初始化成功, User:", this.userId, "SessionId:", this.sessionId);
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    // 供外部呼叫的紀錄方法
    log(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            userId: this.userId,
            ...data
        };

        this.buffer.push(logEntry);
        console.log("[Logger] 記錄數據，buffer 現在有", this.buffer.length, '筆');

        // 滿 50 筆立刻送出
        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) {
            console.log("[Logger] buffer 為空，無須發送");
            return;
        }

        const dataToSent = {
            batch: [...this.buffer]
        };
        
        // 先清空緩衝區，避免發送期間產生的新數據遺失
        const currentBatchSize = this.buffer.length;
        this.buffer = []; 
        this.lastFlushTime = Date.now();

        try {
            console.log("[Logger] 準備發送", currentBatchSize, '筆數據到 Google Apps Script');
            
            // 重要：不帶自定義 headers 以避開 CORS 預檢
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                cache: "no-cache",
                body: JSON.stringify(dataToSent)
            });
            
            console.log(`✅ [Logger] 成功發送 ${currentBatchSize} 筆數據`);
            
            // 發送成功狀態事件
            window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
                detail: { status: "SUCCESS", pendingCount: this.buffer.length, isOffline: false }
            }));
        } catch (error) {
            console.error("❌ [Logger] 發送失敗:", error);
            // 失敗時將資料塞回緩衝區
            this.buffer = dataToSent.batch.concat(this.buffer);
            
            // 發送錯誤狀態事件
            window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
                detail: { status: "ERROR", pendingCount: this.buffer.length, isOffline: true }
            }));
        }
    }

    checkFlush() {
        if (this.buffer.length > 0 && (Date.now() - this.lastFlushTime) > this.flushInterval) {
            console.log("[Logger] checkFlush: 時間已到，準備發送");
            this.flush();
        }
    }
}

// ============================================================================
// 🆕 全局狀態管理 - 供 React 使用
// ============================================================================

let currentLogger = null;
let currentUserId = "anonymous";
let currentMode = "A";

/**
 * 初始化全局 logger
 */
export function initLogger(userId) {
    if (!currentLogger) {
        currentLogger = new AffectiveLogger(userId);
        window.logger = currentLogger; // 也掛到 window 上
        currentUserId = userId;
        console.log("[Logger] initLogger: 已初始化，userId =", userId);
    }
    return currentLogger;
}

/**
 * 獲取當前 logger 實例
 */
export function getLogger() {
    return currentLogger;
}

/**
 * 設置當前用戶 ID
 */
export function setUserId(id) {
    currentUserId = id;
    if (currentLogger) {
        currentLogger.userId = id;
    }
    console.log("[Logger] setUserId:", id);
}

/**
 * 設置當前模式
 */
export function setMode(mode) {
    currentMode = mode;
    console.log("[Logger] setMode:", mode);
}

/**
 * 重置 Session ID
 */
export function resetSessionId() {
    if (currentLogger) {
        currentLogger.sessionId = currentLogger.generateSessionId();
        console.log("[Logger] resetSessionId:", currentLogger.sessionId);
    }
}

/**
 * 立即發送緩衝區中的數據
 */
export async function flushImmediately() {
    if (currentLogger) {
        console.log("[Logger] flushImmediately 被調用");
        return currentLogger.flush();
    }
    console.warn("[Logger] flushImmediately: logger 未初始化");
    return Promise.resolve();
}

/**
 * 生成下一個用戶 ID
 */
export function generateNextUserId() {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    console.log("[Logger] generateNextUserId:", id);
    return id;
}

/**
 * 記錄活動（使用當前 mode）
 */
export function logActivity(activityData) {
    if (currentLogger) {
        currentLogger.log({
            mode: currentMode,
            ...activityData
        });
    } else {
        console.warn("[Logger] logActivity: logger 未初始化，無法記錄");
    }
}

// ============================================================================
// ✅ 兼容全局引用 - 掛到 window 上
// ============================================================================

window.AffectiveLogger = AffectiveLogger;
window.initLogger = initLogger;
window.getLogger = getLogger;
window.setUserId = setUserId;
window.setMode = setMode;
window.resetSessionId = resetSessionId;
window.flushImmediately = flushImmediately;
window.generateNextUserId = generateNextUserId;
window.logActivity = logActivity;

// ✅ 同時支持 ES6 module 導出
export { AffectiveLogger };

console.log("[Logger] ✅ AffectiveLogger.js 已加載，所有導出函數已掛到 window");