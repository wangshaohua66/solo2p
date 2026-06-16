export const secondsToFrames = (seconds: number, fps: 12 | 24 | 30): number => {
  return Math.round(seconds * fps);
};

export const framesToSeconds = (frames: number, fps: 12 | 24 | 30): number => {
  return frames / fps;
};

export const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 30);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

export const pxToSeconds = (px: number, pixelsPerSecond: number): number => {
  return px / pixelsPerSecond;
};

export const secondsToPx = (seconds: number, pixelsPerSecond: number): number => {
  return seconds * pixelsPerSecond;
};
