import React from 'react';

// ── 정적 이미지 베이스 ────────────────────────────────────────────
const BASE = '/kkumdarak/hero/';

// ── 해(sun) 일출/일몰 루프 + 반딧불이 주야 동기화 (데/모 공통) ────
// 산(distant-mountain)보다 먼저 렌더되어 산이 해를 가린다(해가 산 뒤).
// 평소엔 산 몸체 안쪽(home top)에 숨고, 정점에서 translateY로 산 위로 떠오름.
// .ha-sun 은 데/모 공유 클래스 → 컨테이너로 스코프 한정(translateY 양 다름).
// 모바일 정점 translateY는 산 능선(top~224) 위로 떠오르되 제목 2행(bottom~167)을
// 가리지 않도록 -78px로 튜닝(40px 해, 텍스트와 7px·능선과 10px 여유).
// 반딧불이(kd-loop-fireflies-fly)는 해 사이클과 반대 위상으로 페이드:
//   해 뜨면(50%, 낮) opacity 0, 해 지면(0%/100%, 밤) opacity 1. delay 0으로 위상 일치.
const SUN_RISE_CSS = `
@keyframes ha-sun-rise {
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-190px); }
  100% { transform: translateY(0); }
}
@keyframes ha-sun-rise-m {
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-78px); }
  100% { transform: translateY(0); }
}
@keyframes kd-firefly-daynight {
  0%   { opacity: 1; }
  50%  { opacity: 0; }
  100% { opacity: 1; }
}
.kd-figma-hero-desktop .ha-sun {
  animation: ha-sun-rise 10s ease-in-out infinite !important;
  transform-origin: center center;
}
.kd-figma-hero-mobile .ha-sun {
  animation: ha-sun-rise-m 10s ease-in-out infinite !important;
  transform-origin: center center;
}
/* 반딧불이 컨테이너 주야 페이드 — 해와 동기(10s, ease-in-out, delay 0).
   안쪽 6프레임 플립북(kd-loop-6)은 그대로, 바깥 opacity만 페이드. 데/모 공통. */
.kd-loop-fireflies-fly {
  animation: kd-firefly-daynight 10s ease-in-out infinite;
}
.kd-char-shadow {
  position: absolute; left: 50%; bottom: 2%;
  transform: translateX(-50%);
  width: 56%; height: 13%;
  border-radius: 50%;
  background: rgba(37, 27, 19, 0.16);
  pointer-events: none;
}
@keyframes kd-hero-daynight-bg {
  /* 해가 산 위에 떠 있는 동안 흰색 유지, 산 뒤로 사라질 때(82~95%)부터 노을색으로,
     다시 떠오를 때(15~28%) 흰색으로. 해 translateY 사이클(ease-in-out)의 가림 구간에 정합. */
  0%   { background-color: #fbeede; }
  15%  { background-color: #fbeede; }
  28%  { background-color: #ffffff; }
  82%  { background-color: #ffffff; }
  95%  { background-color: #fbeede; }
  100% { background-color: #fbeede; }
}
.kd-figma-hero-desktop, .kd-hero-desktop-inner { animation: kd-hero-daynight-bg 10s ease-in-out infinite; }
.kd-figma-hero-mobile, .kd-hero-mobile-inner { animation: kd-hero-daynight-bg 10s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  /* 모션 끄면 해는 정점(노출) 위치 정적, 반딧불이는 보이게(opacity 1) */
  .kd-figma-hero-desktop .ha-sun {
    animation: none !important;
    transform: translateY(-190px) !important;
  }
  .kd-figma-hero-mobile .ha-sun {
    animation: none !important;
    transform: translateY(-78px) !important;
  }
  .kd-loop-fireflies-fly {
    animation: none !important;
    opacity: 1 !important;
  }
  .kd-figma-hero-desktop, .kd-hero-desktop-inner, .kd-figma-hero-mobile, .kd-hero-mobile-inner {
    animation: none !important;
    background-color: #ffffff !important;
  }
}
`;

