# Attribution

## Audio
All built-in sounds are generated at runtime by this project's own code (MIT):

| Sound | How it's made | License |
|---|---|---|
| Drift | Generative D-major pentatonic notes at ~60 BPM over a soft pad, with a small reverb (`src/audio/dsp/synth.ts`) | MIT (own code) |
| Hush | Slowly moving drone on D | MIT (own code) |
| Soft rain | Filtered pink noise plus synthesized drops | MIT (own code) |
| Pink / brown noise | Noise generators | MIT (own code) |

| Lo-fi chill, Aurora, Lullaby, Warm strings | Generated styles (`src/audio/dsp/styles.ts`) | MIT (own code) |
| Reverie | Generated piano score played on the piano samples below (`src/music/generative.ts`) | MIT (own code) |

## Piano samples
- **Upright Piano KW (small), version 2019-07-03**, FreePats project. Recorded from a Kawai upright by Gonzalo and Roberto (roberto@zenvoid.org). **CC0 1.0** (public domain dedication). Source: https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html#UprightKW. Files: `public/samples/piano-kw/` (sample names with `#` renamed to `s`, e.g. `D#3vH.flac` -> `Ds3vH.flac`; original readme and CC0 text included).

## Classical scores (MIDI)
Played from free engravings by the **Mutopia Project** (https://www.mutopiaproject.org). The compositions are public domain; the MIDI files carry the license their typesetters chose. Pieces under **CC BY-SA** are adapted (re-timed, pedaled, rendered with the piano samples), so the audio the app renders from them is shared under the same CC BY-SA license, with credit to the Mutopia typesetter. No NC or ND material is used.

| Piece | Composer | License | Source |
|---|---|---|---|
| Nocturne Op. 9 No. 2 | Chopin | CC BY-SA 3.0 | https://www.mutopiaproject.org/ftp/ChopinFF/O9/chopin_nocturne_op9_n2/ |
| Nocturne Op. 9 No. 1 | Chopin | CC BY-SA 2.5 | https://www.mutopiaproject.org/ftp/ChopinFF/O9/nocturne_in_b-flat_minor/ |
| Nocturne Op. 27 No. 2 | Chopin | CC BY-SA 3.0 | https://www.mutopiaproject.org/ftp/ChopinFF/O27/chopin-nocturne-8/ |
| Nocturne Op. 72 No. 1 | Chopin | CC BY-SA 4.0 | https://www.mutopiaproject.org/ftp/ChopinFF/O72/nocturne_in_e_minor/ |
| Preludes Op. 28 No. 4, 6, 15, 20 | Chopin | Public Domain | https://www.mutopiaproject.org/ftp/ChopinFF/O28/ |
| Prelude Op. 45 | Chopin | Public Domain | https://www.mutopiaproject.org/ftp/ChopinFF/O45/chopin_prelude_op45/ |
| Gymnopédies No. 1, 2, 3 | Satie | Public Domain | https://www.mutopiaproject.org/ftp/SatieE/ |
| Gnossienne No. 1 | Satie | CC BY-SA 4.0 | https://www.mutopiaproject.org/ftp/SatieE/Gnossienne/no_1/ |
| Clair de lune | Debussy | Public Domain | https://www.mutopiaproject.org/ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/ |
| Première Arabesque | Debussy | Public Domain | https://www.mutopiaproject.org/ftp/DebussyC/L66/debussy_Arabesque_1/ |
| Prelude in C, BWV 846 | J. S. Bach | Public Domain | https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/ |

Typesetter names for each file are on its Mutopia page (linked above).

## Code
- Pink-noise filter coefficients: Paul Kellet's well-known "refined" method (public description).
- Reverb structure follows the public Freeverb design (Jezar at Dreampoint); implementation written from scratch.
- K-weighting filter formulas as published in ITU-R BS.1770 and used by libebur128; implementation written from scratch.

## Fonts
- **Fraunces** (Undercase Type), SIL Open Font License 1.1. `public/fonts/fraunces-*.woff2`, license in `public/fonts/OFL-Fraunces.txt`.
- **Manrope** (Mikhail Sharanda), SIL Open Font License 1.1. `public/fonts/manrope-normal.woff2`, license in `public/fonts/OFL-Manrope.txt`.
