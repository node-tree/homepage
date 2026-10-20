import React, { useId } from 'react';

type Point = readonly [number, number];

// 고정 시드: 굵기는 바꾸지 않고 방향과 끝에만 작은 편차를 준다.
function penLine(start: Point, end: Point, seed: number, road = false): string {
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296 - 0.5;
  };
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const wavelength = 80 + (random() + 0.5) * 40;
  const phase = (random() + 0.5) * Math.PI * 2;
  const steps = Math.max(2, Math.ceil(length / (road ? 8 : 32)));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    // 긴 길만 법선 방향 ±1px, 파장 80~120px. 짧은 획은 ±0.4px 유지.
    const drift = Math.sin(length * t / wavelength * Math.PI * 2 + phase);
    const x = start[0] + (end[0] - start[0]) * t
      + (road ? -(end[1] - start[1]) / length * drift : random() * 0.8);
    const y = start[1] + (end[1] - start[1]) * t
      + (road ? (end[0] - start[0]) / length * drift : random() * 0.8);
    return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

const DESKTOP_ROADS: readonly (readonly [Point, Point])[] = [
  [[-45, 355], [470, -34]], [[-25, 380], [490, -9]],
  [[694, -20], [694, 500]],
  [[426, 216], [426, 322]], [[-20, 394], [704, 394]],
];
const MOBILE_ROADS: readonly (readonly [Point, Point])[] = [
  [[-28, 175], [246, -32]], [[-21, 186], [253, -21]],
  [[259, -20], [259, 325]],
  [[159, 128], [159, 200]], [[-20, 246], [269, 246]],
];

// 각 구간 끝에는 반드시 획을 남겨 모서리와 장소 진입부가 빈틈으로 끊기지 않게 한다.
function walkStrokes(points: readonly Point[], seed: number): string[] {
  return points.slice(1).flatMap((end, index) => {
    const start = points[index];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const count = Math.max(1, Math.round((length + 6) / 38));
    const strokeLength = (length - (count - 1) * 6) / count;
    const at = (distance: number): Point => [
      start[0] + (end[0] - start[0]) * distance / length,
      start[1] + (end[1] - start[1]) * distance / length,
    ];
    return Array.from({ length: count }, (_, i) => {
      const offset = i * (strokeLength + 6);
      return penLine(at(offset), at(offset + strokeLength), seed + index * 100 + i);
    });
  });
}

// 석동로와 보행선은 넓은 핀 마스크에서 분리한다. 이름표의 불투명 배경이 실제 겹침만 가린다.
const DirectionsPen: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const id = useId().replace(/:/g, '');
  const maskId = `directions-pen-clear-${id}`;
  const width = mobile ? 342 : 944;
  const height = mobile ? 300 : 470;
  const roads = mobile ? MOBILE_ROADS : DESKTOP_ROADS;
  const pins: Point[] = mobile ? [[291, 73], [163, 178]] : [[768, 114], [442, 311]];
  const seokdong: readonly [Point, Point] = mobile
    ? [[-20, 138], [370, 138]] : [[154, 226], [980, 226]];
  // 자치센터 캐릭터 바로 위에서 시작해 갈림길, 석동로, 세로길을 거쳐 생산소 이름표에 닿는다.
  const walk: readonly (readonly Point[])[] = mobile
    ? [
      [[159, 154], [159, 143], [264, 143], [264, 136]],
      [[164, 154], [164, 148], [269, 148], [269, 136]],
    ]
    : [
      [[426, 271], [426, 231], [699, 231], [699, 208], [710, 208]],
      [[431, 271], [431, 236], [704, 236], [704, 213], [710, 213]],
    ];

  return (
    <svg className="directions-pen" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          {pins.map(([x, y]) => <circle key={x} cx={x} cy={y} r="60" fill="black" />)}
        </mask>
      </defs>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g className="pen-roads" mask={`url(#${maskId})`}>
          {roads.map(([start, end], i) => <path key={i} d={penLine(start, end, 29102 + i, true)} />)}
        </g>
        <g className="pen-roads">
          <path d={penLine(seokdong[0], seokdong[1], 29120, true)} />
        </g>
        <g className="pen-walk">
          {walk.flatMap((points, i) => walkStrokes(points, 310 + i * 1000))
            .map((d, i) => <path key={i} d={d} />)}
        </g>
      </g>
    </svg>
  );
};

export const PenLandmark: React.FC<{ bank?: boolean; label: string }> = ({ bank = false, label }) => (
  <div className={bank ? 'nonghyup' : 'office'}>
    <svg className="pen-building" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M2 30 L1.6 2.1 L29.5 1.7 L30 29.7 L2 30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {bank && <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
        {[12, 22, 32, 42, 52].map(sum => (
          <path key={sum} d={`M${Math.max(4, sum - 28)},${Math.min(28, sum - 4)} L${Math.min(28, sum - 4)},${Math.max(4, sum - 28)}`} />
        ))}
      </g>}
    </svg>
    <span>{label}</span>
  </div>
);

export default DirectionsPen;
