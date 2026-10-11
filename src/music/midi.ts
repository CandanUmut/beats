// Minimal Standard MIDI File reader: notes, sustain pedal, tempo, key and
// time signatures, converted to seconds.

export interface MidiNote {
  /** Start, seconds. */
  t: number;
  /** Length, seconds (key held). */
  dur: number;
  midi: number;
  vel: number;
  ch: number;
  track: number;
}

export interface PedalEvent {
  t: number;
  down: boolean;
}

export interface MidiFile {
  notes: MidiNote[];
  pedal: PedalEvent[];
  /** Key signature: sharps (+) / flats (-), and minor flag. */
  key: { sf: number; minor: boolean } | null;
  timeSig: { num: number; den: number } | null;
  /** Seconds per quarter note at the start. */
  firstTempo: number;
  duration: number;
  /** Bar start times in seconds (from the time signature and tempo map). */
  bars: number[];
}

interface RawEvent {
  tick: number;
  order: number;
  track: number;
  kind: 'on' | 'off' | 'cc' | 'tempo' | 'key' | 'time';
  a: number;
  b: number;
  ch: number;
}

export function parseMidi(data: Uint8Array): MidiFile {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let p = 0;
  const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(data[p + i]); p += n; return s; };
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  if (str(4) !== 'MThd') throw new Error('Not a MIDI file');
  const hlen = u32();
  const hstart = p;
  u16(); // format
  const ntrks = u16();
  const division = u16();
  p = hstart + hlen;
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  const events: RawEvent[] = [];
  let order = 0;
  for (let tr = 0; tr < ntrks && p < data.length; tr++) {
    const id = str(4);
    const len = u32();
    const end = p + len;
    if (id !== 'MTrk') { p = end; continue; }
    let tick = 0;
    let status = 0;
    const vlq = () => { let x = 0; for (;;) { const b = data[p++]; x = (x << 7) | (b & 0x7f); if (!(b & 0x80)) return x; } };
    while (p < end) {
      tick += vlq();
      let b = data[p];
      if (b & 0x80) { status = b; p++; } else b = status; // running status
      const type = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const mt = data[p++];
        const ml = vlq();
        if (mt === 0x51 && ml === 3) events.push({ tick, order: order++, track: tr, kind: 'tempo', a: (data[p] << 16) | (data[p + 1] << 8) | data[p + 2], b: 0, ch: 0 });
        else if (mt === 0x59 && ml >= 2) events.push({ tick, order: order++, track: tr, kind: 'key', a: (data[p] << 24) >> 24, b: data[p + 1], ch: 0 });
        else if (mt === 0x58 && ml >= 2) events.push({ tick, order: order++, track: tr, kind: 'time', a: data[p], b: 1 << data[p + 1], ch: 0 });
        p += ml;
        status = 0; // meta events cancel running status
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
        status = 0;
      } else if (type === 0x90 || type === 0x80) {
        const note = data[p++], vel = data[p++];
        const on = type === 0x90 && vel > 0;
        events.push({ tick, order: order++, track: tr, kind: on ? 'on' : 'off', a: note, b: vel, ch });
      } else if (type === 0xb0) {
        events.push({ tick, order: order++, track: tr, kind: 'cc', a: data[p], b: data[p + 1], ch });
        p += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        p += 1;
      } else if (type === 0xa0 || type === 0xe0) {
        p += 2;
      } else {
        // Unknown byte: skip to the end of this track to stay safe.
        p = end;
      }
    }
    p = end;
  }
  events.sort((x, y) => x.tick - y.tick || x.order - y.order);

  // Tempo map: tick -> seconds.
  const tempos = events.filter((e) => e.kind === 'tempo');
  const segs: { tick: number; sec: number; spq: number }[] = [{ tick: 0, sec: 0, spq: 0.5 }];
  for (const e of tempos) {
    const last = segs[segs.length - 1];
    const sec = last.sec + ((e.tick - last.tick) / division) * last.spq;
    if (e.tick === last.tick) last.spq = e.a / 1e6;
    else segs.push({ tick: e.tick, sec, spq: e.a / 1e6 });
  }
  const toSec = (tick: number) => {
    let s = segs[0];
    for (const x of segs) { if (x.tick <= tick) s = x; else break; }
    return s.sec + ((tick - s.tick) / division) * s.spq;
  };

  const notes: MidiNote[] = [];
  const open = new Map<string, { tick: number; vel: number; track: number }[]>();
  const pedal: PedalEvent[] = [];
  let key: MidiFile['key'] = null;
  let timeSig: MidiFile['timeSig'] = null;
  let lastTick = 0;
  for (const e of events) {
    lastTick = Math.max(lastTick, e.tick);
    if (e.kind === 'on') {
      const k = `${e.ch}:${e.a}`;
      const list = open.get(k) ?? [];
      list.push({ tick: e.tick, vel: e.b, track: e.track });
      open.set(k, list);
    } else if (e.kind === 'off') {
      const k = `${e.ch}:${e.a}`;
      const st = open.get(k)?.shift();
      if (st) {
        const t = toSec(st.tick);
        notes.push({ t, dur: Math.max(0.02, toSec(e.tick) - t), midi: e.a, vel: st.vel, ch: e.ch, track: st.track });
      }
    } else if (e.kind === 'cc' && e.a === 64) {
      const down = e.b >= 64;
      const t = toSec(e.tick);
      if (!pedal.length || pedal[pedal.length - 1].down !== down) pedal.push({ t, down });
    } else if (e.kind === 'key' && !key) {
      key = { sf: e.a, minor: e.b === 1 };
    } else if (e.kind === 'time' && !timeSig) {
      timeSig = { num: e.a, den: e.b };
    }
  }
  notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
  const duration = Math.max(toSec(lastTick), ...notes.map((n) => n.t + n.dur));

  // Bar lines from the first time signature.
  const bars: number[] = [];
  const ts = timeSig ?? { num: 4, den: 4 };
  const ticksPerBar = (division * 4 * ts.num) / ts.den;
  for (let tick = 0; toSec(tick) < duration + 0.001; tick += ticksPerBar) bars.push(toSec(tick));

  return { notes, pedal, key, timeSig, firstTempo: segs[0].spq, duration, bars };
}

const MAJOR_FROM_SF = [11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1]; // sf -7..7 -> pitch class

/** Tonic pitch class (0 = C) from a key signature. */
export function tonicPitchClass(key: { sf: number; minor: boolean }): number {
  const major = MAJOR_FROM_SF[key.sf + 7];
  return key.minor ? (major + 9) % 12 : major;
}

export const PITCH_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
