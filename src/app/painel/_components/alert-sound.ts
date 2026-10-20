/** Bipe repetido via Web Audio (sem arquivo). Só soa depois de `unlock()` num gesto do usuário. */
export function createAlertSound() {
  let context: AudioContext | null = null;
  let timer: number | null = null;

  function beep() {
    if (!context) return;
    // iOS suspende o contexto quando a aba vai para o fundo: retoma a cada bipe.
    if (context.state === "suspended") void context.resume();
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
    /** Começa a bipar; antes do `unlock` o intervalo roda em silêncio e passa a soar quando o áudio for liberado. */
    start() {
      if (timer !== null) return;
      beep();
      timer = window.setInterval(beep, 1200);
    },
    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    },
  };
}

export type AlertSound = ReturnType<typeof createAlertSound>;
