# Build prompt: experimental brain-state self-help app

Paste this into Claude Code from the repo root. The full research is in `docs/RESEARCH.md`. Read it completely before planning anything.

---

## 1. What we are building

A free, open-source web app that runs fully in the browser (a PWA hosted on GitHub Pages). It brings together the best-supported self-help methods for five goals, plus experimental sound methods, in one place:

- **Calm down** (anger, stress)
- **Ride an urge** (cravings, impulses)
- **Relax**
- **Sleep** (wind-down)
- **Focus**

It also has a built-in **Experiment Lab**, so each user (starting with me, the first test subject) can test in a fair, blinded way which parts actually help them.

The idea in one line: **combine the proven parts (breathing, calm music, urge-surfing, movement, sleep habits, low-distraction sound) with the experimental parts (monaural/AM pulses, binaural beats), label every part honestly with its evidence grade, and measure what works.**

This is an experimental wellness tool. It is not a medical device and must never claim to treat anything.

## 2. Ground rules (non-negotiable)

1. **Everything traces to `docs/RESEARCH.md`.** If a feature, number or claim isn't supported there, don't add it. Ask me instead.
2. **Evidence grades everywhere.** Every goal and every layer shows its grade (Strong / Moderate / Weak / No evidence) from the research, with a "Why?" link.
3. **No medical claims.** Banned words in the UI: treat, treatment, cure, therapy, any disorder or disease name, "boosts dopamine", "digital drug", "rewires your brain". Add a test that fails the build if a banned word appears in UI strings.
4. **Experimental layers are off by default** and clearly labeled "Experimental".
5. **Safety before features.** Volume control, no flashing visuals, help links and the first-run safety screen ship in the first usable version.
6. **Data stays on the device.** No server, no accounts, no analytics, no third-party trackers. IndexedDB storage, CSV export and import.
7. **Proven tools come first in each flow.** For anger and urges, the evidence is in breathing and urge-surfing, not beats.

## 3. Features

### 3.1 Sound engine (Web Audio API)
One audio graph with these layers:

- **Music layer:** a built-in library, or a file the user uploads (decoded locally with `decodeAudioData`, never uploaded anywhere).
- **Breathing layer:** a slow, gentle volume swell that follows a breathing pace.
  - Default 6 breaths/min; adjustable 4.5–7. Inhale/exhale ratio adjustable (default exhale longer).
  - Cyclic sighing pattern: two inhales, one long exhale.
  - Visual pacer: a slowly growing and shrinking circle. Smooth only, never flashing.
  - Optional vibration on devices that support it.
