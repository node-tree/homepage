// 박 계산 재현 — 컴포넌트가 쓰는 것과 같은 식(beat.ts)을 노드에서 다시 돌린다
const BEAT_SEC = 9.508088, BEATS = 3029;
const seoulSec = (d) => { const s = d.getTime() + 9*3600*1000; return (s - Math.floor(s/86400000)*86400000)/1000; };
const beatOf = (d) => { const sec = seoulSec(d); const t = Math.floor(sec/BEAT_SEC); return ((t%BEATS)+BEATS)%BEATS; };
const kst = (h,m,s,ms=0) => new Date(Date.UTC(2026,7,27,h-9,m,s,ms));  // KST 벽시계 → UTC
const cases = [
  ['00:00:00.000', kst(0,0,0),        0],
  // 한 박 = 9.508088 s 이므로 9.508 s 는 **아직 0박**이다(경계 검산)
  ['00:00:09.508', kst(0,0,9,508),    0],
  ['00:00:09.509', kst(0,0,9,509),    1],
  ['00:00:19.016', kst(0,0,19,16),    1],
  ['00:00:19.017', kst(0,0,19,17),    2],
  ['07:59:59.000', kst(7,59,59),   3028],
  ['08:00:00.000', kst(8,0,0),        0],
  ['15:59:59.000', kst(15,59,59), 3028],
  ['16:00:00.000', kst(16,0,0),       0],
  ['23:59:59.000', kst(23,59,59),  3028],
];
let ok = 0;
console.log('BEAT_SEC=%s  BEATS=%d  cycle=%ss (=%s h)', BEAT_SEC, BEATS, (BEAT_SEC*BEATS).toFixed(3), (BEAT_SEC*BEATS/3600).toFixed(6));
for (const [label, d, want] of cases) {
  const got = beatOf(d);
  const pass = got === want; ok += pass ? 1 : 0;
  console.log('%s KST  기대 %s  실제 %s  %s', label, String(want).padStart(4,'0'), String(got).padStart(4,'0'), pass ? 'PASS' : 'FAIL');
}
// 순환·각 검산
const gakOf = (i) => Math.floor(i/20);
console.log('각 검산: index 0->角 %d · 19->角 %d · 20->角 %d · 3028->角 %d (총 %d 각)',
  gakOf(0), gakOf(19), gakOf(20), gakOf(3028), Math.ceil(BEATS/20));
console.log('讀誦 바늘 각도: 0842 -> %s° (목업 정본 100.1°)', (842/BEATS*360).toFixed(2));
console.log('%d/%d PASS', ok, cases.length);
process.exit(ok === cases.length ? 0 : 1);
