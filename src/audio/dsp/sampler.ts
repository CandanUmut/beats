// Piano sampler, a streaming reverb, and a score player. Pure TypeScript, so
// the same code runs live (AudioWorklet), for export (Worker) and in tests.

export interface SampleRegion {
  lo: number;
  hi: number;
  /** MIDI note the sample was recorded at. */
  center: number;
  /** Mono sample data at `rate`. */
  data: Float32Array;
  rate: number;
  loopStart?: number;
  loopEnd?: number;
}

interface Voice {
  midi: number;
  r: SampleRegion;
  pos: number;
  inc: number;
  amp: number;
  /** One-pole low-pass coefficient (softer notes are darker). */
  lp: number;
  lpState: number;
  gl: number;
  gr: number;
  env: number;
  /** Per-sample multiplier while held (slow decay in the loop). */
  holdDecay: number;
  /** Per-sample multiplier after release (0 = not released). */
  relDecay: number;
  age: number;
}

const MAX_VOICES = 40;

export class PianoSampler {
  private voices: Voice[] = [];
  private byKey: SampleRegion[] = [];

  constructor(readonly rate: number, regions: SampleRegion[]) {
    for (const r of regions) for (let k = r.lo; k <= r.hi; k++) this.byKey[k] = r;
  }

  get active(): number {
    return this.voices.length;
  }

  noteOn(midi: number, vel: number, gain = 1): void {
    const r = this.byKey[Math.min(108, Math.max(21, midi))];
    if (!r) return;
    // Re-striking a key damps the previous sound of that key.
    for (const v of this.voices) if (v.midi === midi && v.relDecay === 0) v.relDecay = decayCoef(0.08, this.rate);
    if (this.voices.length >= MAX_VOICES) this.steal();
    const v01 = Math.min(1, Math.max(0, vel));
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const cutoff = Math.min(0.45 * this.rate, Math.max(3 * f0, 700 * Math.pow(2, 5 * v01)));
    const pan = Math.max(-0.45, Math.min(0.45, ((midi - 64) / 44) * 0.45));
    this.voices.push({
      midi,
      r,
      pos: 0,
      inc: Math.pow(2, (midi - r.center) / 12) * (r.rate / this.rate),
      amp: gain * (0.1 + 0.9 * Math.pow(v01, 1.6)),
      lp: Math.exp((-2 * Math.PI * cutoff) / this.rate),
      lpState: 0,
      gl: Math.cos(((pan + 1) * Math.PI) / 4),
      gr: Math.sin(((pan + 1) * Math.PI) / 4),
      env: 1,
      holdDecay: decayCoef(5 + (108 - midi) / 10, this.rate),
      relDecay: 0,
      age: 0,
    });
  }

  /** Release all held voices of this key. Treble keys (no dampers) ring longer. */
  noteOff(midi: number): void {
    const t = midi >= 89 ? 1.2 : 0.32;
    for (const v of this.voices) if (v.midi === midi && v.relDecay === 0) v.relDecay = decayCoef(t, this.rate);
  }

  private steal(): void {
    // Fade the quietest voice quickly instead of cutting it (no click).
    let q = 0;
    for (let i = 1; i < this.voices.length; i++) if (this.voices[i].env * this.voices[i].amp < this.voices[q].env * this.voices[q].amp) q = i;
    this.voices[q].relDecay = decayCoef(0.01, this.rate);
  }

  /** Add one sample of all voices to out[0..1]. */
  tick(out: [number, number]): void {
    let l = 0, r = 0;
    const vs = this.voices;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      const d = v.r.data;
      const j = v.pos | 0;
      if (j + 1 >= d.length) { vs.splice(i, 1); continue; }
      const x = d[j] + (d[j + 1] - d[j]) * (v.pos - j);
      v.pos += v.inc;
      const ls = v.r.loopStart, le = v.r.loopEnd;
      if (le !== undefined && ls !== undefined && v.pos >= le) v.pos -= le - ls;
      v.lpState = x + v.lp * (v.lpState - x);
      if (ls !== undefined && v.pos > ls) v.env *= v.holdDecay;
      if (v.relDecay) v.env *= v.relDecay;
      // Short fade-in on the very first samples avoids a click if a sample starts off-zero.
      const a = v.age < 64 ? (v.age + 1) / 64 : 1;
      v.age++;
      const s = v.lpState * v.amp * v.env * a;
      l += s * v.gl;
      r += s * v.gr;
      if (v.env < 2e-4) vs.splice(i, 1);
    }
    out[0] = l;
    out[1] = r;
  }

  allOff(): void {
    for (const v of this.voices) if (v.relDecay === 0) v.relDecay = decayCoef(0.3, this.rate);
  }
}

