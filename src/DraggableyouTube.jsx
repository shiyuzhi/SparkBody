import React, { useState, useEffect } from "react";
import YouTube from "react-youtube";

export default function DraggableYouTube({
  videoId,
  opts = {},
  width = 320,
  height = 180,
  initialPosition = { top: 100, left: 100 }
}) {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 強化的 YouTube 設定，確保影片填滿容器
  const videoOptions = {
    ...opts,
    width: "100%",
    height: "100%",
    playerVars: {
      ...opts.playerVars,
      autoplay: 0,
    },
  };

  const handlePointerDown = (e) => {
    // 只有按住「非影片區域」或特定把手時觸發拖曳較為理想
    // 若要全區域拖曳，建議在拖曳開始時紀錄
    setDragging(true);
    setOffset({ x: e.clientX - position.left, y: e.clientY - position.top });
    
    // 防止文字選取
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    
    const newLeft = e.clientX - offset.x;
    const newTop = e.clientY - offset.y;

    // 邊界限制
    setPosition({
      left: Math.max(0, Math.min(window.innerWidth - width, newLeft)),
      top: Math.max(0, Math.min(window.innerHeight - height, newTop))
    });
  };

  const handlePointerUp = (e) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: width,
        height: height,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: 1000,
        touchAction: "none",
        transition: dragging ? "none" : "transform 0.1s", // 增加一點平滑感
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 拖曳保護層：當拖曳時，這層會出現防止 IFrame 攔截事件 */}
      {dragging && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 10,
          background: "transparent"
        }} />
      )}

     {/* 梯形剪裁層 */}
      <div
          style={{
          width: "100%",
          height: "100%",
          clipPath: "polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)",
          background: "#000",
          overflow: "hidden",
          pointerEvents: "auto" // 確保內層可以點擊
        }}
        >
        <YouTube 
          videoId={videoId} 
          opts={videoOptions} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}