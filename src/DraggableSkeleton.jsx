import React, { useRef } from "react";
import Draggable from "react-draggable";

export default function DraggableSkeleton({ children, scale, visible, onHide }) {
  const nodeRef = useRef(null);

  return (
    <Draggable nodeRef={nodeRef} bounds="parent" handle=".drag-handle">
      {/* 外層：負責拖拽位置 */}
      <div
        ref={nodeRef}
        className="position-absolute"
        style={{
          zIndex: 100,
          right: "50px",
          top: "50px",
          display: visible ? "block" : "none", // 隱藏
        }}
      >
        {/* 內層：負責縮放樣式 */}
        <div
          className="shadow-lg border border-info rounded overflow-hidden"
          style={{
            width: "300px",  
            height: "500px",
            background: "#000",
            transform: `scale(${scale})`, // 縮放
            transformOrigin: "top right", 
            transition: "transform 0.2s ease-out",
          }}
        >
          <div className="drag-handle bg-info p-1 d-flex justify-content-between align-items-center" style={{ cursor: "move" }}>
            <span className="badge bg-dark ms-1" style={{ fontSize: '10px' }}>✥ AI TRACKER</span>
            <button className="btn-close btn-close-white me-1" style={{ fontSize: '0.5rem' }} onClick={onHide}></button>
          </div>
          <div style={{ width: "100%", height: "500px", position: "relative" }}>
            {children}
          </div>
        </div>
      </div>
    </Draggable>
  );
}