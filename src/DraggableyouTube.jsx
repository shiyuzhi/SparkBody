import React, { useState, useRef } from "react";
import YouTube from "react-youtube";

export default function DraggableYouTube({
  videoId,
  opts = {},
  width = 480,
  height = 270,
  initialPosition = { top: 100, left: 100 }
}) {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState({ width, height });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const startResize = useRef(null);

  const videoOptions = {
    ...opts,
    width: "100%",
    height: "100%",
    playerVars: { ...opts.playerVars, autoplay: 1 }, // 通常切換歌曲建議開啟 autoplay
  };

  // ── 拖曳處理 ──────────────────────────────────────────────────────
  const handleDragDown = (e) => {
    if (e.target.closest("[data-resize]")) return; // 如果點到縮放把手就不要啟動拖曳
    setDragging(true);
    setOffset({ x: e.clientX - position.left, y: e.clientY - position.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragging) {
      setPosition({
        left: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - offset.x)),
        top: Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - offset.y)),
      });
    }

    if (resizing && startResize.current) {
      // ★ 左下角縮放邏輯：
      // 向左拉 (dx 為負) 應該增加寬度 -> 寬度 = 原始寬度 - dx
      const dx = e.clientX - startResize.current.x;
      const newW = Math.max(200, startResize.current.w - dx); 
      const newH = Math.round(newW * 9 / 16);

      // 因為是從左邊縮放，left 座標也必須跟著變動，右側邊界才會看起來固定不動
      const newLeft = startResize.current.left + dx;

      setSize({ width: newW, height: newH });
      setPosition(prev => ({
        ...prev,
        left: newLeft
      }));
    }
  };

  const handlePointerUp = (e) => {
    setDragging(false);
    setResizing(false);
    startResize.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleResizeDown = (e) => {
    e.stopPropagation();
    setResizing(true);
    // 紀錄起始時的座標、尺寸以及最重要的 left 位置
    startResize.current = { 
      x: e.clientX, 
      y: e.clientY, 
      w: size.width, 
      h: size.height,
      left: position.left 
    };
    e.currentTarget.closest("[data-draggable]").setPointerCapture(e.pointerId);
  };

  return (
    <div
      data-draggable
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: 1000,
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={handleDragDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 防止 iframe 攔截滑鼠事件 */}
      {(dragging || resizing) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "transparent" }} />
      )}

      {/* 梯形剪裁容器 */}
      <div style={{
        width: "100%", height: "100%",
        clipPath: "polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)",
        background: "#000",
        overflow: "hidden",
        pointerEvents: "auto",
        border: "1px solid #333"
      }}>
        <YouTube videoId={videoId} opts={videoOptions} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* 左下角縮放把手 */}
      <div
        data-resize
        onPointerDown={handleResizeDown}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 40, // 稍微加大感應區比較好點
          height: 40,
          cursor: "nesw-resize",
          zIndex: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: "0 0 4px 4px",
        }}
        title="左下縮放"
      >
        <div style={{
          width: 15,
          height: 15,
          borderLeft: "3px solid #0ef",
          borderBottom: "3px solid #0ef",
          boxShadow: "-1px 1px 5px rgba(0,239,255,0.5)",
          opacity: 0.9,
        }} />
      </div>
    </div>
  );
}