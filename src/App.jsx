// App.jsx
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import DraggableYouTube from "./DraggableyouTube";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";
import Recognizer from "./Recognizer";

export default function App() {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [poseData, setPoseData] = useState(null);
  const [gestureData, setGestureData] = useState(null); 
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setInputUrl(url);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) setVideoId(match[2]);
  };

  return (
    <div className="vw-100 vh-100 bg-black position-relative overflow-hidden">
      
      {/* 1. 精準看板：移到左下角 (在底欄上方) */}
      <div style={{
        position: "absolute", bottom: "75px", left: "20px", zIndex: 1000,
        background: "rgba(0, 0, 0, 0.8)", padding: "10px 15px", borderRadius: "8px",
        border: "1px solid #444", color: "#0f0", pointerEvents: "none", minWidth: "180px"
      }}>
        <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "4px" }}>PRECISE GESTURE</div>
        {gestureData && gestureData.length > 0 ? (
          <div style={{ fontSize: "1.1rem" }}>
            hand: <strong style={{ color: "#ffcc00" }}>{gestureData[0]?.[0]?.categoryName}</strong>
          </div>
        ) : (
          <div className="small text-secondary">偵測器已準備就緒</div>
        )}
      </div>

      {/* 2. Fireworks 特效層 */}
      <Fireworks
        gestureData={gestureData}
        poseData={{
          ...poseData,
          rightHandGesture: gestureData?.[0]?.[0]?.categoryName,
          leftHandGesture: gestureData?.[1]?.[0]?.categoryName,
        }}
      />

      {/* 3. 骨架層 */}
      <DraggableSkeleton
        scale={skeletonScale}
        visible={showSkeleton}
        onHide={() => setShowSkeleton(false)}
        width={600} height={600}
        initialPosition={{ top: "10%", left: "25%" }}
        transparent
      >
        <PoseSkeleton onPoseUpdate={setPoseData} hideCanvas={!showSkeleton} />
      </DraggableSkeleton>

      {/* 4. 底部工具列 (佈局更新) */}
      <div className="w-100 p-2 d-flex align-items-center justify-content-between"
           style={{ background: "#111", borderTop: "1px solid #333", zIndex: 200, position: "absolute", bottom: 0 }}>
        
        {/* 左區：骨架 */}
        <div className="d-flex align-items-center gap-2" style={{ flex: 1 }}>
          <button className="btn btn-sm btn-info" onClick={() => setShowSkeleton(!showSkeleton)}>
            {showSkeleton ? "隱藏骨架" : "顯示骨架"}
          </button>
          <input type="range" min="0.3" max="2" step="0.1" value={skeletonScale} 
                 onChange={(e) => setSkeletonScale(parseFloat(e.target.value))} style={{ width: "60px" }} />
        </div>

        {/* 中區：標題 */}
        <div className="text-light fw-bold px-2 d-none d-md-block" style={{ letterSpacing: "2px" }}>
          SPARKBODY STAGE
        </div>

        {/* 右區：辨識按鈕與音樂 */}
        <div className="d-flex align-items-center gap-2 justify-content-end" style={{ flex: 1 }}>
          {/* Recognizer 現在就在 Music UI 旁邊 */}
          <Recognizer onGestureData={setGestureData} />
          
          <button className="btn btn-sm btn-warning" onClick={() => setShowMusic(!showMusic)}>
            Music UI
          </button>
          
          <input type="text" value={inputUrl} onChange={handleUrlChange} 
                 className="form-control form-control-sm bg-dark text-info border-secondary d-none d-sm-block" 
                 style={{ width: "100px" }} placeholder="YT URL" />
        </div>
      </div>

      {showMusic && (
        <DraggableYouTube videoId={videoId} width={320} height={180} initialPosition={{ top: 100, left: window.innerWidth - 340 }} />
      )}
    </div>
  );
}