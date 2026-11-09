// Liten pianoliknende synth bygget kun på Web Audio.
// Rene hjelpefunksjoner ligger øverst slik at de kan testes uten lyd.

const NOTE_OFFSETS = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
export const PARTIAL_COUNT = 7;
export const INHARMONICITY = 0.0004;
const LOOKAHEAD_SECONDS = 0.12;
const TICK_MS = 25;

export function noteToMidi(name) {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(String(name).trim());
  if (!match) throw new Error(`Ugyldig tonenavn: ${name}`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(octave) + 1) * 12 + NOTE_OFFSETS[letter] + shift;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

// theme: {tempo (BPM), notes: [[pitch | 'R', beats], ...]}
// Returnerer bare klingende toner, med start og varighet i sekunder.
export function parseTheme(theme) {
  const secondsPerBeat = 60 / (theme.tempo || 100);
  let beat = 0;
  const result = [];
  for (const [pitch, beats] of theme.notes) {
    if (pitch !== 'R') {
      result.push({
        midi: noteToMidi(pitch),
        start: round(beat * secondsPerBeat),
        duration: round(beats * secondsPerBeat)
      });
    }
    beat += beats;
  }
  return result;
}

// Overtoner: frekvensen går litt over heltallsforholdet (stiv streng/hammer).
export function partialFrequency(fundamental, n) {
  return fundamental * n * Math.sqrt(1 + INHARMONICITY * n * n);
}

export function partialAmplitude(n) {
  return 1 / Math.pow(n, 1.1);
}

// Tidskonstant i sekunder. Høyere overtoner dør raskere, som på piano.
export function partialDecay(n) {
  return 1.6 / Math.pow(n, 1.25);
}

// Eksponentiell avtakning som er nær null ved slutten av impulsresponsen.
export function reverbEnvelope(t, seconds = 1.8) {
  return Math.exp(-6.9 * t / seconds);
}

function defaultCreateContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function createImpulse(ctx, seconds = 1.8) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * reverbEnvelope(t, seconds);
    }
  }
  return buffer;
}

function createNoise(ctx, seconds = 0.03) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function buildGraph(ctx) {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(ctx.destination);

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 0.5;

  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  tone.connect(dry);
  dry.connect(compressor);

  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulse(ctx, 1.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  tone.connect(convolver);
  convolver.connect(wet);
  wet.connect(compressor);

  return {tone, noise: createNoise(ctx)};
}

function playVoice(ctx, graph, bus, midi, when, duration, velocity) {
  const f0 = midiToFrequency(midi);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2 * velocity, when);
  gain.gain.setTargetAtTime(0, when + duration * 0.95, 0.06);
  gain.connect(bus);

  for (let n = 1; n <= PARTIAL_COUNT; n++) {
    const frequency = partialFrequency(f0, n);
    if (frequency > ctx.sampleRate * 0.45) break;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    const env = ctx.createGain();
    const tau = partialDecay(n);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(partialAmplitude(n), when + 0.002);
    env.gain.setTargetAtTime(0, when + 0.002, tau);
    osc.connect(env);
    env.connect(gain);
    osc.start(when);
    osc.stop(when + 0.002 + 6 * tau);
  }

  // Kort filtrert støy som gir hammerlyden i starten.
  const hammer = ctx.createBufferSource();
  hammer.buffer = graph.noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = Math.min(6000, f0 * 6);
  band.Q.value = 1.2;
  const hammerGain = ctx.createGain();
  hammerGain.gain.setValueAtTime(0.25 * velocity, when);
  hammerGain.gain.setTargetAtTime(0, when, 0.004);
  hammer.connect(band);
  band.connect(hammerGain);
  hammerGain.connect(gain);
  hammer.start(when);
  hammer.stop(when + 0.03);
}

// Returnerer {play(theme, {onNote, onEnd, velocity}), stop(), dispose(), isPlaying}.
// AudioContext opprettes først ved play(), som må komme fra et trykk (iOS).
export function createPlayer({createContext = defaultCreateContext} = {}) {
  let ctx = null;
  let graph = null;
  let bus = null;
  let playing = false;
  let tickTimer = null;
  let noteTimers = [];

  function clearTimers() {
    clearTimeout(tickTimer);
    tickTimer = null;
    noteTimers.forEach(clearTimeout);
    noteTimers = [];
  }

  function ensureContext() {
    if (!ctx) ctx = createContext();
    if (!ctx) return null;
    if (!graph) graph = buildGraph(ctx);
    return ctx;
  }

  function stop() {
    clearTimers();
    playing = false;
    if (bus && ctx) {
      const finished = bus;
      bus = null;
      finished.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => finished.disconnect(), 300);
    }
    bus = null;
  }

  function play(theme, {onNote, onEnd, velocity = 0.7} = {}) {
    const c = ensureContext();
    if (!c) return false;
    stop();
    if (c.state === 'suspended') Promise.resolve(c.resume()).catch(() => {});

    const notes = parseTheme(theme);
    if (!notes.length) return false;

    const origin = c.currentTime + 0.08;
    const session = c.createGain();
    session.connect(graph.tone);
    bus = session;
    graph.tone.frequency.setValueAtTime(1200 + 4800 * velocity, c.currentTime);
    playing = true;

    let next = 0;
    const tick = () => {
      if (!playing || bus !== session) return;
      const horizon = c.currentTime + LOOKAHEAD_SECONDS;
      while (next < notes.length && origin + notes[next].start < horizon) {
        const note = notes[next];
        const when = origin + note.start;
        playVoice(c, graph, session, note.midi, when, note.duration, velocity);
        const index = next;
        noteTimers.push(setTimeout(() => {
          if (playing && bus === session) onNote?.(index);
        }, Math.max(0, (when - c.currentTime) * 1000)));
        next++;
      }
      if (next >= notes.length) {
        const last = notes[notes.length - 1];
        const endAt = origin + last.start + last.duration;
        tickTimer = setTimeout(() => {
          if (bus !== session) return;
          playing = false;
          bus = null;
          onEnd?.();
        }, Math.max(0, (endAt - c.currentTime) * 1000));
        return;
      }
      tickTimer = setTimeout(tick, TICK_MS);
    };
    tick();
    return true;
  }

  // Lukker lydkonteksten når spilleren ikke skal brukes mer; nettleseren tillater bare noen få samtidig.
  function dispose() {
    stop();
    const closing = ctx;
    ctx = null;
    graph = null;
    if (closing?.close) setTimeout(() => Promise.resolve(closing.close()).catch(() => {}), 350);
  }

  return {
    play,
    stop,
    dispose,
    get isPlaying() {
      return playing;
    }
  };
}
