import { buildSlots, ClockGlyphSet } from '../../components/DharaniClock/atlas';
import { BEATS, BEAT_SEC, CYCLE_SEC, beatAt } from '../../components/DharaniClock/beat';
export const geumni = { bg: '#0F1320', ink: '#B9A271', read: '#8F3B2C', trace: '#857551' };
const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export function circularModel(set: ClockGlyphSet) {
  const slots = buildSlots(set), readable = slots.map((s, id) => ({ ...s, id })).filter(s => s.group && !s.red);
  const ringCounts = [0, 1, 2, 3, 4].map(ri => slots.filter(s => s.ri === ri).length);
  const ringReadables = ringCounts.map((_, ri) => readable.filter(s => s.ri === ri));
  const prefix = [Array(5).fill(0) as number[]];
  for (let i = 0; i < BEATS; i++) {
    const next = [...prefix[i]]; next[readable[i % readable.length].ri]++; prefix.push(next);
  }
  return { slots, readable, ringCounts, ringReadables, prefix };
}
export type CircularModel = ReturnType<typeof circularModel>;
export function circularFrame(model: CircularModel, date = new Date()) {
  const beat = beatAt(date), t = beat.frac * BEAT_SEC;
  // Keep the index-to-ring schedule; the glyph comes from that ring's top slot.
  const readingRing = model.readable[beat.index % model.readable.length].ri;
  const amount = t < .8 ? ease(t / .8) : t < 6.6 ? 1 : t < 7.5 ? 1 - ease((t - 6.6) / .9) : 0;
  const turnStart = BEAT_SEC - .55;
  const turning = t >= turnStart;
  // Monotone deceleration, no rebound, blur or trails. Reading starts next beat.
  const u = Math.max(0, Math.min(1, (t - turnStart) / .55));
  const step = 1 - (1 - u) ** 3;
  const days = Math.floor((date.getTime() + 9 * 3600000) / 86400000);
  const cycles = days * 3 + Math.floor(beat.sec / CYCLE_SEC);
  const positions = model.ringReadables.map((slots, ri) => (cycles * model.prefix[BEATS][ri] + model.prefix[beat.index][ri]) % slots.length);
  const active = model.ringReadables[readingRing][positions[readingRing]];
  const angles = model.ringReadables.map((slots, ri) => {
    const position = positions[ri], angle = slots[position].a;
    // Redacted cells stay blank. One reading step advances to the next actual glyph.
    const nextAngle = position + 1 < slots.length ? slots[position + 1].a : slots[0].a + 360;
    return (angle + (readingRing === ri ? (nextAngle - angle) * step : 0)) * Math.PI / 180;
  });
  const phase = turning ? 'turn' : t < .8 ? 'rise' : t < 6.6 ? 'hold' : t < 7.5 ? 'fall' : 'rest';
  const moving = phase === 'rise' || phase === 'fall' || phase === 'turn';
  const boundary = t < .8 ? .8 : t < 6.6 ? 6.6 : t < 7.5 ? 7.5 : t < turnStart ? turnStart : BEAT_SEC;
  return { index: beat.index, active, amount, angles, phase, moving, until: boundary - t, turningRing: turning ? readingRing : -1 };
}
export type CircularFrame = ReturnType<typeof circularFrame>;
