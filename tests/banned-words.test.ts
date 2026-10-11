// Fails the build if UI text makes medical or hype claims.
// Comments are stripped; exact safety sentences in ALLOWED_PHRASES are allowed.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALLOWED_PHRASES } from '../src/data/safety';

const BANNED: RegExp[] = [
  /\btreat(s|ed|ing|ment|ments)?\b/i,
  /\bcur(e|es|ed|ing)\b/i,
  /\btherap(y|ies|ist|ists|eutic)\b/i,
  /\bboosts? dopamine\b/i,
  /\bdigital drugs?\b/i,
  /\brewires? (your )?brain\b/i,
  /\bdisorders?\b/i,
  /\binsomnia\b/i,
  /\bADHD\b/,
  /\bPTSD\b/,
  /\bdepression\b/i,
  /\baddiction\b/i,
  /\balcoholism\b/i,
  /\bepilepsy\b/i,
  /\bdementia\b/i,
  /\balzheimer'?s?\b/i,
  /\bpsychosis\b/i,
  /\bschizophreni/i,
  /\bbipolar\b/i,
  /\bCBT-?I\b/i,
  /\bdiagnos/i,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|html)$/.test(p) ? [p] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Texts shown to users: string literals, template literals and JSX text. */
function uiText(src: string): string {
  let s = stripComments(src);
  for (const p of ALLOWED_PHRASES) s = s.split(p).join(' ');
  return s;
}

const targets = [...files('src/ui'), ...files('src/data'), 'index.html'].filter((f) => !f.endsWith('safety.ts'));

describe('banned words in UI text', () => {
  for (const f of targets) {
    it(f, () => {
      const text = uiText(readFileSync(f, 'utf8'));
      const hits = BANNED.flatMap((re) => {
        const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
        return m ? m.map((x) => `${x} (${re})`) : [];
      });
      expect(hits).toEqual([]);
    });
  }
  it('safety.ts only uses banned words inside its allowed sentences', () => {
    const src = uiText(readFileSync('src/data/safety.ts', 'utf8'));
    const consts = src.match(/'[^']*'/g) ?? [];
    const leftovers = consts.filter((c) => BANNED.some((re) => re.test(c)));
    expect(leftovers).toEqual([]);
  });
  it('the banned list actually catches things', () => {
    expect(BANNED.some((re) => re.test('This music will cure your insomnia'))).toBe(true);
    expect(BANNED.some((re) => re.test('Theta boosts dopamine'))).toBe(true);
  });
});
