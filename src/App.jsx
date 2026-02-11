import React, { useState, useEffect, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import DraggableSkeleton from "./DraggableSkeleton";
import DraggableYouTube from "./DraggableyouTube";
import PoseSkeleton from "./PoseSkeleton";
import Fireworks from "./Fireworks";

export default function App() {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [skeletonScale, setSkeletonScale] = useState(1);
  const [poseData, setPoseData] = useState(null);
  const [gestureData, setGestureData] = useState([]); 
  const [showMusic, setShowMusic] = useState(false);
  const [videoId, setVideoId] = useState("4rgSzQwe5DQ");
  const [inputUrl, setInputUrl] = useState("https://youtu.be/4rgSzQwe5DQ");
  
  const [midiList, setMidiList] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [selectedCategory, setSelectedCategory] = useState(""); 
  
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const [isLowEnd, setIsLowEnd] = useState(() => {
    // 初始載入時自動判定一次
    const isWeakCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    const isIOSChrome = /CriOS/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 600;
    return isWeakCPU || isIOSChrome || isSmallScreen;
  });

  // 抓資料 
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    fetch('https://imuse.ncnu.edu.tw/Midi-library/api/categories')
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(err => console.error("Category Error:", err));

    fetch('https://imuse.ncnu.edu.tw/Midi-library/api/midis')
      .then(res => res.json())
      .then(data => {
        const list = data.items || data || [];
        setMidiList(list);

        // 處理網址參數 ?midi=歌名
        const params = new URLSearchParams(window.location.search);
        const midiParam = params.get("midi");
        if (midiParam) {
          const matchMidi = list.find(m => m.title === midiParam);
          if (matchMidi && matchMidi.description) {
            handleUrlChange(matchMidi.description);
          }
        }
      })
      .catch(err => console.error("MIDI Error:", err));

    return () => window.removeEventListener("resize", handleResize);
  }, []); 

  const filteredMidiList = useMemo(() => {
    if (!selectedCategory) return midiList;
    return midiList.filter(midi => {
      const isInArray = Array.isArray(midi.categories) && midi.categories.includes(selectedCategory);
      const isMatchText = midi.categories_text === selectedCategory;
      return isInArray || isMatchText;
    });
  }, [selectedCategory, midiList]);

  const isLandscapePhone = windowHeight < 500;
  const isMobile = windowWidth < 768;

  const integratedPoseData = useMemo(() => {
    if (!poseData) return null;
    return {
      ...poseData,
      leftHandGesture: gestureData?.[0]?.[0]?.categoryName || "None",
      rightHandGesture: gestureData?.[1]?.[0]?.categoryName || "None"
    };
  }, [poseData, gestureData]);

  const handleUrlChange = (e_or_url) => {
    const url = typeof e_or_url === 'string' ? e_or_url : e_or_url.target.value;
    if (!url) return;
    setInputUrl(url);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      setVideoId(match[2]);
      setShowMusic(true);
    }
  };

  return (
    <div style={{ height: "100dvh", width: "100vw", backgroundColor: "black", overflow: "hidden", position: "relative" }}>
      
      {/* 雙手狀態面板 */}
      <div style={{
        position: "absolute", bottom: isLandscapePhone ? "60px" : "85px", left: "15px", zIndex: 1000,
        background: "rgba(0, 0, 0, 0.8)", padding: "8px 12px", borderRadius: "10px",
        border: "1px solid #444", color: "#0f0", pointerEvents: "none", 
        fontSize: "0.7rem", display: "flex", gap: "15px"
      }}>
        <div>
          <span style={{color: '#888'}}>LEFT</span><br/>
          <strong style={{color: gestureData?.[0] ? '#ffcc00' : '#444'}}>
            {gestureData?.[0]?.[0]?.categoryName || "Lost"}
          </strong>
        </div>
        <div style={{width: '1px', background: '#333'}}></div>
        <div>
          <span style={{color: '#888'}}>RIGHT</span><br/>
          <strong style={{color: gestureData?.[1] ? '#00e5ff' : '#444'}}>
            {gestureData?.[1]?.[0]?.categoryName || "Lost"}
          </strong>
        </div>
      </div>

      <Fireworks poseData={integratedPoseData} isLowEnd={isLowEnd} />

      <DraggableSkeleton
        scale={skeletonScale}
        visible={showSkeleton}
        onHide={() => setShowSkeleton(false)}
        width={isLandscapePhone ? windowHeight * 0.8 : 600} 
        height={isLandscapePhone ? windowHeight * 0.8 : 600}
        initialPosition={isLandscapePhone ? { top: "5%", left: "15%" } : { top: "10%", left: "25%" }}
        transparent
      >
        <PoseSkeleton 
          onPoseUpdate={setPoseData} 
          onGestureData={setGestureData} 
          hideCanvas={!showSkeleton}
          isLowEnd={isLowEnd} 
        />
      </DraggableSkeleton>

      {/* 底部工具列 */}
      <div className="w-100 d-flex align-items-center px-3 px-md-4"
           style={{ 
             background: "rgba(15, 15, 15, 0.95)", borderTop: "1px solid #333", zIndex: 200, 
             position: "absolute", bottom: 0, height: isLandscapePhone ? "50px" : "65px",
             paddingBottom: "env(safe-area-inset-bottom)"
           }}>
        
        <div className="d-flex align-items-center gap-2" style={{ zIndex: 10, flexShrink: 0 }}>
          <button className="btn btn-sm btn-info" onClick={() => setShowSkeleton(!showSkeleton)}>
            <span className="d-none d-lg-inline">{showSkeleton ? "Hide Skeleton" : "Show Skeleton"}</span>
            <span className="d-lg-none">💀</span>
          </button>
          {!isLandscapePhone && (
            <input type="range" min="0.3" max="2" step="0.1" value={skeletonScale} 
                   onChange={(e) => setSkeletonScale(parseFloat(e.target.value))} 
                   style={{ width: "60px" }} />
          )}
          
          {/* 把原本的 badge 改成可以點擊的按鈕，手動切換效能模式 */}
          <button 
            className={`btn btn-sm ${isLowEnd ? 'btn-secondary' : 'btn-success'} d-none d-md-inline`}
            onClick={() => setIsLowEnd(!isLowEnd)}
            style={{ fontSize: "0.7rem", fontWeight: "bold" }}
          >
            {isLowEnd ? "🚀 Lite Mode (ON)" : "💎 High Performance"}
          </button>

        </div>

        <div className="position-absolute start-50 translate-middle-x text-center" 
             style={{ pointerEvents: "none", display: windowWidth < 950 ? "none" : "block" }}>
          <div className="text-light fw-bold" style={{ letterSpacing: "2px", whiteSpace: "nowrap", opacity: 0.7 }}>
            SPARKBODY STAGE
          </div>
        </div>

        <div className="ms-auto d-flex align-items-center gap-1 gap-md-2" style={{ zIndex: 10, flexShrink: 0 }}>
          
          <select 
            className="form-select form-select-sm bg-dark text-info border-secondary shadow-none"
            style={{ width: isMobile ? "85px" : "110px", fontSize: "0.75rem" }}
            onChange={(e) => setSelectedCategory(e.target.value)}
            value={selectedCategory}
          >
            <option value="">所有分類</option>
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            className="form-select form-select-sm bg-dark text-warning border-secondary shadow-none"
            style={{ width: isMobile ? "95px" : "145px", fontSize: "0.75rem" }}
            onChange={(e) => handleUrlChange(e.target.value)}
            value={inputUrl}
          >
            <option value="">快速點歌</option>
            {filteredMidiList.map(midi => (
              <option key={midi.id} value={midi.description}>{midi.title}</option>
            ))}
          </select>

          {/* 手動輸入框 */}
          <input 
            type="text" 
            value={inputUrl} 
            onChange={handleUrlChange} 
            className="form-control form-control-sm bg-dark text-info border-secondary d-none d-sm-block" 
            style={{ width: "100px", fontSize: "0.75rem" }} 
            placeholder="YT URL" 
          />

          <button className="btn btn-sm btn-warning" onClick={() => setShowMusic(!showMusic)}>
              {isMobile ? "🎵" : "Music"}
          </button>
        </div>
      </div>

      {showMusic && (
        <DraggableYouTube 
          videoId={videoId} 
          width={isLandscapePhone ? 240 : 320} 
          height={isLandscapePhone ? 135 : 180} 
          initialPosition={{ 
            top: 20, 
            left: windowWidth - (isLandscapePhone ? 260 : 340) 
          }} 
        />
      )}
    </div>
  );
}