/** Per-sample multiplier that decays by 60 dB in `seconds`. */
function decayCoef(seconds: number, rate: number): number {
  return Math.exp(Math.log(1e-3) / (seconds * rate));
}

/** Freeverb-style stereo reverb, streaming. */
export class StreamReverb {
  private combs: { buf: Float32Array; pos: number; store: number }[][];
  private aps: { buf: Float32Array; pos: number }[][];
  constructor(rate: number, private wet = 0.25, private room = 0.8, private damp = 0.4) {
    const sc = rate / 44100;
    const cl = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    const al = [556, 441, 341, 225];
    this.combs = [0, 23].map((o) => cl.map((c) => ({ buf: new Float32Array(Math.round((c + o) * sc)), pos: 0, store: 0 })));
    this.aps = [0, 23].map((o) => al.map((c) => ({ buf: new Float32Array(Math.round((c + o) * sc)), pos: 0 })));
  }
  /** In place on one stereo sample. */
  tick(s: [number, number]): void {
    const input = (s[0] + s[1]) * 0.5 * 0.015;
    for (let ch = 0; ch < 2; ch++) {
      let out = 0;
      for (const c of this.combs[ch]) {
        const y = c.buf[c.pos];
        c.store = y * (1 - this.damp) + c.store * this.damp;
        c.buf[c.pos] = input + c.store * this.room;
        if (++c.pos === c.buf.length) c.pos = 0;
        out += y;
      }
      for (const a of this.aps[ch]) {
        const b = a.buf[a.pos];
        a.buf[a.pos] = out + b * 0.5;
        out = b - out;
        if (++a.pos === a.buf.length) a.pos = 0;
      }
      s[ch] = s[ch] * (1 - this.wet * 0.5) + out * this.wet * 3;
    }
  }
}

export interface ScoreNote {
  t: number;
  release: number;
  midi: number;
  vel: number;
  /** Loudness normalization for this note's piece (linear). */
  gain: number;
}

/**
 * Plays a list of notes (one piece or a playlist) through the sampler and
 * reverb, looping after `length` seconds.
 */
export class ScorePlayer {
  readonly kind = 'score' as const;
  private sampler: PianoSampler;
  private reverb: StreamReverb;
  private starts: Float64Array;
  private idx = 0;
  /** Pending releases: [frame, midi], kept sorted. */
  private releases: { f: number; midi: number }[] = [];
  pos = 0;
  readonly lengthFrames: number;
  private tmp: [number, number] = [0, 0];

  constructor(readonly rate: number, regions: SampleRegion[], readonly notes: ScoreNote[], length: number) {
    this.sampler = new PianoSampler(rate, regions);
    this.reverb = new StreamReverb(rate);
    this.starts = Float64Array.from(notes, (n) => Math.round(n.t * rate));
    this.lengthFrames = Math.max(1, Math.round(length * rate));
  }

  get time(): number {
    return this.pos / this.rate;
  }

  render(L: Float32Array, R: Float32Array, frames: number): void {
    const s = this.tmp;
    for (let i = 0; i < frames; i++) {
      const f = this.pos;
      while (this.idx < this.notes.length && this.starts[this.idx] <= f) {
        const n = this.notes[this.idx++];
        this.sampler.noteOn(n.midi, n.vel, n.gain);
        const rf = Math.round(n.release * this.rate);
        let k = this.releases.length;
        while (k > 0 && this.releases[k - 1].f > rf) k--;
        this.releases.splice(k, 0, { f: rf, midi: n.midi });
      }
      while (this.releases.length && this.releases[0].f <= f) this.sampler.noteOff(this.releases.shift()!.midi);
      this.sampler.tick(s);
      this.reverb.tick(s);
      L[i] = s[0];
      R[i] = s[1];
      if (++this.pos >= this.lengthFrames) {
        this.pos = 0;
        this.idx = 0;
        for (const r of this.releases) r.f -= this.lengthFrames;
      }
    }
  }
}
