const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

export function playNewOrderSound() {
  try {
    const c = getCtx();
    // Two-tone ascending alert
    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = "sine";
      osc.frequency.value = 600 + i * 200;
      gain.gain.setValueAtTime(0.3, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + 0.15);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + 0.15);
    });
  } catch (e) {
    console.warn("Audio not available", e);
  }
}

export function playTimerEndSound() {
  try {
    const c = getCtx();
    // Rapid beeps
    [0, 0.2, 0.4, 0.6, 0.8].forEach((delay) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + 0.12);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + 0.12);
    });
  } catch (e) {
    console.warn("Audio not available", e);
  }
}
