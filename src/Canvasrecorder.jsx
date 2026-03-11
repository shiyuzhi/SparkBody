import { useRef, useState, useCallback, useEffect } from "react";

const BUTTON_BASE_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  position: "relative",
  zIndex: 1000,
  backdropFilter: "blur(8px)",
  padding: "6px 16px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "600",
  fontFamily: "monospace",
  cursor: "pointer",
  transition: "all 0.1s ease",
  border: "1px solid",
  minWidth: "140px",
  height: "38px",
  outline: "none"
};

const CSS_ANIMATIONS = `
  @keyframes rec-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .rec-btn-recording { background: rgba(255, 59, 48, 0.2) !important; color: #ff453a !important; border-color: #ff453a !important; }
  .rec-btn-idle { background: rgba(255, 255, 255, 0.05); color: #ccc; border-color: #444; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-active { background: #ff453a; animation: rec-blink 1.2s infinite; }
  .dot-idle { background: #666; }
`;

// 目標錄影 FPS，降低此數字可大幅減少 CPU 負擔
const RECORD_FPS = 24;
const FRAME_INTERVAL_MS = 1000 / RECORD_FPS;

export default function CanvasRecorder({ fireworksSelector, skeletonCanvasRef, userId }) {
  const [isRecordingState, setIsRecordingState] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recordingRef  = useRef(false);
  const compositeRef  = useRef(null);
  // ★ ctx 只取一次，不在 drawFrame 裡重複呼叫 getContext
  const ctxRef        = useRef(null);
  const recorderRef   = useRef(null);
  const rafRef        = useRef(null);
  const timerRef      = useRef(null);
  const chunksRef     = useRef([]);
  const secondsRef    = useRef(0);
  const fwCanvasRef   = useRef(null);
  const lastDrawTime  = useRef(0);

  useEffect(() => {
    return () => {
      if (recordingRef.current) stopRecording();
    };
  }, []);

  const drawFrame = useCallback((timestamp) => {
    if (!recordingRef.current) return;

    // FPS 節流：距上次合成未滿一個 frame interval 就跳過
    if (timestamp - lastDrawTime.current < FRAME_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    lastDrawTime.current = timestamp;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const composite = compositeRef.current;
    const fwCanvas  = fwCanvasRef.current;
    const skCanvas  = skeletonCanvasRef?.current;

    // 1. ★ 黑底用 fillRect（影片需要黑底）；若不需黑底改 clearRect 更快
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, composite.width, composite.height);

    // 2. 合成兩個 canvas
    //    drawImage 會自動做 GPU-accelerated downscale，不需手動計算
    if (fwCanvas?.width > 0) {
      ctx.drawImage(fwCanvas, 0, 0, composite.width, composite.height);
    }
    if (skCanvas?.width > 0) {
      ctx.drawImage(skCanvas, 0, 0, composite.width, composite.height);
    }

    // 3. 浮水印（輕量文字，避免 shadowBlur）
    const mm = String(Math.floor(secondsRef.current / 60)).padStart(2, "0");
    const ss = String(secondsRef.current % 60).padStart(2, "0");
    ctx.font = "13px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`REC ${mm}:${ss}  ${userId || ""}`, 12, composite.height - 12);

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [fireworksSelector, skeletonCanvasRef, userId]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    setIsRecordingState(false);

    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current.stop();
    }

    if (rafRef.current)  cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    recorderRef.current = null;
    fwCanvasRef.current = null;
    ctxRef.current      = null;
    lastDrawTime.current = 0;
    setSeconds(0);
  }, []);

  const startRecording = useCallback(() => {
    const composite = compositeRef.current;
    if (!composite) return;

    // 360p：合成解析度夠用，且比 720p 省約 75% GPU 合成成本
    composite.width  = 640;
    composite.height = 360;

    // ★ getContext 只在這裡取一次，後續 drawFrame 直接用 ctxRef.current
    ctxRef.current = composite.getContext("2d", { alpha: false, willReadFrequently: false });

    // ★ fireworks canvas DOM query 只在錄影開始時做一次
    fwCanvasRef.current = document.querySelector(fireworksSelector) ?? null;

    chunksRef.current    = [];
    recordingRef.current = true;
    setIsRecordingState(true);

    // captureStream FPS 與 RECORD_FPS 一致，避免瀏覽器在背景多餘插幀
    const stream = composite.captureStream(RECORD_FPS);

    // ★ 優先嘗試 VP9（壓縮率更高 → 寫入負擔更小）；不支援則降回 VP8
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm;codecs=vp8";

    const recorder = new MediaRecorder(stream, {
      mimeType,
      // ★ 降低位元率：360p@24fps 用 600kbps 已很清晰，減少編碼器 CPU 佔用
      videoBitsPerSecond: 600_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (!chunksRef.current.length) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `REC_${userId || "user"}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.parentNode?.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    };

    recorderRef.current = recorder;
    // ★ timeslice 2000ms：兼顧 ondataavailable 呼叫頻率低 與 停止時不卡頓
    recorder.start(2000);

    secondsRef.current = 0;
    setSeconds(0);
    timerRef.current = setInterval(() => {
      secondsRef.current++;
      setSeconds(secondsRef.current);
    }, 1000);

    lastDrawTime.current = 0;
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [drawFrame, userId]);

  const handleToggleRecording = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isRecordingState ? stopRecording() : startRecording();
  };

  return (
    <div className="canvas-recorder-wrapper" style={{ display: "inline-block" }}>
      <style>{CSS_ANIMATIONS}</style>
      <canvas ref={compositeRef} style={{ display: "none" }} />

      <button
        type="button"
        onClick={handleToggleRecording}
        className={isRecordingState ? "rec-btn-recording" : "rec-btn-idle"}
        style={BUTTON_BASE_STYLE}
      >
        <span className={`dot ${isRecordingState ? "dot-active" : "dot-idle"}`} />
        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "85px", textAlign: "left" }}>
          {isRecordingState
            ? `STOP ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
            : "START REC"}
        </span>
      </button>
    </div>
  );
}