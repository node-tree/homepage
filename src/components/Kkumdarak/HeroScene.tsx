import React from 'react';

// ── 정적 이미지 베이스 ────────────────────────────────────────────
const BASE = '/kkumdarak/hero/';

// ── 해(sun)·달(night) 교차 루프 + 마을 창문 주야 토글 (데/모 공통) ──
//
// ★ 2026-06 Figma 노드 74-149 신규 구도(우측 세로 토템) + 원근감(perspective) 재배치:
//   우측에 달·해 → 산 → 강 → 들판이 세로로 겹쳐 하나의 기둥처럼 연결, 마을은 좌측.
//   원근감: 위(원경)→아래(근경)로 content width 단조 증가(산<강<들판)로 공간 깊이 부여.
//   해·달은 산 위 상단을 base로 두고, 산 능선 뒤로 dip(+Δ)하며 엇갈려 교차.
//   가시=translateY(0), 은닉=translateY(+Δ)(아래로 dip). 해: 밤=+Δ 은닉/낮=0 가시, 달: 거울상.
//   day=50% 위상은 마을창문·반딧불이·배경 키프레임과 잠금되어 있으므로 보존.
const SUN_RISE_CSS = `
/* 해(낮 노출) — 릴레이: 낮(0~22%·82~100%) 노출, 22~32% 하강해 완전 은닉,
   32~72% 산 뒤에서 대기(밤 동안), 72~82% 다시 상승. 달과 동시에 보이지 않음. */
@keyframes ha-sun-rise {
  0%   { transform: translateY(0); }
  15%  { transform: translateY(0); }
  27%  { transform: translateY(200px); }
  75%  { transform: translateY(200px); }
  93%  { transform: translateY(0); }
  100% { transform: translateY(0); }
}
@keyframes ha-sun-rise-m {
  0%   { transform: translateY(0); }
  15%  { transform: translateY(0); }
  27%  { transform: translateY(90px); }
  75%  { transform: translateY(90px); }
  93%  { transform: translateY(0); }
  100% { transform: translateY(0); }
}
/* 달(밤 노출) — 릴레이: 해가 완전히 내려간 32% 후에야 상승(32~42%), 밤(42~62%) 노출,
   62~72% 하강해 은닉, 이후 낮 동안 산 뒤 대기. 해와 엇갈리지 않고 순차 교대. */
@keyframes kd-moon-rise {
  0%   { transform: translateY(200px); }
  32%  { transform: translateY(200px); }
  50%  { transform: translateY(0); }
  58%  { transform: translateY(0); }
  70%  { transform: translateY(200px); }
  100% { transform: translateY(200px); }
}
@keyframes kd-moon-rise-m {
  0%   { transform: translateY(90px); }
  32%  { transform: translateY(90px); }
  50%  { transform: translateY(0); }
  58%  { transform: translateY(0); }
  70%  { transform: translateY(90px); }
  100% { transform: translateY(90px); }
}
/* 반딧불이 — 밤(달 노출, ~37~67%)에 켜짐 */
@keyframes kd-firefly-daynight {
  0%   { opacity: 0; }
  15%  { opacity: 0; }
  32%  { opacity: 1; }
  70%  { opacity: 1; }
  90%  { opacity: 0; }
  100% { opacity: 0; }
}
/* 마을 창문 ON 토글 — 밤(달 노출, 33~72%)에 step 경계로 또렷이 켜짐 */
@keyframes kd-village-lights {
  0%,   29.99% { opacity: 0; }
  30%,  71.99% { opacity: 1; }
  72%,  100%   { opacity: 0; }
}
.kd-figma-hero-desktop .ha-sun {
  animation: ha-sun-rise 10s ease-in-out infinite !important;
  transform-origin: center center;
}
.kd-figma-hero-mobile .ha-sun {
  animation: ha-sun-rise-m 10s ease-in-out infinite !important;
  transform-origin: center center;
}
/* 달(밤) 컨테이너 — 해와 반대 위상으로 오르내림. 바깥 div(.kd-loop-night)에만 적용,
   안쪽 6프레임 플립북(kd-loop-frame)은 그대로. */
.kd-figma-hero-desktop .kd-loop-night {
  animation: kd-moon-rise 10s ease-in-out infinite;
  transform-origin: center center;
}
.kd-figma-hero-mobile .kd-loop-night {
  animation: kd-moon-rise-m 10s ease-in-out infinite;
  transform-origin: center center;
}
/* 반딧불이 컨테이너 주야 페이드 — 해와 동기(10s, ease-in-out, delay 0). */
.kd-loop-fireflies-fly {
  animation: kd-firefly-daynight 10s ease-in-out infinite;
}
/* ── 마을 2상태(주야 토글) — 6프레임 루프 대체 ── */
.kd-village-toggle { position: absolute; }
.kd-village-toggle img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: contain; display: block;
}
.kd-village-on {
  opacity: 0;
  animation: kd-village-lights 10s steps(1, end) infinite;
}
/* 마을 창문 웜 글로우 — ON 창문 위에 얹는 은은한 야간 블룸. */
.kd-village-glow {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 214, 120, 0.72) 0%,
    rgba(255, 196, 84, 0.52) 34%,
    rgba(255, 180, 60, 0.22) 62%,
    rgba(255, 180, 60, 0) 80%);
  mix-blend-mode: screen;
  pointer-events: none;
  filter: blur(1px);
  animation: kd-village-lights 10s steps(1, end) infinite;
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
  0%   { background-color: #ffffff; }
  15%  { background-color: #ffffff; }
  27%  { background-color: #F6EEDD; }
  75%  { background-color: #F6EEDD; }
  93%  { background-color: #ffffff; }
  100% { background-color: #ffffff; }
}
.kd-figma-hero-desktop, .kd-hero-desktop-inner { animation: kd-hero-daynight-bg 10s ease-in-out infinite; }
.kd-figma-hero-mobile, .kd-hero-mobile-inner { animation: kd-hero-daynight-bg 10s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  /* 모션 끄면 낮 상태로 고정: 해=base 노출(0), 달=산 뒤 은닉(+Δ),
     배경=흰색, 반딧불이=꺼짐. */
  .kd-figma-hero-desktop .ha-sun {
    animation: none !important;
    transform: translateY(0) !important;
  }
  .kd-figma-hero-mobile .ha-sun {
    animation: none !important;
    transform: translateY(0) !important;
  }
  .kd-figma-hero-desktop .kd-loop-night {
    animation: none !important;
    transform: translateY(200px) !important;
  }
  .kd-figma-hero-mobile .kd-loop-night {
    animation: none !important;
    transform: translateY(90px) !important;
  }
  .kd-loop-fireflies-fly {
    animation: none !important;
    opacity: 0 !important;
  }
  .kd-village-on {
    animation: none !important;
    opacity: 0 !important;
  }
  .kd-village-glow {
    animation: none !important;
    opacity: 0 !important;
  }
  .kd-figma-hero-desktop, .kd-hero-desktop-inner, .kd-figma-hero-mobile, .kd-hero-mobile-inner {
    animation: none !important;
    background-color: #ffffff !important;
  }
}
`;

