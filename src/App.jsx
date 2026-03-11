// App.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import DraggableYouTube from "./DraggableyouTube";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";
import { drumKit } from "./Audio";
import MouseFireworks from "./MouseFireworks";
// ★ Logger 整合
import { flushImmediately, setUserId, setMode, generateNextUserId, resetSessionId } from "./AffectiveLogger";
import CanvasRecorder from "./Canvasrecorder";

export default function App() {
  // -------------------- 狀態 --------------------
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [poseData, setPoseData] = useState(null);
  const [gestureData, setGestureData] = useState([]);
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");

  const [midiList, setMidiList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
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

  // 受試者管理
  const [currentUserId, setCurrentUserId] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  // 同步狀態
  const [syncState, setSyncState] = useState({ status: 'IDLE', pendingCount: 0, isOffline: false });
  const skeletonCanvasRef = useRef(null);
  const lmaDataRef = useRef(null);

  // -------------------- memo 化 Fireworks 用 poseData --------------------
  const fireworksPose = useMemo(() => {
    if (!poseData) return null;
    return {
      ...poseData,
      leftHandGesture: gestureData?.[0]?.[0]?.categoryName || "None",
      rightHandGesture: gestureData?.[1]?.[0]?.categoryName || "None"
    };
  }, [poseData, gestureData]);

  // -------------------- 受試者確認 --------------------
  const confirmUser = () => {
    const id = generateNextUserId();
    setCurrentUserId(id);
    resetSessionId();   // ← 每位受試者產生新的 sessionId
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);
    console.log(`[Session] userId=${id} mode=B`);
  };

  // -------------------- 初始化 --------------------
  useEffect(() => {
    // 解鎖 Audio
    const handleUnlockAudio = () => {
      drumKit.init();
      window.removeEventListener("click", handleUnlockAudio);
    };
    window.addEventListener("click", handleUnlockAudio);

    // 視窗 resize
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Logger 狀態監聽
    const onLoggerStatus = (e) => setSyncState(e.detail);
    window.addEventListener("LMA_LOGGER_STATUS", onLoggerStatus);

    // 讀取 MIDI categories
    fetch('https://imuse.ncnu.edu.tw/Midi-library/api/categories')
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(err => console.error("Category Error:", err));

    // 讀取 MIDI 列表
    fetch('https://imuse.ncnu.edu.tw/Midi-library/api/midis')
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

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleUnlockAudio);
      window.removeEventListener("LMA_LOGGER_STATUS", onLoggerStatus);
    };
  }, []);

  // -------------------- 過濾 MIDI --------------------
  const filteredMidiList = useMemo(() => {
    if (!selectedCategory) return midiList;
    return midiList.filter(midi => {
      const isInArray = Array.isArray(midi.categories) && midi.categories.includes(selectedCategory);
      const isMatchText = midi.categories_text === selectedCategory;
      return isInArray || isMatchText;
    });
  }, [selectedCategory, midiList]);

  const isLandscapePhone = windowHeight < 500;
  const isMobile = windowWidth < 768;

  // -------------------- URL 解析 --------------------
  const handleUrlChange = (e_or_url) => {
    const url = typeof e_or_url === 'string' ? e_or_url : e_or_url.target.value;
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

  // -------------------- Session Reset --------------------
 const resetSession = () => {
    flushImmediately().catch(e => console.error("Flush failed:", e));
    const id = generateNextUserId();
    setCurrentUserId(id);
    resetSessionId();
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);
    setSessionKey(k => k + 1);
};
  // -------------------- 渲染 --------------------
  return (
    <div style={{ height: "100dvh", width: "100vw", backgroundColor: "black", overflow: "hidden", position: "relative" }}>
      

      {/* Fireworks & Skeleton */}
       <Fireworks poseData={fireworksPose} isLowEnd={isLowEnd} showDebug={showDebug} mode={`B-${sessionKey}`} onLMAUpdate={(lma) => { lmaDataRef.current = lma; }} />

      <DraggableSkeleton scale={skeletonScale} visible={showSkeleton} onHide={() => setShowSkeleton(false)}
        width={isLandscapePhone ? windowHeight * 0.8 : 600} height={isLandscapePhone ? windowHeight * 0.8 : 600}
        initialPosition={isLandscapePhone ? { top: "5%", left: "15%" } : { top: "10%", left: "25%" }} transparent>
        <PoseSkeleton onPoseUpdate={setPoseData} onGestureData={setGestureData} hideCanvas={!showSkeleton} isLowEnd={isLowEnd} skeletonCanvasRef={skeletonCanvasRef} lmaDataRef={lmaDataRef} showDebug={showDebug} />
      </DraggableSkeleton>
      <MouseFireworks isLowEnd={isLowEnd} />

      {/* 底部工具列 */}
      <div className="w-100 d-flex align-items-center px-3 px-md-4" style={{ background: "rgba(15,15,15,0.95)", borderTop: "1px solid #333", zIndex: 200, position: "absolute", bottom: 0, height: isLandscapePhone ? "50px" : "65px", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="d-flex align-items-center gap-2" style={{ zIndex: 10, flexShrink: 0 }}>
          <button className="btn btn-sm btn-info" onClick={() => { setShowSkeleton(!showSkeleton); drumKit.init(); }}>
            <span className="d-none d-lg-inline">{showSkeleton ? "Hide Skeleton" : "Show Skeleton"}</span><span className="d-lg-none">💀</span>
          </button>
          {!isLandscapePhone && <input type="range" min="0.3" max="2" step="0.1" value={skeletonScale} onChange={(e) => setSkeletonScale(parseFloat(e.target.value))} style={{ width: "60px" }} />}
          <button className={`btn btn-sm ${isLowEnd ? 'btn-secondary' : 'btn-success'} d-none d-md-inline`} onClick={() => setIsLowEnd(!isLowEnd)} style={{ fontSize: "0.7rem", fontWeight: "bold" }}>{isLowEnd ? "🚀 Lite Mode (ON)" : "💎 High Performance"}</button>

          {/* 受試者面板 */}
          <div className="d-flex align-items-center gap-1">
          <button onClick={confirmUser} style={{ background: isConfirmed ? "rgba(0,239,255,0.15)" : "rgba(255,100,100,0.2)", border: `1px solid ${isConfirmed ? "#0ef" : "#f66"}`, borderRadius: 6, padding: "4px 10px", color: isConfirmed ? "#0ef" : "#f88", fontSize: "0.7rem", cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {isConfirmed ? `👤 ${currentUserId}` : "Set Participant"}
          </button>
          {isConfirmed && <button onClick={resetSession} className="btn btn-sm btn-outline-warning" style={{ fontSize: "0.6rem", padding: "2px 6px" }}>NEXT ▶</button>}
          </div>
            <div onClick={() => setShowDebug(v => !v)} style={{ background: showDebug ? "rgba(0,239,255,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${showDebug ? "#0ef" : "#444"}`, borderRadius: 8, padding: "4px 8px", color: showDebug ? "#0ef" : "#555", fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace" }}>
              {showDebug ? "LMA ✓" : "LMA"}
            </div>

          <CanvasRecorder
            fireworksSelector="#fireworks-canvas"
            skeletonCanvasRef={skeletonCanvasRef}
            userId={currentUserId}
          />

        </div>

        {/* 舞台標題 */}
        <div className="position-absolute start-50 translate-middle-x text-center" style={{ pointerEvents: "none", display: windowWidth < 950 ? "none" : "block" }}>
          <div className="text-light fw-bold" style={{ letterSpacing: "2px", whiteSpace: "nowrap", opacity: 0.7 }}>SPARKBODY STAGE</div>
        </div>

        {/* 點歌區 */}
        <style>{`
          .music-trigger {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 6px; cursor: pointer;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.25);
            color: #ffffff; font-size: 0.82rem; font-family: monospace;
            letter-spacing: 0.05em; white-space: nowrap;
            transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
            user-select: none;
          }
          .music-trigger:hover, .music-trigger.open {
            background: rgba(255,255,255,0.12);
            border-color: rgba(255,255,255,0.55);
            box-shadow: 0 0 8px rgba(255,255,255,0.12);
          }
          .music-trigger .arr {
            font-size: 0.55rem; opacity: 0.6;
            display: inline-block;
            transition: transform 0.2s;
          }
          .music-trigger.open .arr { transform: rotate(180deg); }

          .music-panel {
            position: absolute; bottom: calc(100% + 8px); right: 0;
            width: 240px; max-height: 52vh;
            background: #0d0d0d;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            box-shadow: 0 -8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03);
            overflow-y: auto; overflow-x: hidden;
            z-index: 1001;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.2) transparent;
          }
          .music-panel::-webkit-scrollbar { width: 3px; }
          .music-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

          .cat-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; cursor: pointer;
            color: #ffc107; font-size: 0.82rem; font-family: monospace;
            letter-spacing: 0.04em; user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            transition: background 0.12s;
          }
          .cat-row:hover { background: rgba(255,180,0,0.07); }
          .cat-row.active { background: rgba(255,180,0,0.12); color: #ffd54f; }
          .cat-arrow {
            font-size: 0.5rem; opacity: 0.5;
            display: inline-block;
            transition: transform 0.18s, opacity 0.18s;
          }
          .cat-row.active .cat-arrow { transform: rotate(90deg); opacity: 1; }

          .song-list { border-left: 2px solid rgba(255,180,0,0.25); }
          .song-row {
            padding: 8px 12px 8px 16px; cursor: pointer;
            color: rgba(0,210,255,0.8); font-size: 0.78rem; font-family: monospace;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            transition: background 0.1s, color 0.1s, padding-left 0.12s;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .song-row:hover {
            background: rgba(0,220,255,0.07);
            color: #00e5ff;
            padding-left: 20px;
          }
          .show-btn {
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; cursor: pointer;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.6); font-size: 0.82rem;
            font-family: monospace; padding: 6px 14px;
            transition: all 0.15s; flex-shrink: 0; user-select: none;
            white-space: nowrap;
          }
          .show-btn:hover, .show-btn.on {
            background: rgba(255,180,0,0.12);
            border-color: rgba(255,180,0,0.55);
            color: #ffc107;
            box-shadow: 0 0 6px rgba(255,180,0,0.2);
          }
          .feedback-btn {
            display: flex; align-items: center; justify-content: center;
            width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.15);
            font-size: 1rem; text-decoration: none;
            transition: all 0.18s; flex-shrink: 0;
            animation: feedback-pulse 3s ease-in-out infinite;
          }
          .feedback-btn:hover {
            background: rgba(100,220,255,0.12);
            border-color: rgba(100,220,255,0.5);
            box-shadow: 0 0 10px rgba(100,220,255,0.25);
            transform: scale(1.1);
          }
          @keyframes feedback-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(100,220,255,0); }
            50% { box-shadow: 0 0 0 4px rgba(100,220,255,0.12); }
          }
        `}</style>

        <div className="ms-auto d-flex align-items-center gap-2"
          style={{ zIndex: 1000, position: "relative", flexShrink: 0 }}>

          {/* 回饋表單按鈕 */}
          <a href="https://forms.gle/fmD9XYixYHLLrjQP6" target="_blank" rel="noopener noreferrer"
            className="feedback-btn" title="填寫回饋表單">
            📮
          </a>


          {/* YT URL 輸入框 */}
          <input type="text" value={inputUrl} onChange={handleUrlChange}
            className="d-none d-md-block"
            style={{ width: "110px", fontSize: "0.72rem", padding: "5px 8px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 5, color: "#0ef", outline: "none", fontFamily: "monospace" }}
            placeholder="貼上 YouTube 連結" />

        
          {/* 點歌觸發器 */}
          <div className={`music-trigger${isMenuOpen ? " open" : ""}`}
            onClick={() => { setIsMenuOpen(v => !v); setExpandedCat(null); }}>
            <span>♩</span>
            {!isMobile && <span>點歌</span>}
            <span className="arr">▼</span>
          </div>

          {/* 下拉面板 */}
          {isMenuOpen && (
            <div className="music-panel">
              {categories.map((cat) => {
                const songs = midiList.filter((m) =>
                  (Array.isArray(m.categories) && m.categories.includes(cat)) ||
                  m.categories_text === cat
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
              {(() => {
                const other = midiList.filter((m) => !categories.length ||
                  !categories.some((c) =>
                    (Array.isArray(m.categories) && m.categories.includes(c)) || m.categories_text === c
                  ));
                if (!other.length) return null;
                const active = expandedCat === "__other__";
                return (
                  <div>
                    <div className={`cat-row${active ? " active" : ""}`}
                      style={{ color: "rgba(255,255,255,0.35)" }}
                      onClick={() => setExpandedCat(active ? null : "__other__")}>
                      <span>其他</span>
                      <span className="cat-arrow">▶</span>
                    </div>
                    {active && (
                      <div className="song-list">
                        {other.map((m) => (
                          <div key={m.id} className="song-row"
                            onClick={() => { handleUrlChange(m.description); setIsMenuOpen(false); setExpandedCat(null); }}>
                            {m.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        
        
          {/* 播放器顯示切換 */}
          <div className={`show-btn${showMusic ? " on" : ""}`}
            onClick={() => { setShowMusic(v => !v); drumKit.init(); }}
            title={showMusic ? "隱藏播放器" : "顯示播放器"}
            style={{ width: "auto", padding: "5px 12px", fontSize: "0.72rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            🎵 Music
          </div>
      </div>

      {showMusic && (
        <DraggableYouTube videoId={videoId} width={isLandscapePhone ? 240 : 320} height={isLandscapePhone ? 135 : 180} initialPosition={{ top: 20, left: windowWidth - (isLandscapePhone ? 260 : 340) }} />
      )}
    </div>
  );
}