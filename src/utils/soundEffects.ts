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

function effectiveVolume(scale = 1): number {
  return Math.max(0.001, globalVolume * scale);
}

/** 短促点击：正弦波 + 快速衰减 */
function synthClick(freq = 1000, duration = 0.05, volumeScale = 0.18) {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  const peak = effectiveVolume(volumeScale);
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 成功提示：双正弦波上行 */
function synthSuccess(notes = [523.25, 659.25], noteDuration = 0.11, volumeScale = 0.14) {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;

  const now = ctx.currentTime;
  const peak = effectiveVolume(volumeScale);

  notes.forEach((freq, index) => {
    const start = now + index * noteDuration * 0.75;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteDuration + 0.02);
  });
}

/** 错误警示：方波降调 */
function synthError(startFreq = 420, endFreq = 140, duration = 0.22, volumeScale = 0.09) {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), now + duration);

  const peak = effectiveVolume(volumeScale);
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 正弦扫频（展开/翻页等过渡音） */
function synthSweep(from: number, to: number, duration: number, volumeScale = 0.1) {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + duration);

  const peak = effectiveVolume(volumeScale);
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 水滴声：高频正弦波 + 快速衰减，模拟水滴滴落 */
function synthWaterDrop(freq = 1400, duration = 0.08, volumeScale = 0.08) {
  const ctx = getAudioContext();
  if (!ctx || !readSoundEnabled()) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.6, 1), now + duration);

  const peak = effectiveVolume(volumeScale);
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

// 纸张翻页声（加入词库、划线）
export const playPageTurn = () => synthSweep(480, 220, 0.1, 0.09);

// 水滴声（确认、通关）
export const playDrop = () => synthSuccess([659.25], 0.08, 0.1);

// 成功/错误声
export const playSuccess = () => synthSuccess();
export const playError = () => synthError();

// 点击音效
export const playClick = () => synthClick();

// Tab/模块切换
export const playSwitch = () => {
  synthClick(900, 0.04, 0.14);
  setTimeout(() => synthClick(1150, 0.04, 0.12), 55);
};

// 面板展开/折叠
export const playReveal = () => synthSweep(280, 560, 0.12, 0.08);

// AI 处理/加载
export const playScan = () => synthClick(440, 0.12, 0.07);

// 滑块拖动
export const playDrag = () => synthClick(720, 0.035, 0.06);

// 表单验证
export const playValidatePass = () => synthSuccess([523.25, 784], 0.09, 0.12);
export const playValidateFail = () => synthError(380, 120, 0.18, 0.08);

// 兼容老音效函数映射
export const playWaterDrop = () => synthWaterDrop();
export const playSuccessCyber = () => playSuccess();
export const playErrorCyber = () => playError();
export const playGentleWarning = () => playError();
export const playHeartbeat = () => playError();
export const playUpload = () => playPageTurn();
