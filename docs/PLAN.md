# M0 plan

Status: draft, waiting for the owner's yes. No app code has been written.

## Summary

- The build prompt and the research mostly agree. Most of what it asks for can be built in the browser.
- I found 6 places where the prompt and the research disagree or the research is silent. The biggest one: the banned-word rule clashes with text the research requires (the disclaimer says "treat, cure", the urge card says "not treatment", the Myths page has to quote "digital drugs"). This needs a decision.
- One citation in the research is wrong: PubMed 38319068 is Lin et al. 2024 (the sleep trial in older adults), not Chuderski et al. 2024. I checked this against PubMed.
- The hardest technical parts are a true-peak limiter, accurate LUFS measurement, background playback on iOS, and pleasant generative music. None of them is blocked.
- An honest point about the Lab: a pulse (AM) sham with depth 0 will almost always be easy to tell apart from the real thing. Expect that experiment to end with "can't tell, blinding failed". The binaural sham (Δf = 0) blinds much better.

## Repo state found

- The research is at `RESEARCH (1).md` in the repo root, not at `docs/RESEARCH.md`. The build prompt is at `BUILD_PROMPT (1).md`.
- `compass_artifact_wf-…md` is an earlier draft of the same research. It has numbered citations and an extra "Build plan" with beat presets (Calm 6 Hz, Relax 6/10 Hz, Sleep 2 Hz, Focus 14–16 Hz). Those presets are **not** in RESEARCH.md.
- Proposal: move the files to `docs/RESEARCH.md`, `docs/BUILD_PROMPT.md` and `docs/research-draft-with-citations.md`, and fix the PubMed label.

## Where the prompt and the research disagree (research wins unless you say otherwise)

1. **Banned words vs required text.** The required disclaimer contains "treat, cure", and the coping card says "not treatment". The Why? pages need to describe study groups ("anxiety around surgery", "alcohol withdrawal", "insomnia/CBT-I"). The Myths page quotes "digital drugs". Proposal: the banned-word test scans all UI strings, with a small exact-match allowlist (the disclaimer, "not treatment", quoted myths). The Why? pages describe study groups in plain words ("people about to have surgery") and keep paper titles only in the citation line. That citation line is also allowlisted.
2. **Badge grades.** Relax/Beats: research says "Weak–Moderate vs pink noise, Weak vs music" (prompt: Weak). Sleep/Music: research gives no explicit grade (prompt: Weak–Moderate). It only says "modest sleep-quality gains from music over weeks". Proposal: show "Beats: Weak (vs music)" for Relax. For Sleep music, either drop the chip or ask you for a grade.
3. **Breathing numbers.** The research says "~6/min" and does not give 4.5–7 or an inhale/exhale ratio. The cyclic-sigh pattern (two inhales, long exhale) is the standard definition of what Balban 2023 tested, but RESEARCH.md doesn't spell it out. These need your OK, or a line added to the research.
4. **Binaural level range.** The research says keep the carriers 12–20 dB below the music. The prompt slider goes up to −10 dB. Proposal: cap it at −12 dB.
5. **Beat rate per goal.** The prompt doesn't set one. The research only lists rates "used in studies": Calm theta 4–7 Hz, Relax theta 4–7 or alpha ~10 Hz, Sleep delta 0.25–4 Hz, Focus beta 14–20 Hz. Proposal: use those as defaults. Never offer 40 Hz binaural (research: probably not even perceived). Do **not** offer the rhythm layer in Calm-down at all outside the Lab (research: possible harm signal for anger). In the Lab, test it only as "coping plan + beats vs coping plan + sham" (protocol step 8).
6. **Session counts.** The default of 30 pairs gives about 75% power for d = 0.5. The research says about 34 pairs gives 80%. I'll show this in the Lab setup screen rather than change the default.

## Architecture (short)

- **TypeScript + Vite**, no backend. The UI framework is your choice (see decisions).
- **DSP as pure TS functions** (oscillators, raised-cosine AM, breathing envelope, pink/brown noise, true-peak limiter, BS.1770 meter, WAV writer). The same code runs inside AudioWorklets in the browser and in Vitest in Node. That way the unit tests check the exact code that makes the sound, not a copy of it.
- **Real-time and export share one graph builder.** Live playback uses AudioContext and export uses OfflineAudioContext at the source sample rate, rendering to 24-bit WAV.
- **Loudness:** we measure integrated LUFS offline on the rendered or decoded source, set a static gain to reach −20 LUFS, then apply a 4×-oversampled lookahead true-peak limiter at −1 dBTP in a worklet. The browser's built-in DynamicsCompressor is not a true-peak limiter, so we don't use it.
- **Storage:** IndexedDB through a thin wrapper, with CSV export and import. No network calls except loading the app itself.
- **Tests:** Vitest (Node) for DSP and stats. Playwright for screenshots at 390 px and desktop, plus one in-browser render check. `tools/verify_wav.py` checks WAV files (it needs `pip install scipy soundfile pyloudnorm`, which this container doesn't have yet).
- **iOS:** audio starts on a tap. Playback is routed through an `<audio>` element plus Media Session so it survives screen lock better. The UI says plainly that it may still stop, and suggests export for sleep.

## Milestone sizes (rough, honest)

| Milestone | Size | What drives it |
|---|---|---|
| M1 sound core | **Large** (~3–4k lines incl. tests) | limiter + LUFS meter + tests; generative tracks that sound good; safety/L-R screens |
| M2 guided practices | **Medium** (~1.5–2k) | mostly UI and timers; urge flow; nudges need a usage log |
| M3 Experiment Lab | **Large** (~2.5–3k) | locked plans, randomization, PVT timing, stats with known-answer tests |
| M4 the rest | **Large** (~2.5–3k) | binaural + pulse + shams with tests; Sleep/Focus; evidence JSON + pages; PWA; Pages deploy |
| M5 optional | unknown | each item is its own project; decide later |

Expect the generative music to need a round or two of listening feedback from you. I can check it with numbers, but I can't hear it.
