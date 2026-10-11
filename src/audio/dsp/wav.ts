// WAV (RIFF, PCM) writer. 24-bit by default; 16-bit uses TPDF dither.

import { mulberry32 } from './random';

export function wavHeader(rate: number, channels: number, bits: 16 | 24, frames: number): Uint8Array {
  const bytes = bits / 8;
  const dataLen = frames * channels * bytes;
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * bytes, true);
  v.setUint16(32, channels * bytes, true);
  v.setUint16(34, bits, true);
  str(36, 'data');
  v.setUint32(40, dataLen, true);
  return new Uint8Array(buf);
}

export class PcmEncoder {
  private rand = mulberry32(12345);
  constructor(readonly bits: 16 | 24) {}

  /** Interleave and quantize a stereo block. */
  encode(left: Float32Array, right: Float32Array, frames: number): Uint8Array {
    const bytes = this.bits / 8;
    const out = new Uint8Array(frames * 2 * bytes);
    let o = 0;
    for (let i = 0; i < frames; i++) {
      for (const x of [left[i], right[i]]) {
        if (this.bits === 24) {
          let s = Math.round(Math.max(-1, Math.min(1, x)) * 8388607);
          if (s < 0) s += 0x1000000;
          out[o++] = s & 0xff;
          out[o++] = (s >> 8) & 0xff;
          out[o++] = (s >> 16) & 0xff;
        } else {
          const d = (this.rand() - this.rand()) / 32768;
          let s = Math.round(Math.max(-1, Math.min(1, x + d)) * 32767);
          if (s < 0) s += 0x10000;
          out[o++] = s & 0xff;
          out[o++] = (s >> 8) & 0xff;
        }
      }
    }
    return out;
  }
}

/** Decode a PCM WAV (16/24-bit) back to float channels. Used by tests. */
export function decodeWav(data: Uint8Array): { rate: number; channels: Float32Array[] } {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ch = v.getUint16(22, true);
  const rate = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  const len = v.getUint32(40, true);
  const bytes = bits / 8;
  const frames = len / (ch * bytes);
  const chans = Array.from({ length: ch }, () => new Float32Array(frames));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      let s: number;
      if (bits === 24) {
        s = data[o] | (data[o + 1] << 8) | (data[o + 2] << 16);
        if (s & 0x800000) s -= 0x1000000;
        chans[c][i] = s / 8388607;
      } else {
        s = v.getInt16(o, true);
        chans[c][i] = s / 32767;
      }
      o += bytes;
    }
  }
  return { rate, channels: chans };
}
