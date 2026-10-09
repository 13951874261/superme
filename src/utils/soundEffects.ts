const SOUND_ENABLED_KEY = 'super_agent_sound_enabled';
const SOUND_VOLUME_KEY = 'super_agent_sound_volume';

let audioCtx: AudioContext | null = null;
let globalVolume = 0.5;

function readSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
}

function readGlobalVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  const stored = parseFloat(localStorage.getItem(SOUND_VOLUME_KEY) || '0.5');
  return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 0.5;
}

globalVolume = readGlobalVolume();

export function setGlobalVolume(volume: number) {
  globalVolume = Math.max(0, Math.min(1, volume));
}

export function getGlobalVolume() {
  return globalVolume;
}

export function isSoundEnabled() {
  return readSoundEnabled();
}

if (typeof window !== 'undefined') {
  window.addEventListener('global-sound-changed', () => {
    globalVolume = readGlobalVolume();
  });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function ev(scale = 1): number {
  return Math.max(0.001, globalVolume * scale);
}

// ─── 底层音色引擎 ───

/** 带泛音叠加的钟琴音色：基频 + 2 层泛音 + 高频微光 */
function bellTone(ctx: AudioContext, freq: number, t: number, dur: number, vol: number) {
  const harmonics = [
    { ratio: 1, gain: 1, type: 'sine' as OscillatorType },
    { ratio: 2.0, gain: 0.35, type: 'sine' as OscillatorType },
    { ratio: 3.0, gain: 0.12, type: 'sine' as OscillatorType },
    { ratio: 5.04, gain: 0.06, type: 'sine' as OscillatorType },
  ];
  harmonics.forEach(h => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = h.type;
    osc.frequency.setValueAtTime(freq * h.ratio, t);
    const peak = vol * h.gain;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(peak * 0.6, t + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

/** 马林巴音色：三角波基频 + 正弦泛音 + 快速衰减 */
function marimbaTone(ctx: AudioContext, freq: number, t: number, dur: number, vol: number) {
  const layers: { ratio: number; type: OscillatorType; g: number }[] = [
    { ratio: 1, type: 'triangle', g: 1 },
    { ratio: 4.0, type: 'sine', g: 0.18 },
    { ratio: 10.0, type: 'sine', g: 0.04 },
  ];
  layers.forEach(l => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = l.type;
    osc.frequency.setValueAtTime(freq * l.ratio, t);
    const peak = vol * l.g;
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(peak * 0.4, t + dur * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

/** 柔和噪声脉冲（模拟纸张/气流） */
function noiseBurst(ctx: AudioContext, t: number, dur: number, vol: number, filterFreq = 3000) {
  const bufferSize = Math.ceil(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, t);
  filter.Q.setValueAtTime(1.2, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** 水滴共鸣：正弦下滑 + 谐振滤波器 */
function resonantDrop(ctx: AudioContext, freq: number, t: number, dur: number, vol: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.45, 80), t + dur);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq * 1.2, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
  filter.Q.setValueAtTime(8, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** 柔和警示：三角波 + 低频共振 */
function warmAlert(ctx: AudioContext, freq: number, endFreq: number, t: number, dur: number, vol: number) {
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const gain = ctx.createGain();
  const subGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur);
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq * 0.5, t);
  sub.frequency.exponentialRampToValueAtTime(Math.max(endFreq * 0.5, 20), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  subGain.gain.setValueAtTime(vol * 0.3, t);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  sub.connect(subGain);
  gain.connect(ctx.destination);
  subGain.connect(ctx.destination);
  osc.start(t);
  sub.start(t);
  osc.stop(t + dur + 0.05);
  sub.stop(t + dur + 0.05);
}

// ─── 导出音效函数 ───

/** 点击：轻盈的钟琴短触 + 微噪声质感 */
export const playClick = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 1800, t, 0.06, ev(0.12));
  noiseBurst(ctx, t, 0.025, ev(0.03), 6000);
};

/** 成功：温暖的马林巴琶音上行（C5 → E5 → G5） */
export const playSuccess = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    marimbaTone(ctx, f, t + i * 0.09, 0.18, ev(0.13));
  });
};

/** 错误：柔和的三角波下行 + 低频底蕴 */
export const playError = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  warmAlert(ctx, 380, 180, t, 0.28, ev(0.1));
};

/** 翻页/加入词库：纸张沙沙声 + 轻微音调扫动 */
export const playPageTurn = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  noiseBurst(ctx, t, 0.12, ev(0.08), 2800);
  bellTone(ctx, 420, t + 0.02, 0.08, ev(0.04));
};

/** 水滴声：共鸣腔水滴 */
export const playWaterDrop = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  resonantDrop(ctx, 1600, t, 0.12, ev(0.1));
};

/** 确认/通关水滴 */
export const playDrop = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  resonantDrop(ctx, 1200, t, 0.1, ev(0.12));
};

/** Tab/模块切换：双钟琴快闪 */
export const playSwitch = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 1200, t, 0.05, ev(0.1));
  bellTone(ctx, 1500, t + 0.06, 0.05, ev(0.08));
};

/** 面板展开/折叠：泛音绽放 */
export const playReveal = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 440, t, 0.15, ev(0.07));
  bellTone(ctx, 880, t + 0.03, 0.12, ev(0.05));
  noiseBurst(ctx, t, 0.06, ev(0.025), 4000);
};

/** AI 处理/扫描：柔和脉冲 */
export const playScan = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 660, t, 0.14, ev(0.06));
  noiseBurst(ctx, t + 0.02, 0.05, ev(0.02), 5000);
};

/** 滑块拖动：微触感 */
export const playDrag = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 1400, t, 0.03, ev(0.05));
};

/** 表单验证通过：明亮的双音钟琴 */
export const playValidatePass = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 523.25, t, 0.12, ev(0.1));
  bellTone(ctx, 783.99, t + 0.08, 0.12, ev(0.08));
};

/** 表单验证失败：柔和警告 */
export const playValidateFail = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  warmAlert(ctx, 350, 160, t, 0.2, ev(0.08));
};

/** 口语沙盘 - 发送消息：清脆水滴送出 */
export const playSendMessage = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  resonantDrop(ctx, 1400, t, 0.08, ev(0.1));
  bellTone(ctx, 2200, t + 0.02, 0.04, ev(0.04));
};

/** 口语沙盘 - 开始录音：温暖启动音 */
export const playRecordStart = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 880, t, 0.08, ev(0.09));
  bellTone(ctx, 1320, t + 0.06, 0.06, ev(0.06));
};

/** 口语沙盘 - 停止录音：沉稳收束 */
export const playRecordStop = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  marimbaTone(ctx, 660, t, 0.08, ev(0.1));
};

/** 口语沙盘 - 场景切换 */
export const playSceneSwitch = () => playPageTurn();

/** 口语沙盘 - 突破 */
export const playBreakthrough = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  marimbaTone(ctx, 784, t, 0.1, ev(0.12));
  bellTone(ctx, 1568, t + 0.08, 0.12, ev(0.08));
};

/** 口语沙盘 - 角色切换 */
export const playRoleSwitch = () => {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;
  const t = ctx.currentTime;
  bellTone(ctx, 1000, t, 0.05, ev(0.09));
  bellTone(ctx, 1260, t + 0.055, 0.05, ev(0.07));
};

// 兼容老音效函数映射
export const playSuccessCyber = () => playSuccess();
export const playErrorCyber = () => playError();
export const playGentleWarning = () => playError();
export const playHeartbeat = () => playError();
export const playUpload = () => playPageTurn();