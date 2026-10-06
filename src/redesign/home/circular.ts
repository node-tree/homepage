import { buildSlots, ClockGlyphSet } from '../../components/DharaniClock/atlas';
import { BEATS, BEAT_SEC, CYCLE_SEC, beatAt } from '../../components/DharaniClock/beat';
import { ease } from './scene';

export const materials = {
  geumni: { bg: '#0F1320', ink: '#B9A271', read: '#8F3B2C', trace: '#857551', text: '#C9BEA6', residual: '#8E8C88', mark: '#8F3B2C' },
  relief: { bg: '#1E1E1C', ink: '#8D8A7F', read: '#AAA698', trace: '#69504A', text: '#D2CEC1', residual: '#94938B', mark: '#B97565' },
  silk: { bg: '#202624', ink: '#B8BBA6', read: '#D9D9C5', trace: '#79635B', text: '#D1D4C6', residual: '#959F95', mark: '#BA7B68' },
};
export type Material = keyof typeof materials;
export type Movement = 'still' | 'step';
export function circularSelection(params: URLSearchParams) {
  const candidate = params.get('mat') || 'geumni';
  const mat: Material = Object.prototype.hasOwnProperty.call(materials, candidate) ? candidate as Material : 'geumni';
  const move: Movement = params.get('move') === 'still' ? 'still' : 'step';
  return { mat, move };
}
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
export function circularFrame(model: CircularModel, move: Movement, date = new Date()) {
  const beat = beatAt(date), t = beat.frac * BEAT_SEC;
  // Keep the index-to-ring schedule; the glyph comes from that ring's top slot.
  const readingRing = model.readable[beat.index % model.readable.length].ri;
  const amount = t < .8 ? ease(t / .8) : t < 6.6 ? 1 : t < 7.5 ? 1 - ease((t - 6.6) / .9) : 0;
  const turnStart = BEAT_SEC - .55;
  const turning = move === 'step' && t >= turnStart;
  // Monotone deceleration, no rebound, blur or trails. Reading starts next beat.
  const u = Math.max(0, Math.min(1, (t - turnStart) / .55));
  const step = 1 - (1 - u) ** 3;
  const days = Math.floor((date.getTime() + 9 * 3600000) / 86400000);
  const cycles = days * 3 + Math.floor(beat.sec / CYCLE_SEC);
  const positions = model.ringReadables.map((slots, ri) => move === 'still' ? 0 :
    (cycles * model.prefix[BEATS][ri] + model.prefix[beat.index][ri]) % slots.length);
  const active = model.ringReadables[readingRing][positions[readingRing]];
  const angles = model.ringReadables.map((slots, ri) => {
    const position = positions[ri], angle = slots[position].a;
    // Redacted cells stay blank. One reading step advances to the next actual glyph.
    const nextAngle = position + 1 < slots.length ? slots[position + 1].a : slots[0].a + 360;
    return (angle + (move === 'step' && readingRing === ri ? (nextAngle - angle) * step : 0)) * Math.PI / 180;
  });
  const phase = turning ? 'turn' : t < .8 ? 'rise' : t < 6.6 ? 'hold' : t < 7.5 ? 'fall' : 'rest';
  const moving = phase === 'rise' || phase === 'fall' || phase === 'turn';
  const boundary = t < .8 ? .8 : t < 6.6 ? 6.6 : t < 7.5 ? 7.5 : move === 'step' && t < turnStart ? turnStart : BEAT_SEC;
  return { index: beat.index, active, amount, angles, phase, moving, until: boundary - t, turningRing: turning ? readingRing : -1 };
}
export type CircularFrame = ReturnType<typeof circularFrame>;
