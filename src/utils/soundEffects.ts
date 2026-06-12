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

export function playSuccess() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Ignore if audio not supported
  }
}

export function playError() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Ignore
  }
}

export function playScan() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Ignore
  }
}

export function playClick() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

export function playSwitch() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

export function playUpload() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

export function playReveal() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}
// 追加入 soundEffects.ts 中的新声光电特效应音效
export function playSuccessCyber() {
  try {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    // 快速上升的琶音 (C5 -> E5 -> G5 -> C6)
    const now = ctx.currentTime;
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
    osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);

    osc2.frequency.setValueAtTime(523.25, now);
    osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

export function playErrorCyber() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {}
}

export function playHeartbeat() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(50, now); // 低频心跳
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {}
}
