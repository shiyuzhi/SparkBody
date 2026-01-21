import React, { useState } from "react"; 
import "bootstrap/dist/css/bootstrap.min.css";
import Fireworks from "./Fireworks";       
import PoseSkeleton from "./PoseSkeleton"; 
import YouTube from 'react-youtube'; 

export default function App() {
  const [poseData, setPoseData] = useState(null);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ"); 
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");
  const [showPlayer, setShowPlayer] = useState(false);

  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setInputUrl(url);
    const id = extractVideoId(url);
    if (id) setVideoId(id);
  };

  const opts = {
    height: '180',
    width: '320',
    playerVars: { autoplay: 1, controls: 1 },
  };

  return (
    <div className="vh-100 vw-100 bg-dark d-flex flex-column overflow-hidden">
      <div className="py-2 text-light text-center shadow-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
        <h2 className="mb-0">SparkBody Stage</h2>
      </div>

      <div className="flex-grow-1 d-flex p-3 gap-3 position-relative">
        <div className="flex-grow-1 position-relative rounded overflow-hidden border border-secondary shadow">
          <div className="position-absolute w-100 h-100">
            <Fireworks poseData={poseData} />
          </div>
          
          {/*樂控制按鈕*/}
          <button 
            className="position-absolute bottom-0 start-0 m-3 btn btn-outline-light btn-sm"
            style={{ zIndex: 20, borderRadius: '20px', background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setShowPlayer(!showPlayer)}
          >
           🎵 {showPlayer ? "Hide Player" : "Music Settings"}
          </button>

          <div className="position-absolute bottom-0 start-0 m-3 shadow-lg rounded overflow-hidden border border-light" 
               style={{ 
                 opacity: "0.95", 
                 zIndex: 10, 
                 background: "#222", 
                 width: "320px", 
                 marginBottom: "50px",
                 display: showPlayer ? "block" : "none" 
               }}>
            
            <div className="p-2 bg-secondary">
              <input 
                type="text" 
                className="form-control form-control-sm bg-dark text-white border-0" 
                placeholder="貼上網址..."
                value={inputUrl}
                onChange={handleUrlChange}
              />
            </div>
            
            <YouTube videoId={videoId} opts={opts} />
          </div>

          <div className="position-absolute top-0 start-0 p-2 badge bg-primary m-2">Live Canvas</div>
        </div>

        {/* 右側 AI 偵測 */}
        <div className="rounded overflow-hidden border border-secondary shadow" 
             style={{ width: "35%", minWidth: "300px", background: "#000" }}>
          <div className="w-100 h-100 d-flex flex-column">
            <div className="p-2 badge bg-success m-2 align-self-start">AI Tracker</div>
            <div className="flex-grow-1 d-flex justify-content-center align-items-center">
              <PoseSkeleton onPoseUpdate={setPoseData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}