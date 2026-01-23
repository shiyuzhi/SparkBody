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
  initialPosition = { top: "10%", left: "25%" },
  width = 600,
  height = 600,
  transparent = true,
}) {
  const nodeRef = useRef(null);

  return (
    <Draggable nodeRef={nodeRef} bounds="parent" handle=".drag-handle">
      <div
        ref={nodeRef}
        className="position-absolute"
        style={{
          zIndex: 100,  // 比火花低一點
          top: initialPosition.top,
          left: initialPosition.left,
          display: visible ? "block" : "none",
          width: width,
          height: height,
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
