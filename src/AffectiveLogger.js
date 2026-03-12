const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOFIDOoDRgOdqiprotV3etzeEHPulmPZlhcrAEnHa_1OcugfzohrP5t0gcPTF8hbZfHA/exec";

class AffectiveLogger {
    constructor(userId) {
        this.userId = userId || "anonymous";
        this.sessionId = this.generateSessionId();
        this.buffer = [];
        this.batchSize = 50;
        this.flushInterval = 5000; 
        this.lastFlushTime = Date.now();

        // 啟動定時器
        setInterval(() => this.checkFlush(), 2000);
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

        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const dataToSent = {
            batch: [...this.buffer]
        };
        this.buffer = []; 
        this.lastFlushTime = Date.now();

        try {
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dataToSent)
            });
            console.log("✅ 數據已發送至 Google Sheets");
        } catch (error) {
            console.error("❌ 發送失敗:", error);
            this.buffer = dataToSent.batch.concat(this.buffer);
        }
    }

    checkFlush() {
        if (this.buffer.length > 0 && (Date.now() - this.lastFlushTime) > this.flushInterval) {
            this.flush();
        }
    }
}

window.AffectiveLogger = AffectiveLogger;