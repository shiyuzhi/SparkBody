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
        console.log("[Logger] 初始化成功, User:", this.userId);
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

        // 滿 50 筆立刻送出
        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const dataToSent = {
            batch: [...this.buffer]
        };
        
        // 先清空緩衝區，避免發送期間產生的新數據遺失
        const currentBatchSize = this.buffer.length;
        this.buffer = []; 
        this.lastFlushTime = Date.now();

        try {
            // 重要：不帶自定義 headers 以避開 CORS 預檢
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                cache: "no-cache",
                body: JSON.stringify(dataToSent)
            });
            console.log(`✅ [Logger] 成功發送 ${currentBatchSize} 筆數據`);
        } catch (error) {
            console.error("❌ [Logger] 發送失敗:", error);
            // 失敗時將資料塞回緩衝區
            this.buffer = dataToSent.batch.concat(this.buffer);
        }
    }

    checkFlush() {
        if (this.buffer.length > 0 && (Date.now() - this.lastFlushTime) > this.flushInterval) {
            this.flush();
        }
    }
}

// 掛載到 window 確保全域可調用
window.AffectiveLogger = AffectiveLogger;