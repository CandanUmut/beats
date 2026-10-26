import { describe, expect, it } from 'vitest';
import { bestSpot, freeSpans, nearestIn, spanAt, type Perch } from '../src/ui/catRoom';

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

// The cat must never sit on text or buttons: these find where he may go.
describe('the cat keeps to free space', () => {
  it('finds the gaps between things in his band, keeping a margin', () => {
    const boxes = [box(100, 0, 150, 40), box(250, 10, 300, 30)];
    expect(freeSpans(boxes, 0, 50, 0, 400, 30, 8)).toEqual([[0, 92], [158, 242], [308, 400]]);
  });

  it('ignores things above or below his band, and drops gaps too narrow for him', () => {
    const boxes = [box(100, 60, 150, 90), box(120, 0, 200, 10), box(230, 20, 260, 40)];
    // Only the last box crosses [20, 50]; the gap after it is too short.
    expect(freeSpans(boxes, 20, 50, 0, 300, 60, 8)).toEqual([[0, 222]]);
  });

  it('measures from where the stretch starts on screen', () => {
    expect(freeSpans([box(140, 0, 160, 10)], 0, 10, 100, 200, 10, 0)).toEqual([[0, 40], [60, 200]]);
  });

  it('a page covered edge to edge leaves no room', () => {
    expect(freeSpans([box(-10, 0, 500, 100)], 0, 100, 0, 400, 10)).toEqual([]);
  });

  it('knows whether he fits where he is, and the nearest place he would', () => {
    const spans: [number, number][] = [[0, 90], [200, 400]];
    expect(spanAt(spans, 45, 40)).toEqual([0, 90]);
    expect(spanAt(spans, 80, 40)).toBeUndefined();
    expect(nearestIn(spans, 150, 40)).toEqual([[200, 400], 240]);
    expect(nearestIn(spans, 60, 40)).toEqual([[0, 90], 50]);
  });

  it('picks the closest place, favouring his full size', () => {
    const floor: Perch = { el: null, left: 0, width: 400, foot: 800, sizes: [{ s: 1, spans: [] }, { s: 0.72, spans: [[0, 80]] }] };
    const card: Perch = { el: null, left: 0, width: 400, foot: 600, sizes: [{ s: 1, spans: [[200, 400]] }] };
    // From the bottom left: the small spot beside him beats a big one 200px up.
    expect(bestSpot([floor, card], 40, 800, 100)).toMatchObject({ p: floor, s: 0.72, cx: 40 });
    // From the middle: the card.
    expect(bestSpot([floor, card], 300, 650, 100)).toMatchObject({ p: card, s: 1, cx: 300 });
    expect(bestSpot([], 0, 0, 100)).toBeNull();
  });
});
