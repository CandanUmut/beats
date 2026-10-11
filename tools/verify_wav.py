#!/usr/bin/env python3
"""Independent check of exported WAV files (does not share code with the app).

Checks: integrated loudness (pyloudnorm, BS.1770), true peak (4x oversampling),
clicks (spikes in the second difference), and optionally:
  --binaural F_C   interaural phase rotation rate at carrier F_C (should = delta-f)
  --pulse          amplitude-modulation rate and depth

Usage: python tools/verify_wav.py file.wav [--binaural 220] [--pulse]
"""
import argparse
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal


def true_peak_db(x, rate):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def click_ratio(x):
    """Max |2nd difference| near the loudest jump vs the 99.9th percentile."""
    d2 = np.abs(np.diff(x, n=2, axis=0)).max(axis=1)
    return float(d2.max() / (np.percentile(d2, 99.9) + 1e-12))


def interaural_rate(x, rate, fc):
    """Demodulate each ear at fc, low-pass, and fit the slope of the phase difference."""
    t = np.arange(len(x)) / rate
    lo = np.exp(-2j * np.pi * fc * t)
    sos = signal.butter(4, 5, 'low', fs=rate, output='sos')
    zl = signal.sosfiltfilt(sos, x[:, 0] * lo)
    zr = signal.sosfiltfilt(sos, x[:, 1] * lo)
    phase = np.unwrap(np.angle(zr * np.conj(zl)))
    cut = slice(int(5 * rate), len(phase) - int(10 * rate))
    slope = np.polyfit(t[cut], phase[cut], 1)[0]
    return slope / (2 * np.pi)


def pulse(x, rate):
    mono = x.mean(axis=1)
    env = np.abs(signal.hilbert(mono))
    sos = signal.butter(4, 40, 'low', fs=rate, output='sos')
    env = signal.sosfiltfilt(sos, env)[int(5 * rate):-int(10 * rate)]
    f, p = signal.welch(env - env.mean(), fs=rate, nperseg=rate * 8)
    band = (f > 0.5) & (f < 30)
    return float(f[band][np.argmax(p[band])])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--binaural', type=float)
    ap.add_argument('--pulse', action='store_true')
    a = ap.parse_args()
    ok = True
    for fn in a.files:
        x, rate = sf.read(fn, always_2d=True)
        info = sf.info(fn)
        lufs = pyln.Meter(rate).integrated_loudness(x)
        tp = true_peak_db(x, rate)
        cr = click_ratio(x)
        print(f'{fn}: {rate} Hz, {info.subtype}, {len(x) / rate:.1f} s')
        good_l = abs(lufs + 20) <= 1
        good_tp = tp <= -1.0 + 0.05
        print(f'  loudness  {lufs:7.2f} LUFS  (target -20 +-1)   {"PASS" if good_l else "FAIL"}')
        print(f'  true peak {tp:7.2f} dBTP  (limit -1)          {"PASS" if good_tp else "FAIL"}')
        print(f'  click ratio {cr:5.1f}  (max jump / normal; < 3 means no clicks)  {"PASS" if cr < 3 else "CHECK"}')
        ok &= good_l and good_tp
        if a.binaural:
            print(f'  interaural phase rotation {interaural_rate(x, rate, a.binaural):.4f} Hz')
        if a.pulse:
            print(f'  dominant envelope rate {pulse(x, rate):.2f} Hz')
    raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