// ── 6프레임 루프: 풍경 (반딧불이·잎사귀·강 전용) ─────────────────
// 프레임 오프셋은 CSS keyframe 주기(kd-loop-6 1.5s, 프레임당 0.25s)에 정합한
// 0.25s 간격으로 둔다 → 6프레임이 빈틈(블랭크) 없이 연속 루핑.
// 바깥 div에 name 기반 식별 클래스(kd-loop-{name}) 부여 → 개별 타겟 가능
// (예: 반딧불이 주야 페이드는 .kd-loop-fireflies-fly 만, 잎씨앗은 제외).
function NatureLoop({
  name,
  style,
  delay,
}: {
  name: string;
  style?: React.CSSProperties;
  delay?: string;
}) {
  return (
    <div
      className={`kd-hero-loop-layer kd-nature-loop kd-loop-${name}`}
      style={style}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <img
          key={i}
          src={`/kkumdarak/nature-loops/${name}/frame-0${i}.svg`}
          alt=""
          className="kd-loop-frame"
          style={delay ? { animationDelay: `calc(${delay} + ${[-0, -0.25, -0.5, -0.75, -1.0, -1.25][i - 1]}s)` } : undefined}
        />
      ))}
    </div>
  );
}

// ── 정적 풍경 이미지 헬퍼 (현재 raster nature-loops 룩 유지) ───────
function StaticNature({ name, style }: { name: string; style?: React.CSSProperties }) {
  return (
    <img
      src={`/kkumdarak/nature-loops/${name}/frame-01.svg`}
      alt=""
      style={{ position: 'absolute', display: 'block', objectFit: 'contain', ...style }}
    />
  );
}

