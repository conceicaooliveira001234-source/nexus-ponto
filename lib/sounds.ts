// Utilitário para sons de interface futuristas usando Web Audio API
// Não requer arquivos externos, funciona nativamente no navegador

let audioCtx: AudioContext | null = null;

const getContext = () => {
  if (!audioCtx && typeof window !== 'undefined') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const playTone = (
  freqs: number[], 
  type: OscillatorType, 
  duration: number, 
  stagger: number = 0, 
  vol: number = 0.1
) => {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + (i * stagger);

    osc.type = type;
    osc.frequency.setValueAtTime(f, startTime);
    
    // Envelope de volume para evitar cliques
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });
};

const playSweep = (startFreq: number, endFreq: number, duration: number, type: OscillatorType = 'sine') => {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
};

export const playSound = {
  // Som de sucesso (Login, Cadastro, Ações positivas)
  // Acorde maior ascendente futurista
  success: () => playTone([440, 554.37, 659.25, 880], 'sine', 0.4, 0.08, 0.1),

  // Som de erro (Senha errada, Rosto não reconhecido)
  // Tom grave descendente e áspero
  error: () => {
    playTone([150, 145], 'sawtooth', 0.3, 0, 0.15);
    playSweep(150, 50, 0.3, 'sawtooth');
  },

  // Som ao abrir a câmera
  // Efeito de "carregamento" ou "power up" sci-fi
  cameraOpen: () => playSweep(200, 1200, 0.6, 'sine'),

  // Som ao registrar ponto (O mais importante!)
  // Melodia triunfante e tecnológica
  attendance: () => {
    playTone([523.25], 'sine', 0.1, 0);       // C5
    playTone([659.25], 'sine', 0.1, 0.1);     // E5
    playTone([783.99], 'sine', 0.1, 0.2);     // G5
    playTone([1046.50], 'sine', 0.6, 0.3, 0.2); // C6 (Forte)
  },

  // Som de clique/interação leve
  click: () => playTone([800], 'sine', 0.05, 0, 0.05),
  
  // Som de alerta/atenção
  alert: () => playTone([600, 800], 'square', 0.1, 0.1, 0.05)
};
