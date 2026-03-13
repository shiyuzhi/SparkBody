// AffectiveLogger.js - ✅ 完整修正版本（Vite 適配 + 新部署 URL）

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBIcQE1mwSeBDYcdAFYfmVhoshNRxlLPdPlFasulCwKoziAS0StsAW88VPekc0NJbWxA/exec";

class AffectiveLogger {
    constructor(userId) {
        this.userId = userId || "anonymous";
        this.sessionId = this.generateSessionId();
        this.buffer = [];
        this.batchSize = 50;
        this.flushInterval = 5000; 
        this.lastFlushTime = Date.now();

        setInterval(() => this.checkFlush(), 2000);
        console.log("[Logger] 初始化成功, User:", this.userId, "SessionId:", this.sessionId);
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    log(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            userId: this.userId,
            ...data
        };

        this.buffer.push(logEntry);
        console.log("[Logger] 記錄數據，buffer 現在有", this.buffer.length, '筆');

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
        
        const currentBatchSize = this.buffer.length;
        this.buffer = []; 
        this.lastFlushTime = Date.now();

        try {
            console.log("[Logger] 準備發送", currentBatchSize, '筆數據到 Google Apps Script');
            
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                cache: "no-cache",
                body: JSON.stringify(dataToSent)
            });
            
            console.log(`✅ [Logger] 成功發送 ${currentBatchSize} 筆數據`);
            
            window.dispatchEvent(new CustomEvent("LMA_LOGGER_STATUS", {
                detail: { status: "SUCCESS", pendingCount: this.buffer.length, isOffline: false }
            }));
        } catch (error) {
            console.error("❌ [Logger] 發送失敗:", error);
            this.buffer = dataToSent.batch.concat(this.buffer);
            
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

let currentLogger = null;
let currentUserId = "anonymous";
let currentMode = "A";

export function initLogger(userId) {
    if (!currentLogger) {
        currentLogger = new AffectiveLogger(userId);
        window.logger = currentLogger;
        currentUserId = userId;
        console.log("[Logger] initLogger: 已初始化，userId =", userId);
    }
    return currentLogger;
}

export function getLogger() {
    return currentLogger;
}

export function setUserId(id) {
    currentUserId = id;
    if (currentLogger) {
        currentLogger.userId = id;
    }
    console.log("[Logger] setUserId:", id);
}

export function setMode(mode) {
    currentMode = mode;
    console.log("[Logger] setMode:", mode);
}

export function resetSessionId() {
    if (currentLogger) {
        currentLogger.sessionId = currentLogger.generateSessionId();
        console.log("[Logger] resetSessionId:", currentLogger.sessionId);
    }
}

export async function flushImmediately() {
    if (currentLogger) {
        console.log("[Logger] flushImmediately 被調用");
        return currentLogger.flush();
    }
    console.warn("[Logger] flushImmediately: logger 未初始化");
    return Promise.resolve();
}

export function generateNextUserId() {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    console.log("[Logger] generateNextUserId:", id);
    return id;
}

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

// Vite 延遲掛載
setTimeout(() => {
    window.AffectiveLogger = AffectiveLogger;
    window.initLogger = initLogger;
    window.getLogger = getLogger;
    window.setUserId = setUserId;
    window.setMode = setMode;
    window.resetSessionId = resetSessionId;
    window.flushImmediately = flushImmediately;
    window.generateNextUserId = generateNextUserId;
    window.logActivity = logActivity;
    console.log("[Logger] ✅ AffectiveLogger.js 已加載，所有導出函數已掛到 window");
}, 0);