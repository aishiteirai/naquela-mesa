/** Bipe repetido via Web Audio (sem arquivo). Só toca depois de `unlock()` num clique do usuário. */
export function createAlertSound() {
  let context: AudioContext | null = null;
  let timer: number | null = null;

  function beep() {
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  }

  return {
    unlock() {
      context ??= new AudioContext();
      void context.resume();
    },
    start() {
      if (!context || timer !== null) return;
      beep();
      timer = window.setInterval(beep, 1200);
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    },
  };
}
