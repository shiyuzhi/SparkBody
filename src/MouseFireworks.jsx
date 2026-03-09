import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";

// 核心 Web Audio (完全回歸原版配置)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 預先建立 noiseBuffer 快取，避免每次點擊重新 allocate
const _snareBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
const _hihatBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
(() => {
  const s = _snareBuffer.getChannelData(0);
  const h = _hihatBuffer.getChannelData(0);
  for (let i = 0; i < s.length; i++) s[i] = Math.random() * 2 - 1;
  for (let i = 0; i < h.length; i++) h[i] = Math.random() * 2 - 1;
})();

const playKick = (time, panValue) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = panValue;
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5); 
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
  osc.connect(gain).connect(panner).connect(audioCtx.destination);
  osc.start(time); osc.stop(time + 0.5);
};

const playSnare = (time, panValue) => {
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(250, time);
  oscGain.gain.setValueAtTime(0.6, time);
  oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  const noise = audioCtx.createBufferSource();
  noise.buffer = _snareBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1500;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.5, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = panValue;
  osc.connect(oscGain).connect(panner).connect(audioCtx.destination);
  noise.connect(filter).connect(noiseGain).connect(panner).connect(audioCtx.destination);
  osc.start(time); osc.stop(time + 0.2); noise.start(time);
};

const playHiHat = (time, panValue, isOpen = false) => {
  const noise = audioCtx.createBufferSource();
  noise.buffer = _hihatBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 5000; 
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.4, time);
  const decayTime = isOpen ? 0.3 : 0.05; 
  gain.gain.exponentialRampToValueAtTime(0.01, time + decayTime);
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = panValue;
  noise.connect(filter).connect(gain).connect(panner).connect(audioCtx.destination);
  noise.start(time);
};

const playTom = (time, panValue, pitch = 100) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch, time);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.2, time + 0.3);
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = panValue;
  osc.connect(gain).connect(panner).connect(audioCtx.destination);
  osc.start(time); osc.stop(time + 0.3);
};

const playChord = (time, panValue) => {
  const chords = [
    [261.63, 329.63, 392.00], [220.00, 261.63, 329.63], [174.61, 220.00, 261.63],
    [196.00, 246.94, 293.66], [329.63, 392.00, 493.88], [293.66, 349.23, 440.00],
    [261.63, 329.63, 392.00, 493.88], [174.61, 220.00, 261.63, 329.63],
    [220.00, 261.63, 329.63, 392.00], [196.00, 246.94, 293.66, 349.23],
    [261.63, 349.23, 392.00], [293.66, 392.00, 440.00], [196.00, 261.63, 329.63, 392.00],
    [164.81, 220.00, 261.63, 329.63], [246.94, 293.66, 349.23, 440.00]
  ];
  const notes = chords[Math.floor(Math.random() * chords.length)];
  const octave = Math.random() > 0.5 ? 1 : 2;
  const waveform = Math.random() > 0.5 ? "sine" : "sawtooth";

  notes.forEach(freq => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq * octave, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 1.2); 
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = panValue;
    osc.connect(filter).connect(gain).connect(panner).connect(audioCtx.destination);
    osc.start(time); osc.stop(time + 1.2);
  });
};

const playLaunchSound = (combo) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (combo < 4) return; 
  const time = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const bassNotes = [65.41, 55.00, 43.65, 49.00]; 
  const note = bassNotes[Math.floor(combo / 4) % bassNotes.length];
  osc.type = "square";
  osc.frequency.setValueAtTime(note, time);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, time);
  filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.connect(filter).connect(gain).connect(audioCtx.destination);
  osc.start(time); osc.stop(time + 0.2);
};

const playExplosionSound = (combo, isLowEnd, panValue) => {
  const time = audioCtx.currentTime;
  const beat = combo % 4; 
  if (beat === 0) playKick(time, panValue);
  else if (beat === 1) playHiHat(time, panValue);
  else if (beat === 2) { playSnare(time, panValue); playKick(time, panValue); }
  else if (beat === 3) { playTom(time, panValue, 120); playHiHat(time, panValue, true); }
  
  // 原版最迷人的和弦觸發
  if (combo >= 8 && (beat === 0 || beat === 2)) playChord(time, panValue);
};

