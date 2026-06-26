export const audioCache: Record<string, HTMLAudioElement> = {};

export function playSound(src: string) {
  if (typeof window === 'undefined') return;
  if (!audioCache[src]) {
    const audio = new Audio(src);
    audioCache[src] = audio;
  }
  audioCache[src].currentTime = 0;
  audioCache[src].play().catch(e => console.warn('Audio play prevented:', e));
}

// 纸张翻页声（加入词库、划线）
export const playPageTurn = () => playSound('/assets/sounds/page-turn.mp3');

// 水滴声（确认、通关）
export const playDrop = () => playSound('/assets/sounds/drop.wav');

// 成功/错误声
export const playSuccess = () => playSound('/assets/sounds/success.mp3');
export const playError = () => playSound('/assets/sounds/error.mp3');

// 兼容老音效函数映射，使用新版高质量音频文件替代
export const playClick = () => playDrop();
export const playSwitch = () => playDrop();
export const playReveal = () => playDrop();
export const playScan = () => playDrop();
export const playWaterDrop = () => playDrop();
export const playSuccessCyber = () => playSuccess();
export const playErrorCyber = () => playError();
export const playGentleWarning = () => playError();
export const playHeartbeat = () => playError();
export const playUpload = () => playPageTurn();
