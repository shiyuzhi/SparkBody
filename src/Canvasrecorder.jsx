import { useRef, useState, useCallback, useEffect } from "react";

// 靜態樣式優化：保持 UI 輕量
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
  transition: "all 0.1s ease", // 縮短反應時間
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

export default function CanvasRecorder({ fireworksSelector, skeletonCanvasRef, userId }) {
  const [isRecordingState, setIsRecordingState] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recordingRef = useRef(false);
  const compositeRef = useRef(null);
  const recorderRef  = useRef(null);
  const rafRef       = useRef(null);
  const timerRef     = useRef(null);
  const chunksRef    = useRef([]);
  const secondsRef   = useRef(0);
  const fwCanvasRef  = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingRef.current) stopRecording();
    };
  }, []);

  const drawFrame = useCallback(() => {
    if (!recordingRef.current) return;

    const composite = compositeRef.current;
    if (!composite) return;

    const ctx = composite.getContext("2d", { alpha: false });
    const fwCanvas = fwCanvasRef.current || document.querySelector(fireworksSelector);
    const skCanvas = skeletonCanvasRef?.current;

    // 1. 底色
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, composite.width, composite.height);

    // 2. 繪製 (360p 下 drawImage 的負擔極低)
    if (fwCanvas && fwCanvas.width > 0) {
      ctx.drawImage(fwCanvas, 0, 0, fwCanvas.width, fwCanvas.height, 0, 0, composite.width, composite.height);
      if (!fwCanvasRef.current) fwCanvasRef.current = fwCanvas;
    }
    if (skCanvas && skCanvas.width > 0) {
      ctx.drawImage(skCanvas, 0, 0, skCanvas.width, skCanvas.height, 0, 0, composite.width, composite.height);
    }

    // 3. 浮水印
    ctx.font = "14px monospace"; // 360p 字體縮小
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    const mm = String(Math.floor(secondsRef.current / 60)).padStart(2, "0");
    const ss = String(secondsRef.current % 60).padStart(2, "0");
    ctx.fillText(`REC ${mm}:${ss} | ${userId || "User"}`, 15, composite.height - 15);

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [fireworksSelector, skeletonCanvasRef, userId]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    setIsRecordingState(false);

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    recorderRef.current = null;
    fwCanvasRef.current = null;
    setSeconds(0);
  }, []);

  const startRecording = useCallback(() => {
    const composite = compositeRef.current;
    if (!composite) return;

    // 🔴 降級為 360p：極大提升流暢度
    composite.width = 640;
    composite.height = 360;
    
    chunksRef.current = [];
    recordingRef.current = true;
    setIsRecordingState(true);

    const stream = composite.captureStream(24); // 降到 24fps 更有電影感且更順
    const recorder = new MediaRecorder(stream, { 
      mimeType: "video/webm;codecs=vp8", // VP8 在低解析度下最快
      videoBitsPerSecond: 800000 // 800kbps 針對 360p 已足夠清晰
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `REC_360p_${userId || "user"}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    };

    recorderRef.current = recorder;
    recorder.start(1000); 

    secondsRef.current = 0;
    setSeconds(0);
    timerRef.current = setInterval(() => {
      secondsRef.current++;
      setSeconds(secondsRef.current);
    }, 1000);
    
    requestAnimationFrame(drawFrame);
  }, [drawFrame, userId, stopRecording]);

  const handleToggleRecording = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRecordingState) {
      stopRecording();
    } else {
      startRecording();
    }
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
            ? `STOP ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}` 
            : "START REC"}
        </span>
      </button>
    </div>
  );
}