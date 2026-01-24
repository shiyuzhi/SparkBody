// App.jsx
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import DraggableYouTube from "./DraggableyouTube";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";

export default function App() {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [maxScale, setMaxScale] = useState(2);
  const [isMobile, setIsMobile] = useState(false);
  const [poseData, setPoseData] = useState(null);
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");

  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setInputUrl(url);
    const id = extractVideoId(url);
    if (id) setVideoId(id);
  };

  const youtubeOpts = {
    height: "180",
    width: "320",
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin,
    },
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const widthLimit = window.innerWidth / 150;
      const heightLimit = window.innerHeight / 150;
      setMaxScale(Math.min(2, widthLimit, heightLimit));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="vw-100 vh-100 bg-black position-relative overflow-hidden">

      {/* Fireworks 層 */}
      <Fireworks poseData={poseData} />

      {/* PoseSkeleton 永遠存在，canvas 依 showSkeleton 顯示 */}
      {!isMobile && (
        <DraggableSkeleton
          scale={skeletonScale}
          visible={showSkeleton}
          onHide={() => setShowSkeleton(false)}
          minScale={0.3}
          maxScale={maxScale}
          initialPosition={{ top: "10%", left: "25%" }}
          width={Math.min(600, window.innerWidth * 0.6)}
          height={Math.min(600, window.innerHeight * 0.6)}
          transparent
        >
          <PoseSkeleton onPoseUpdate={setPoseData} hideCanvas={!showSkeleton} />
        </DraggableSkeleton>
      )}

      {/* 底部工具列 */}
      <div
        className="w-100 p-2 d-flex flex-wrap align-items-center justify-content-between"
        style={{
          background: "linear-gradient(to bottom, #111, #000)",
          borderTop: "1px solid #444",
          height: "auto",
          zIndex: 200,
          position: "absolute",
          bottom: 0,
          left: 0,
          paddingLeft: "2vw",
          paddingRight: "2vw",
        }}
      >
        {/* 左側骨架控制 */}
        <div className="d-flex flex-wrap align-items-center gap-2" style={{ flex: 1, minWidth: "150px" }}>
          {!isMobile && (
            <>
              <button
                className={`btn btn-sm ${showSkeleton ? "btn-info" : "btn-outline-info"}`}
                onClick={() => setShowSkeleton(!showSkeleton)}
                style={{ borderRadius: "4px", fontWeight: "500" }}
              >
                {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
              </button>

              {showSkeleton && (
                <div className="d-flex align-items-center gap-1 flex-wrap" style={{ minWidth: "120px" }}>
                  <span className="text-secondary small">Scale:</span>
                  <input
                    type="range"
                    min="0.3"
                    max={maxScale}
                    step="0.05"
                    value={skeletonScale}
                    onChange={(e) => setSkeletonScale(parseFloat(e.target.value))}
                    style={{ width: "100px", minWidth: "80px" }}
                  />
                  <span className="text-info mono" style={{ fontSize: "0.8rem", width: "40px" }}>
                    {Math.round(skeletonScale * 100)}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 中間標題 */}
        <div
          className="text-light fw-bold text-center flex-grow-1"
          style={{ letterSpacing: "4px", fontSize: "1.2rem", minWidth: "150px" }}
        >
          SPARKBODY STAGE
        </div>

        {/* 右側音樂控制 */}
        <div className="d-flex flex-wrap align-items-center gap-2 justify-content-end" style={{ flex: 1, minWidth: "150px" }}>
          <button
            className={`btn btn-sm ${showMusic ? "btn-warning" : "btn-outline-warning"}`}
            onClick={() => setShowMusic(!showMusic)}
            style={{ borderRadius: "4px", fontWeight: "500" }}
          >
            {showMusic ? "Hide Music" : "Show Music"}
          </button>

          <input
            type="text"
            value={inputUrl}
            onChange={handleUrlChange}
            className="form-control form-control-sm bg-dark text-info border-secondary"
            style={{ width: "150px", minWidth: "100px" }}
            placeholder="Paste YouTube Link..."
          />
        </div>
      </div>

      {/* 遠方 YouTube 梯形視覺 */}
      {showMusic && (
        <DraggableYouTube
          videoId={videoId}
          opts={youtubeOpts}  
          width={Math.min(320, window.innerWidth * 0.35)}
          height={Math.min(180, window.innerWidth * 0.2)}
          initialPosition={{ top: 200, left: window.innerWidth - Math.min(320, window.innerWidth * 0.35) - 20 }}
        />
      )}
    </div>
  );
}