- **Rhythm layer (Experimental, off by default):**
  - **Pulse mode (monaural / AM), works on speakers:** raised-cosine amplitude modulation at the target rate, `gain = 1 − m·(0.5 − 0.5·cos 2πft)`, depth m 0–40%, default about 15%. No hard-edged pulses (they click).
  - **Binaural mode, headphones only:** two hard-panned sine carriers at f_c − Δf/2 (left) and f_c + Δf/2 (right). f_c 150–450 Hz (default 200–250 Hz, or a note in the song's key if detected), level −30 to −10 dB relative to the music (default −15 dB). Phase-continuous oscillators.
  - **Sham versions for the Experiment Lab:** binaural sham = identical carriers and level with Δf = 0. Pulse sham = depth 0. The pulse sham is easier to tell apart, so the blinding check (below) is required.
- **Noise layer:** pink and brown noise generators.
- **Loudness:** measure loudness (ITU-R BS.1770), normalize to about −20 LUFS, true-peak limiter at −1 dBTP. All fades smooth; no clicks at starts, stops or loops.
- **Export:** OfflineAudioContext → 24-bit WAV (FLAC later). Match the source sample rate. Blinded exports get neutral random file names.

### 3.2 Guided practices (the proven parts)
- **Paced breathing and cyclic sighing:** 2–5 minute guided sessions.
- **Urge surfing:** a 15-minute timer with short, calm prompts at intervals (notice where you feel it, rate it 0–10, it usually peaks and fades), a "delay plan", and a visible "Talk to someone" button.
- **Calm-down flow (anger):** step-away prompt → 2–5 min breathing → calm music. No "venting" exercises (the research says venting keeps anger going).
- **Movement break:** a 5–10 minute prompt to walk, do stairs or simple movement. Offered in Urge and Focus flows.
- **Short mindfulness prompts:** text first; recorded voice can come later.
- **Sleep wind-down:** a session that fades out over 20–30 minutes and never loops all night by default. A simple sleep-habits checklist and an optional sleep diary (bedtime, wake time, morning rating). Do not call it CBT-I. Suggest professional help for long-lasting sleep problems.
- **Focus blocks:** timed work blocks (e.g. 25 or 50 min) with low-distraction sound (lyric-free music or noise). Optional pulse layer labeled "Experimental, unproven for focus".

### 3.3 Goal flows

| Goal | Flow | Default layers | Badges shown |
|---|---|---|---|
| Calm down | Step away → breathing (2–5 min) → calm music | Music + breathing | Breathing: Moderate–Strong · Music: Moderate · Beats: No evidence |
| Ride an urge | Coping card + help link → urge-surfing timer (15 min) → optional movement | Music or noise + breathing | Urge-surfing/delay: Moderate · Beats: No evidence |
| Relax | Music with breathing swell | Music + breathing | Music: Moderate · Breathing: Moderate–Strong · Beats: Weak |
| Sleep | Wind-down with fade-out + habits checklist | Music or noise, slow breathing | Sleep habits: Strong · Music: Weak–Moderate · Beats: Weak |
| Focus | Timed block with low-distraction sound | Lyric-free music or noise | Low-distraction sound: Moderate · Beats: Weak |

Take the exact grades and wording from `docs/RESEARCH.md`. If the table above and the research disagree, the research wins.

### 3.4 Experiment Lab
Because many parts run together, the Lab tests **one part at a time** while everything else stays the same. Otherwise we can't tell which part helped.

- **Setting up an experiment:** pick a goal and the one thing under test. Examples: rhythm layer vs its sham; breathing guide on vs off; music A vs noise.
- **Locked plan:** before the first session, the user fixes the primary outcome, the number of sessions (default 5 baseline + 30 pairs) and the success rule (default: Active − Control ≥ 1 point on 0–10, 95% CI excludes 0, condition guesses ≤ 60% correct). Save it with a timestamp. It can't be edited once started.
- **Randomization:** balanced blocks of 4 (ABBA/BAAB), seeded, hidden from the user.
- **Each session:** pre-ratings 0–10 (calm, anger, craving, focus, sleepiness) → optional 2-minute reaction-time test (PVT-style) → session → post-ratings → "Which version do you think this was?" → optional side-effects note.
- **No peeking:** results stay hidden until the planned end. Stopping early for safety is always allowed.
- **Analysis:** per-condition means, paired difference with 95% CI, permutation test, blinding-guess accuracy, and a plain-language verdict ("works for you / no clear effect / can't tell, blinding failed").
- **Stop rules** from the research's self-experiment protocol are shown in the Lab and on the session screen.
- **Data:** IndexedDB, CSV export and import.

### 3.5 Safety
- First-run safety screen: who shouldn't use it, never while driving, keep volume low. Short and plain.
- Left/right headphone check ("tap the side you hear") and a mono check (explain that binaural mode doesn't work in mono, on one earbud or on speakers).
- "Comfortable level" calibration with a reference sound; point to the OS volume limiters.
- Default 30-minute timer, 60 minutes max. Sleep sessions fade out.
- Weekly listening log, using a conservative assumed level. Be honest in the UI that the browser can't know the real loudness.
- **No flashing or flickering visuals anywhere.**
- Help links: US 988 and SAMHSA 1-800-662-4357 by default; keep the list in one editable data file so other regions can be added.
- Usage nudges: urge flow used more than about 5 times a week, or the calm-down flow daily for 2+ weeks → gently suggest talking to a professional.
- Disclaimer text from section 7.4 of the research, on the About page and the first-run screen.

### 3.6 Evidence and honesty pages
- An evidence data file (JSON) generated from `docs/RESEARCH.md`, used by the badges and "Why?" pages. Include null and negative results, not just positive ones.
- A Myths page (from the research's "Myths, briefly" section).
- Repo files: `EVIDENCE.md`, `SAFETY.md`, `ATTRIBUTION.md`, `LICENSE` (MIT for code).

### 3.7 Content (music and sounds)
- Only public domain, CC0 or CC BY assets. No NC or ND licenses. Record source, author and license for every file in `ATTRIBUTION.md`.
- First version: our own generative sounds, which have no copyright risk (a slow pentatonic ambient piece at about 60 BPM, a soft drone, pink/brown noise).
- Later: public-domain pieces (Satie, Bach, Chopin, etc.) rendered from MIDI with CC0/CC BY instrument samples, and CC0 nature sounds (rain, ocean, forest). See section 6 of the research for the starter list.
- **Don't download or add any outside audio file without telling me its source and license first.**

## 4. Tech

- TypeScript + Vite, minimal dependencies, no backend.
- UI framework: propose one (vanilla TS, Preact or Svelte) with a one-line reason, and ask me before choosing.
- Web Audio API; AudioWorklet for the pulse and any custom DSP; OfflineAudioContext for export.
- PWA (works offline), IndexedDB for data.
- Deploy to GitHub Pages with a GitHub Actions workflow.
- Mobile-first and touch-first. It must work well on a phone at about 390 px wide. Don't rely on keyboard shortcuts.
- iOS: audio starts only after a tap, and background playback is limited. Handle this and explain it plainly in the UI (suggest export for long sleep sessions).

## 5. Tests and proof

- **Unit tests (Vitest)** for the audio math, on rendered buffers:
  - Binaural: the left/right phase difference rotates at exactly Δf.
  - Sham: identical to active except Δf = 0 (or depth = 0).
  - Pulse: modulation rate and depth are correct.
  - Loudness: within ±1 LU of −20 LUFS; true peak ≤ −1 dBTP.
  - No clicks at fades, loops or start/stop.
  - Breathing swell follows the set breaths per minute.
- **Statistics tests:** analysis functions checked against small datasets with known answers.
- **Banned-word test** on all UI strings.
- **Python check** in `tools/` (numpy, scipy, soundfile, pyloudnorm) that independently verifies exported WAV files.
- **Screenshots (Playwright)** of every screen at phone width (390 px) and desktop width, at each milestone.

## 6. Milestones — stop and show me after each one

- **M0, plan:** read `docs/RESEARCH.md` fully. Write a short plan, list the open decisions you need from me (app name, UI framework, anything unclear), and estimate the size of each milestone. **Wait for my yes before writing code.**
- **M1, sound core:** music + breathing layer + loudness + limiter + WAV export, the Relax flow, first-run safety screen, L/R check, timer, two generative tracks.
- **M2, guided practices:** breathing and cyclic sighing, Calm-down and Urge flows, movement break, help links, usage nudges.
- **M3, Experiment Lab:** locked plans, blinded randomization, ratings, reaction-time test, analysis, CSV.
- **M4, everything else:** rhythm layer (pulse + binaural, off by default), Sleep and Focus flows, evidence and myths pages, PWA, GitHub Pages deploy.
- **M5, optional:** band-limited frequency-shift mode, heart rate/HRV over Web Bluetooth, consumer EEG check. Only after I decide.

At each stop show me: screenshots, test results, any numbers explained plainly, and an honest verdict of what works and what doesn't yet.

## 7. How to work with me

- Honesty first. I want the truth, not approval. Use simple words.
- Put a short summary first, then the details.
- Small fixes: just do them. If something is bigger than a quick fix, tell me how big before starting and let me decide.
- Big changes to anything that already exists (how it works or feels, its design, its defaults) need my yes first.
- If my request is unclear, take the smallest safe step, show me the result, and ask which way to go.
- Show proof as fits: screenshots of the real result, test results, numbers explained plainly, an honest verdict even when it's bad news.
- Ask about my device or setup only when the answer would change what gets built. Don't "improve" something based on a test that doesn't match my real setup.
- When a choice is realism or strictness vs ease of use (for example, how strict the Experiment Lab is), ask me each time.
- Don't work for a long time without showing me something. If I send a message while you're working, stop and answer it first.
- If you make a mistake, say plainly what went wrong, offer to undo it, and let me decide.
- Anything that speaks for me (README voice, my preferences) must come from my own answers, not your guesses.
