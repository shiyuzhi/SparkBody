// src/Audio.jsx

class DrumKit {
  constructor() {
    this.context = null;
    this.buffers = {};
    this.masterGain = null;
  }

  /**
   * 初始化 AudioContext
   * 必須在使用者互動（click, touch）後觸發
   */
  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      
      // 建立一個總音量控制節點
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.context.destination);
    }
    
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * 載入音檔
   * @param {string} name - 音效標籤名稱 (例如 'boom')
   * @param {string} url - 檔案路徑 (相對於 public 或是完整 URL)
   */
  async loadBuffer(name, url) {
    this.init();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers[name] = audioBuffer;
      console.log(`✅ 音效 "${name}" 載入成功`);
    } catch (e) {
      console.error(`❌ 音效 "${name}" 載入失敗:`, e);
    }
  }

  /**
   * 播放音效
   * @param {string} name - 載入時設定的名稱
   * @param {Object} options - 控制選項
   */
  play(name, { volume = 0.5, detune = 0, pan = 0 } = {}) {
    if (!this.buffers[name] || !this.context) return;

    if (this.context.state === 'suspended') this.context.resume();

    // 1. 建立節點
    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    const panner = this.context.createStereoPanner();

    // 2. 設定數值
    source.buffer = this.buffers[name];
    
    // 隨機音高：讓煙火聲不單調 (0.85 ~ 1.15 倍速)
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    
    // 如果有額外的 detune 需求 (以分算，100分為半音)
    if (detune) source.detune.value = detune;

    gainNode.gain.value = volume;
    panner.pan.value = pan; // -1 (左) 到 1 (右)

    // 3. 連接路徑: Source -> Panner -> Gain -> Master -> Destination
    source.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.masterGain);

    // 4. 播放並自動釋放資源
    source.start(0);
    source.onended = () => {
      source.disconnect();
      panner.disconnect();
      gainNode.disconnect();
    };
  }

  /**
   * 停止所有聲音
   */
  stopAll() {
    if (this.context) {
      this.context.suspend();
    }
  }
}
if (!window._drumKitInstance) {
  window._drumKitInstance = new DrumKit();
}

export const drumKit = window._drumKitInstance;