// Evidence base used by the badges and the "Why?" pages.
// Source of truth: docs/RESEARCH.md. Null and negative results are kept on
// purpose. Where the app makes a judgment call the research doesn't make,
// the item says so in `note`.

export type Grade =
  | 'Strong'
  | 'Moderate–Strong'
  | 'Moderate'
  | 'Weak–Moderate'
  | 'Weak'
  | 'No evidence'
  | 'Contradicted';

export interface Source {
  label: string;
  url?: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  grade: Grade;
  /** One-line plain summary. */
  summary: string;
  /** What the studies found, including nulls and negatives. */
  findings: string[];
  /** What this means for you. */
  takeaway: string;
  sources: Source[];
  note?: string;
}

export const GRADE_KEY: Record<Grade, string> = {
  Strong: 'Several good randomized trials or meta-analyses, with consistent results and decent controls.',
  'Moderate–Strong': 'Between Moderate and Strong.',
  Moderate: 'Some randomized trials or meta-analyses, with real limits.',
  'Weak–Moderate': 'Between Weak and Moderate: positive on average, but studies are small or varied.',
  Weak: 'Small, few, uncontrolled or not replicated studies.',
  'No evidence': 'Not meaningfully tested, or no study shows a benefit.',
  Contradicted: 'Good studies point the other way.',
};

export function gradeLevel(g: Grade): 'strong' | 'moderate' | 'weak' | 'none' {
  if (g === 'Strong' || g === 'Moderate–Strong') return 'strong';
  if (g === 'Moderate' || g === 'Weak–Moderate') return 'moderate';
  if (g === 'Weak') return 'weak';
  return 'none';
}

