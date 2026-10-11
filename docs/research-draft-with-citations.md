# Binaural-Beat Music Tool: What the Science Actually Supports (and How to Build It Honestly)

You can build this tool, and it is low-risk. But the science does not support the core idea that binaural beats reliably "tune" your brainwaves into a chosen state. Any benefit will probably come mostly from the music, a calm session ritual, and expectation. The beat itself has not been shown to add anything that lasts. Build it as an honest, self-testing music-and-breathing tool, not a brainwave machine.

## TL;DR

- **Entrainment is weak and inconsistent.** A 2023 systematic review of 14 EEG studies (Ingendoh et al., PLOS ONE) found the evidence that binaural beats push the brain to their own frequency is inconclusive. A direct EEG test (Orozco Perez et al., 2020, eNeuro) found binaural beats entrain the cortex only weakly, less than monaural beats, with no mood change. Anxiety benefits show up mostly around medical procedures and against weak controls (silence, blank audio). Against music alone, the extra benefit is small and comes mainly from trials linked to a company (LUCID).
- **For each of your goals, something else has better evidence.** For anger and calm: slow breathing and cyclic sighing. For urges: urge-surfing, delay, exercise, and real treatment. For sleep: sleep habits and CBT-I. For focus: quiet, lyric-free sound. Calm music at 60–90 BPM has far more research behind it than binaural beats. For craving and anger there is essentially no beat evidence, and one small study found binaural beats alone *raised* anger.
- **Build it anyway, as a measurement tool.** Make it browser-only, with WAV/FLAC export. Its core feature should be a blinded beat-vs-sham self-experiment. Add evidence grades, a loudness cap, a timer, and treatment links. Expect to need about 30+ paired sessions per goal to tell a real effect from placebo.

---

## One-page summary

**Proven (Strong)**
- EEG measures the synchronized activity of large groups of cortical neurons. Alpha rises when you close your eyes, and sleep stages have distinct EEG signatures.
- Binaural beats are a real brainstem perception. They need low carriers (best around 400–500 Hz, roughly under 1,000 Hz) and small left–right differences (under about 30–35 Hz).\[1\]\[2\]\[3\]\[4\]
- Music interventions lower stress. A meta-analysis of 104 RCTs found d ≈ 0.38 for body measures and d ≈ 0.55 for self-reported stress.\[5\]
- Breathwork lowers stress (g ≈ −0.35 across 12 RCTs).\[6\]
- Loud headphone use damages hearing. The WHO-ITU reference is 80 dB(A) for 40 hours a week for adults.\[7\]

**Promising (Moderate / Weak)**
- Binaural beats reduce anxiety around surgery and dental work, but heterogeneity is extreme and the controls are weak.\[8\]\[9\]
- Theta-beat music beat pink noise for anxiety in two RCTs. Both are linked to LUCID.\[10\]\[11\]\[12\]
- Small, varied lab studies suggest memory and attention gains (g ≈ 0.40).\[13\]
- Small, single-blind trials suggest better sleep quality in older adults.\[14\]

**Unproven (No evidence / Weak)**
- Beats for craving, addiction urges or anger.
- 40 Hz binaural beats for focus.
- "Personalized" or EEG-guided presets.

**Myths**
- "Theta waves release dopamine."
- "Binaural beats are digital drugs."
- "Solfeggio/432 Hz frequencies heal."
- "An EEG headband can read your dopamine."

**Verdict**
1. It is easy to build.
2. For relaxing, it is about as good as calm music. Beyond music, it is unproven for focus and sleep. There is no evidence for urges or anger. For acute calming it is weaker than slow breathing.
3. It is low-risk. The real risks are volume, drowsy driving, occasional discomfort, flicker (if you add visuals), and people using it instead of treatment.
4. To know whether it works for you, run about 30 blinded beat-vs-sham pairs per goal, with the outcome fixed in advance.

**Grading key:** Strong = several good RCTs or meta-analyses with consistent results and decent controls. Moderate = some RCTs or meta-analyses with real limits. Weak = small, few, uncontrolled or non-replicated studies. No evidence = not meaningfully tested. Contradicted = good studies point the other way.

---

## Part 1: How the brain's electrical activity works

### 1.1 Where EEG comes from and its limits

EEG (electroencephalography) records tiny scalp voltages. They come mostly from *postsynaptic currents* (electrical activity at the receiving end of neuron-to-neuron connections) in large, parallel-aligned pyramidal neurons of the cortex. A signal only appears when many thousands to millions of these neurons are active *in sync*. Out-of-step activity cancels out. So EEG measures *synchrony*, not "how hard the brain works."

- **Timing:** excellent (milliseconds).
- **Location:** poor. The skull smears signals over centimeters. "Source localization" is a model, not a direct measurement.
- **Depth:** poor. Scalp EEG barely sees the amygdala, nucleus accumbens, VTA or locus coeruleus, which are the structures that matter for craving and anger.
- **Artifacts are big:**
  - Blinks and eye movements create slow frontal waves (delta/theta).
  - Jaw and neck muscle tension creates broadband "beta/gamma."
  - Sweat creates slow drifts.
  - Mains power adds 50/60 Hz noise.
  - A headband showing "more gamma when focused" may simply be measuring a clenched jaw.

### 1.2 Frequency bands

Band boundaries are conventions and vary by 1–2 Hz between studies. For example, Orozco Perez et al. (2020) used delta 1–4, theta 5–8, alpha 9–12, beta 13–30 and gamma 32–48 Hz.\[4\]

| Band | Typical range | States linked to it in solid studies | Evidence grade |
|---|---|---|---|
| Delta | ~0.5–4 Hz | Deep (N3) sleep; anesthesia. In awake adults it is often eye artifact | **Strong** for sleep |
| Theta | ~4–8 Hz | Drowsiness and N1 sleep; frontal-midline theta with working-memory load; hippocampal theta in memory (mostly from animal and intracranial recordings) | **Strong** for drowsiness and mental load; **Weak** for "creativity/deep meditation" |
| Alpha | ~8–12 Hz | Rises with eyes closed and relaxed wakefulness (Berger, 1929); falls with visual attention; linked to suppressing distractions | **Strong** for eyes-closed and attention; **Moderate** as a "relaxation" marker |
| Beta | ~13–30 Hz | Alert thinking; motor control; increased by benzodiazepines; inconsistently higher in anxiety | **Strong** (motor, drugs); **Weak** (anxiety marker) |
| Gamma | ~30–80+ Hz | Local processing (intracranial recordings); a reliable 40 Hz steady-state response to clicks or flicker; scalp gamma is heavily contaminated by muscle | **Moderate** (intracranial); **Weak** (scalp "focus" claims) |

Other states: there is no single "focus wave", because task engagement usually *lowers* alpha over the regions doing the work (Weak as a target). Meditation often raises alpha and frontal theta, but this depends heavily on style and experience (Moderate, mixed). There is no reliable individual EEG "anxiety signature" (Weak).

### 1.3 Cause or correlation?

Mostly, **brain states produce rhythms**. The rhythm is a by-product of how a network is working, like the hum of an engine.

