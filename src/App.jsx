// App.jsx - ✅ 完整修正版本
import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";
import { drumKit } from "./Audio";
import MouseFireworks from "./MouseFireworks";

// ✅ 正確的 AffectiveLogger 導入方式（包括 initLogger 和 getLogger）
import { 
    flushImmediately, 
    setUserId, 
    setMode, 
    generateNextUserId, 
    resetSessionId,
    initLogger,
    getLogger
} from "./AffectiveLogger";

// ✅ Code Splitting - 延後加載重型組件
const DraggableYouTube = lazy(() => import("./DraggableyouTube"));
const CanvasRecorder = lazy(() => import("./Canvasrecorder"));

// ✅ Suspense Fallback 組件
const LoadingSpinner = () => (
  <div style={{
    width: "24px", height: "24px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "rgba(0,220,255,0.6)",
    animation: "spin 0.8s linear infinite"
  }} />
);

export default function App() {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [poseData, setPoseData] = useState(null);
  const [gestureData, setGestureData] = useState([]);
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");
  const [midiList, setMidiList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [isLowEnd, setIsLowEnd] = useState(() => {
    const isWeakCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    const isIOSChrome = /CriOS/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 600;
    return isWeakCPU || isIOSChrome || isSmallScreen;
  });
  const [showDebug, setShowDebug] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [syncState, setSyncState] = useState({ status: "IDLE", pendingCount: 0, isOffline: false });
  
  // ✅ 橫向遊玩提示
  const [showLandscapeHint, setShowLandscapeHint] = useState(true);
  
  const skeletonCanvasRef = useRef(null);
  const lmaDataRef = useRef(null);
  const frameCallbackRef = useRef(null); // CanvasRecorder 的 onFrame，由 Fireworks 驅動

  // ✅ 策略 C：分離偵測邏輯 - 使用 Ref 減少重新渲染
  const poseDataRef = useRef(null);
  const gestureDataRef = useRef(null);

  // ✅ 計算式 - 需要在 useEffect 之前定義
  const isLandscapePhone = windowHeight < 500;

  // 當 poseData 改變時，只更新 Ref（不觸發 App 重新渲染）
  useEffect(() => {
    poseDataRef.current = poseData;
  }, [poseData]);

  useEffect(() => {
    gestureDataRef.current = gestureData;
  }, [gestureData]);

  // ✅ 橫向遊玩提示 - 只在手機顯示，5 秒後自動消失
  useEffect(() => {
    const isMobileDevice = windowWidth < 600; // ✅ 直接計算，不依賴 isMobile
    if (showLandscapeHint && isMobileDevice) {
      const timer = setTimeout(() => {
        setShowLandscapeHint(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showLandscapeHint, windowWidth]);

  const fireworksPose = useMemo(() => {
    if (!poseData) return null;
    return {
      ...poseData,
      leftHandGesture: gestureData?.[0]?.[0]?.categoryName || "None",
      rightHandGesture: gestureData?.[1]?.[0]?.categoryName || "None",
    };
  }, [poseData, gestureData]);

  // ✅ 修正的 confirmUser 函數 - 使用導出的 initLogger
  const confirmUser = () => {
    const id = generateNextUserId();
    setCurrentUserId(id);
    resetSessionId();
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);

    // ✅ [Logger Integration] 使用導出的 initLogger 函數初始化
    initLogger(id);
    
    console.log(`[Session] userId=${id} mode=B logger initialized`);
  };

  useEffect(() => {
    const handleUnlockAudio = () => { drumKit.init(); window.removeEventListener("click", handleUnlockAudio); };
    window.addEventListener("click", handleUnlockAudio);
    const handleResize = () => { setWindowWidth(window.innerWidth); setWindowHeight(window.innerHeight); };
    window.addEventListener("resize", handleResize);
    const onLoggerStatus = (e) => setSyncState(e.detail);
    window.addEventListener("LMA_LOGGER_STATUS", onLoggerStatus);

    // ✅ 策略 D：延後加載 API 數據 - 非阻塞式加載
    const loadApiData = () => {
      fetch("https://imuse.ncnu.edu.tw/Midi-library/api/categories")
        .then(res => res.json())
        .then(data => setCategories(Array.isArray(data) ? data : []))
        .catch(err => console.error("Category Error:", err));

      fetch("https://imuse.ncnu.edu.tw/Midi-library/api/midis")
        .then(res => res.json())
        .then(data => {
          const list = data.items || data || [];
          setMidiList(list);
          const params = new URLSearchParams(window.location.search);
          const midiParam = params.get("midi");
          if (midiParam) {
            const matchMidi = list.find(m => m.title === midiParam);
            if (matchMidi && matchMidi.description) handleUrlChange(matchMidi.description);
          }
        })
        .catch(err => console.error("MIDI Error:", err));
    };

    // 使用 requestIdleCallback 延後加載（主線程閒置時執行）
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadApiData, { timeout: 2000 });
    } else {
      setTimeout(loadApiData, 500);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleUnlockAudio);
      window.removeEventListener("LMA_LOGGER_STATUS", onLoggerStatus);
    };
  }, []);

  const handleUrlChange = (e_or_url) => {
    const url = typeof e_or_url === "string" ? e_or_url : e_or_url.target.value;
    if (!url) return;
    setInputUrl(url);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      setVideoId(match[2]);
      setShowMusic(true);
      drumKit.init();
    }
  };

  // ✅ 修正的 resetSession 函數 - 使用導出的 getLogger
  const resetSession = () => {
    // ✅ [Logger Integration] 結束 Session 前強制送出剩餘數據
    const logger = getLogger();
    if (logger) {
      logger.flush();
    }

    flushImmediately().catch(e => console.error("Flush failed:", e));
    const id = generateNextUserId();
    setCurrentUserId(id);
    resetSessionId();
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);
    setSessionKey(k => k + 1);
  };

  const renderMusicPanel = () => (
    <div className="music-panel">
      {categories.map((cat) => {
        const songs = midiList.filter((m) =>
          (Array.isArray(m.categories) && m.categories.includes(cat)) || m.categories_text === cat
        );
        if (!songs.length) return null;
        const active = expandedCat === cat;
        return (
          <div key={cat}>
            <div className={`cat-row${active ? " active" : ""}`}
              onClick={() => setExpandedCat(active ? null : cat)}>
              <span>{cat}</span>
              <span className="cat-arrow">▶</span>
            </div>
            {active && (
              <div className="song-list">
                {songs.map((m) => (
                  <div key={m.id} className="song-row"
                    onClick={() => { handleUrlChange(m.description); setIsMenuOpen(false); setExpandedCat(null); }}>
                    {m.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-100 h-100 d-flex flex-column" style={{ background: "linear-gradient(135deg, rgba(15,15,40,0.98) 0%, rgba(20,10,50,0.96) 100%)", overflow: "hidden", position: "relative" }}>

      {/* 🎆 Fireworks Canvas */}
      {fireworksPose && !isLowEnd && (
        <Fireworks
          key={sessionKey}
          canvasRef={skeletonCanvasRef}
          poseData={fireworksPose}
          isLandscapePhone={isLandscapePhone}
          onFrameCallback={(cb) => { frameCallbackRef.current = cb; }}
        />
      )}

      {/* 骨架 Canvas */}
      <canvas
        ref={skeletonCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: showSkeleton ? "block" : "none",
          zIndex: 50,
          cursor: "crosshair",
        }}
      />

      {/* 景深 UI 容器 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
          zIndex: 100,
        }}>
        {/* 頂部：Debug */}
        {showDebug && (
          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(0,0,0,0.7)",
              color: "#0ef",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              padding: "8px",
              borderRadius: "4px",
              margin: "8px",
              maxHeight: "200px",
              overflowY: "auto",
              minWidth: "250px",
            }}>
            <div>FPS: {Math.round(1000 / 16.67)} | Pose: {poseData ? "✓" : "✗"}</div>
            <div>Sync: {syncState.status} | Pending: {syncState.pendingCount}</div>
            <div>UserId: {currentUserId}</div>
            <div>Logger: {getLogger() ? "✓" : "✗"}</div>
          </div>
        )}
      </div>

      {/* 模態視窗 */}
      {!isConfirmed && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          backdropFilter: "blur(2px)"
        }}>
          <div style={{
            background: "rgba(20,20,50,0.95)",
            padding: "40px",
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid rgba(0,220,255,0.3)",
            boxShadow: "0 0 20px rgba(0,220,255,0.2)"
          }}>
            <h2 style={{ color: "#0ef", marginBottom: "20px", fontSize: "1.5rem" }}>
              參與者確認
            </h2>
            <p style={{ color: "#aaa", marginBottom: "30px" }}>
              點擊下方按鈕以設定參與者 ID
            </p>
            <button
              onClick={confirmUser}
              style={{
                padding: "12px 32px",
                fontSize: "1rem",
                background: "linear-gradient(135deg, #00dcff 0%, #0088ff 100%)",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 0 15px rgba(0,220,255,0.4)",
                transition: "all 0.3s"
              }}
              onMouseEnter={(e) => {
                e.target.style.boxShadow = "0 0 25px rgba(0,220,255,0.6)";
                e.target.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.target.style.boxShadow = "0 0 15px rgba(0,220,255,0.4)";
                e.target.style.transform = "scale(1)";
              }}>
              開始實驗
            </button>
          </div>
        </div>
      )}

      {/* 樂景 hint */}
      {showLandscapeHint && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,0.9)",
          color: "#0ef",
          padding: "20px 40px",
          borderRadius: "8px",
          textAlign: "center",
          zIndex: 1500,
          fontSize: "1rem",
          fontFamily: "monospace",
          animation: "fadeInOut 5s ease-in-out"
        }}>
          💡 建議橫向遊玩以獲得最佳體驗
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0%   { opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { opacity: 0; }
        }

        .music-panel {
          position: fixed; bottom: 65px; right: 0;
          width: 200px; height: calc(100vh - 130px);
          background: rgba(15,15,20,0.96); border-left: 1px solid #333;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.9);
          overflow-y: auto; overflow-x: hidden; z-index: 1001;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent;
        }
        .music-panel::-webkit-scrollbar { width: 3px; }
        .music-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }

        .cat-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; cursor: pointer; color: #ffc107;
          font-size: 0.82rem; font-family: monospace; user-select: none;
          border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.12s;
        }
        .cat-row:hover { background: rgba(255,180,0,0.07); }
        .cat-row.active { background: rgba(255,180,0,0.12); color: #ffd54f; }
        .cat-arrow { font-size: 0.5rem; opacity: 0.45; display: inline-block; transition: transform 0.18s, opacity 0.18s; }
        .cat-row.active .cat-arrow { transform: rotate(90deg); opacity: 1; }

        .song-list { border-left: 2px solid rgba(255,180,0,0.22); }
        .song-row {
          padding: 8px 12px 8px 16px; cursor: pointer;
          color: rgba(0,210,255,0.8); font-size: 0.78rem; font-family: monospace;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          transition: background 0.1s, color 0.1s, padding-left 0.12s;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .song-row:hover { background: rgba(0,220,255,0.07); color: #00e5ff; padding-left: 20px; }

        .show-btn {
          display: flex; align-items: center; justify-content: center;
          padding: 5px 12px; border-radius: 6px; cursor: pointer;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.55); font-size: 0.8rem; font-family: monospace;
          white-space: nowrap; user-select: none; flex-shrink: 0; transition: all 0.15s;
        }
        .show-btn:hover, .show-btn.on {
          background: rgba(255,180,0,0.12); border-color: rgba(255,180,0,0.5);
          color: #ffc107; box-shadow: 0 0 6px rgba(255,180,0,0.18);
        }

        .feedback-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%; cursor: pointer; flex-shrink: 0;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.13);
          font-size: 0.95rem; text-decoration: none; transition: all 0.18s;
          animation: fb-pulse 3s ease-in-out infinite;
        }
        .feedback-btn:hover {
          background: rgba(100,220,255,0.1); border-color: rgba(100,220,255,0.45);
          box-shadow: 0 0 10px rgba(100,220,255,0.2); transform: scale(1.1);
        }
        @keyframes fb-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(100,220,255,0); }
          50%      { box-shadow: 0 0 0 4px rgba(100,220,255,0.1); }
        }

        .yt-input {
          width: 110px; font-size: 0.72rem; padding: 5px 8px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.14);
          border-radius: 5px; color: #0ef; outline: none; font-family: monospace;
        }
        .yt-input::placeholder { color: rgba(0,220,255,0.4); }
      `}</style>

      {/* ── 底部工具列 ── */}
      <div className="w-100 d-flex align-items-center px-3 px-md-4"
        style={{ background: "rgba(15,15,15,0.95)", borderTop: "1px solid #333", zIndex: 200,
          position: "absolute", bottom: 0,
          height: isLandscapePhone ? "50px" : "65px",
          paddingBottom: "env(safe-area-inset-bottom)" }}>

        {/* 左側 */}
        <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>

          {/* 群組1：骨架 */}
          <button className="btn btn-sm btn-info"
            style={{ fontSize: "0.7rem", padding: "3px 8px" }}
            onClick={() => { setShowSkeleton(!showSkeleton); drumKit.init(); }}>
            💀
          </button>
          {!isLandscapePhone && (
            <input type="range" min="0.3" max="2" step="0.1" value={skeletonScale}
              onChange={(e) => setSkeletonScale(parseFloat(e.target.value))}
              style={{ width: "50px" }} />
          )}
          <button
            className={`btn btn-sm ${isLowEnd ? "btn-secondary" : "btn-success"} d-none d-md-inline`}
            style={{ fontSize: "0.65rem", fontWeight: "bold", padding: "3px 7px" }}
            onClick={() => setIsLowEnd(!isLowEnd)}>
            {isLowEnd ? "LITE" : "HD"}
          </button>

          <div className="tb-sep" style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 5px" }} />

          {/* 群組2：實驗管理 */}
          <button onClick={confirmUser}
            style={{ background: isConfirmed ? "rgba(0,239,255,0.15)" : "rgba(255,100,100,0.2)",
              border: `1px solid ${isConfirmed ? "#0ef" : "#f66"}`, borderRadius: 6,
              padding: "3px 8px", color: isConfirmed ? "#0ef" : "#f88",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {isConfirmed ? `👤 ${currentUserId}` : "Set Participant"}
          </button>
          {isConfirmed && (
            <button onClick={resetSession} className="btn btn-sm btn-outline-warning"
              style={{ fontSize: "0.6rem", padding: "2px 5px" }}>
              NEXT ▶
            </button>
          )}
          <div onClick={() => setShowDebug(v => !v)}
            style={{ background: showDebug ? "rgba(0,239,255,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showDebug ? "#0ef" : "#444"}`, borderRadius: 6,
              padding: "3px 7px", color: showDebug ? "#0ef" : "#555",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace" }}>
            {showDebug ? "LMA ✓" : "LMA"}
          </div>

          <div className="tb-sep" style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 5px" }} />

          {/* ✅ 策略 A：Code Splitting - 延後加載錄影 */}
          {!isLowEnd && (
            <Suspense fallback={<LoadingSpinner />}>
              <CanvasRecorder
                skeletonCanvasRef={skeletonCanvasRef}
                userId={currentUserId}
                onRegisterFrameCallback={(cb) => { frameCallbackRef.current = cb; }}
              />
            </Suspense>
          )}
        </div>

        {/* 右側：點歌區 */}
        <div className="ms-auto d-flex align-items-center gap-2"
          style={{ zIndex: 1000, position: "relative", flexShrink: 0 }}>

          {/* 回饋按鈕 */}
          <a href="https://forms.gle/fmD9XYixYHLLrjQP6" target="_blank" rel="noopener noreferrer"
            className="feedback-btn" title="填寫回饋表單">📮</a>

          {/* YT URL 輸入框 */}
          <input type="text" value={inputUrl} onChange={handleUrlChange}
            className="yt-input d-none d-md-block"
            placeholder="貼上 YouTube 連結" />

          {/* 點歌觸發器 */}
          <div className={`music-trigger${isMenuOpen ? " open" : ""}`}
            onClick={() => { setIsMenuOpen(v => !v); setExpandedCat(null); }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
              background: isMenuOpen ? "rgba(255,180,0,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isMenuOpen ? "rgba(255,180,0,0.5)" : "rgba(255,255,255,0.18)"}`,
              color: isMenuOpen ? "#ffc107" : "rgba(255,255,255,0.6)",
              fontSize: "0.8rem", fontFamily: "monospace", whiteSpace: "nowrap",
              transition: "all 0.15s"
            }}>
            <span>♩</span>
            {windowWidth >= 768 && <span>點歌</span>}
            <span className="arr" style={{
              display: "inline-block",
              transition: "transform 0.18s",
              transform: isMenuOpen ? "rotate(180deg)" : "rotate(0deg)"
            }}>▼</span>
          </div>

          {/* 下拉面板 */}
          {isMenuOpen && renderMusicPanel()}

          {/* 播放器開關 */}
          <div className={`show-btn${showMusic ? " on" : ""}`}
            onClick={() => { setShowMusic(v => !v); drumKit.init(); }}>
            🎵 Music
          </div>

        </div>
      </div>

      {/* ✅ 策略 B：LCP 標題 - 在工具列下方最底部 */}
      {windowWidth >= 950 && (
        <div
          className="text-center"
          style={{
            pointerEvents: "none",
            position: "fixed",
            bottom: "5px",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            zIndex: 201,
          }}>
          <div
            className="text-light fw-bold"
            style={{
              letterSpacing: "2px",
              opacity: 0.7,
              fontSize: "0.85rem",
              contentVisibility: "auto",
            }}>
            SPARKBODY STAGE
          </div>
        </div>
      )}

      {/* ✅ 策略 A：Code Splitting - 延後加載 YouTube */}
      {showMusic && (
        <Suspense fallback={<LoadingSpinner />}>
          <DraggableYouTube videoId={videoId}
            width={isLandscapePhone ? 240 : 320}
            height={isLandscapePhone ? 135 : 180}
            initialPosition={{ top: 20, left: windowWidth - (isLandscapePhone ? 260 : 340) }} />
        </Suspense>
      )}
    </div>
  );
}