// App.jsx
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import PoseSkeleton from "./PoseSkeleton";

export default function App() {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [maxScale, setMaxScale] = useState(2);
  const [isMobile, setIsMobile] = useState(false);
  const [poseData, setPoseData] = useState(null);

  // 偵測是否為手機
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 動態計算最大縮放，避免骨架超出螢幕
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
      
      {/* 桌面才顯示骨架 */}
      {!isMobile && showSkeleton && (
        <DraggableSkeleton
          scale={skeletonScale}
          visible={showSkeleton}
          onHide={() => setShowSkeleton(false)}
          minScale={0.3}
          maxScale={maxScale}
          initialPosition={{ top: 0, left: 0 }}
          transparent
        >
          <PoseSkeleton onPoseUpdate={setPoseData} />
        </DraggableSkeleton>
      )}

      {/* 底部工具列 */}
      <div
        className="w-100 p-2 d-flex align-items-center justify-content-between"
        style={{
          background: "linear-gradient(to bottom, #111, #000)",
          borderTop: "1px solid #444",
          height: "80px",
          zIndex: 200,
          position: "absolute",
          bottom: 0,
          left: 0,
          paddingLeft: "2vw",
          paddingRight: "2vw",
        }}
      >
        {/* 左側骨架控制 */}
        <div className="d-flex align-items-center gap-3" style={{ flex: 1 }}>
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
                <div className="d-flex align-items-center gap-2">
                  <span className="text-secondary small">Scale:</span>
                  <input
                    type="range"
                    min="0.3"
                    max={maxScale}
                    step="0.05"
                    value={skeletonScale}
                    onChange={(e) => setSkeletonScale(parseFloat(e.target.value))}
                    style={{ width: "20vw" }}
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
        <div className="text-light fw-bold text-center" style={{ letterSpacing: "4px", fontSize: "1.2rem", flex: 1 }}>
          SPARKBODY STAGE
        </div>

        {/* 右側空白 */}
        <div style={{ flex: 1 }}></div>
      </div>
    </div>
  );
}