export default function MouseFireworks({ isLowEnd }) {
  const svgRef = useRef(null);
  const comboCount = useRef(0);
  const lastClickTime = useRef(0);
  const lastFireTime = useRef(0);
  const activeCount = useRef(0);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      const target = e.target;
      if (['BUTTON', 'SELECT', 'INPUT', 'A'].includes(target.tagName) || target.closest('button')) return;
      const now = Date.now();
      // ★ 只改這裡：寬鬆的 5 秒 Combo
      if (now - lastFireTime.current < 300) return; // throttle 300ms
      lastFireTime.current = now;
      comboCount.current = (now - lastClickTime.current < 5000) ? comboCount.current + 1 : 0;
      lastClickTime.current = now;
      fire({ x: e.clientX, y: e.clientY }, comboCount.current);
    };
    window.addEventListener("pointerdown", handleGlobalClick);
    return () => window.removeEventListener("pointerdown", handleGlobalClick);
  }, []);

  const fire = (m, combo) => {
    const stage = svgRef.current;
    if (!stage) return;
    if (activeCount.current >= 6) return; // 最多同時 6 個
    activeCount.current++;
    playLaunchSound(combo);

    const firework = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const trail = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hues = [0, 180, 60, 280]; 
    const hsl = `hsl(${hues[combo % 4] + gsap.utils.random(-20, 20)}, 100%, 60%)`;
    stage.appendChild(firework);
    firework.appendChild(trail);
    firework.appendChild(ring);

    const rawPan = (m.x / window.innerWidth) * 2 - 1;
    const panValue = Math.max(-1, Math.min(1, rawPan));

    for (let i = 1; i < 5; i++) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "path");
      gsap.set(t, { x: m.x, y: window.innerHeight, opacity: 0.3, attr: { "stroke-width": i, "stroke": "#fff", d: `M0,0 0,${window.innerHeight}` } });
      gsap.to(t, { y: m.y, ease: "expo" });
      trail.appendChild(t);
    }

    const ringCount = Math.min((isLowEnd ? 4 : 7) + Math.floor(combo / 2), 15);
    for (let i = 1; i < ringCount; i++) { 
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      gsap.set(c, { x: m.x, y: m.y, attr: { r: (i / 1.5) * 18, fill: "none", stroke: hsl, "stroke-width": 0.5 + (9 - i), "stroke-dasharray": `1 ${i / 2 * gsap.utils.random(i + 3, i + 6)}` } });
      ring.appendChild(c);
    }

    const explosionScale = isLowEnd ? () => gsap.utils.random(30 + combo * 2, 60 + combo * 4, 1) : () => gsap.utils.random(40 + combo * 5, 80 + combo * 8, 1);

    gsap.timeline({ onComplete: () => { activeCount.current--; if (stage.contains(firework)) stage.removeChild(firework); } })
      .to(trail.children, { duration: 0.2, attr: { d: "M0,0 0,0" }, stagger: -0.08, ease: "expo.inOut" }, 0)
      .to(trail.children, { duration: 0.4, scale: explosionScale, attr: { stroke: hsl }, stagger: -0.15, ease: "expo" }, 0.4)
      .call(() => playExplosionSound(combo, isLowEnd, panValue), [], 0.4)
      .to(trail.children, { duration: 0.3, opacity: 0, stagger: -0.1, ease: "power2.inOut" }, 0.5)
      .from(ring.children, { duration: 0.8, rotate: () => gsap.utils.random(-90, 90, 1), scale: 0, stagger: 0.05, ease: "expo.out" }, 0.4)
      .to(ring.children, { opacity: 0, stagger: 0.1, ease: "sine.inOut" }, 0.6)
      .to(ring.children, { duration: 1, y: "+=50", ease: "power1.in" }, 0.6);
  };

  return (
    <svg ref={svgRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 150 }} />
  );
}