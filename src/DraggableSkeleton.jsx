// DraggableSkeleton.jsx
// DraggableSkeleton.jsx
import React, { useRef } from "react";
import Draggable from "react-draggable"; // 確保這一行存在

export default function DraggableSkeleton({
  children,
  scale = 1,
  visible = true,
  initialPosition = { top: "0%", left: "0%" },
  width = "100vw",  
  height = "100vh", 
  transparent = true,
}) {
  const nodeRef = useRef(null);

  return (
    <Draggable 
      nodeRef={nodeRef} 
      bounds="parent" 
      handle=".drag-handle"
      // 避免文書機在拖動時產生不必要的渲染重疊
      enableUserSelectHack={false} 
    >
      <div
        ref={nodeRef}
        className="position-absolute"
        style={{
          zIndex: 90, 
          top: initialPosition.top,
          left: initialPosition.left,
          display: visible ? "block" : "none",
          width: width,
          height: height,
          pointerEvents: "none", 
        }}
      >
        <div
          className="drag-handle"
          style={{
            cursor: "move",
            pointerEvents: "auto", 
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease-out",
            width: "100%",
            height: "100%",
            background: transparent ? "transparent" : "#000",
          }}
        >
          {children}
        </div>
      </div>
    </Draggable>
  );
}