const S = {
  fincham: { label: 'Fincham et al. 2023, Scientific Reports: breathwork meta-analysis (12 RCTs, n = 785)', url: 'https://www.nature.com/articles/s41598-022-27247-y' },
  balban: { label: 'Balban et al. 2023, Cell Reports Medicine: cyclic sighing vs mindfulness (n = 108)' },
  dewitte: { label: 'de Witte et al. 2020, Health Psychology Review: music and stress (104 RCTs, 9,617 people)', url: 'https://www.tandfonline.com/doi/full/10.1080/17437199.2020.1846580' },
  adiasto: { label: 'Adiasto et al. 2022, PLOS ONE: music listening after a lab stressor (14 studies, N = 706)' },
  ingendoh: { label: 'Ingendoh, Posny & Heine 2023, PLOS ONE: systematic review of 14 EEG studies', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023' },
  orozco: { label: 'Orozco Perez, Dumas & Lehmann 2020, eNeuro (n = 16)', url: 'https://www.eneuro.org/content/eneuro/7/2/ENEURO.0232-19.2020.full.pdf' },
  lee: { label: 'Lee et al. 2019, Frontiers in Human Neuroscience (~15 people)', url: 'https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2019.00425/full' },
  mallik: { label: 'Mallik & Russo 2022, PLOS ONE (n = 163; company-linked)', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0259312' },
  mullen: { label: 'Mullen et al. 2026, PLOS Mental Health (n = 144; company-linked)', url: 'https://journals.plos.org/mentalhealth/article?id=10.1371/journal.pmen.0000355' },
  xiong: { label: 'Xiong et al. 2025, Complement. Ther. Med. (journal): beats around medical procedures (15 RCTs)', url: 'https://www.sciencedirect.com/science/article/pii/S096522992500175X' },
  platt: { label: 'Platt 2024, Advances in Mental Health: personal use for stress (12 RCTs)', url: 'https://www.tandfonline.com/doi/full/10.1080/18387357.2024.2374759' },
  garcia: { label: 'Garcia-Argibay et al. 2019: meta-analysis (22 studies)' },
  basu: { label: 'Basu & Banerjee 2023: memory and attention (15 studies, g = 0.40)', url: 'https://link.springer.com/article/10.1007/s00426-022-01706-7' },
  lin: { label: 'Lin et al. 2024, Geriatrics & Gerontology International: older adults, 14 days (n = 64)', url: 'https://pubmed.ncbi.nlm.nih.gov/38319068/' },
  nap: { label: 'Scientific Reports 2024: 0.25 Hz beats and nap sleep', url: 'https://www.nature.com/articles/s41598-024-76059-9' },
  asim: { label: 'Asimakopoulos 2020, MA thesis (not peer-reviewed)', url: 'https://dspace.lib.uom.gr/handle/2159/24458' },
  engel: { label: 'Engelbregt et al. 2021: 40 Hz binaural beats and attention' },
  lopez: { label: 'López-Caballero & Escera 2017', url: 'https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2017.00557/xml' },
  research: { label: 'Project research summary: docs/RESEARCH.md' },
};

export const EVIDENCE: EvidenceItem[] = [
  {
    id: 'breathing',
    title: 'Slow breathing & cyclic sighing',
    grade: 'Moderate–Strong',
    summary: 'Breathing slowly (about 6 breaths a minute) or cyclic sighing lowers stress within minutes.',
    findings: [
      'Across 12 randomized trials (785 people), breathwork lowered stress (g = −0.35), anxious feelings (g = −0.32) and low mood (g = −0.40).',
      'In a 108-person study, 5 minutes a day of cyclic sighing raised positive mood more than mindfulness meditation. Drops in anxious feelings were similar.',
      'Breathing at about 6 per minute raises heart-rate variability (the body\'s "brake") in the short term.',
    ],
    takeaway: 'This is the best-supported tool in the app for calming down fast. That is why the Calm and Urge flows start with it.',
    sources: [S.fincham, S.balban],
  },
  {
    id: 'music',
    title: 'Calm music',
    grade: 'Moderate',
    summary: 'Calm, predictable music at 60–90 BPM lowers stress, mostly in medical settings.',
    findings: [
      '104 randomized trials: body stress measures d ≈ 0.38, self-reported stress d ≈ 0.55. Tempos of 60–90 BPM gave larger effects.',
      'Null result: in healthy people after a lab stressor, pure listening gave a small, non-significant effect (g = 0.15, 95% CI −0.21 to 0.52).',
      'For relaxing, calm matters more than favorite.',
    ],
    takeaway: 'Expect a small-to-moderate stress drop. In most beat studies, this is where most of the benefit comes from.',
    sources: [S.dewitte, S.adiasto],
  },
  {
    id: 'urge-surfing',
    title: 'Urge surfing & delay',
    grade: 'Moderate',
    summary: 'Urges usually peak and fade within minutes if you don\'t act on them. Waiting them out with a plan helps.',
    findings: [
      'Urge-surfing, a 10–20 minute delay, brief exercise and contacting support are the best-supported in-the-moment tools.',
      'Mindfulness-based relapse prevention does better than any sound tool for this goal.',
    ],
    takeaway: 'The Urge flow is a 15-minute coping pause: timer, prompts and a plan. It is not a replacement for real support.',
    sources: [S.research],
  },
  {
    id: 'movement',
    title: 'Brief movement',
    grade: 'Moderate',
    summary: 'A short walk or a few minutes of movement can cut a craving in the short term and lifts mood.',
    findings: [
      'Exercise has strong evidence for mood (Strong), and brief exercise cuts cigarette craving in the short term (Moderate).',
    ],
    takeaway: 'Use the movement break when an urge is strong or your focus is gone.',
    sources: [S.research],
    note: 'The 5–10 minute length is a practical choice, not a number from a specific study.',
  },
  {
    id: 'mindfulness',
    title: 'Mindfulness',
    grade: 'Moderate–Strong',
    summary: 'Regular practice over weeks helps with stress. Single short sessions are weaker.',
    findings: [
      'Small-to-moderate effects after 8-week programs. Single sessions show weaker effects.',
      'Meditation EEG changes depend heavily on style and experience.',
    ],
    takeaway: 'The short prompts in this app are a doorway, not a full program.',
    sources: [S.research],
  },
  {
    id: 'sleep-habits',
    title: 'Sleep habits',
    grade: 'Strong',
    summary: 'Consistent sleep habits and structured sleep programs are the best-supported way to sleep better.',
    findings: [
      'Structured sleep programs (with a professional or a validated program) are the first-line approach for long-lasting sleep problems.',
      'Habits and routine matter far more than any sound.',
    ],
    takeaway: 'Use the checklist and diary. If poor sleep lasts weeks, talk to a professional.',
    sources: [S.research],
  },
  {
    id: 'bedtime-music',
    title: 'Bedtime music',
    grade: 'Weak–Moderate',
    summary: 'Music at bedtime gives modest sleep-quality gains over weeks.',
    findings: [
      'A 2026 review in young adults found SMD 0.3–0.6, pooled across music, beat and audio-visual studies.',
      'Small trials, mostly against no music or usual care.',
    ],
    takeaway: 'A calm sound ritual may help a little. Habits help more.',
    sources: [S.lin, S.research],
    note: 'The research gives no explicit grade for bedtime music alone. "Weak–Moderate" is this app\'s judgment from the studies above.',
  },
  {
    id: 'low-distraction',
    title: 'Low-distraction sound',
    grade: 'Moderate',
    summary: 'Steady, lyric-free sound masks interruptions. Lyrics hurt verbal work.',
    findings: [
      'Avoiding lyrics during verbal work is supported (Moderate).',
      'Steady, low-surprise sound that isn\'t too engaging works best. There is no single "focus frequency".',
    ],
    takeaway: 'Noise or a calm drone plus timed blocks is a reasonable focus setup.',
    sources: [S.research],
  },
  {
    id: 'beats-entrainment',
    title: 'Do beats "tune" your brain?',
    grade: 'Weak',
    summary: 'The brain follows a rhythm a little while it plays. There is little support for it shifting your state.',
    findings: [
      'Review of 14 EEG studies: evidence for frequency-specific entrainment was inconclusive. Several found no effect.',
      'Direct EEG test: monaural beats entrained the cortex more strongly than binaural beats. Neither changed mood or anxious feelings.',
      '1, 5, 10 and 20 Hz binaural beats produced no clear entrainment in one study (Gao et al. 2014).',
      'A measurable response during listening: Moderate. A shift into the target state: Weak.',
    ],
    takeaway: 'Think of the rhythm layer as an experiment, and test it blinded in the Lab.',
    sources: [S.ingendoh, S.orozco],
  },
  {
    id: 'beats-anger',
    title: 'Beats for anger',
    grade: 'No evidence',
    summary: 'No trials show benefit. One small study found anger went up with beats alone.',
    findings: [
      'Lee et al. 2019 (~15 people): anger rose significantly with binaural beats alone, and fell with beats plus ASMR.',
      'Another small study (n = 28, 6 Hz) reportedly found more anger and less calm.',
    ],
    takeaway: 'This app does not offer beats in the Calm-down flow. Breathe first.',
    sources: [S.lee],
  },
  {
    id: 'beats-urge',
    title: 'Beats for urges',
    grade: 'No evidence',
    summary: 'No trial shows beats reduce cravings.',
    findings: [
      'In a double-blind pilot in a rehab center, craving stayed the same with beats and without them (thesis, not peer-reviewed).',
      'Other studies did not measure craving, had no control group, or looked at different outcomes.',
    ],
    takeaway: 'In the Urge flow, sound is only a backdrop for the timer and prompts.',
    sources: [S.asim],
  },
  {
    id: 'beats-relax',
    title: 'Beats for relaxing',
    grade: 'Weak',
    summary: 'Music with theta beats beat pink noise in two trials, but barely beat music alone. Both trials are company-linked.',
    findings: [
      'Weak–Moderate against pink noise; Weak against the same music without beats.',
      '2022 trial: in one subgroup, music plus beats lowered worried thoughts more than music alone. The trial was open-label and run online.',
      '2026 trial: music plus beats beat pink noise; 24 minutes looked best.',
      'Both trials are linked to the company that supplied the music.',
      'Personal-use review (12 trials): 8 found at least one effect, 4 found none.',
    ],
    takeaway: 'Most of the benefit probably comes from the music. The Lab can test whether the beat adds anything for you.',
    sources: [S.mallik, S.mullen, S.platt],
  },
  {
    id: 'beats-procedures',
    title: 'Beats around medical procedures',
    grade: 'Weak',
    summary: 'Big effects against silence, but the controls are weak and results vary a lot.',
    findings: [
      'Anxious feelings around surgery and dental work dropped a lot against blank audio (SMD −1.38), but with extreme heterogeneity (I² = 91.6%).',
      'This shows sound helps in medical stress. It does not show the beat is special (Moderate vs silence, Weak that the beat matters).',
    ],
    takeaway: 'Not directly relevant to everyday use. Listed for completeness.',
    sources: [S.xiong],
  },
  {
    id: 'beats-sleep',
    title: 'Beats for sleep',
    grade: 'Weak',
    summary: 'Small single-blind trials suggest better sleep scores, but how much comes from the beat is unclear.',
    findings: [
      '64 older adults in long-term care, 14 days: better sleep-quality scores (single-blind, against usual care).',
      '0.25 Hz beats shortened time to deep sleep in naps.',
    ],
    takeaway: 'Unproven. Sleep habits matter far more.',
    sources: [S.lin, S.nap],
  },
  {
    id: 'beats-focus',
    title: 'Beats for focus',
    grade: 'Weak',
    summary: 'Small lab studies average a positive effect, but replications are inconsistent. 40 Hz binaural beats are probably not even perceived.',
    findings: [
      'Memory/attention meta-analyses: g ≈ 0.40 on average, from small studies with some null and negative results.',
      '40 Hz binaural: better attention in one study, but no entrainment. A 57.3 Hz beat was used as an imperceptible control elsewhere and changed nothing.',
    ],
    takeaway: 'Labeled "Experimental, unproven for focus". Beats may also distract.',
    sources: [S.basu, S.garcia, S.engel, S.lopez],
  },
  {
    id: 'venting',
    title: 'Venting anger',
    grade: 'Contradicted',
    summary: 'High-arousal venting (yelling, hitting things) tends to keep anger going.',
    findings: ['Lowering arousal works better than venting.'],
    takeaway: 'That\'s why the Calm-down flow has no venting exercise.',
    sources: [S.research],
  },
];

export const EVIDENCE_BY_ID: Record<string, EvidenceItem> = Object.fromEntries(EVIDENCE.map((e) => [e.id, e]));

export interface Myth {
  claim: string;
  verdict: string;
  why: string;
}

export const MYTHS: Myth[] = [
  { claim: '"Theta waves release dopamine."', verdict: 'Unsupported', why: 'No human evidence that driving theta causes dopamine release. It mixes up a correlation with chemistry.' },
  { claim: '"Binaural beats are digital drugs."', verdict: 'Myth', why: 'No study shows drug-like effects. Some people still look for them: 11.7% of beat users in a 30,896-response survey.' },
  { claim: '"Your brain locks onto any frequency."', verdict: 'Largely contradicted', why: 'Binaural entrainment is weak and inconsistent.' },
  { claim: '"40 Hz binaural beats sharpen focus."', verdict: 'Unsupported', why: 'At or beyond the edge of perception, with no entrainment and no replicated benefit.' },
  { claim: '"Alpha = relaxed, beta = stressed."', verdict: 'Oversimplified', why: 'Alpha also rises during internal effort, and beta reflects movement and medication.' },
  { claim: '"An EEG headband can read your neurotransmitters."', verdict: 'Contradicted', why: 'Many chemical states look alike on EEG. Consumer readouts cannot do this.' },
  { claim: '"432 / 528 Hz Solfeggio frequencies heal."', verdict: 'Myth', why: 'No credible evidence.' },
  { claim: '"Venting anger gets it out."', verdict: 'Contradicted', why: 'High-arousal venting tends to keep anger going.' },
];
