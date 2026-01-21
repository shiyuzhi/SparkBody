import React, { useState } from "react"; 
import "bootstrap/dist/css/bootstrap.min.css";
import Fireworks from "./Fireworks";       
import PoseSkeleton from "./PoseSkeleton"; 

export default function App() {
  // 建立存放 5 個點位座標的狀態
  const [poseData, setPoseData] = useState(null);

  return (
    <div className="vh-100 vw-100 bg-dark d-flex flex-column overflow-hidden">
      <div className="py-3 text-light text-center shadow-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
        <h2 className="mb-0">Pose + Fireworks Interactive</h2>
      </div>

      <div className="flex-grow-1 d-flex p-3 gap-3">
        {/* 左側：煙火實境 - 接收數據並繪製 */}
        <div className="flex-grow-1 position-relative rounded overflow-hidden border border-secondary shadow">
          <div className="position-absolute w-100 h-100">
            <Fireworks poseData={poseData} />
          </div>
          <div className="position-absolute top-0 start-0 p-2 badge bg-primary m-2">Fireworks Canvas</div>
        </div>

        {/* 右側：AI 骨架偵測 - 負責抓取座標並回傳 */}
        <div className="rounded overflow-hidden border border-secondary shadow" 
             style={{ width: "40%", minWidth: "320px", background: "#000" }}>
          <div className="w-100 h-100 d-flex flex-column">
            <div className="p-2 badge bg-success m-2 align-self-start">AI Pose Tracker</div>
            <div className="flex-grow-1 d-flex justify-content-center align-items-center">
              {/* 將 setPoseData 傳入，讓組件內部可以更新狀態 */}
              <PoseSkeleton onPoseUpdate={setPoseData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}