// ── 6프레임 루프: 캐릭터 ─────────────────────────────────────────
function CharLoop({
  charId,
  style,
  shadow = true,
}: {
  charId: string;
  style?: React.CSSProperties;
  shadow?: boolean;
}) {
  return (
    <div
      className="kd-hero-loop-layer"
      style={{ ...style, position: 'absolute' }}
    >
      {shadow && <span className="kd-char-shadow" aria-hidden="true" />}
      <div className="kd-char-loop" style={{ position: 'relative', width: '100%', height: '100%' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <img
            key={i}
            src={`/kkumdarak/chars-v2/${charId}/frame-0${i}.svg`}
            alt=""
            className="kd-loop-frame"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── 캐릭터 배치 좌표 타입 ─────────────────────────────────────────
type CharSpot = {
  id: string;          // character-XX
  x: number;
  y: number;
  w: number;
  h: number;
};

// 좌표 배열 → CharLoop 렌더 헬퍼
function renderChars(spots: CharSpot[]) {
  return spots.map((s) => (
    <CharLoop
      key={s.id + '-' + s.x + '-' + s.y}
      charId={s.id}
      shadow={s.id !== 'character-07'}
      style={{ left: s.x, top: s.y, width: s.w, height: s.h }}
    />
  ));
}

// ── 정적 이미지 헬퍼 ─────────────────────────────────────────────
function Img({
  src,
  x,
  y,
  w,
  h,
  cls,
}: {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cls?: string;
}) {
  return (
    <img
      alt=""
      src={BASE + src}
      className={cls}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'block',
      }}
    />
  );
}

// ══ 히어로 전용 캐릭터 7개 ════════════════════════════════════════
// 다른 섹션·내비에 등장하지 않는 히어로 전용 7개만 남김(디클러터):
//   character-01(바위 위·inline), 02, 04, 07, 10, 13, 16.
// "풍경 안에 서 있는" 안착 배치: 들판·강가 녹지 표면 위에 발(y+h)이 닿도록.
//   데스크톱 hill-trees(x470~1030, y392~749) 녹지 표면 ~y600~750,
//   river(x690~1160) 강가 지면. 흰 여백에 둥둥 뜨지 않게.
// 보호: 텍스트 안전영역(x≤560 & y60–470 좌상단) 가림 금지,
//       화면 안전여백 x 16–1364 / y 26–832 (클리핑 금지),
//       원근(상단·뒤 소형 → 하단·앞 대형), 군집+여백 리듬. char-01은 별도 inline.
//
// 레이어 ① 원경(상단 하늘) — 떠다님 / 들판 녹지 위 안착
const DESKTOP_FAR: CharSpot[] = [
  { id: 'character-07', x: 390,  y: 90,  w: 70,  h: 78 },   // "마을이 곧" 제목 옆 (07은 여기 1회만)
  { id: 'character-10', x: 500,  y: 548, w: 38,  h: 33 },   // 별소리꾼: 들판 좌측부 녹지 위 안착, 크기 유지(40)
];
//
// 레이어 ② 근경(중·하단) — 대형, 시원하게 — 녹지 표면 위 안착
const DESKTOP_NEAR: CharSpot[] = [
  { id: 'character-04', x: 490,  y: 608, w: 84,  h: 66 },  // 들판 좌측 녹지 위 안착(발 y668) — 흰여백 탈출
  { id: 'character-02', x: 592,  y: 640, w: 76,  h: 60 },  // 중앙 언덕 부근(발 y668)
  { id: 'character-16', x: 892,  y: 600, w: 84,  h: 80 },  // 강가 전경 녹지 위 안착(발 y686) — 흰여백 탈출
  { id: 'character-13', x: 800,  y: 676, w: 54,  h: 54 },   // 헤드폰머리: 산(x800~) 좌측, 더 작게 원경(28px)
];

// ══ 모바일 히어로 캐릭터 7개 ══════════════════════════════════════
// 컨테이너 390×730. 텍스트: kicker top46 / title(top74, line1 "마을이 곧" ~x[26,173]·y[74,122]) / body top548.
// 풍경 안착: hill-trees(x22~322,y300~492) 녹지 표면 ~y430~492, river(x150~382) 강가 지면.
// 제목·본문 가림 금지, 클리핑 금지. 발(y+h)이 녹지 위에 닿게.
//
// 레이어 ① 원경 / 들판 녹지 위 안착
const MOBILE_FAR: CharSpot[] = [
  { id: 'character-07', x: 210, y: 66,  w: 48, h: 54 },   // "마을이 곧" 제목 옆 (07은 여기 1회만, 중복 없음)
  { id: 'character-10', x: 160, y: 388, w: 26, h: 23 },   // 별소리꾼: 들판 좌측부 녹지 위 안착, 크기 유지(26)
];
//
// 레이어 ② 근경 — 녹지 표면 위 안착
const MOBILE_NEAR: CharSpot[] = [
  { id: 'character-04', x: 30,  y: 446, w: 58, h: 46 },   // 들판 좌측 녹지 위 안착(발 y494) — 흰여백 탈출
  { id: 'character-02', x: 92,  y: 420, w: 54, h: 42 },   // 중앙 언덕 부근(발 y504)
  { id: 'character-16', x: 272, y: 436, w: 54, h: 51 },   // 강가 전경 녹지 위 안착(발 y506)
  { id: 'character-13', x: 208, y: 458, w: 34, h: 34 },   // 헤드폰머리: 산(x178~) 좌측, 더 작게 원경(18px)
];

const HeroScene: React.FC = () => {
  return (
    <>
      {/* 해 일출/일몰 루프 + 반딧불이 주야 동기화 — 데스크톱·모바일 공통 */}
      <style>{SUN_RISE_CSS}</style>

      {/* ══ Desktop ══════════════════════════════════════════════ */}
      <div className="kd-figma-hero-desktop" data-node-id="74:149">
        <div className="kd-hero-desktop-inner">

          {/* 씬 레이어 */}
          <div className="kd-hero-scene-field">

            {/* ── 원경: 해 (산 뒤에서 떠올랐다 지는 루프) — 산보다 먼저 렌더 ── */}
            <Img src="sun.svg" x={980} y={290} w={98} h={98} cls="ha-sun" />

            {/* ── 원경: 먼 산 (정적, 좌이동 — 해를 가리는 실루엣) ── */}
            <StaticNature
              name="distant-mountain-breath"
              style={{ left: 800, top: 210, width: 462, height: 224 }}
            />

            {/* ── 중경: 강 흐름 (애니메이션 6프레임 루프 — 강만 흐름) ── */}
            <NatureLoop
              name="river-flow"
              style={{ left: 690, top: 412, width: 470, height: 286 }}
              delay="0s"
            />

            {/* ── 중경: 언덕 나무 (정적, 주연 매스) ───────────── */}
            <StaticNature
              name="hill-trees-sway"
              style={{ left: 470, top: 392, width: 560, height: 357 }}
            />

            {/* ── 원경 캐릭터 (상단 하늘에 떠다님) ──────────────── */}
            {renderChars(DESKTOP_FAR)}

            {/* ── 근경: char-01 (돌싹) — 바위 제거 후 들판 지면에 안착 ── */}
            <CharLoop
              charId="character-01"
              style={{ left: 678, top: 662, width: 72, height: 63 }}
            />

            {/* ── 근경 캐릭터 (중·하단, 대형) ───────────────────── */}
            {renderChars(DESKTOP_NEAR)}

            {/* ── 풍경 루프: 반딧불이 (강 상단, 내측 — 해 뜨면 사라짐) ─ */}
            <NatureLoop
              name="fireflies-fly"
              style={{ left: 1060, top: 360, width: 194, height: 205 }}
              delay="-0.5s"
            />

            {/* ── 풍경 루프: 씨앗/잎사귀 (들판 우측·강 부근으로 이동, 루프 유지) ── */}
            <NatureLoop
              name="leaves-seeds-drift"
              style={{ left: 736, top: 560, width: 135, height: 108 }}
              delay="-0.67s"
            />

          </div>{/* kd-hero-scene-field */}

          {/* ── 텍스트 블록 ──────────────────────────────────── */}
          <p className="hero-kicker">2026 꿈다락 문화예술학교</p>
          <div className="hero-title">
            <p>마을이 곧</p>
            <p>학교가 되는 자리</p>
          </div>
          <p className="hero-body">
            장암의 흙, 물길, 바위, 잎이 서로의 감각을 받아 적고<br />
            다음 세대의 문화로 이어지는 생활문화 거점입니다.
          </p>

        </div>{/* kd-hero-desktop-inner */}
      </div>

      {/* ══ Mobile ═══════════════════════════════════════════════ */}
      {/* 모바일 프레임: 390×796 (nav 66 포함), 컨테이너: 390×730
          텍스트 안전영역: kicker(top46) · title(top74, ~y74–170) · body(top548)
          → 캐릭터 7개 풍경 녹지 위 안착하되 제목·본문 글자 가림 금지         */}
      <div className="kd-figma-hero-mobile" data-node-id="18:3">
        <div className="kd-hero-mobile-inner">

          <div className="kd-hero-scene-field">

            {/* 해 (산 뒤에서 떠올랐다 지는 루프, 40px) — 산보다 먼저 렌더(산 뒤).
                정점에서 제목 2행(우단 x291) 안 가리게 x312·40px, 능선 위로만 노출 */}
            <Img src="sun.svg" x={312} y={252} w={40} h={40} cls="ha-sun" />

            {/* 먼 산 (정적, 해를 가리는 실루엣) */}
            <StaticNature
              name="distant-mountain-breath"
              style={{ left: 178, top: 210, width: 210, height: 102 }}
            />

            {/* 강 흐름 (애니메이션 6프레임 루프 — 강만 흐름) */}
            <NatureLoop
              name="river-flow"
              style={{ left: 150, top: 318, width: 232, height: 142 }}
              delay="0s"
            />

            {/* 언덕 나무 (정적) */}
            <StaticNature
              name="hill-trees-sway"
              style={{ left: 22, top: 300, width: 300, height: 192 }}
            />

            {/* 원경 캐릭터 (상단 하늘에 떠다님) */}
            {renderChars(MOBILE_FAR)}

            {/* char-01 (돌싹) — 바위 제거 후 들판 지면에 안착 */}
            <CharLoop
              charId="character-01"
              style={{ left: 150, top: 458, width: 46, height: 40 }}
            />

            {/* 근경 캐릭터 (중·하단) */}
            {renderChars(MOBILE_NEAR)}

            {/* 반딧불이 (강 상단 — 해 뜨면 사라짐) */}
            <NatureLoop
              name="fireflies-fly"
              style={{ left: 274, top: 300, width: 104, height: 110 }}
              delay="-0.5s"
            />

            {/* 씨앗/잎사귀 (들판 우측·강 부근으로 이동, 루프 유지) */}
            <NatureLoop
              name="leaves-seeds-drift"
              style={{ left: 170, top: 414, width: 78, height: 62 }}
              delay="-0.67s"
            />

          </div>{/* kd-hero-scene-field */}

          {/* 텍스트 */}
          <p className="m-hero-kicker">2026 꿈다락 문화예술학교</p>
          <div className="m-hero-title">
            <p>마을이 곧</p>
            <p>학교가 되는 자리</p>
          </div>
          <p className="m-hero-body">
            장암의 흙, 물길, 바위, 잎이 서로의 감각을<br />
            받아 적고 다음 세대의 문화로 이어지는<br />
            생활문화 거점입니다.
          </p>

        </div>{/* kd-hero-mobile-inner */}
      </div>
    </>
  );
};

export default HeroScene;
