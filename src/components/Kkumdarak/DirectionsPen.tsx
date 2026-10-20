import React, { useId } from 'react';

type Point = readonly [number, number];

// 고정 시드: 굵기는 바꾸지 않고 방향과 끝에만 작은 편차를 준다.
function penLine(start: Point, end: Point, seed: number): string {
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296 - 0.5;
  };
  const steps = Math.max(2, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 32));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = start[0] + (end[0] - start[0]) * t + random() * 0.8;
    const y = start[1] + (end[1] - start[1]) * t + random() * 0.8;
    return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

const DESKTOP_ROADS: readonly (readonly [Point, Point])[] = [
  [[-45, 355], [470, -34]], [[-25, 380], [490, -9]],
  [[154, 226], [980, 226]],
  [[694, -20], [694, 500]], [[846, -20], [846, 226]],
  [[426, 226], [426, 322]], [[-20, 394], [694, 394]],
];
const MOBILE_ROADS: readonly (readonly [Point, Point])[] = [
  [[-28, 175], [246, -32]], [[-21, 186], [253, -21]],
  [[57, 138], [370, 138]],
  [[259, -20], [259, 325]], [[315, -20], [315, 138]],
  [[159, 138], [159, 200]], [[-20, 246], [259, 246]],
];

// 도로만 마스킹하고 기존 캐릭터와 이름표는 상단 레이어에 유지한다.
const DirectionsPen: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const id = useId().replace(/:/g, '');
  const maskId = `directions-pen-clear-${id}`;
  const width = mobile ? 342 : 944;
  const height = mobile ? 300 : 470;
  const roads = mobile ? MOBILE_ROADS : DESKTOP_ROADS;
  const pins: Point[] = mobile ? [[291, 73], [163, 178]] : [[768, 114], [442, 311]];
  const walk: Point[] = mobile
    ? [[222, 119], [218, 125], [214, 131], [210, 137], [206, 143]]
    : [[617, 216], [602, 223], [587, 230], [572, 237], [557, 244],
      [428, 238], [427, 245], [427, 252]];

  return (
    <svg className="directions-pen" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          {pins.map(([x, y]) => <circle key={x} cx={x} cy={y} r="60" fill="black" />)}
          {mobile ? <>
            <rect x="247" y="121" width="89" height="30" fill="black" />
            <rect x="117" y="213" width="92" height="30" fill="black" />
          </> : <>
            <rect x="650" y="148" width="236" height="96" fill="black" />
            <rect x="326" y="331" width="232" height="82" fill="black" />
          </>}
        </mask>
      </defs>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" mask={`url(#${maskId})`}>
        <g className="pen-roads">
          {roads.map(([start, end], i) => <path key={i} d={penLine(start, end, 29102 + i)} />)}
        </g>
        <g className="pen-walk">
          {walk.map(([x, y], i) => <path key={i} d={penLine([x - 9, y], [x + 9 + i % 3, y - 0.4], 310 + i)} />)}
        </g>
      </g>
    </svg>
  );
};

export const PenLandmark: React.FC<{ bank?: boolean; label: string }> = ({ bank = false, label }) => (
  <div className={bank ? 'nonghyup' : 'office'}>
    <svg className="pen-building" width="28" height="25" viewBox="0 0 28 25" aria-hidden="true" focusable="false">
      <path d="M3 22.5 L2.6 3.1 L24.5 2.7 L25 22.2 L3 22.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {bank && <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
        {[0, 1, 2, 3, 4].map(i => <path key={i} d={penLine([5 + i * 3.4, 19.8], [8 + i * 3.4, 5.5], 910 + i)} />)}
      </g>}
    </svg>
    <span>{label}</span>
  </div>
);

export default DirectionsPen;
