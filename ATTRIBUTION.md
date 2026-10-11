# Attribution

## Audio
All built-in sounds are generated at runtime by this project's own code (MIT):

| Sound | How it's made | License |
|---|---|---|
| Drift | Generative D-major pentatonic notes at ~60 BPM over a soft pad, with a small reverb (`src/audio/dsp/synth.ts`) | MIT (own code) |
| Hush | Slowly moving drone on D | MIT (own code) |
| Soft rain | Filtered pink noise plus synthesized drops | MIT (own code) |
| Pink / brown noise | Noise generators | MIT (own code) |

No third-party audio files are included. Any future file will be listed here with source, author and license (public domain, CC0 or CC BY only).

## Code
- Pink-noise filter coefficients: Paul Kellet's well-known "refined" method (public description).
- Reverb structure follows the public Freeverb design (Jezar at Dreampoint); implementation written from scratch.
- K-weighting filter formulas as published in ITU-R BS.1770 and used by libebur128; implementation written from scratch.
