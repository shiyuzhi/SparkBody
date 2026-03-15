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

const RECORD_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / RECORD_FPS;

export default function CanvasRecorder({ skeletonCanvasRef, userId, onRegisterFrameCallback }) {
  const [isRecordingState, setIsRecordingState] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recordingRef   = useRef(false);
  const compositeRef   = useRef(null);
  const ctxRef         = useRef(null);
  const recorderRef    = useRef(null);
  const timerRef       = useRef(null);
  const chunksRef      = useRef([]);
  const secondsRef     = useRef(0);
  const lastDrawTime   = useRef(0);

  const onFrame = useCallback((fwCanvas) => {
    if (!recordingRef.current) return;

    const now = performance.now();
    if (now - lastDrawTime.current < FRAME_INTERVAL_MS) return;
    lastDrawTime.current = now;

    const ctx = ctxRef.current;
    const composite = compositeRef.current;
    const skCanvas = skeletonCanvasRef?.current;
    if (!ctx || !composite) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, composite.width, composite.height);

    if (fwCanvas?.width > 0) ctx.drawImage(fwCanvas, 0, 0, composite.width, composite.height);
    if (skCanvas?.width > 0) ctx.drawImage(skCanvas, 0, 0, composite.width, composite.height);

    const mm = String(Math.floor(secondsRef.current / 60)).padStart(2, "0");
    const ss = String(secondsRef.current % 60).padStart(2, "0");
    ctx.font = "13px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`REC ${mm}:${ss}  ${userId || ""}`, 12, composite.height - 12);
  }, [skeletonCanvasRef, userId]);

  useEffect(() => {
    onRegisterFrameCallback?.(onFrame);
  }, [onFrame, onRegisterFrameCallback]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    setIsRecordingState(false);

    if (recorderRef.current?.state !== "inactive") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);

    recorderRef.current  = null;
    ctxRef.current       = null;
    lastDrawTime.current = 0;
    secondsRef.current   = 0;
    setSeconds(0);
  }, []);

  useEffect(() => {
    return () => { if (recordingRef.current) stopRecording(); };
  }, [stopRecording]);

  const startRecording = useCallback(() => {
    const composite = compositeRef.current;
    if (!composite) return;

    composite.width  = 320; // 輕量解析度
    composite.height = 180;
    ctxRef.current = composite.getContext("2d", { alpha: false, willReadFrequently: false });

    chunksRef.current    = [];
    recordingRef.current = true;
    setIsRecordingState(true);

    const stream = composite.captureStream(RECORD_FPS);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 200_000, // 降低比特率
    });

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

    recorder.onstop = () => {
      if (!chunksRef.current.length) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `REC_${userId || "user"}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
    };

    recorderRef.current = recorder;
    recorder.start(2000);

    secondsRef.current = 0;
    setSeconds(0);
    timerRef.current = setInterval(() => {
      secondsRef.current++;
      setSeconds(secondsRef.current);
    }, 1000);

    lastDrawTime.current = 0;
  }, [userId]);

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