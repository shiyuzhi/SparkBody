// DraggableSkeleton.jsx
import React, { useRef } from "react";
import Draggable from "react-draggable";

export default function DraggableSkeleton({
  children,
  scale = 1,
  visible = true,
  onHide,
  minScale = 0.3,
  maxScale = 2,
  initialPosition = { top: 0, left: 0 },
  transparent = true,
}) {
  const nodeRef = useRef(null);

  return (
    <Draggable nodeRef={nodeRef} bounds="parent" handle=".drag-handle">
      <div
        ref={nodeRef}
        className="position-absolute"
        style={{
          zIndex: 100,
          top: initialPosition.top,
          left: initialPosition.left,
          display: visible ? "block" : "none",
          width: "100vw",   // 全螢幕拖動容器
          height: "100vh",
        }}
      >
        <div
          className="drag-handle"
          style={{
            cursor: "move",
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
