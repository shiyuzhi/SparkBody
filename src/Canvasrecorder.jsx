// CanvasRecorder.jsx
// 合成兩個 canvas（骨架 + 煙火）並錄製成 webm 影片
import { useRef, useState, useCallback } from "react";

/**
 * @param {Object} props
 * @param {string} props.fireworksSelector  - 煙火 canvas 的 CSS selector
 * @param {string} props.skeletonSelector   - 骨架 canvas 的 CSS selector
 * @param {string} props.userId             - 當前受試者 ID（用於檔名）
 */
export default function CanvasRecorder({ fireworksSelector, skeletonCanvasRef, userId }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds]     = useState(0);

  const compositeRef  = useRef(null); // 隱藏合成 canvas
  const recorderRef   = useRef(null);
  const rafRef        = useRef(null);
  const timerRef      = useRef(null);
  const chunksRef     = useRef([]);
  const secondsRef    = useRef(0);

  // 每幀把骨架 + 煙火合成到 composite canvas
  const drawFrame = useCallback(() => {
    const composite = compositeRef.current;
    if (!composite) return;

    const fwCanvas  = document.querySelector(fireworksSelector);
    const skCanvas  = skeletonCanvasRef?.current;
    const ctx       = composite.getContext("2d");

    const w = window.innerWidth;
    const h = window.innerHeight;
    composite.width  = w;
    composite.height = h;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // 1. 先畫煙火（底層）
    if (fwCanvas && fwCanvas.width > 0) {
      try { ctx.drawImage(fwCanvas, 0, 0, w, h); } catch (_) {}
    }
    // 2. 再畫骨架（最上層）
    if (skCanvas && skCanvas.width > 0) {
      try {
        const r = skCanvas.getBoundingClientRect();
        ctx.drawImage(skCanvas, 0, 0, skCanvas.width, skCanvas.height, r.left, r.top, r.width, r.height);
      } catch (e) { console.error("Sk draw error", e); }
    }

    // 浮水印（用 ref 避免 closure 舊值）
    const elapsed = secondsRef.current;
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    ctx.font      = "bold 14px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`⏺ ${mm}:${ss}  ${userId || ""}`, 12, 22);

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [fireworksSelector, skeletonCanvasRef, userId]);

  const startRecording = useCallback(() => {
    const composite = compositeRef.current;
    if (!composite) return;

    composite.width  = window.innerWidth;
    composite.height = window.innerHeight;

    chunksRef.current = [];

    const stream   = composite.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const now  = new Date();
      const ts   = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
      a.href     = url;
      a.download = `SparkBody_${userId || "unknown"}_${ts}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start(100); // 每 100ms 存一個 chunk
    recorderRef.current = recorder;

    // 開始合成幀
    rafRef.current = requestAnimationFrame(drawFrame);

    // 計時器
    let s = 0;
    timerRef.current = setInterval(() => { s++; secondsRef.current = s; setSeconds(s); }, 1000);

    setRecording(true);
    setSeconds(0);
  }, [drawFrame, userId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      {/* 隱藏合成 canvas，只用來錄製 */}
      <canvas
        ref={compositeRef}
        style={{ display: "none" }}
      />

      {/* 錄製按鈕 */}
      <button
        onClick={recording ? stopRecording : startRecording}
        style={{
          background:   recording ? "rgba(255,50,50,0.25)" : "rgba(255,255,255,0.07)",
          border:       `1px solid ${recording ? "#f55" : "#555"}`,
          borderRadius: 6,
          padding:      "4px 10px",
          color:        recording ? "#f55" : "#888",
          fontSize:     "0.7rem",
          cursor:       "pointer",
          fontFamily:   "monospace",
          whiteSpace:   "nowrap",
          display:      "flex",
          alignItems:   "center",
          gap:          5,
        }}
      >
        {recording
          ? <>⏹ {mm}:{ss}</>
          : <>⏺ REC</>
        }
      </button>
    </>
  );
}