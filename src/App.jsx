// App.jsx
import React, { useState, useEffect, useRef, Suspense, lazy, startTransition, useDeferredValue } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";
import { drumKit } from "./Audio";
import { initLogger, flushImmediately, setUserId, setMode, generateNextUserId, resetSessionId } from "./AffectiveLogger";
import { resetLMA } from "./lmaEngine";
import { useRTC } from "./useRTC";
import RemoteSkeleton from "./RemoteSkeleton";
import RTCPanel from "./RTCPanel";

const DraggableYouTube = lazy(() => import("./DraggableyouTube"));

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
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const inputUrl = "https://youtu.be/4rgSzQwe5DQ";
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
  const [showGuide, setShowGuide] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [syncState, setSyncState] = useState({ status: "IDLE", pendingCount: 0, isOffline: false });
  const [showLandscapeHint, setShowLandscapeHint] = useState(true);
  // ✅ LCP：延後初始化 MediaPipe，讓首幀先繪製
  const [poseReady, setPoseReady] = useState(false);

  // ── RTC state ─────────────────────────────────────────────────────────────
  const [rtcRoom, setRtcRoom] = useState(null);
  const [rtcRole, setRtcRole] = useState(null);
  const [remotePose, setRemotePose] = useState(null);
  const [lang, setLang] = useState("zh");
  const ytPlayerRef = useRef(null);

  const { status: rtcStatus, sendPose, sendYtSync } = useRTC({
    roomId: rtcRoom,
    role: rtcRole,
    onPoseData: setRemotePose,
    onYtSync: ({ action, videoTime }) => {
      const player = ytPlayerRef.current;
      if (!player) return;
      if (action === "play") {
        player.seekTo(videoTime, true);
        player.playVideo();
      } else if (action === "pause") {
        player.pauseVideo();
      }
    },
  });

  // ✅ INP：useDeferredValue 讓 YouTube 更新不阻塞 keyboard 回應
  const deferredVideoId = useDeferredValue(videoId);

  const skeletonCanvasRef = useRef(null);
  const lmaDataRef = useRef(null);
  const poseDataRef = useRef(null);
  const gestureDataRef = useRef(null);

  const isLandscapePhone = windowHeight < 500;

  useEffect(() => {
    const isMobileDevice = windowWidth < 600;
    if (showLandscapeHint && isMobileDevice) {
      const timer = setTimeout(() => setShowLandscapeHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showLandscapeHint, windowWidth]);

  const confirmUser = () => {
    const id = generateNextUserId();
    setCurrentUserId(id);
    initLogger(id);
    resetSessionId();
    resetLMA();
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);
    console.log(`[Session] userId=${id} mode=B`);
  };

  // ✅ LCP：boot-screen 移除
  useEffect(() => { window.__removeBoot?.(); }, []);

  useEffect(() => {
    const handleUnlockAudio = () => { drumKit.init(); window.removeEventListener("click", handleUnlockAudio); };
    window.addEventListener("click", handleUnlockAudio);
    const handleResize = () => { setWindowWidth(window.innerWidth); setWindowHeight(window.innerHeight); };
    window.addEventListener("resize", handleResize);
    const onLoggerStatus = (e) => setSyncState(e.detail);
    window.addEventListener("LMA_LOGGER_STATUS", onLoggerStatus);

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

    // ✅ 方案 B：idle 時同時預載 DraggableYouTube chunk + API 資料
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        import("./DraggableyouTube");
        loadApiData();
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        import("./DraggableyouTube");
        loadApiData();
      }, 500);
    }

    // ✅ LCP：首幀渲染完成後才啟動 MediaPipe（避免 WASM 下載阻塞主線程）
    const t = setTimeout(() => setPoseReady(true), 800);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleUnlockAudio);
      window.removeEventListener("LMA_LOGGER_STATUS", onLoggerStatus);
    };
  }, []);

  // ✅ INP 優化：startTransition 標記非緊急更新，drumKit.init() 保留在外
  const handleUrlChange = (e_or_url) => {
    const url = typeof e_or_url === "string" ? e_or_url : e_or_url.target.value;
    if (!url) return;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    if (match && match[2].length === 11) {
      drumKit.init(); // AudioContext 需即時，保留在 transition 外
      startTransition(() => {
        setVideoId(match[2]);
        setShowMusic(true);
      });
    }
  };

  const resetSession = () => {
    flushImmediately().catch(e => console.error("Flush failed:", e));
    const id = generateNextUserId();
    setCurrentUserId(id);
    initLogger(id);
    resetSessionId();
    resetLMA();
    setUserId(id);
    setMode("B");
    setIsConfirmed(true);
    setSessionKey(k => k + 1);
  };

  const displayNames = {
    "台語歌曲": "Hokkien (Southern Min)",
    "華語歌曲": "Mandarin (Sinitic)",
    "無歌詞": "Unclassified",
    "日語歌曲": "Japanese",
    "英文歌曲": "English",
    "原民歌曲": "Austronesian (Folk Music)",
    "古典": "Classical Music"
  };

  const renderMusicPanel = () => (
    <div className="music-panel">
      {categories.map((cat) => {
        const songs = midiList.filter((m) => {
          const isSensitive = m.title.includes("中華民國") || m.title.includes("民國") || m.title.includes("軍紀歌") || m.title.includes("夜襲");
          const isMatch = (Array.isArray(m.categories) && m.categories.includes(cat)) || m.categories_text === cat;
          return !isSensitive && isMatch;
        });
        if (!songs.length) return null;
        const active = expandedCat === cat;
        return (
          <div key={cat}>
            <div className={`cat-row${active ? " active" : ""}`}
              onClick={() => setExpandedCat(active ? null : cat)}>
              <span>{lang === "zh" ? cat : (displayNames[cat] ?? cat)}</span>
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
        const other = midiList.filter((m) =>
          !categories.some((c) =>
            (Array.isArray(m.categories) && m.categories.includes(c)) || m.categories_text === c
          )
        );
        if (!other.length) return null;
        const active = expandedCat === "__other__";
        return (
          <div>
            <div className={`cat-row${active ? " active" : ""}`}
              style={{ color: "rgba(255,255,255,0.35)" }}
              onClick={() => setExpandedCat(active ? null : "__other__")}>
              <span>{lang === "zh" ? "其他" : "Other"}</span>
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
  );

  return (
    <main style={{ height: "100dvh", width: "100vw", backgroundColor: "black", overflow: "hidden", position: "relative" }}>

      {showLandscapeHint && windowWidth < 600 && (
        <div
          onClick={() => setShowLandscapeHint(false)}
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0, 0, 0, 0.7)", display: "flex",
            alignItems: "center", justifyContent: "center",
            zIndex: 9999, cursor: "pointer", pointerEvents: "auto",
            animation: "fadeInOut 5s ease-in-out forwards",
          }}>
          <div style={{ textAlign: "center", color: "#fff", fontFamily: "monospace", pointerEvents: "none" }}>
            <div style={{ fontSize: "2rem", marginBottom: "20px" }}>📱</div>
            <div style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px" }}>請橫向遊玩</div>
            <div style={{ fontSize: "0.9rem", opacity: 0.8, marginBottom: "20px" }}>Landscape mode recommended</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>點按任何位置關閉 / Tap to close</div>
          </div>
        </div>
      )}

      <Fireworks poseDataRef={poseDataRef} gestureDataRef={gestureDataRef} isLowEnd={isLowEnd} showDebug={showDebug}
        mode={`B-${sessionKey}`} onLMAUpdate={(lma) => { lmaDataRef.current = lma; }} />

      {/* ── 本地骨架 ──────────────────────────────────────────────── */}
      {poseReady && showSkeleton && (
        <DraggableSkeleton
          scale={skeletonScale}
          width="480px"
          height="270px"
          defaultPosition={{ x: windowWidth / 2 - 500, y: windowHeight / 2 - 135 }}
        >
          <PoseSkeleton
            skeletonCanvasRef={skeletonCanvasRef}
            isLowEnd={isLowEnd}
            lmaDataRef={lmaDataRef}
            showDebug={showDebug}
            colorPose={rtcRole === "p2" ? "#ff6bff" : "#e6ffdf"}
            colorHand={rtcRole === "p2" ? "#ff9fff" : "#ffffff"}
            onPoseUpdate={(pd) => {
              poseDataRef.current = pd;
              sendPose(pd);
            }}
            onGestureData={(gd) => { gestureDataRef.current = gd; }}
          />
        </DraggableSkeleton>
      )}

      {/* ── 對方骨架 ──────────────────────────────────────────────── */}
      {remotePose && (
        <DraggableSkeleton
          width="480px"
          height="270px"
          defaultPosition={{ x: windowWidth / 2 + 20, y: windowHeight / 2 - 135 }}
        >
          <RemoteSkeleton poseData={remotePose} isLowEnd={isLowEnd} colorPose={rtcRole === "p2" ? "#e6ffdf" : "#ff6bff"} colorHand={rtcRole === "p2" ? "#ffffff" : "#ff9fff"} />
        </DraggableSkeleton>
      )}

      {/* ── RTC 連線面板 ──────────────────────────────────────────── */}
      <RTCPanel
        status={rtcStatus}
        lang={lang}
        onConnect={(id, role) => { setRtcRoom(id); setRtcRole(role); }}
        onDisconnect={() => { setRtcRoom(null); setRtcRole(null); setRemotePose(null); }}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInOut {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        .tb-sep { width:1px; height:24px; background:rgba(255,255,255,0.13); flex-shrink:0; }
        .music-trigger {
          display:flex; align-items:center; gap:6px;
          padding:5px 12px; border-radius:6px; cursor:pointer;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.22);
          color:#fff; font-size:0.8rem; font-family:monospace;
          letter-spacing:0.05em; white-space:nowrap; user-select:none;
          transition:background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .music-trigger:hover, .music-trigger.open {
          background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.5);
          box-shadow:0 0 8px rgba(255,255,255,0.1);
        }
        .music-trigger .arr { font-size:0.5rem; opacity:0.55; display:inline-block; transition:transform 0.2s; }
        .music-trigger.open .arr { transform:rotate(180deg); }
        .music-panel {
          position:absolute; bottom:calc(100% + 8px); right:0;
          width:240px; max-height:52vh; background:#0d0d0d;
          border:1px solid rgba(255,255,255,0.14); border-radius:8px;
          box-shadow:0 -8px 32px rgba(0,0,0,0.9);
          overflow-y:auto; overflow-x:hidden; z-index:1001;
          scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.18) transparent;
        }
        .music-panel::-webkit-scrollbar { width:3px; }
        .music-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:2px; }
        .cat-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 14px; cursor:pointer; color:#ffc107;
          font-size:0.82rem; font-family:monospace; user-select:none;
          border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.12s;
        }
        .cat-row:hover { background:rgba(255,180,0,0.07); }
        .cat-row.active { background:rgba(255,180,0,0.12); color:#ffd54f; }
        .cat-arrow { font-size:0.5rem; opacity:0.45; display:inline-block; transition:transform 0.18s, opacity 0.18s; }
        .cat-row.active .cat-arrow { transform:rotate(90deg); opacity:1; }
        .song-list { border-left:2px solid rgba(255,180,0,0.22); }
        .song-row {
          padding:8px 12px 8px 16px; cursor:pointer;
          color:rgba(0,210,255,0.8); font-size:0.78rem; font-family:monospace;
          border-bottom:1px solid rgba(255,255,255,0.03);
          transition:background 0.1s, color 0.1s, padding-left 0.12s;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .song-row:hover { background:rgba(0,220,255,0.07); color:#00e5ff; padding-left:20px; }
        .show-btn {
          display:flex; align-items:center; justify-content:center;
          padding:5px 12px; border-radius:6px; cursor:pointer;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.18);
          color:rgba(255,255,255,0.55); font-size:0.8rem; font-family:monospace;
          white-space:nowrap; user-select:none; flex-shrink:0; transition:all 0.15s;
        }
        .show-btn:hover, .show-btn.on {
          background:rgba(255,180,0,0.12); border-color:rgba(255,180,0,0.5);
          color:#ffc107; box-shadow:0 0 6px rgba(255,180,0,0.18);
        }
        .feedback-btn {
          display:flex; align-items:center; justify-content:center;
          width:32px; height:32px; border-radius:50%; cursor:pointer; flex-shrink:0;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.13);
          font-size:0.95rem; text-decoration:none; transition:all 0.18s;
          animation:fb-pulse 3s ease-in-out infinite;
        }
        @keyframes fb-pulse {
          0%,100% { transform: scale(1); opacity: 0.7; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        .yt-input {
          width:110px; font-size:0.72rem; padding:5px 8px;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.14);
          border-radius:5px; color:#0ef; outline:none; font-family:monospace;
        }
        .yt-input::placeholder { color:rgba(0,220,255,0.4); }
      `}</style>

      {showGuide && (
        <div style={{
          position: "absolute",
          bottom: isLandscapePhone ? "50px" : "65px",
          left: "50%", transform: "translateX(-50%)",
          zIndex: 199, pointerEvents: "none",
        }}>
          <svg width="1440" height="444" viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              .gs { stroke: #FF6B2B; stroke-width: 3; stroke-linecap: round; fill: none; }
              .gh { stroke: #FF6B2B; stroke-width: 3; fill: none; }
              .gl { font-family: sans-serif; font-size: 13px; fill: #FF6B2B; text-anchor: middle; font-weight: bold; }
              .gs2{ font-family: sans-serif; font-size: 14px; fill: #ccc; text-anchor: middle; }
              .gc { fill: rgba(255,107,43,0.06); stroke: rgba(255,107,43,0.25); stroke-width: 1; }
            `}</style>
            <rect x="20"  y="10" width="140" height="185" rx="8" className="gc"/>
            <rect x="180" y="10" width="140" height="185" rx="8" className="gc"/>
            <rect x="340" y="10" width="140" height="185" rx="8" className="gc"/>
            <rect x="500" y="10" width="160" height="185" rx="8" className="gc"/>
            <g transform="translate(90,55)">
              <circle cx="0" cy="0" r="12" className="gh"/>
              <line x1="0" y1="12" x2="0" y2="55" className="gs"/>
              <line x1="0" y1="25" x2="-28" y2="10" className="gs"/>
              <line x1="-28" y1="10" x2="-28" y2="-5" className="gs"/>
              <line x1="-28" y1="-5" x2="-22" y2="-18" className="gs"/>
              <line x1="-28" y1="-5" x2="-34" y2="-18" className="gs"/>
              <line x1="0" y1="25" x2="20" y2="18" className="gs"/>
              <line x1="0" y1="55" x2="-15" y2="85" className="gs"/>
              <line x1="0" y1="55" x2="15" y2="85" className="gs"/>
            </g>
            <text x="90" y="162" className="gl">V</text>
            <text x="90" y="182" className="gs2">✌️</text>
            <g transform="translate(250,55)">
              <circle cx="0" cy="0" r="12" className="gh"/>
              <line x1="0" y1="12" x2="0" y2="55" className="gs"/>
              <line x1="0" y1="25" x2="-28" y2="10" className="gs"/>
              <line x1="-28" y1="10" x2="-28" y2="-2" className="gs"/>
              <line x1="0" y1="25" x2="28" y2="10" className="gs"/>
              <line x1="28" y1="10" x2="20" y2="-4" className="gs"/>
              <line x1="28" y1="10" x2="28" y2="-4" className="gs"/>
              <line x1="28" y1="10" x2="34" y2="-2" className="gs"/>
              <line x1="28" y1="10" x2="38" y2="4" className="gs"/>
              <line x1="28" y1="10" x2="40" y2="12" className="gs"/>
              <line x1="0" y1="55" x2="-15" y2="85" className="gs"/>
              <line x1="0" y1="55" x2="15" y2="85" className="gs"/>
            </g>
            <text x="250" y="162" className="gl">Fist to Open</text>
            <text x="250" y="182" className="gs2">✊→🖐️</text>
            <g transform="translate(410,60)">
              <path d="M0,-35 C0,-45 -12,-45 -12,-35 C-12,-25 0,-18 0,-18 C0,-18 12,-25 12,-35 C12,-45 0,-45 0,-35 Z" fill="#ff4d4d"/>
              <circle cx="0" cy="0" r="12" className="gh"/>
              <line x1="0" y1="12" x2="0" y2="55" className="gs"/>
              <line x1="0" y1="22" x2="-22" y2="5" className="gs"/>
              <line x1="-22" y1="5" x2="-10" y2="-18" className="gs"/>
              <line x1="0" y1="22" x2="22" y2="5" className="gs"/>
              <line x1="22" y1="5" x2="10" y2="-18" className="gs"/>
              <line x1="0" y1="55" x2="-15" y2="85" className="gs"/>
              <line x1="0" y1="55" x2="15" y2="85" className="gs"/>
            </g>
            <text x="410" y="162" className="gl">Hands Touching</text>
            <text x="410" y="182" className="gs2">🤲❤️</text>
            <g transform="translate(580,60)">
              <circle cx="0" cy="0" r="12" className="gh"/>
              <line x1="0" y1="12" x2="0" y2="55" className="gs"/>
              <line x1="0" y1="22" x2="-48" y2="8" className="gs"/>
              <line x1="0" y1="22" x2="48" y2="8" className="gs"/>
              <line x1="-48" y1="8" x2="-58" y2="22" className="gs"/>
              <line x1="48" y1="8" x2="58" y2="22" className="gs"/>
              <line x1="0" y1="55" x2="-15" y2="85" className="gs"/>
              <line x1="0" y1="55" x2="15" y2="85" className="gs"/>
            </g>
            <text x="580" y="162" className="gl">Raise & Lower Hands</text>
            <text x="580" y="182" className="gs2">🦅👇</text>
          </svg>
        </div>
      )}

      <div className="w-100 d-flex align-items-center px-3 px-md-4"
        style={{ background: "rgba(15,15,15,0.95)", borderTop: "1px solid #333", zIndex: 200,
          position: "absolute", bottom: 0,
          height: isLandscapePhone ? "50px" : "65px",
          paddingBottom: "env(safe-area-inset-bottom)" }}>

        <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>
          <button className="btn btn-sm btn-info"
            style={{ fontSize: "0.7rem", padding: "3px 8px" }}
            onClick={() => { setShowSkeleton(!showSkeleton); drumKit.init(); }}>
            💀
          </button>
          {!isLandscapePhone && (
            <input type="range" min="0.3" max="2" step="0.1" defaultValue={skeletonScale}
              onPointerUp={(e) => setSkeletonScale(parseFloat(e.target.value))}
              aria-label="Skeleton scale"
              style={{ width: "50px" }} />
          )}
          <button
            className={`btn btn-sm ${isLowEnd ? "btn-secondary" : "btn-success"} d-none d-md-inline`}
            style={{ fontSize: "0.65rem", fontWeight: "bold", padding: "3px 7px" }}
            onClick={() => setIsLowEnd(!isLowEnd)}>
            {isLowEnd ? "LITE" : "HD"}
          </button>

          <div className="tb-sep" />

          <button onClick={confirmUser}
            style={{ background: isConfirmed ? "rgba(0,239,255,0.15)" : "rgba(255,100,100,0.2)",
              border: `1px solid ${isConfirmed ? "#0ef" : "#f66"}`, borderRadius: 6,
              padding: "3px 8px", color: isConfirmed ? "#0ef" : "#f88",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {isConfirmed ? `👤 ${currentUserId}` : (lang === "zh" ? "設定參與者" : "Set Participant")}
          </button>
          {isConfirmed && (
            <button onClick={resetSession} className="btn btn-sm btn-outline-warning"
              style={{ fontSize: "0.6rem", padding: "2px 5px" }}>
              {lang === "zh" ? "下一位 ▶" : "NEXT ▶"}
            </button>
          )}
          <div onClick={() => setShowDebug(v => !v)}
            style={{ background: showDebug ? "rgba(0,239,255,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showDebug ? "#0ef" : "#444"}`, borderRadius: 6,
              padding: "3px 7px", color: showDebug ? "#0ef" : "#555",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace" }}>
            {showDebug ? "LMA ✓" : "LMA"}
          </div>

          <div className="tb-sep" />
        </div>

        <div className="ms-auto d-flex align-items-center gap-2"
          style={{ zIndex: 1000, position: "relative", flexShrink: 0 }}>

          <button
            onClick={() => setShowGuide(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "32px", borderRadius: "6px", cursor: "pointer",
              padding: "0 8px",
              background: showGuide ? "rgba(255,107,43,0.15)" : "rgba(255,255,255,0.04)",
              border: showGuide ? "1px solid #FF6B2B" : "1px solid rgba(255,255,255,0.13)",
              color: showGuide ? "#FF6B2B" : "#fff",
              fontSize: "0.75rem", fontFamily: "monospace", whiteSpace: "nowrap",
            }}>
            {lang === "zh" ? "動作指南" : "Action Guide"}
          </button>

          <a href="https://forms.gle/fmD9XYixYHLLrjQP6" target="_blank" rel="noopener noreferrer"
            className="feedback-btn" title="Submit Feedback">📮</a>

          {/* ✅ INP 優化：移除 onBlur，只保留 Enter 鍵觸發；加 preventDefault + stopPropagation */}
          <input type="text" defaultValue={inputUrl}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              e.stopPropagation();
              handleUrlChange(e);
            }}
            className="yt-input d-none d-md-block"
            placeholder={lang === "zh" ? "貼上 YouTube 連結" : "Paste YouTube URL"} />

          <div className={`music-trigger${isMenuOpen ? " open" : ""}`}
            onClick={() => { setIsMenuOpen(v => !v); setExpandedCat(null); }}>
            <span>♩</span>
            {windowWidth >= 768 && <span>{lang === "zh" ? "選歌" : "Song Selection"}</span>}
            <span className="arr">▼</span>
          </div>

          {isMenuOpen && renderMusicPanel()}

          <div className={`show-btn${showMusic ? " on" : ""}`}
            onClick={() => { setShowMusic(v => !v); drumKit.init(); }}>
            {lang === "zh" ? "🎵 音樂" : "🎵 Music"}
          </div>

          <button
            onClick={() => setLang(l => l === "zh" ? "en" : "zh")}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6, padding: "3px 8px", color: "rgba(255,255,255,0.6)",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace", flexShrink: 0,
            }}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </div>

      {windowWidth >= 950 && (
        <div className="text-center"
          style={{
            pointerEvents: "none", position: "fixed", bottom: "5px",
            left: "50%", transform: "translateX(-50%)",
            whiteSpace: "nowrap", zIndex: 201,
          }}>
          <div className="text-light fw-bold"
            style={{ letterSpacing: "2px", opacity: 0.7, fontSize: "0.85rem", contentVisibility: "auto" }}>
            SPARKBODY STAGE
          </div>
        </div>
      )}

      {showMusic && (
        <Suspense fallback={<LoadingSpinner />}>
          <DraggableYouTube videoId={deferredVideoId}
            width={isLandscapePhone ? 240 : 320}
            height={isLandscapePhone ? 135 : 180}
            initialPosition={{ top: 20, left: windowWidth - (isLandscapePhone ? 260 : 340) }}
            onPlayerReady={(player) => { ytPlayerRef.current = player; }} />
        </Suspense>
      )}
    </main>
  );
}