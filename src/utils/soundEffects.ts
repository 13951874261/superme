// src/utils/soundEffects.ts

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. 极致极简水滴声
export function playWaterDrop() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // 调低频率起点和终点，显得更加浑厚低沉一些，减少刺耳感
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(1150, now + 0.035);
    
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.012, now + 0.005); // 从 0.02 降低至 0.012，降低音量
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07); // 延长衰减以使尾音更温润柔和
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {}
}

// 2. 真实沙沙纸张翻页声
export function playPageTurn() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 0.18; // 稍微延长，使其过渡更柔和
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now); // 降低滤波器中心频率，减少高频白噪音
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.003, now); // 从 0.005 降到 0.003
    gain.gain.linearRampToValueAtTime(0.01, now + 0.025); // 从 0.02 降到 0.01
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  } catch (e) {}
}

// 3. 温柔平缓的低频和弦提示音
export function playGentleWarning() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(329.63, now); // E4
    osc2.frequency.setValueAtTime(415.30, now); // G#4
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch (e) {}
}

// ---------------- 统一的高端行政风底层音效映射 ----------------

export function playClick() {
  playWaterDrop();
}

export function playSwitch() {
  playWaterDrop();
}

export function playReveal() {
  playWaterDrop();
}

export function playScan() {
  playWaterDrop();
}

export function playSuccess() {
  playPageTurn();
}

export function playSuccessCyber() {
  playPageTurn();
}

export function playUpload() {
  playPageTurn();
}

export function playError() {
  playGentleWarning();
}

export function playErrorCyber() {
  playGentleWarning();
}

export function playHeartbeat() {
  playGentleWarning();
}
