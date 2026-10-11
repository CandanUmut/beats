#!/usr/bin/env python3
"""Dev helper: decode the piano FLAC samples to raw float32 so Node scripts
(tools/measure-gains.ts) can use the exact same samples as the browser."""
import sys, glob, os, numpy as np, soundfile as sf
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(src, '*.flac')):
    x, rate = sf.read(f, dtype='float32')
    if x.ndim > 1: x = x.mean(axis=1)
    x.astype('<f4').tofile(os.path.join(out, os.path.basename(f)[:-5] + '.f32'))
print('ok', rate)