// ── 6프레임 루프: 풍경 (반딧불이·잎사귀·강·산·들판·밤 전용) ───
//   img: decoding="async" 로 메인 스레드 디코드 블로킹 완화(좌표/룩 무관).
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
          decoding="async"
          style={delay ? { animationDelay: `calc(${delay} + ${[-0, -0.25, -0.5, -0.75, -1.0, -1.25][i - 1]}s)` } : undefined}
        />
      ))}
    </div>
  );
}

// ── 마을 2상태 토글: lights-off(기본/낮) + lights-on(밤에 또렷이 켜짐) ──
function VillageToggle({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="kd-hero-loop-layer kd-village-toggle kd-loop-village" style={style}>
      <img className="kd-village-base" src="/kkumdarak/nature-loops/village/lights-off.svg" alt="" decoding="async" />
      <img className="kd-village-on" src="/kkumdarak/nature-loops/village/static.svg" alt="" decoding="async" />
    </div>
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
            decoding="async"
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
      decoding="async"
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

// ══ 히어로 전용 캐릭터 ════════════════════════════════════════════
// ★ 2026-06 원근감 풍경에 맞춰 캐릭터를 새 표면에 재접지.
//   ※ 2026-06-03 가로간격 축소 패스: 산 그룹(산·해·달·char-10·반딧불이) 좌측 이동,
//     들판 우측寄り·축소(600→550)로 대각선 가로 폭 압축. 아래 캐릭터 좌표는 실측 재접지값.
//   캐릭터는 들판 색면·산 표면에 발(y+h)이 닿게 안착(floater 금지). 픽셀 실측으로 접지 확인.
//
// 레이어 ① 원경(상단·소형)
const DESKTOP_FAR: CharSpot[] = [
  { id: 'character-07', x: 452,  y: 92,  w: 70,  h: 78 },   // 제목 옆 — "마을이 곧 예술" 우측(불변)
  { id: 'character-10', x: 1191, y: 312, w: 46,  h: 40 },   // 별소리꾼: 산 빨간바위 아래(산 동반 +90)
];
//
// 레이어 ② 근경(중·하단·대형) — 들판 표면 위 안착
const DESKTOP_NEAR: CharSpot[] = [
  // 들판 좌측 플랭크 접지(근경 대형)
  { id: 'character-04', x: 984,  y: 560, w: 80,  h: 74 },  // 빨간별 캐릭터: 들판 바로 오른쪽 옆 접지(우측 +100)
  // 마을 양옆(같은 바닥선 y650 = 한옥 지면)
  { id: 'character-13', x: 2,    y: 574, w: 76,  h: 76 },  // 마을 좌측 여백(cx40, 발 y650, 확대)
  { id: 'character-02', x: 482,  y: 574, w: 76,  h: 76 },  // 마을 우측 여백(cx520, 발 y650, 확대)
  // 들판 우측 플랭크 접지(로봇)
  { id: 'character-16', x: 916,  y: 450, w: 72,  h: 68 },  // 로봇: 강 중간 아래 접지(강 동반 +40)
];

// ══ 모바일 히어로 캐릭터 ══════════════════════════════════════════
// 컨테이너 390×730. 텍스트 안전영역: kicker(top46) · title(top74, ~y74–236) · body(top≈594).
//
// ★ 원근 풍경(모바일 좌표) — 데스크톱과 동일 비율로 가로간격 축소 + 들판 축소(168→152).
//   캐릭터는 들판 색면·산 표면에 발 접지. 우측 ≤390, 제목/본문 미침범.
//
// 레이어 ① 원경(상단·소형)
const MOBILE_FAR: CharSpot[] = [
  { id: 'character-07', x: 258, y: 70,  w: 44, h: 50 },   // 제목 옆(불변)
  { id: 'character-10', x: 182, y: 300, w: 30, h: 28 },   // 별소리꾼: 산 빨간바위 위(확대)
];
//
// 레이어 ② 근경
const MOBILE_NEAR: CharSpot[] = [
  // 들판 좌측 플랭크 접지
  { id: 'character-04', x: 344, y: 401, w: 42, h: 38 },   // 빨간별: 들판 오른쪽 가장자리(더 오른쪽)
  // 마을 양옆(같은 바닥선 y389 = 한옥 지면)
  { id: 'character-13', x: 4,   y: 512, w: 38, h: 38 },   // 마을 좌측(확대, 발 y550)
  { id: 'character-02', x: 178, y: 510, w: 40, h: 40 },   // 마을 우측(확대, 발 y550)
  // 들판 우측 플랭크 접지(로봇)
  { id: 'character-16', x: 166, y: 385, w: 44, h: 40 },   // 책로봇: 강 아래(오른쪽으로 더 이동)
];

const HeroScene: React.FC = () => {
  return (
    <>
      {/* 해·달 교차 루프 + 마을창문/반딧불이 주야 동기화 — 데/모 공통 */}
      <style>{SUN_RISE_CSS}</style>

      {/* ══ Desktop ══════════════════════════════════════════════ */}
      <div className="kd-figma-hero-desktop" data-node-id="74:149">
        <div className="kd-hero-desktop-inner">

          {/* 씬 레이어 */}
          <div className="kd-hero-scene-field">

            {/* ══ 원근감(perspective) 우측 세로 토템 (2026-06).
                렌더 순서(뒤→앞): 해·달 → 산 → 강 → 들판 → 마을 → 캐릭터.
                ※ 2026-06-03 가로간격 축소: 산 그룹 −110, 강 −50, 들판 +30·축소(600→550).
                대각선 흐름·세로 겹침 유지하되 가로 폭 압축. ══ */}

            {/* ── 천체 ①: 해 — 산 우상단 노출. 산보다 먼저 렌더(산이 dip 가림). 산 그룹과 함께 −110 ── */}
            <Img src="sun.svg" x={1182} y={8} w={64} h={64} cls="ha-sun" />

            {/* ── 천체 ②: 밤(달·별) — 산 위 노출. 해와 반대 위상 교차. 산 그룹과 함께 −110 ── */}
            <NatureLoop
              name="night"
              style={{ left: 1174, top: 0, width: 80, height: 80 }}
              delay="0s"
            />

            {/* ── 천체 ③: 산 — 원경 최소. 해·달 가림(교차 앵커). 가로압축 −110(984→874). ── */}
            <NatureLoop
              name="mountain"
              style={{ left: 1076, top: 115, width: 276, height: 276 }}
              delay="-0.3s"
            />

            {/* ══ 전경 매스 (뒤→앞): 강 → 들판 → 마을 — 세로 토템(연결·겹침) ══ */}

            {/* ── 강/연못 — 중경. 산과 세로 겹침. 가로압축 −50(709→659) + 산 축소 후 재연결 위해 상향 191→172. ── */}
            <NatureLoop
              name="river"
              style={{ left: 799, top: 232, width: 380, height: 380 }}
              delay="-0.9s"
            />

            {/* ── 들판 — 근경 최대(원근 강조). 강과 세로 겹침. 가로압축 +14(418→432) + 축소 550→478(center 고정, 좌468/상395). ── */}
            <NatureLoop
              name="field"
              style={{ left: 592, top: 419, width: 430, height: 430 }}
              delay="-0.6s"
            />

            {/* ── 마을(한옥) — 좌측 근경(좌측 앵커, 불변). 들판과 겹침 유지. 2상태 주야 토글. ── */}
            <VillageToggle
              style={{ left: 63, top: 300, width: 460, height: 460 }}
            />

            {/* ── 마을 창문 웜 글로우 (밤=켜짐/낮=꺼짐, 달 위상 동기) ──
                village content 창문 위치(~중앙 하부)에 정렬(마을 불변 → glow 불변). */}
            <span
              className="kd-village-glow"
              style={{ left: 322, top: 539, width: 50, height: 50 }}
            />

            {/* ── 원경 캐릭터 (상단·뒤, 소형) ──────────────────── */}
            {renderChars(DESKTOP_FAR)}

            {/* ── 근경: char-01 (돌싹) — 강/들판 경계 새싹 위에 안착(들판 우측이동·축소 후 재접지) ── */}
            <CharLoop
              charId="character-01"
              style={{ left: 728, top: 402, width: 66, height: 60 }}
            />

            {/* ── 근경 캐릭터 (중·하단, 대형) ───────────────────── */}
            {renderChars(DESKTOP_NEAR)}

            {/* ── 풍경 루프: 반딧불이 (강 우측 옆, 강 y레벨, 해 뜨면 사라짐). char-10 동반 ─ */}
            <NatureLoop
              name="fireflies-fly"
              style={{ left: 1210, top: 300, width: 160, height: 170 }}
              delay="-0.5s"
            />

            {/* ── 풍경 루프: 씨앗/잎사귀 (강·들판 경계 위로 드리프트, 루프 유지). 들판 우측이동 후 재정렬 ── */}
            <NatureLoop
              name="leaves-seeds-drift"
              style={{ left: 728, top: 600, width: 120, height: 96 }}
              delay="-0.67s"
            />

          </div>{/* kd-hero-scene-field */}

          {/* ── 텍스트 블록 ──────────────────────────────────── */}
          <p className="hero-kicker">2026 꿈다락 문화예술학교</p>
          <div className="hero-title">
            <p>마을이 곧 예술</p>
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
          텍스트 안전영역: kicker(top46) · title(top74, ~y74–236) · body(top≈594, x28–338)
          → 원근 토템은 제목 아래·본문 위 띠에 우측 세로(산<강<들판), 마을은 좌측. */}
      <div className="kd-figma-hero-mobile" data-node-id="18:3">
        <div className="kd-hero-mobile-inner">

          <div className="kd-hero-scene-field">

            {/* ══ 원근 우측 세로 토템 — 데스크톱과 동형(content width 단조 증가).
                ※ 2026-06-03 가로간격 축소: 산 그룹 −30, 강 −14, 들판 +8·축소(168→152).
                렌더 순서(뒤→앞): 해·달 → 산 → 강 → 들판 → 마을. ══ */}

            {/* ── 천체 ①: 해 — 산 우상단 노출. 산보다 먼저 렌더(산이 dip 가림). 산 그룹과 함께 −30 ── */}
            <Img src="sun.svg" x={182} y={174} w={28} h={28} cls="ha-sun" />

            {/* ── 천체 ②: 밤(달·별) — 산 위 노출. 해와 반대 위상 교차. 산 그룹과 함께 −30 ── */}
            <NatureLoop
              name="night"
              style={{ left: 176, top: 174, width: 40, height: 40 }}
              delay="0s"
            />

            {/* ── 천체 ③: 산 — 원경 최소. 해·달 가림. 가로압축 −30 후 축소 78→72(좌260, center-x 유지). ── */}
            <NatureLoop
              name="mountain"
              style={{ left: 126, top: 192, width: 140, height: 140 }}
              delay="-0.3s"
            />

            {/* ══ 전경 매스 (뒤→앞): 강 → 들판 → 마을 — 세로 토템(연결·겹침) ══ */}

            {/* ── 강 — 중경. 산과 겹침. 가로압축 −14(194→180) + 산 축소 후 재연결 위해 상향 231→225. ── */}
            <NatureLoop
              name="river"
              style={{ left: 7, top: 254, width: 195, height: 195 }}
              delay="-0.9s"
            />

            {/* ── 들판 — 근경 최대. 강과 겹침. 가로압축 +8(105→113) + 축소 152→132(center 고정, 좌123/상287). 우측 ≤390. ── */}
            <NatureLoop
              name="field"
              style={{ left: 195, top: 308, width: 180, height: 180 }}
              delay="-0.6s"
            />

            {/* ── 마을(한옥) — 좌측 근경(좌측 앵커, 불변). 들판과 겹침. 2상태 토글 ── */}
            <VillageToggle
              style={{ left: 19, top: 385, width: 200, height: 200 }}
            />

            {/* ── 마을 창문 웜 글로우 (밤=켜짐/낮=꺼짐, 달 위상 동기) ──
                village content 창문 위치(~중앙 하부)에 정렬(마을 불변 → glow 불변). */}
            <span
              className="kd-village-glow"
              style={{ left: 132, top: 490, width: 20, height: 20 }}
            />

            {/* ── 원경 캐릭터 (상단·뒤, 소형) ── */}
            {renderChars(MOBILE_FAR)}

            {/* ── char-01 (돌싹) — 강/들판 경계 새싹 위에 안착(들판 우측이동·축소 후 재접지) ── */}
            <CharLoop
              charId="character-01"
              style={{ left: 28, top: 373, width: 40, height: 36 }}
            />

            {/* ── 근경 캐릭터 (중·하단) ── */}
            {renderChars(MOBILE_NEAR)}

            {/* ── 반딧불이 (강 우측 옆, 강 y레벨, 해 뜨면 사라짐). char-10 동반 ── */}
            <NatureLoop
              name="fireflies-fly"
              style={{ left: 238, top: 256, width: 58, height: 62 }}
              delay="-0.5s"
            />

            {/* ── 씨앗/잎사귀 (강·들판 경계 위로 드리프트, 루프 유지). 들판 우측이동 후 재정렬 ── */}
            <NatureLoop
              name="leaves-seeds-drift"
              style={{ left: 265, top: 391, width: 42, height: 34 }}
              delay="-0.67s"
            />

          </div>{/* kd-hero-scene-field */}

          {/* 텍스트 */}
          <p className="m-hero-kicker">2026 꿈다락 문화예술학교</p>
          <div className="m-hero-title">
            <p>마을이 곧 예술</p>
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
