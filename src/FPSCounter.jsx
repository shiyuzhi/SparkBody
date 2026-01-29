// FPSCounter.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function FPSCounter() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const requestRef = useRef();

  useEffect(() => {
    const updateFPS = () => {
      frameCount.current++;
      const currentTime = performance.now();
      if (currentTime >= lastTime.current + 1000) { // 每秒更新一次
        setFps(frameCount.current);
        frameCount.current = 0;
        lastTime.current = currentTime;
      }
      requestRef.current = requestAnimationFrame(updateFPS);
    };
    requestRef.current = requestAnimationFrame(updateFPS);

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <span style={{ 
      color: fps < 20 ? "#ff4444" : "#00ff00",
      fontFamily: 'monospace',
      fontWeight: 'bold',
      fontSize: '0.85rem',
      backgroundColor: '#222',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid #444',
      marginLeft: '10px'
    }}>
      FPS: {fps}
    </span>
  );
}
