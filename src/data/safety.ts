// Safety copy. Some sentences here must name conditions or use words that
// are banned elsewhere in the UI. They are listed in ALLOWED_PHRASES so the
// banned-word test can allow exactly these sentences and nothing else.

/** Disclaimer text from docs/RESEARCH.md section 7.4, verbatim. */
export const DISCLAIMER =
  'This is a free, experimental wellness and music tool. It is not a medical device and does not diagnose, treat, cure or prevent any condition. Evidence for binaural beats is limited and mixed. Do not use while driving or when you need to stay alert. Keep the volume low. If you have epilepsy, hearing problems, or a mental-health or substance-use condition, talk to a professional. In a crisis, contact emergency services or a crisis line.';

export const ASK_FIRST =
  'Ask a doctor first if you have epilepsy; severe tinnitus, sound sensitivity or hearing loss in one ear; psychosis, dissociation or PTSD with dissociation; or if you are under 18.';

export const NOT_TREATMENT = 'This is a coping timer, not treatment.';

export const CRISIS =
  'If you are in crisis (thoughts of suicide, severe withdrawal, urges to hurt someone), this app is not enough. Alcohol or benzodiazepine withdrawal can be medically dangerous. Contact a person now.';

export const NEVER_WHILE = 'Never use it while driving, cycling, operating machinery, or anywhere you need to hear alarms.';

export const STOP_DAY =
  'Stop for the day if you get a headache, dizziness, nausea, ringing or muffled hearing, rising panic or anger, or feel detached.';

export const STOP_STUDY =
  'Stop the experiment and get help if you have a seizure-like event, ringing in the ears lasting more than 24 hours, mood getting worse over a week, more craving or use, or you notice you are using this instead of real support.';

export const ALLOWED_PHRASES = [DISCLAIMER, ASK_FIRST, NOT_TREATMENT, CRISIS, '"Binaural beats are digital drugs."'];
