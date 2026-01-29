import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";

export default function MouseFireworks() {
  const svgRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerMove);
    
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerMove);
      // 清理：組件卸載時殺掉所有還在跑的動畫，防止記憶體洩漏
      gsap.killTweensOf(`${svgRef.current} *`);
    };
  }, []);

  // 2. 點擊觸發
  const handlePointerUp = () => {
    fire(pointer.current);
  };

  // 3. 火花動畫函式
  const fire = (m) => {
    const stage = svgRef.current;
    if (!stage) return;

    // 建立元素
    const firework = document.createElementNS("http://www.w3.org/2000/svg", "g"),
          trail = document.createElementNS("http://www.w3.org/2000/svg", "g"),
          ring = document.createElementNS("http://www.w3.org/2000/svg", "g"),
          hsl = `hsl(${gsap.utils.random(0, 360, 1)}, 100%, 50%)`;

    stage.appendChild(firework);
    firework.appendChild(trail);
    firework.appendChild(ring);

    // Trail 動畫 (你原始的路徑邏輯)
    for (let i = 1; i < 5; i++) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "path");
      gsap.set(t, { 
        x: m.x, 
        y: window.innerHeight, 
        opacity: 0.25, 
        attr: { "stroke-width": i, "stroke": "#fff", d: `M0,0 0,${window.innerHeight}` } 
      });
      gsap.to(t, { y: m.y, ease: "expo" });
      trail.appendChild(t);
    }

    // Ring 動畫 (爆炸圓圈)
    const ringCount = gsap.utils.random(6, 13);
    for (let i = 1; i < ringCount; i++) { 
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      gsap.set(c, { 
        x: m.x, 
        y: m.y, 
        attr: { 
          r: (i / 1.5) * 18, 
          fill: "none", 
          stroke: hsl, 
          "stroke-width": 0.25 + (9 - i), 
          "stroke-dasharray": `1 ${i / 2 * gsap.utils.random(i + 3, i + 6)}` 
        } 
      });
      ring.appendChild(c);
    }

    // 動態 Timeline
    gsap.timeline({ 
        onComplete: () => {
          if (stage.contains(firework)) {
            stage.removeChild(firework);
          }
        } 
    })
      .to(trail.children, { duration: 0.2, attr: { d: "M0,0 0,0" }, stagger: -0.08, ease: "expo.inOut" }, 0)
      .to(trail.children, { duration: 0.4, scale: () => gsap.utils.random(40, 80, 1), attr: { stroke: hsl }, stagger: -0.15, ease: "expo" }, 0.4)
      .to(trail.children, { duration: 0.3, opacity: 0, stagger: -0.1, ease: "power2.inOut" }, 0.5)
      .from(ring.children, { duration: 1, rotate: () => gsap.utils.random(-90, 90, 1), scale: 0, stagger: 0.05, ease: "expo" }, 0.4)
      .to(ring.children, { opacity: 0, stagger: 0.1, ease: "sine.inOut" }, 0.7)
      .to(ring.children, { duration: 1, y: "+=30", ease: "power2.in" }, 0.7);
  };

  return (
    <svg 
      ref={svgRef} 
      style={{ 
        width: "100%", 
        height: "100%", 
        position: "absolute", 
        inset: 0,
        backgroundColor: "#1806066e", // 加入底色能讓煙火更明顯
        overflow: "hidden"
      }} 
      onPointerUp={handlePointerUp} 
    />
  );
}