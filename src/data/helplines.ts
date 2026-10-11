// Help lines by region. Add your region here; the app shows the one picked
// in Settings, plus the international directory.

export interface Helpline {
  name: string;
  detail: string;
  /** tel:, sms: or https: link. */
  href: string;
  action: string;
}

export interface Region {
  id: string;
  name: string;
  emergency: string;
  lines: Helpline[];
}

export const REGIONS: Region[] = [
  {
    id: 'US',
    name: 'United States',
    emergency: '911',
    lines: [
      { name: '988 Suicide & Crisis Lifeline', detail: 'Call or text 988, 24/7, free and confidential.', href: 'tel:988', action: 'Call 988' },
      { name: '988 by text', detail: 'Text 988 if talking is hard right now.', href: 'sms:988', action: 'Text 988' },
      { name: 'SAMHSA National Helpline', detail: '1-800-662-4357. Free, 24/7 support and referrals for substance use and mental health.', href: 'tel:18006624357', action: 'Call SAMHSA' },
    ],
  },
  {
    id: 'INTL',
    name: 'Other countries',
    emergency: 'your local emergency number',
    lines: [
      { name: 'Find a Helpline', detail: 'Free directory of crisis lines in many countries.', href: 'https://findahelpline.com', action: 'Open directory' },
    ],
  },
];

export const DIRECTORY: Helpline = REGIONS[1].lines[0];

export function regionById(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}
