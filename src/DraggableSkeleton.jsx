// DraggableSkeleton.jsx
import React, { useRef } from "react";
import Draggable from "react-draggable";

export default function DraggableSkeleton({
  children,
  scale = 1,
  visible = true,
  defaultPosition = { x: 0, y: 0 },
  width = "480px",
  height = "270px",
  transparent = true,
}) {
  const nodeRef = useRef(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      handle=".drag-handle"
      defaultPosition={defaultPosition}
      enableUserSelectHack={false}
    >
      <div
        ref={nodeRef}
        className="position-absolute"
        style={{
          zIndex: 90,
          top: 0,
          left: 0,
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
            transformOrigin: "top left",
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