- **tACS** (weak alternating current through the scalp) drives rhythms directly. A 2023 meta-analysis (Grover et al., *Science Translational Medicine*) covered 102 studies and 2,893 people and found cognitive gains.\[15\] But a 2024 meta-analysis of working memory in healthy adults (Chuderski et al., *Brain Research*; 42 reports, 1,386 people) put the overall effect at Hedges' g = 0.076, and after correcting for publication bias the effect dropped to zero. **Grade:** Moderate that driving rhythms can nudge functions; Weak for meaningful everyday effects.
- **TMS** can briefly reset local rhythms. Its use in depression works through repeated plasticity-changing sessions, not by "installing a frequency."
- **Sensory flicker/clicks at 40 Hz** reliably drive a matching EEG response *during* stimulation. A single-session study (Wu et al., 2025, *Journal of Alzheimer's Disease Reports*) found robust 40 Hz entrainment during 30 minutes of audiovisual stimulation, no 40 Hz rhythm afterwards, and no gains in perception, attention or memory. In Alzheimer's mice, Soula et al. (2023, *Nature Neuroscience*) found 40 Hz light did *not* entrain native gamma or reduce amyloid, which contradicts earlier positive mouse work.\[16\]\[17\]

**Bottom line:** the brain *follows* a strong rhythmic stimulus while it plays. There is little support for producing a *mental state* this way with sound in healthy people.

### 1.4 Individual differences

- **Individual alpha frequency (IAF)** varies between people (about 8–12+ Hz in adults) and slows with age and drowsiness. A fixed "10 Hz alpha" preset fits some people better than others.
- Children have slower rhythms. Older adults have slower alpha and less slow-wave sleep.
- People differ in how well they hear binaural beats, and hearing loss in one ear can abolish them.
- Personalizing would need a real EEG measurement, and there is no good evidence that IAF-matched beats work better.

---

## Part 2: Brain chemistry and your target states

### 2.1 The chemicals in plain words

| Chemical | Plain role | Common misunderstanding |
|---|---|---|
| **Dopamine** | "This matters, go get it": motivation, reward-prediction learning, movement | Not the "pleasure chemical"; it drives *wanting* more than *liking* |
| **Serotonin** | Mood, impulse control, patience, sleep-wake | "Low serotonin = depression" is oversimplified |
| **Norepinephrine** | Alertness and alarm, attention focus | Too much feels like anxiety; too little feels like fog |
| **GABA** | The main "brake"; the target of alcohol and benzodiazepines | Sound has not been shown to "boost GABA" |
| **Glutamate** | The main "accelerator"; learning, plasticity | |
| **Acetylcholine** | Attention, learning, REM sleep, muscle activation | |
| **Endorphins** | The body's opioids: pain relief, some reward | |

### 2.2 Can EEG frequencies read or change these chemicals?

- **Fact:** drugs change the EEG in typical ways (pharmaco-EEG). Benzodiazepines raise beta. Anticholinergics slow the EEG. Ketamine raises gamma. So chemistry shapes rhythm.
- **But** you cannot reverse this and read chemical levels from a rhythm, because many different chemical states look alike on EEG. **Consumer "neurotransmitter readouts": Contradicted.**
- **Sound changing chemical levels:** there are no human studies showing binaural beats change dopamine, serotonin, GABA or endorphins. **No evidence.**
- **Myth: "theta waves release dopamine."** This mixes up theta seen during reward learning (a correlation) with dopamine release. No study shows that externally driven theta causes dopamine release. **Unsupported.**

### 2.3 Neuroscience of the four states

- **Craving and urges:**
  - Repeated drug use sensitizes dopamine-driven "wanting" to drug cues (incentive sensitization, Robinson & Berridge). Wanting can grow even as liking falls.
  - Cues such as places, people, moods and objects trigger urges automatically.
  - Stress hormones (cortisol, CRF) and norepinephrine raise relapse risk.
  - With repetition, control shifts toward habit circuits (dorsal striatum).
  - Urges usually peak and fade within minutes if you don't act on them. This is why urge-surfing, delay and brief exercise help. A sound tool can at most be a *timer and distraction* for that window.
- **Anger and stress:**
  - The amygdala flags threat, and the prefrontal cortex reappraises and brakes.
  - The autonomic nervous system drives the body: the sympathetic "gas" and the parasympathetic/vagal "brake."
  - Lowering arousal works better than high-arousal "venting."
  - HRV (heart rate variability) roughly indexes the vagal brake. Breathing at about 6 breaths per minute raises it short-term.
- **Relaxation:** a parasympathetic shift (slower breathing and heart rate, lower muscle tone). It is easy to bring on with breathing, music and a safe setting.
- **Focus:** depends on moderate arousal (norepinephrine), motivation (dopamine), prefrontal control, sleep and freedom from interruptions. There is no single focus frequency.

### 2.4 Music and brain chemistry

- **Dopamine:**
  - PET imaging (Salimpoor et al., 2011, *Nature Neuroscience*, n = 8) showed striatal dopamine release at peak musical pleasure.
  - Ferreri et al. (2019, *PNAS*, n = 27, double-blind, placebo-controlled) gave participants levodopa, risperidone or placebo. Levodopa (raises dopamine) *increased* musical pleasure and willingness to pay for songs. Risperidone (blocks dopamine) *reduced* both.\[18\]\[19\]\[20\]
  - **Moderate–Strong** that dopamine causally supports pleasure from music you enjoy. This is not about beat frequencies.
- **Stress:**
  - de Witte et al. (2020, *Health Psychology Review*; 104 RCTs, 9,617 participants): physiological stress d ≈ 0.38, psychological stress d ≈ 0.55. Tempos of 60–90 BPM gave larger effects.\[5\]\[21\]
  - A 2022 meta-analysis of pure listening after a lab stressor in healthy people (Adiasto et al., PLOS ONE; 14 studies, N = 706) found a non-significant g = 0.15 (95% CI −0.21 to 0.52).
  - **Moderate:** effects are clearer in medical settings than in healthy people.
- **Endorphins:** limited evidence. **Weak.**

---

## Part 3: Ways to regulate brain states

### 3.1 Non-sound methods and music

| Method | Best use | Typical effect | Grade |
|---|---|---|---|
| **Slow/HRV breathing, cyclic sighing** | Acute calm, stress, anger | Fincham et al. 2023 (12 RCTs, n = 785): stress g = −0.35, anxiety g = −0.32, depression g = −0.40.\[6\] Balban et al. 2023 (*Cell Reports Medicine*, n = 108): 5 min/day of cyclic sighing raised positive mood more than mindfulness; anxiety drops were similar\[22\]\[23\] | **Moderate–Strong** |
| **Mindfulness meditation** | Anxiety, stress, relapse prevention | Small-to-moderate after 8-week programs; single sessions are weaker | **Moderate–Strong** |
| **Exercise** | Mood, anxiety, sleep; acute nicotine craving | Moderate effects on mood; brief exercise cuts cigarette craving short-term | **Strong** (mood), **Moderate** (craving) |
| **Sleep habits / CBT-I** | Insomnia | First-line treatment for chronic insomnia | **Strong** |
| **Reading** | Relaxation | The popular "68% less stress" figure comes from a 2009 commercial study by Mindlab International (Lewis, "Galaxy Stress Research") that was never published in a peer-reviewed journal | **Weak** |
| **Music listening** | Stress, procedure anxiety, pain | d ≈ 0.38–0.55; smaller or null in healthy people after lab stress | **Moderate** |
| **Neurofeedback** | ADHD (the most studied use) | Effects shrink a lot with blinded raters; sham-controlled trials are often null | **Weak** for your goals |

**Music features:**
- **Tempo:** 60–90 BPM, calm and predictable (Moderate).
- **Lyrics:** avoid them during verbal work (Moderate).
- **Preference:** liked music engages reward more, but for relaxation *calm* matters more than *favorite* (Moderate).
- **"Mozart effect":** small, short-lived and explained by arousal (mostly contradicted as an IQ claim).

### 3.2 Sound stimulation

**Definitions**
- **Binaural beat:** a different tone in each ear (e.g., 200 Hz left, 206 Hz right). The brain hears a 6 Hz wobble that exists in neither ear's sound. **Needs headphones.**
- **Monaural beat:** the two tones are mixed in the air, so the beating is physically in the sound wave.
- **Isochronic tone:** a sharply pulsed tone.
- **AM music:** rhythmic loudness modulation of the music.
- Monaural beats, isochronic tones and AM music all work on speakers.
- **40 Hz stimulation:** clicks and/or flicker, studied mainly in Alzheimer's disease.

#### 1) Where binaural beats arise, and their limits
- They arise in the brainstem's **superior olivary complex**, the first place where signals from both ears meet.\[2\]\[3\]\[4\]\[24\] They depend on neurons phase-locking to low-frequency sound, which fades above about 1–1.5 kHz.
- **Carrier limits:** Licklider et al. (1950) and Perrott & Nelson (1969) found beats need carriers below about 1,000 Hz and are **best around 400–500 Hz**.\[1\]\[25\] Some listeners detect them up to about 1,200–1,300 Hz.\[4\]\[26\]
- **Beat-frequency limits:** up to about 20 Hz the beat sounds like a loudness wobble. From about 20 to 30–35 Hz it sounds rough. Above about 30–35 Hz the two tones are heard separately.\[2\]\[3\]
- **Gamma (40 Hz) binaural beats** sit at or beyond the edge of perception.
  - López-Caballero & Escera (2017) used a 57.3 Hz beat as a deliberately imperceptible control and found no EEG change.\[25\]
  - Engelbregt et al. (2021) found better attention with 40 Hz binaural beats but *no entrainment*.\[27\]
  - **"40 Hz binaural beats entrain gamma": Weak / Contradicted.** For 40 Hz, use monaural or isochronic stimulation, though even these have no proven focus benefit in healthy people.

#### 2) Do they entrain EEG?
- **Ingendoh, Posny & Heine (2023, PLOS ONE), 14 studies:** very heterogeneous. Evidence for frequency-specific entrainment was inconclusive. Several studies found no frequency-specific effects, and one found none even for monaural beats.\[3\]\[28\]
- **Orozco Perez, Dumas & Lehmann (2020, eNeuro), single-blind, active-controlled, n = 16:** both beat types produced brainstem responses and entrained the cortex, but **monaural beats did so more strongly**. **Neither changed mood or anxiety.**\[29\]\[30\]\[31\]
- **Gao et al. (2014):** 1, 5, 10 and 20 Hz binaural beats produced no clear entrainment in relative EEG power.\[32\]\[33\]
- **Grades:**
  - "Produces a measurable response during listening": **Moderate.**
  - "Shifts your brain into the target band and state": **Weak.**
  - "Monaural/isochronic beats give a stronger response than binaural": **Moderate.**

#### 3) Effects on outcomes, vs sham and music alone

| Outcome | Best evidence | Control | Result | Grade |
|---|---|---|---|---|
| **Anxiety (procedures)** | Xiong et al. 2025 meta-analysis, *Complementary Therapies in Medicine* (15 RCTs, 1,436 patients); Shukla et al. 2025 dental meta-analysis (9 studies) | Mostly blank audio or nothing; some non-beat music | Anxiety SMD −1.38 vs blank audio, but I² = 91.6%.\[8\] Dental anxiety reduced; dental pain inconclusive vs no intervention\[9\] | **Moderate** vs silence; **Weak** that the beat matters |
| **Anxiety (everyday)** | Mallik & Russo 2022, PLOS ONE (n = 163 adults taking anti-anxiety medication; open-label; online; one 24-min session; 4 arms). Mullen et al. 2026, PLOS Mental Health (n = 144; replication and dose) | Pink noise; music-only arm (2022) | 2022: in the moderate-trait-anxiety subgroup, music+theta beats cut cognitive anxiety more than music alone, beats alone or pink noise; arms were not well separated in high-trait-anxiety participants.\[11\] 2026: music+beats beat pink noise (cognitive anxiety −5.79 vs −0.72); 24 min looked best\[10\]\[34\] | **Moderate** vs pink noise, **Weak** vs music. **⚠ Company-linked:** LUCID supplied the music; Russo is LUCID's Chief Science Officer; Mallik worked there\[12\]\[35\] |
| **Stress (personal use)** | Platt 2024 systematic review of 12 RCTs (*Advances in Mental Health*) | Varied | 8 found at least one significant effect, 4 found none; too varied to pool,\[36\] with unclear randomization and blinding | **Weak–Moderate** |
| **Memory/attention** | Garcia-Argibay et al. 2019 (22 studies, 35 effect sizes); Basu & Banerjee 2023 (15 studies, g = 0.40)\[13\]\[37\] | Often white noise, silence or another frequency | Positive on average; small studies, inconsistent replication, some null or negative results | **Weak–Moderate** |
| **Pain** | Garcia-Argibay 2019; perioperative meta-analyses | Silence/blank | Reductions mostly around procedures | **Weak–Moderate** |
| **Sleep** | Lin et al. 2024 RCT (older adults in long-term care, n = 64, 14 days, single-blind); 0.25 Hz beats shortened time to slow-wave sleep in naps (*Scientific Reports* 2024); 2026 young-adult review (SMD 0.3–0.6, pooled across music, beat and audiovisual studies)\[14\]\[38\]\[39\] | Usually no music or usual care | Better sleep-quality scores; how much the beat itself contributes is unclear | **Weak** |
| **Anger** | No targeted trials. Lee et al. 2019 (*Frontiers in Human Neuroscience*, ~15 people): **anger rose significantly with binaural beats alone**, but fell with beats+ASMR. Jirakittayakorn & Wongsawat 2017 (n = 28, 6 Hz) reportedly found more anger and less calm\[40\] | Sham | Possible harm signal | **No evidence of benefit** |
| **Craving/addiction** | Asimakopoulos 2020 MA thesis (not peer-reviewed), double-blind pilot in a Greek rehab center: theta beats + pink noise vs pink noise during music therapy; **craving stayed stable in both groups**, anxiety and distress improved.\[41\]\[42\] Yari Oskouei & Mansouriyeh 2024 (*Addiction & Health*, n = 30 opioid-dependent outpatients, 7.5 Hz): depression and anxiety improved; craving not measured.\[43\] Prithiviraj et al. 2026 (*Indian J Psychol Med*, n = 100, alcohol withdrawal, one 10-min session, **no control**): anxiety fell only in severe withdrawal, which the authors accept may be its natural course.\[44\]\[45\] Mousavi et al. 2024 (*Healthcare*, n = 45, compulsive sexual behavior): beats ≈ cognitive rehabilitation, both better than control\[46\] | Pink noise / unclear / none | **No trial shows beats reduce substance craving** | **No evidence** |

**"Digital drugs":** Barratt et al. (2022, *Drug and Alcohol Review*) analyzed 30,896 Global Drug Survey responses from 22 countries. 5.3% had used binaural beats for altered states: 72.2% to relax or sleep, and 11.7% to mimic drug effects.\[47\] The survey reports no adverse-event data. It shows how the product is marketed and used, not that it works.

#### 4) Dose
- **Length:** most positive studies used 10–30 minutes, and the LUCID-linked dose study found 24 minutes best.\[34\]\[48\] Exposure time and timing (before or during a task or procedure) moderated effects (Garcia-Argibay 2019).\[49\]
- **Number of sessions:** usually one; sleep studies used daily sessions for 2–4 weeks.
- **Playback:** binaural beats **require headphones**. Through speakers the two channels mix and you get partial, position-dependent monaural beating.
- **Volume:** low to moderate is enough, and masking noise was not needed.\[49\]

#### 5) Best-supported method per goal

| Goal | Best-supported method | Beat frequency used in studies | Grade (best method / beats) | Realistic expected effect |
|---|---|---|---|---|
| **Anger / calm** | Slow breathing (~6/min) or cyclic sighing for 2–5 min; step away from the trigger; then calm music | Theta 4–7 Hz (anxiety studies); none for anger | Moderate–Strong / **No evidence** (possible harm) | Breathing lowers arousal within minutes; assume beats add nothing |
| **Urge** | Urge-surfing or a 10–20 min delay; brief exercise; contact support; treatment | None tested | Moderate / **No evidence** | The tool works as timer + distraction + prompts only |
| **Relax** | Calm, liked instrumental music at 60–90 BPM; slow breathing | Theta 4–7 Hz; alpha ~10 Hz | Moderate / Weak–Moderate vs pink noise, Weak vs music | Small-to-moderate drop in stress, mostly from the music |
| **Sleep** | Sleep habits, CBT-I; bedtime music | Delta 0.25–4 Hz; theta | Strong / Weak | Modest sleep-quality gains from music over weeks; beats unproven |
| **Focus** | Low-distraction instrumental music or noise; good sleep; time blocks | Beta 14–20 Hz; 40 Hz gamma | Moderate / Weak | Less distraction helps; 40 Hz binaural "focus" is unproven and probably not even perceived |

---

## Part 4: Safety

### 4.1 Risks

| Risk | What is known | Grade |
|---|---|---|
| **Hearing damage** | The **main real risk**. WHO-ITU H.870 reference: 80 dB(A) for 40 h/week for adults (75 dB for children); every +3 dB halves the safe time\[7\] | **Strong** |
| **Seizures from sound** | No good evidence that beats trigger seizures | **Weak** (lack of data) |
| **Seizures from flicker** | Flicker, especially around 15–25 Hz, can trigger photosensitive epilepsy | **Strong** |
| **Headache, dizziness, nausea, discomfort** | Reported occasionally, including discomfort that hinders focus\[50\] | **Weak** |
| **More anxiety or anger** | Anger rose with beats alone in one small study\[40\] | **Weak** |
| **Dissociation / "altered states"** | Marketed as digital drugs; no adverse-event data | **No evidence** |
| **Sleepiness** | Sleep presets are designed to make you drowsy; dangerous when driving | **Strong** (drowsy driving) |
| **Opportunity cost** | Using it instead of treatment | The biggest harm across all users |

### 4.2 Who should not use it, or should ask first
- **No flicker mode** for anyone with epilepsy, photosensitivity, or migraine with aura. Best to not ship flicker at all.
- **Ask a clinician first:** epilepsy; severe tinnitus, hyperacusis or hearing loss in one ear; psychosis, dissociative disorders, or PTSD with dissociation; anyone under 18.
- **Never** use it while driving, cycling, operating machinery, or anywhere you need to hear alarms.
- **Acute crisis** (suicidal thoughts, severe withdrawal, violent urges) needs human help. Alcohol or benzodiazepine withdrawal can be medically dangerous.

### 4.3 Designing against "instead of treatment"
- Never use the words treatment, therapy or cure, and never name a disorder.
- The urge and anger presets open with a card: "This is a coping timer, not treatment." It includes a crisis line chosen by region (e.g., US 988; SAMHSA 1-800-662-4357) and a "Talk to someone" button.
- **On-device nudge:** if the urge preset is used more than about 5 times a week, or the anger preset daily for 2+ weeks, suggest professional help.
- **Bundle the proven tools:** calm and anger sessions start with 1–2 minutes of paced breathing; urge sessions include urge-surfing prompts and a 15-minute delay plan.

### 4.4 Enforcing safe listening in software
- Weekly allowance: 80 dB(A) for 40 h, 83 dB for 20 h, 86 dB for 10 h, 89 dB for 5 h.\[51\]
- **Be honest that a browser can't know your real loudness (dB SPL).** It depends on the headphones and the device volume.
- **What the software can do:**
  1. Normalize output to about −20 LUFS (loudness standard ITU-R BS.1770 / EBU R128) and apply a **true-peak limiter at −1 dBTP**.
  2. Keep the beat carriers 12–20 dB below the music.
  3. Run a "comfortable level" calibration with a reference sound.
  4. Default to a 30-minute timer (60 minutes max) and keep a weekly listening log at a conservative assumed level.
  5. Point users to the OS limiters (iOS "Reduce Loud Audio", Android volume limiters).
  6. In sleep mode, fade out after 20–30 minutes and never loop all night by default.

---

## Part 5: Technical plan for turning any music into binaural-beat audio

### 5.1 Approaches rated

| Approach | How | (a) Likely brain effect | (b) Music quality | Verdict |
|---|---|---|---|---|
| **1. Carrier tones under the music** | Sine at f_c − Δf/2 in the left ear and f_c + Δf/2 in the right, f_c ≈ 150–450 Hz, 12–20 dB below the music | **Best match to the studies** | Good if quiet; tune f_c to the song's key to avoid clashes | **Default.** Easy sham (Δf = 0) |
| **2. Shift one whole channel by Δf (SSB/Hilbert)** | Analytic signal × e^(j2πΔf t), real part, right channel only | Beats only appear from content below ~1–1.5 kHz; changing content gives a weaker, messier beat; **untested** | Stereo image wobbles; harsh phasing in mono; slightly inharmonic | Skip, or hide behind a developer flag |
| **3. Shift one band only (e.g., 100–600 Hz)** | Matched crossovers, shift that band in one channel, recombine | Targets the range where binaural beats work; untested | Better than #2; low-mids wobble; crossover phase can smear transients | v2 "experimental" |
| **4. AM / isochronic on the music** | Multiply by 1 − m·(0.5 − 0.5·cos 2πft), m = 10–50% | **Stronger EEG following** than binaural (Orozco Perez 2020);\[31\] works on speakers | Audible tremolo; subtle below m = 20%; can irritate | **Second MVP mode** ("speaker-safe"); avoid hard-edged pulses (clicks) |

### 5.2 Phase, stereo and delivery
- **Mono playback** (one earbud, phone speaker, the accessibility "mono audio" setting, some Bluetooth speakers) sums left and right. The binaural beat disappears and becomes an audible monaural wobble, and modes #2 and #3 produce phasing. Add an L/R check and a mono test, and tell users plainly.
- **MP3/AAC joint stereo:** mid/side coding is lossless, but low-bitrate *intensity stereo* and HE-AAC v2 *parametric stereo* throw away fine left/right phase. **Export WAV/FLAC.** If lossy is unavoidable, use AAC-LC or Opus at ≥192 kbps, then decode and verify.
- **Bluetooth:** codecs usually keep low-frequency phase. Call mode and the "mono audio" setting downmix. Use wired headphones for experiments.
- **Phase:** keep oscillators phase-continuous. In #3, use identical filters on both channels.
- **Loudness:** measure BS.1770 loudness, normalize to about −20 LUFS, then apply a true-peak limiter.
- **Sample rate and bit depth:** match the source (44.1/48 kHz) by setting `sampleRate` in OfflineAudioContext. Render in 32-bit float and export 24-bit (or 16-bit with dither).

### 5.3 Recommended stack
**Browser-only on GitHub Pages (recommended):**
- `decodeAudioData` for MP3/AAC/WAV/FLAC/OGG. Files never leave the device.
- **Preview graph:** two `OscillatorNode`s hard-panned via `ChannelMergerNode`, plus the music `AudioBufferSourceNode` → `GainNode` → limiter.
- **AudioWorklet** (custom DSP on the audio thread) for the AM and Hilbert modes. Use an FIR Hilbert filter (255–1023 taps) or WASM FFT block processing.
- **Export:** `OfflineAudioContext` renders the same graph faster than real time → WAV (plain JS) or FLAC (WASM libflac).
- **Storage:** IndexedDB, CSV export, PWA for offline use.
- **iOS:** audio needs a user tap to start and is suspended in the background. Use the Media Session API, or suggest exporting a file for sleep sessions.

**Python (validation and batch work):** numpy/scipy (`hilbert`, `firwin`, `sosfiltfilt`), soundfile, pyloudnorm, librosa (key/tempo to choose the carrier), MNE-Python (EEG). Use it to check that the interaural phase difference rotates at Δf after encoding.

**Real-time vs pre-rendered:** real-time is good for preview and makes blinding easy. Pre-rendered is best for reliability and sleep use; give the files neutral random names. Do both.

### 5.4 Open-source projects

| Project | License | Strengths | Weaknesses |
|---|---|---|---|
| **SBaGen** (Jim Peters) | GPL-2.0 | Classic sequence format; mixes in a music track; tiny | Unmaintained (forks exist, e.g., SBaGenX); C command line; GPL is viral\[52\]\[53\] |
| **Gnaural** (Bret Logan) | GPL-2.0-or-later | Graphical beat schedules; audio export | Last stable release 2011; desktop only\[54\]\[55\] |
| **I-Doser** | Proprietary (based on SBaGen's format) | A lesson in how *not* to market ("doses" named after drugs) | Closed source; unsupported claims\[56\] |
| Small Web Audio generators on GitHub | Varies (often MIT) | Show OscillatorNode basics | Tones only; no music, blinding or loudness control |

To license your project MIT/Apache, learn from the ideas and file formats and write your own code. Copying GPL code makes your project GPL.

---

## Part 6: Music and sounds without copyright problems

### 6.1 Two copyrights
The **composition** (notes) by Bach, Satie, Chopin or early Debussy is public domain. In the US, works published before 1931 are public domain as of 2026. The **recording** has its own copyright, so a modern recording of a Bach suite is not free to use. Modern sheet-music editions can also carry rights; IMSLP marks the status of each file.

### 6.2 Licenses and sources
- **CC0 / public domain:** use freely.
- **CC BY:** credit the author (keep an ATTRIBUTION.md).
- **CC BY-SA:** modified audio must stay CC BY-SA.
- **Avoid CC BY-NC** (it blocks forks and is murky).
- **Avoid CC BY-ND** (adding beats is a modification).
- **Sources** (check every file):
  - Musopen (public-domain classical recordings).
  - Kimiko Ishizaka's *Open Goldberg Variations* and *Open Well-Tempered Clavier* (public domain).
  - Wikimedia Commons.
  - Free Music Archive / ccMixter / Jamendo (filter out NC and ND).
  - Freesound (rain, ocean, forest; filter to CC0/CC BY).

### 6.3 Making your own
- **MIDI of public-domain scores** plus free samples, for example: Salamander Grand Piano (CC BY), VSCO 2 Community Edition (CC0), FluidR3_GM (MIT). Render in the browser with a SoundFont/WASM synth.
- **Generative ambient code:** you own the code and its output, and you can tune the drone to the carrier so the beat blends in. This is the cleanest legal route.
- **AI-generated music:** the US Copyright Office's Part 2 report (January 2025) says prompt-only outputs are not copyrightable, though human arrangement or modification can be.\[57\]\[58\] Tool terms of service and training-data lawsuits add risk. Prefer your own code or CC0 material.

### 6.4 Features and starter library
- **Relaxation:** 60–90 BPM or no pulse, instrumental, predictable, quiet, simple.
- **Focus:** steady, low-surprise, no lyrics, not *too* engaging.

| # | Piece / sound | Goal | Source |
|---|---|---|---|
| 1 | Bach, Goldberg Aria | Relax, sleep | Ishizaka (PD) |
| 2 | Bach, WTC I Prelude in C | Focus | Ishizaka (PD) |
| 3 | Satie, Gymnopédie No. 1 | Relax, sleep | Musopen or MIDI + Salamander |
| 4 | Debussy, Clair de lune | Relax | Musopen/MIDI |
| 5 | Chopin, Nocturne Op. 9 No. 2 | Wind-down | Musopen/MIDI |
| 6 | Bach, Cello Suite No. 1 Prelude | Focus | MIDI + VSCO 2 CE |
| 7 | Pachelbel, Canon in D (strings) | Calm after anger | MIDI/Musopen |
| 8 | Sor/Carcassi guitar études | Relax, focus | Self-rendered |
| 9 | Generative drone in the carrier key | Sleep, urge timer | Own code |
| 10 | Generative pentatonic ambient at ~60 BPM | Relax, anger | Own code |
| 11 | Steady rain | Sleep, focus | Freesound CC0 |
| 12 | Ocean waves (6–10 s cycle) | Breath-paced calm | Freesound CC0/BY |
| 13 | Forest/stream | Focus, relax | Freesound CC0 |
| 14 | Pink/brown noise | Focus masking, sham | Own code |

---

## Part 7: Product plan

### 7.1 Interface (mobile-first)
1. **First run:** safety screen → L/R check ("tap the side you hear") → mono check → set a comfortable volume.
2. **Home:** five goal cards (Calm Down, Ride an Urge, Relax, Sleep, Focus), each with an **evidence badge** (e.g., "Beats: No evidence · Breathing: Moderate").
3. **Sound:** the built-in library, or upload a file (it stays on the device).
4. **Strength:** one slider. Mode toggle: Headphones (binaural) / Speakers (gentle AM).
5. **Session:** play, timer, a non-flashing breathing circle, fade-out.
6. **Export:** WAV/FLAC with neutral file names.

### 7.2 Honest labeling
Each preset shows a grade chip and a "Why?" page with studies, including null results. Example wording: "May help you relax; in studies most of the effect comes from the music." Banned words: treat, cure, therapy, any disorder name, "boosts dopamine," "digital drug."

### 7.3 Self-experiment mode
- **Design:** randomized N-of-1 crossover. **Active** (Δf = target) vs **Sham** (Δf = 0: same carriers, music and level), in balanced blocks of 4 (ABBA/BAAB).
- **Blinding check:** a 4–10 Hz wobble can be faintly audible, so after each session ask, "Which was this?"
- **Measures:**
  - Before/after 0–10 sliders: calm, anger, craving, focus, sleepiness.
  - A 2-minute PVT-style reaction-time test.
  - Optional digit span.
- **Optional sensors:** heart rate/HRV via Web Bluetooth (Chrome/Android only, not iOS Safari). Muse/OpenBCI EEG via Web Bluetooth or Lab Streaming Layer; treat it as exploratory because of artifacts.
- **Data:** IndexedDB on the device and CSV export, with no analytics. The built-in analysis gives per-condition means, a paired difference with a CI, a permutation test, and blinding-guess accuracy.

### 7.4 Legal and regulatory
- **US:** FDA's *General Wellness: Policy for Low Risk Devices* (revised January 6, 2026) does not regulate products intended **only** for general wellness that are **low risk**.\[59\]\[60\]
  - Wellness-style claims are fine: "helps you relax," "manage everyday stress," "a calm bedtime routine," "helps you focus."
  - Claims about a disease or condition (anxiety disorder, insomnia, addiction, ADHD) move you toward device territory.
  - Being covered by the policy does not mean FDA has judged the product safe or effective.\[61\]
  - The FTC expects health claims to be backed by competent and reliable scientific evidence.
- **"Ride an urge":** frame it as a general 15-minute coping pause. Do not claim it reduces craving or aids recovery, and link to treatment.
- **EU:** under the MDR (EU 2017/745), software with a medical intended purpose is a medical device, usually class IIa or higher under Rule 11. Keep the intended purpose non-medical. GDPR largely doesn't apply if data never leaves the device; say so clearly.
- **Disclaimer:** "This is a free, experimental wellness and music tool. It is not a medical device and does not diagnose, treat, cure or prevent any condition. Evidence for binaural beats is limited and mixed. Do not use while driving or when you need to stay alert. Keep the volume low. If you have epilepsy, hearing problems, or a mental-health or substance-use condition, talk to a professional. In a crisis, contact emergency services or a crisis line."
- **Licenses:** MIT/Apache-2.0 for code; CC0/CC BY for audio, with attributions.

### 7.5 Roadmap

| Stage | Features | Difficulty |
|---|---|---|
| **MVP (2–4 weekends)** | Upload/decode; carrier tones (#1) + gentle AM (#4); presets with grades; L/R + mono check; LUFS normalization + limiter; timer; WAV export; safety screen; PWA | Low–Medium |
| **v1 (1–2 months)** | Blinded active/sham mode; ratings; reaction-time test; IndexedDB/CSV; analysis screen; breathing pacer; generative + CC0 library; FLAC; crisis links; usage nudges | Medium |
| **v2 (2–4 months)** | Band-limited Hilbert mode (#3, experimental); Web Bluetooth HR/HRV; Muse/OpenBCI check for an EEG peak at Δf; Python validation; opt-in anonymous data donation | High |

---

## Part 8: Honest verdict

### 8.1 Technically possible?
**Yes.** It is standard Web Audio work. The hard parts are mobile background playback, correct loudness metering, and the band-limited Hilbert mode.

### 8.2 Effectiveness per goal

| Goal | vs music alone | vs slow breathing | vs meditation | Honest expectation |
|---|---|---|---|---|
| Anger | ≈ same; possible irritation | **Worse** | Worse in the moment | Breathe first; sound as a backdrop |
| Urge | Unknown; probably ≈ music | Worse than urge-surfing + breathing | Worse than mindfulness-based relapse prevention | Timer and distraction only |
| Relax | Maybe slightly better (LUCID-linked subgroup result) | Similar or worse | Similar short-term | Small-to-moderate stress drop, mostly from the music |
| Sleep | Unknown | n/a | n/a | Habits and CBT-I matter far more |
| Focus | Unknown; beats may distract | n/a | Attention training helps long-term | Low-distraction sound helps; beats unproven |

### 8.3 Dangerous?
Not for most healthy adults, **if volume is controlled and it is never used while driving**. Higher-risk groups: photosensitive epilepsy (if there is any flicker), hearing loss or tinnitus, psychosis or dissociation, acute withdrawal or crisis, and anyone using it in place of treatment.

### 8.4 "It works for me" vs "it doesn't"
- **Pick one primary outcome per goal in advance.** Examples: post-minus-pre calm (0–10) for Relax, median reaction time for Focus, a morning sleep rating for Sleep.
- **It works for you if** Active − Sham is **≥ 1 point on 0–10** (or ≥ 0.5 of your own session-to-session SD), **and** the 95% CI excludes zero (or permutation p < 0.05), **and** your condition guesses were ≤ 60% correct. If you could tell the conditions apart, expectation may explain the result.
- **It doesn't work if** the difference is near zero, or the CI includes zero, at the planned end. That is a useful result: keep the music and breathing, and drop the beat.
- **How many sessions:**
  - A paired comparison needs about 34 pairs for 80% power to detect d = 0.5 (α = 0.05).
  - About 15 pairs only detects a large effect (d = 0.8).
  - **Plan 30–40 sessions per condition per goal.** Test one goal at a time, and don't look at results before the planned end.

### 8.5 Biggest failure modes and fixes

| Failure | Fix |
|---|---|
| Placebo mistaken for a beat effect | Blinded sham with the same music; blinding check; outcome fixed in advance |
| Overclaiming | Grade chips, banned words, a myths page |
| Hearing damage | LUFS normalization, limiter, timer, weekly log, sleep fade-out |
| Replacing treatment | Coping-timer framing, crisis links, nudges, proven tools built in |
| Beats lost to mono, Bluetooth or MP3 | L/R and mono checks; lossless export; Python verification |
| Copyright takedowns | Only PD/CC0/CC BY assets; ATTRIBUTION.md |
| Self-experiment bias | Outcome and sample size locked in the app; results shown only at the end |
| Drowsy driving | Warning on the sleep preset |

---

## Myths, briefly
- **"Theta waves release dopamine":** there is no human evidence that driving theta causes dopamine release. It mixes up correlation with chemistry. **Unsupported.**
- **"Digital drugs":** no study shows drug-like effects. Some people still seek them (11.7% of beat users in a 30,896-response survey).\[47\] **Myth.**
- **"Your brain locks onto any frequency":** binaural entrainment is weak and inconsistent. **Largely contradicted.**
- **"40 Hz binaural beats boost focus":** at or beyond the edge of perception, with no entrainment and no replicated benefit. **Unsupported.**
- **"Alpha = relaxed, beta = stressed":** alpha also rises during internal effort, and beta reflects motor activity and drugs. **Oversimplified.**
- **"EEG headbands read neurotransmitters":** they can't. **Contradicted.**
- **"432/528 Hz Solfeggio frequencies heal":** no credible evidence. **Myth.**
- **"Venting anger gets it out":** high-arousal venting tends to keep anger going. **Contradicted.**

---

## Recommendations

### Build plan (step by step)
1. Repo: MIT license, `/docs` for GitHub Pages, `ATTRIBUTION.md`, `EVIDENCE.md` (the grades table, including null results), `SAFETY.md`.
2. Audio core (TypeScript): decode → music + two hard-panned oscillators (f_c ± Δf/2) → gain → limiter.
3. Carrier: default f_c = 200–250 Hz, or pick a note in the song's key between 150 and 450 Hz. Beat level −15 dB relative to the music (slider −30 to −10 dB).
4. AM mode: an AudioWorklet applying a raised-cosine envelope at Δf, depth 0–40%.
5. Loudness: BS.1770 → −20 LUFS → true-peak limiter at −1 dBTP.
6. Safety UX: first-run screen, L/R and mono test, volume calibration, 30-minute timer, sleep fade-out, weekly log.
7. Presets:
   - Calm: theta 6 Hz + breathing pacer at 5.5–6 breaths/min.
   - Urge: 15-minute timer + urge-surfing prompts + helpline.
   - Relax: theta 6 Hz or alpha 10 Hz.
   - Sleep: delta 2 Hz with a 20–30 min fade.
   - Focus: 14–16 Hz or no beat + noise, labeled "unproven."
8. Export: OfflineAudioContext → 24-bit WAV → optional FLAC (WASM).
9. Self-experiment mode: block randomization, Δf = 0 sham, ratings, reaction-time test, blinding guess, IndexedDB/CSV, permutation test.
10. Validation: a Python script that checks the interaural phase rotates at Δf, checks LUFS and true peak, and checks that the beat survives AAC/Opus at your bitrate.
11. Content: a CC0/CC BY library plus a generative ambient module tuned to f_c.
12. Release: PWA, offline, no tracking, and a "what we know and don't" page that includes null results.
13. v2: band-limited Hilbert mode, Web Bluetooth HR/HRV, a Muse/OpenBCI steady-state check.

### Self-experiment protocol (step by step)
1. Screen yourself against Part 4.2. Use wired headphones at a quiet level.
2. Start with one goal (Relax is easiest). Write down the primary outcome and the success rule (Active − Sham ≥ 1 point, 95% CI excluding 0, guesses ≤ 60% correct). Lock both in the app or on a dated note (e.g., OSF).
3. Baseline: 5 music-only sessions, to learn your normal variation.
4. Main phase: 60 sessions (30 Active, 30 Sham) in randomized blocks of 4. Same time of day, same music pool, same volume, 24 minutes each, at most 1–2 a day.
5. Each session:
   - Rate yourself before (and run the reaction-time test for Focus).
   - Listen without multitasking.
   - Rate yourself after, guess the condition, and note any side effects.
6. **Stop for the day** if you get a headache, dizziness, nausea, ringing or muffled hearing, rising panic or anger, or feel detached.
7. **Stop the study and get help** if you have a seizure-like event, tinnitus lasting more than 24 hours, mood getting worse over a week, more craving or use, or you notice you are replacing treatment.
8. For urge and anger goals, compare "your coping plan + beats" against "your coping plan + sham." Never test beats *instead of* your plan.
9. Don't peek. At the end, run the permutation test, check your blinding guesses, and apply your pre-set rule.
10. If Active ≈ Sham, keep what helps (music, breathing, the ritual) and drop the beat claim. If Active > Sham with good blinding, confirm it with a second 30+30 block before believing it.
11. Publish the anonymized CSV and the protocol in your repo. A documented null result is valuable.

---

## Caveats
- **Company links:** the strongest "beats + music beat pink noise" trials (Mallik & Russo 2022; Mullen et al. 2026) involve LUCID, which supplied the music. Russo is its Chief Science Officer, and Mallik worked there. The 2022 trial was open-label and run online with people taking anti-anxiety medication.\[11\]\[12\]\[35\]
- **Weak controls:** the large perioperative effect (SMD −1.38) is mostly versus blank audio, with I² ≈ 92%.\[8\] That shows sound helps in medical stress, not that the beat is special.
- **Craving evidence** comes mostly from a master's thesis, single-group studies and small non-English studies. Some sample sizes and statistics come from abstracts only.
- **The anger "harm" signal** comes from small studies (~15 and 28 people). The Jirakittayakorn & Wongsawat finding is reported as cited by another paper;\[40\] I did not check the original.
- **40 Hz Alzheimer's work** (MIT/Cognito; HOPE phase 3, 670 participants) is company-linked and medical. Its long-term human data so far come from a five-person open-label extension.\[16\]\[62\]\[63\] Do not extrapolate it to focus in healthy people.
- **Regulation** varies by country and changes. This is not legal advice. Get a review before making any disease-related claim or collecting data centrally.
- **Effect sizes for meditation, exercise and neurofeedback** are general summaries. Check the specific review before quoting exact numbers in the app.

## Sources

1. [https://www.frontiersin.org/journals/neuroscience/articles/ ...](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00365/xml/nlm)
2. [pmc.ncbi.nlm.nih.gov](https://pmc.ncbi.nlm.nih.gov/articles/PMC10198548)
3. [Binaural beats to entrain the brain? A systematic review of ...](https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0286023&type=printable)
4. [Cognition and Behavior Binaural Beats through the Auditory Pathway: From](https://www.eneuro.org/content/eneuro/7/2/ENEURO.0232-19.2020.full.pdf)
5. [How Music Reduces Stress and Improves Mental Health](https://www.harmonyandhealing.org/how-music-can-reduce-stress/)
6. [Effect of breathwork on stress and mental health: A meta-analysis of randomised-controlled trials - Scientific Reports](https://www.nature.com/articles/s41598-022-27247-y)
7. [Headphone Volume Safety Calculator: How Long Is Safe?](https://hearingbuddyapp.com/headphone-volume-safety)
8. [Binaural beats for perioperative anxiety and pain: A systematic review and meta-analysis - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S096522992500175X)
9. [Effectiveness of Binaural Beats in Reducing Dental Pain and Anxiety among Children and Adults: A Systematic Review and Meta-analysis - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12451561/)
10. [Digital music-based therapy ameliorates impact of anxiety](https://www.healio.com/news/psychiatry/20260212/digital-musicbased-therapy-ameliorates-impact-of-anxiety)
11. [The effects of music & auditory beat stimulation on anxiety: A randomized clinical trial](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0259312)
12. [Investigating the dose-response relationship between music and anxiety reduction: A randomized clinical trial](https://journals.plos.org/mentalhealth/article?id=10.1371%2Fjournal.pmen.0000355)
13. [Potential of binaural beats intervention for improving memory and attention: insights from meta-analysis and systematic review](https://link.springer.com/article/10.1007/s00426-022-01706-7)
14. [Examining the effects of binaural beat music on sleep quality, heart rate variability, and depression in older people with poor sleep quality in a long-term care institution: A randomized controlled trial - PubMed](https://pubmed.ncbi.nlm.nih.gov/38319068/)
15. [A meta-analysis suggests that tACS improves cognition in healthy, aging, and psychiatric populations](https://www.science.org/doi/10.1126/scitranslmed.abo2044)
16. [Gamma40](https://gamma40.health/)
17. [s12264 023 01165 z](https://link.springer.com/10.1007/s12264-023-01165-z)
18. [Dopamine modulates reward experiences elicited by music](https://www.sciencedaily.com/releases/2019/01/190124110958.htm)
19. [Dopamine modulates the reward experiences elicited by music - NYU Scholars](https://nyuscholars.nyu.edu/en/publications/dopamine-modulates-the-reward-experiences-elicited-by-music)
20. [Dopamine modulates the reward experiences elicited by music](https://www.pnas.org/doi/10.1073/pnas.1811878116)
21. [Full article: Music therapy for stress reduction: a systematic review and meta-analysis](https://www.tandfonline.com/doi/full/10.1080/17437199.2020.1846580)
22. [Cyclic Sighing & the Physiological Sigh — Apnea Trainer](https://www.apnea-trainer.com/blog/cyclic-sighing-physiological-sigh/)
23. [Cyclic Sighing: The Breathing Technique Your Body Already Runs](https://brizzy.app/en/library/cyclic-sighing)
24. [System and method for inducing sleep by transplanting mental states](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12661480)
25. [Frontiersin](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2017.00557/xml)
26. [(PDF) A Psychoacoustical Evaluation of the Frequency Influence on the Human Binaural-Beat Perception](https://www.researchgate.net/publication/319647050_A_Psychoacoustical_Evaluation_of_the_Frequency_Influence_on_the_Human_Binaural-Beat_Perception)
27. [(PDF) Binaural beats to entrain the brain? A systematic review of the effects of binaural beat stimulation on brain oscillatory activity, and the implications for psychological research and intervention](https://www.researchgate.net/publication/370900678_Binaural_beats_to_entrain_the_brain_A_systematic_review_of_the_effects_of_binaural_beat_stimulation_on_brain_oscillatory_activity_and_the_implications_for_psychological_research_and_intervention)
28. [Binaural beats to entrain the brain? A systematic review of the effects of binaural beat stimulation on brain oscillatory activity, and the implications for psychological research and intervention](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10198548/)
29. [The Science Behind Binaural Beats: Can Sound Ease Anxiety and Boost Your Brain?](https://www.lakeforest.edu/academics/student-honors-and-research/student-publications/eukaryon/the-science-behind-binaural-beats-can-sound-ease-anxiety-and-boost-your-brain)
30. [Binaural Beats through the Auditory Pathway: From Brainstem to Connectivity Patterns — Lacuna](https://lacuna.tiptreesystems.com/work/binaural-beats-through-the-auditory-pathway-from-brainstem-to-connectivity/wrk_ab5c0ec60364c731b197148dd1f74274)
31. [pmc.ncbi.nlm.nih.gov](https://pmc.ncbi.nlm.nih.gov/articles/PMC7082494)
32. [Auditory beat stimulation and its effects on cognition and ...](https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2015.00070/pdf)
33. [Effects of binaural and monaural beat stimulation on attention and EEG](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8448709/)
34. [Just 24 minutes of specially designed music could significantly reduce anxiety](https://www.sciencedaily.com/releases/2026/03/260315225133.htm)
35. [The effects of music & auditory beat stimulation on anxiety](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0259312&type=printable)
36. [Full article: Is non-clinical, personal use of binaural beats audio an effective stress-management strategy? A systematic review of randomised control trials](https://www.tandfonline.com/doi/full/10.1080/18387357.2024.2374759)
37. [Binaural beats: which effects have scientific support](https://yeshcube.com/en/research/binaural-beats-experimental-support-and-hypothesis/)
38. [Binaural beats at 0.25 Hz shorten the latency to slow-wave sleep during daytime naps](https://www.nature.com/articles/s41598-024-76059-9)
39. [Music and binaural beat interventions for young adults: A systematic review of effects on anxiety, sleep, and cognition - PubMed](https://pubmed.ncbi.nlm.nih.gov/41656644/)
40. [Frontiers](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2019.00425/full)
41. [Binaural Beats in Music Therapy Interventions for Substance Addiction Treatment](https://onlineconferenceformusictherapy.com/sessions/binaural-beats-in-music-therapy-interventions-for-substance-addiction-treatment/)
42. [ΨΗΦΙΔΑ: Binaural beats in music therapy interventions for substance addiction treatment: an exploratory study](https://dspace.lib.uom.gr/handle/2159/24458)
43. [The effectiveness of brain wave synchronization in the theta band on depression and anxiety in opioid-dependent patients - PubMed](https://pubmed.ncbi.nlm.nih.gov/39944389/)
44. [Reply to: Comments on “Effectiveness of Binaural Beats in Reducing Anxiety in Alcohol Withdrawal Patients: A Single-group Pre-post Interventional Study” - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13391969/)
45. [Effectiveness of Binaural Beats in Reducing Anxiety in Alcohol Withdrawal Patients: A Single-group Pre-post Interventional Study - PubMed](https://pubmed.ncbi.nlm.nih.gov/41982916/)
46. [Comparing the Effectiveness of Cognitive Rehabilitation and Binaural Beats on Craving and Comorbidities of Sexual Hyperactivity: A Pilot, Exploratory Quasi-Experimental Study - PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11172304/)
47. [Who uses digital drugs? An international survey of 'binaural beat' consumers - PubMed](https://pubmed.ncbi.nlm.nih.gov/35353927/?fc=None&ff=20220331062606&v=2.17.6)
48. [The Effects of Music & Auditory Beat Stimulation on Anxiety](https://cdn.clinicaltrials.gov/large-docs/18/NCT05171218/Prot_000.pdf)
49. [Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis](https://www.semanticscholar.org/paper/Efficacy-of-binaural-auditory-beats-in-cognition,-a-Garcia-Argibay-Santed/734c4370714677491330635eca220fa45efed8b2)
50. [can binaural beats increase your focus exploring the efects of mu 2](https://researchportalplus.anu.edu.au/en/publications/can-binaural-beats-increase-your-focus-exploring-the-efects-of-mu-2/)
51. [Safe Headphone Volume Calculator: How Loud Is Too Loud?](https://theaudiostuff.com/tools/safe-listening-calculator/)
52. [documentation - UAZU](https://uazu.net/sbagen/sbagen.txt)
53. [SBaGen -- Binaural Beat Brain Wave Experimenter's Lab](https://uazu.net/sbagen/)
54. [Gnaural](https://en.wikipedia.org/wiki/Gnaural)
55. [Gnaural Download - An opensource binaural-beat generator released under the GNU](https://gnaural.software.informer.com/)
56. [I-Doser](https://en.wikipedia.org/wiki/I-Doser)
57. [Copyrightability of AI Outputs: U.S. Copyright Office Analyzes Human Authorship Requirement](https://www.jonesday.com/en/insights/2025/02/copyrightability-of-ai-outputs-us-copyright-office-analyzes-human-authorship-requirement)
58. [Copyright Office Releases Part 2 of Artificial Intelligence Report](https://newsroom.loc.gov/news/copyright-office-releases-part-2-of-artificial-intelligence-report/s/f3959c36-d616-498d-b8f9-67641fd18bab)
59. [FDA Issues Updated Guidance on Low-Risk General Wellness Devices and Clinical Decision Support Software](https://www.afslaw.com/perspectives/alerts/fda-issues-updated-guidance-low-risk-general-wellness-devices-and-clinical)
60. [FDA’s 2026 General Wellness Policy and What It Means for Manufacturers of Wearable Devices](https://www.womblebonddickinson.com/us/insights/blogs/fdas-2026-general-wellness-policy-and-what-it-means-manufacturers-wearable-devices)
61. [FDA’s Recent Updates to General Wellness and Clinical Decision Support Policies](https://www.honigman.com/alert-3236)
62. [Gamma sensory stimulation in mild Alzheimer's dementia: An open‐label extension study - Chan - 2025 - Alzheimer's & Dementia - Wiley Online Library](https://alz-journals.onlinelibrary.wiley.com/doi/10.1002/alz.70792)
63. [40Hz Light Therapy for Alzheimer's: Is It Real?](https://www.helpingparentsage.com/40hz-light-therapy-for-alzheimer-s-is-it-real)
