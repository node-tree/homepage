import React from 'react';
import IntroChar from './IntroChar';

// ── 모바일 오시는길 캐릭터-그림자 정렬 패치 (모바일 전용) ─────────────
// 라벨(생산소·주민 자치)은 지도 위치 기준점 → 원래 자리에 고정(라벨 이동 금지).
// 정렬은 캐릭터+그림자를 라벨의 원래 가로 중심으로 옮겨서 맞춘다.
// 측정(폭390, CSS px): 라벨 원래 중심 = 생산소 309, 주민자치 181.
//   기존 캐릭터 시각 중심 = 생산소 332, 주민자치 204 → 각각 ~23px 우측 치우침.
// 해결: 캐릭터 .map-character-scale 의 translate-x 와 그림자 ::after 의 left 를
//   같은 양(−23px)만큼 좌로 이동 → 캐릭터·그림자가 한 몸으로 라벨 위 중앙에.
//   데스크톱(.kd-map-desktop) 무영향. (kkumdarak.css 직접편집 불가 → 컴포넌트 오버라이드)
const MAP_MOBILE_SHADOW_CSS = `
@media (max-width: 900px) {
  .kd-map-mobile .pin-saengsanso .map-character-scale {
    transform: translate(7px, -26px) scale(0.48);
  }
  .kd-map-mobile .pin-saengsanso::after {
    left: 48px;
    bottom: 58px;
    width: 50px;
  }
  .kd-map-mobile .pin-jumin .map-character-scale {
    transform: translate(-23px, 0) scale(0.48);
    transform-origin: center top;
  }
  .kd-map-mobile .pin-jumin::after {
    left: 17px;
    bottom: 44px;
    width: 50px;
  }
}
`;

// ── 오시는길 「마을 안내판」 — 리스타일(구조 보존) (2026-06-12) ─────────────
//   사용자 정정: 원본 약도의 "지도 자체"(도로 구조·갈래·방향, 건물 위치·상대배치,
//     핀 위치)는 그대로 유지하고, 디자인(시각 표현)만 새로 입힌다.
//   → 원본 figma-map-canvas 마크업(.road-* / .nonghyup / .office / 두 캐릭터 핀)을
//     그대로 쓰고, 좌표(구조)는 원본과 동일하게 둔다. 바꾸는 것은 스타일뿐:
//       · 도로/건물 색·선 굵기·표면 톤(약도 종이 느낌)
//       · 범례 색 연동 — 생산소 라벨/마커=초록, 주민자치센터=파랑(농협·면사무소는 중립)
//       · 라벨 타이포/문구 재구성(주소 보조표기 추가, 겹침 없음)
//       · 의미 없던 "지도" 타일 → 방위(나침반) 장식으로 교체
//   안내판 보드(머리+지도+범례+카드)로 묶고 데스크톱 보드를 수평 중앙정렬.
//   kkumdarak.css 직접편집 불가 규칙 → 신규 스타일 전부 이 컴포넌트 <style> 주입.
const MAP_BOARD_CSS = `
/* 공통 토큰(주입 스코프 한정) */
.kd-directions {
  --mb-board: #fffdf5;
  --mb-ink: #1a1a1a;
  --mb-yellow: #ffba12;
  --mb-green: #259f3e;
  --mb-blue: #1b55e2;
  --mb-road: #dcd7ca;
  --mb-paper: #f4f2ea;
  --mb-neutral: #d2cdbf;
  /* 정제 스케일: 테두리 위계(주 3 → 보조 2.5 → 라벨 2) · 하드섀도 절제 */
  --mb-bd-1: 3px;     /* 주 프레임 */
  --mb-bd-2: 2.5px;   /* 카드·건물 */
  --mb-bd-3: 2px;     /* 라벨·필·범례 */
  --mb-sh-board: 6px;
  --mb-sh-card: 3px;
  --mb-sh-sm: 2.5px;
  --mb-sh-xs: 1.5px;
}

/* ── 안내판 프레임 ─────────────────────────────────────────────── */
.kd-directions .kd-mapboard {
  position: absolute;
  border: var(--mb-bd-1) solid var(--mb-ink);
  border-radius: 22px;
  background: var(--mb-board);
  box-shadow: var(--mb-sh-board) var(--mb-sh-board) 0 var(--mb-ink);
  z-index: 0;
}
.kd-directions .kd-mapboard-head {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 11px;
  border: var(--mb-bd-2) solid var(--mb-ink);
  border-radius: 999px;
  background: var(--mb-yellow);
  box-shadow: var(--mb-sh-sm) var(--mb-sh-sm) 0 var(--mb-ink);
  font-family: var(--kd-font-body);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--mb-ink);
}
.kd-directions .kd-mapboard-head .mb-dot {
  display: inline-grid;
  place-items: center;
  border: var(--mb-bd-3) solid var(--mb-ink);
  border-radius: 50%;
  background: #fff;
}
.kd-directions .kd-mapboard-head .mb-dot::before {
  content: '';
  display: block;
  border-radius: 50%;
  background: var(--mb-ink);
}

/* ── 핀 범례 ───────────────────────────────────────────────────── */
.kd-directions .kd-map-legend {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--kd-font-body);
  font-weight: 800;
  color: var(--mb-ink);
}
.kd-directions .kd-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: var(--mb-bd-3) solid var(--mb-ink);
  border-radius: 999px;
  background: #fff;
  box-shadow: var(--mb-sh-xs) var(--mb-sh-xs) 0 var(--mb-ink);
  letter-spacing: -0.01em;
}
.kd-directions .kd-legend-item .swatch {
  display: inline-block;
  border: 1.8px solid var(--mb-ink);
  border-radius: 50%;
}
.kd-directions .kd-legend-tip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(26,26,26,0.52);
  letter-spacing: -0.01em;
}
.kd-directions .kd-legend-tip svg { display: block; }

/* ════════════ 약도 — 구조는 원본 유지, 스타일만 리디자인 ════════════ */
/* 캔버스: 약도 종이 톤 + 옅은 격자 */
.kd-directions .figma-map-canvas {
  background: var(--mb-paper);
  box-shadow: var(--mb-sh-card) var(--mb-sh-card) 0 var(--mb-ink);
}
.kd-directions .figma-map-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(33,25,20,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(33,25,20,0.035) 1px, transparent 1px);
  background-size: 12% 16%;
  pointer-events: none;
}

/* 도로 — 색/선만 리스타일(좌표·크기·각도는 원본 유지) */
.kd-directions .road { background: var(--mb-road); border-color: var(--mb-ink); }
.kd-directions .road-gray { background: var(--mb-road); border-color: var(--mb-ink); }
.kd-directions .road-pink,
.kd-directions .road-red,
.kd-directions .road-yellow { background: var(--mb-road); }

/* 농협(좌 다이아) — 중립 회색조(원본 위치·회전 유지) */
.kd-directions .nonghyup {
  background: #fff;
  border-color: var(--mb-ink);
  color: var(--mb-ink);
}
/* 면사무소(중앙 원) — 중립(원본 위치 유지) */
.kd-directions .office {
  background: #fff;
  border-color: var(--mb-ink);
  color: var(--mb-ink);
}

/* 캐릭터 핀 라벨 — 범례 색 연동(생산소=초록 / 주민자치=파랑) */
.kd-directions .pin-saengsanso > .map-pin-label {
  background: var(--mb-green);
  color: #fff;
  border-color: var(--mb-ink);
}
.kd-directions .pin-jumin > .map-pin-label {
  background: var(--mb-blue);
  color: #fff;
  border-color: var(--mb-ink);
}
/* 라벨 보조 주소 한 줄 */
.kd-directions .map-pin-label {
  letter-spacing: -0.01em;
}
.kd-directions .map-pin-label .pin-sub {
  display: block;
  margin-top: 1px;
  font-weight: 700;
  letter-spacing: 0;
  opacity: 0.78;
}

/* 방위 나침반 — 의미 없던 "지도" 타일을 대체(원본 타일 자리) */
.kd-directions .mountain-tile {
  background: #fffdf5 !important;
  border: var(--mb-bd-2) solid var(--mb-ink) !important;
  border-radius: 50% !important;
  box-shadow: var(--mb-sh-sm) var(--mb-sh-sm) 0 var(--mb-ink);
  font-size: 0 !important;
  display: grid;
  place-items: center;
  overflow: visible;
}
.kd-directions .mountain-tile .nlabel {
  position: absolute;
  top: 6%;
  font-family: var(--kd-font-head);
  font-size: 13px;
  color: var(--kd-figma-red, #f02e1f);
  line-height: 1;
}
.kd-directions .mountain-tile .needle { width: 0; height: 0; }
.kd-directions .mountain-tile .needle.n {
  border-left: 8px solid transparent; border-right: 8px solid transparent;
  border-bottom: 19px solid var(--kd-figma-red, #f02e1f); margin-bottom: 1px;
}
.kd-directions .mountain-tile .needle.s {
  border-left: 8px solid transparent; border-right: 8px solid transparent;
  border-top: 19px solid var(--mb-ink);
}

/* ── 정보카드 ─────────────────────────────────────────────────── */
.kd-directions .map-info-card {
  background: #fff;
  border-radius: 18px;
  border-width: var(--mb-bd-2);
  box-shadow: var(--mb-sh-card) var(--mb-sh-card) 0 var(--mb-ink);
}
.kd-directions .map-info-card p {
  grid-template-columns: max-content 1fr;
  align-items: center;
}
.kd-directions .map-info-card p span {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  border: 2px solid var(--mb-ink);
  border-radius: 999px;
  background: #fff8e3;
  white-space: nowrap;
  line-height: 1.1;
}
/* 카드 타이포·여백 리듬 정밀화(정제 패스) */
.kd-directions .map-info-card { padding: 22px 24px; }
.kd-directions .map-info-card header { margin-bottom: 14px; gap: 11px; }
.kd-directions .map-info-card h2 { letter-spacing: -0.015em; }
.kd-directions .map-info-card p { margin: 0 0 11px; column-gap: 11px; align-items: baseline; }
.kd-directions .map-info-card p:last-of-type { margin-bottom: 0; }
.kd-directions .map-info-card p b { letter-spacing: -0.01em; line-height: 1.35; }
/* 라벨 필: 패딩·정렬 일관화 */
.kd-directions .map-info-card p span {
  justify-self: start;
  align-self: center;
  display: inline-flex;
  align-items: center;
  padding: 2.5px 11px;
  border: var(--mb-bd-3) solid var(--mb-ink);
  border-radius: 999px;
  background: #fff8e3;
  white-space: nowrap;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

/* ── 진입 리빌 + 핀 호버 ──────────────────────────────────────── */
.kd-directions .kd-mapboard,
.kd-directions .kd-mapboard-head,
.kd-directions .figma-map-canvas,
.kd-directions .kd-map-legend,
.kd-directions .map-info-card {
  animation: mb-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both;
}
.kd-directions .kd-mapboard { animation-delay: 0s; }
.kd-directions .kd-mapboard-head { animation-delay: 0.06s; }
.kd-directions .figma-map-canvas { animation-delay: 0.12s; }
.kd-directions .kd-map-legend { animation-delay: 0.18s; }
.kd-directions .map-info-card:nth-of-type(1) { animation-delay: 0.24s; }
.kd-directions .map-info-card:nth-of-type(2) { animation-delay: 0.3s; }
@keyframes mb-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.kd-directions .map-character-pin {
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.kd-directions .map-character-pin:hover { transform: translateY(-5px); }

@media (prefers-reduced-motion: reduce) {
  .kd-directions .kd-mapboard,
  .kd-directions .kd-mapboard-head,
  .kd-directions .figma-map-canvas,
  .kd-directions .kd-map-legend,
  .kd-directions .map-info-card {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .kd-directions .map-character-pin { transition: none; }
}

/* ════════════ 데스크톱(1440 캔버스) — 보드 수평 중앙정렬 ════════════
   보드 width 1008 → left (1440-1008)/2 = 216 (좌우여백 216 대칭). */
.kd-map-desktop .kd-mapboard {
  left: 216px;
  top: 168px;
  width: 1008px;
  height: 968px;
}
.kd-map-desktop h1 { z-index: 2; letter-spacing: -0.02em; }
.kd-map-desktop .map-sub { z-index: 2; letter-spacing: -0.01em; color: rgba(26,26,26,0.6); }
.kd-map-desktop .kd-mapboard-head {
  left: 248px;
  top: 188px;
  height: 46px;
  padding: 0 22px 0 14px;
  font-size: 17px;
}
.kd-map-desktop .kd-mapboard-head .mb-dot { width: 28px; height: 28px; }
.kd-map-desktop .kd-mapboard-head .mb-dot::before { width: 11px; height: 11px; }
.kd-map-desktop .walk-label {
  left: 1072px;
  right: auto;
  top: 196px;
  z-index: 2;
}
.kd-map-desktop .figma-map-canvas {
  left: 248px;
  top: 252px;
  width: 944px;
  height: 470px;
  z-index: 1;
}
.kd-map-desktop .kd-map-legend {
  left: 248px;
  top: 740px;
  width: 944px;
  font-size: 14px;
}
.kd-map-desktop .kd-legend-item { padding: 6px 14px 6px 10px; }
.kd-map-desktop .kd-legend-item .swatch { width: 16px; height: 16px; }
.kd-map-desktop .kd-legend-tip { font-size: 13px; }
.kd-map-desktop .map-card-row { left: 248px; top: 800px; width: 944px; gap: 22px; z-index: 1; }

/* 데스크톱 약도 라벨 보조주소 글자 */
.kd-map-desktop .map-pin-label .pin-sub { font-size: 9px; }

/* 보드를 담도록 데스크톱 캔버스/섹션 높이 확장 — 1024px+ 한정 */
@media (min-width: 1024px) {
  .kd-figma-map { min-height: 1224px; }
  .kd-map-desktop { height: 1154px; }
}

/* 데스크톱 캔버스 내부 약도 요소 — 원본 구조를 470 높이에 맞춰 비율 보존 재배치
   (좌표 비율은 원본 960×576 → 944×470 동일 환산. 도로 갈래/건물/핀 상대배치 유지) */
.kd-map-desktop .figma-map-canvas .road-pink { top: 96px; }
.kd-map-desktop .figma-map-canvas .road-red { top: 210px; }
.kd-map-desktop .figma-map-canvas .road-v1 { height: 470px; }
.kd-map-desktop .figma-map-canvas .road-v2 { height: 224px; }
.kd-map-desktop .figma-map-canvas .road-v3 { top: 226px; }
.kd-map-desktop .figma-map-canvas .road-yellow { top: 378px; }
.kd-map-desktop .figma-map-canvas .nonghyup { top: 168px; }
.kd-map-desktop .figma-map-canvas .office { top: 134px; }
.kd-map-desktop .figma-map-canvas .pin-saengsanso { top: 104px; }
.kd-map-desktop .figma-map-canvas .pin-jumin { top: 262px; }
/* 나침반 타일(원본 "지도" 타일 자리) */
.kd-map-desktop .figma-map-canvas .mountain-tile {
  left: 798px; top: 360px; width: 96px; height: 96px;
}

/* ════════════ 모바일(390 캔버스) — 보드 좌우여백 12 대칭 ════════════ */
@media (max-width: 900px) {
  .kd-map-mobile .kd-mapboard {
    left: 12px;
    top: 128px;
    width: 366px;
    height: 988px;
  }
  .kd-map-mobile h1 { z-index: 2; letter-spacing: -0.02em; }
  .kd-map-mobile .map-sub { z-index: 2; top: 110px; letter-spacing: -0.01em; color: rgba(26,26,26,0.6); }
  .kd-map-mobile .kd-mapboard-head {
    left: 24px;
    top: 144px;
    height: 36px;
    padding: 0 16px 0 10px;
    font-size: 13px;
    gap: 8px;
  }
  .kd-map-mobile .kd-mapboard-head .mb-dot { width: 22px; height: 22px; }
  .kd-map-mobile .kd-mapboard-head .mb-dot::before { width: 9px; height: 9px; }
  .kd-map-mobile .walk-label {
    left: auto;
    right: 26px;
    top: 151px;
    width: auto;
    padding: 0 10px;
    z-index: 2;
  }
  .kd-map-mobile .figma-map-canvas {
    left: 24px;
    top: 196px;
    width: 342px;
    height: 300px;
    z-index: 1;
  }
  .kd-map-mobile .kd-map-legend {
    left: 24px;
    top: 512px;
    width: 342px;
    font-size: 11px;
    gap: 7px;
  }
  .kd-map-mobile .kd-legend-item { padding: 4px 10px 4px 7px; }
  .kd-map-mobile .kd-legend-item .swatch { width: 12px; height: 12px; }
  .kd-map-mobile .kd-legend-tip { display: none; }

  /* 모바일 카드: 보드 안으로 수납 */
  .kd-map-mobile .map-info-card { left: 24px; width: 342px; z-index: 1; }
  .kd-map-mobile .map-info-card:nth-of-type(1) { top: 556px; }
  .kd-map-mobile .map-info-card:nth-of-type(2) { top: 838px; }
  .kd-map-mobile .map-info-card p { grid-template-columns: max-content 1fr; }
  .kd-map-mobile .map-info-card p span { padding: 3px 10px; }

  /* 모바일 약도 내부 요소 — 원본 구조를 300 높이에 맞춰 비율 보존 재배치 */
  .kd-map-mobile .figma-map-canvas .road-pink { top: 70px; }
  .kd-map-mobile .figma-map-canvas .road-red { top: 132px; }
  .kd-map-mobile .figma-map-canvas .road-v1 { height: 300px; }
  .kd-map-mobile .figma-map-canvas .road-v2 { height: 142px; }
  .kd-map-mobile .figma-map-canvas .road-v3 { top: 140px; }
  .kd-map-mobile .figma-map-canvas .road-yellow { top: 240px; }
  .kd-map-mobile .figma-map-canvas .nonghyup { top: 49px; }
  .kd-map-mobile .figma-map-canvas .office { top: 84px; }
  .kd-map-mobile .figma-map-canvas .pin-saengsanso { top: 64px; }
  .kd-map-mobile .figma-map-canvas .pin-jumin { top: 144px; }
  /* 모바일 나침반 타일 */
  .kd-map-mobile .figma-map-canvas .mountain-tile {
    left: auto; right: 6px; top: auto; bottom: 6px; width: 50px; height: 50px;
  }
  .kd-map-mobile .mountain-tile .nlabel { font-size: 8px; top: 5%; }
  .kd-map-mobile .mountain-tile .needle.n { border-bottom-width: 12px; border-left-width: 5px; border-right-width: 5px; }
  .kd-map-mobile .mountain-tile .needle.s { border-top-width: 12px; border-left-width: 5px; border-right-width: 5px; }
  .kd-map-mobile .map-pin-label .pin-sub { display: none; }

  /* 보드를 담도록 섹션·캔버스 높이 */
  .kd-figma-map { min-height: 1162px; }
  .kd-map-mobile { height: 1162px; }
}
`;

// ── 오시는길 「문의 · 노드트리 사무국」 표기 ──────────────────────────
//   이메일은 mailto 링크. 전화번호는 표기하지 않는다(사용자 지시, 2026-06-11).
const OFFICE_EMAIL = 'nodetree.pmaker@gmail.com';

// 오시는길 정보 행 타입: [라벨, 값, href?]. href 가 있으면 값을 링크(<a>)로 렌더.
type InfoRow = [label: string, value: string, href?: string];

// 약도 위 캐릭터 핀(원본 구조 유지). 라벨에 보조주소(sub) 한 줄을 옵션으로 더한다.
const CharacterPin: React.FC<{ className: string; src: string; label: string; sub?: string }> = ({ className, src, label, sub }) => (
  <div className={`map-character-pin ${className}`}>
    <div className="map-character-scale">
      <IntroChar src={src} alt={label} />
    </div>
    <span className="map-pin-label">
      {label}
      {sub ? <span className="pin-sub">{sub}</span> : null}
    </span>
  </div>
);

const InfoCard: React.FC<{
  color: string;
  title: string;
  rows: InfoRow[];
  charSrc?: string;
}> = ({ color, title, rows, charSrc }) => (
  <article className="map-info-card">
    <header>
      {charSrc ? (
        <span className="map-info-card-char" aria-hidden="true">
          <span className="map-info-card-char-scale">
            <IntroChar src={charSrc} alt="" />
          </span>
        </span>
      ) : (
        <i style={{ background: color }} />
      )}
      <h2>{title}</h2>
    </header>
    {rows.map(([k, v, href]) => (
      <p key={k}>
        <span>{k}</span>
        {href ? (
          <b><a className="map-info-link" href={href}>{v}</a></b>
        ) : (
          <b>{v}</b>
        )}
      </p>
    ))}
  </article>
);

// 안내판 머리(옐로 플래카드).
const BoardHead: React.FC<{ text: string }> = ({ text }) => (
  <div className="kd-mapboard-head" aria-hidden="true">
    <span className="mb-dot" />
    <span>{text}</span>
  </div>
);

// 핀 범례 — 지도 위 핀 라벨 색(생산소 초록/주민자치 파랑)과 연동.
const MapLegend: React.FC = () => (
  <div className="kd-map-legend" aria-hidden="true">
    <span className="kd-legend-item">
      <span className="swatch" style={{ background: 'var(--mb-green)' }} />
      장암 생산소
    </span>
    <span className="kd-legend-item">
      <span className="swatch" style={{ background: 'var(--mb-blue)' }} />
      주민자치센터
    </span>
    <span className="kd-legend-tip">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1c2.8 0 5 2.1 5 4.8C13 9.3 8 15 8 15S3 9.3 3 5.8C3 3.1 5.2 1 8 1Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8" cy="5.6" r="1.7" fill="currentColor" />
      </svg>
      석동로 일대 · 도보 3분권
    </span>
  </div>
);

// 방위 나침반 — 원본 "지도" 타일 자리에 들어가는 장식(.mountain-tile 재활용).
const CompassTile: React.FC = () => (
  <div className="mountain-tile" aria-hidden="true">
    <span className="nlabel">N</span>
    <span className="needle n" />
    <span className="needle s" />
  </div>
);

const Directions: React.FC = () => {
  // 문의·이메일(노드트리 사무국)은 장암 생산소 카드로 통합(사용자 요청 2026-06-12).
  const firstRows: InfoRow[] = [
    ['주소', '충청남도 부여군 장암면 석동로29번길 3'],
    ['대중교통', '부여터미널 → 장암면 버스'],
    ['주차', '생산소 앞 주차 가능'],
    ['문의', '노드트리 사무국'],
    ['이메일', OFFICE_EMAIL, `mailto:${OFFICE_EMAIL}`],
  ];
  // 문의·이메일을 생산소로 옮긴 뒤 생기는 공백을 메우는 안내 행(현장 운영 주체 안내).
  const secondRows: InfoRow[] = [
    ['주소', '충청남도 부여군 장암면 석동로 16, 2층'],
    ['도보', '생산소에서 석동로 따라 도보 약 3분'],
    ['주차', '면사무소 공용주차장 이용'],
    ['안내', '문의·예약은 장암 생산소로'],
  ];

  return (
    <section className="kd-figma-map kd-directions">
      {/* 모바일 오시는길 캐릭터-그림자 정렬 패치 — 데스크톱 무영향(@media max-width:900px) */}
      <style>{MAP_MOBILE_SHADOW_CSS}</style>
      {/* 마을 안내판 리스타일(구조 보존) — 데스크톱·모바일 양쪽 주입 */}
      <style>{MAP_BOARD_CSS}</style>
      <div className="kd-map-desktop" data-name="오시는 길 — Desktop">
        <div className="kd-section-rule kd-section-rule--s5" />
        <h1>오시는 길</h1>
        <p className="map-sub">충청남도 부여군 장암면 석동로 일대</p>
        {/* 안내판 보드(머리+지도+범례+카드를 감싸는 프레임) */}
        <div className="kd-mapboard" aria-hidden="true" />
        <BoardHead text="장암마을 약도 · 오시는 길" />
        <span className="walk-label">도보 3분 코스</span>
        {/* 약도 — 원본 구조(도로·건물·핀 좌표) 그대로, 스타일만 리디자인 */}
        <div className="figma-map-canvas">
          <i className="road road-pink" />
          <i className="road road-red" />
          <i className="road road-gray road-v1" />
          <i className="road road-gray road-v2" />
          <i className="road road-gray road-v3" />
          <i className="road road-yellow" />
          <div className="nonghyup">장암농협</div>
          <div className="office">장암면사무소</div>
          <CharacterPin className="pin-saengsanso" src="char-09.svg" label="장암 생산소" sub="석동로29번길 3" />
          <CharacterPin className="pin-jumin" src="char-18.svg" label="주민자치센터" sub="석동로 16" />
          <CompassTile />
        </div>
        <MapLegend />
        <div className="map-card-row">
          <InfoCard color="#259f3e" title="장암 생산소" charSrc="char-09.svg" rows={firstRows} />
          <InfoCard color="#1b55e2" title="주민자치센터" charSrc="char-18.svg" rows={secondRows} />
        </div>
      </div>

      <div className="kd-map-mobile" data-name="오시는 길 — Mobile">
        <div className="kd-section-rule kd-section-rule--s5" />
        <h1>오시는 길</h1>
        <p className="map-sub">충청남도 부여군 장암면 석동로 일대</p>
        <div className="kd-mapboard" aria-hidden="true" />
        <BoardHead text="장암마을 약도" />
        <span className="walk-label">도보 3분</span>
        <div className="figma-map-canvas">
          <i className="road road-pink" />
          <i className="road road-red" />
          <i className="road road-gray road-v1" />
          <i className="road road-gray road-v2" />
          <i className="road road-gray road-v3" />
          <i className="road road-yellow" />
          <div className="nonghyup">농협</div>
          <div className="office">면사무소</div>
          <CharacterPin className="pin-saengsanso" src="char-09.svg" label="생산소" />
          <CharacterPin className="pin-jumin" src="char-18.svg" label="주민 자치" />
          <CompassTile />
        </div>
        <MapLegend />
        <InfoCard
          color="#ec251f"
          title="장암 생산소"
          charSrc="char-09.svg"
          rows={[
            ['주소', '부여군 장암면 석동로29번길 3'],
            ['교통', '부여터미널 → 장암면 버스'],
            ['주차', '생산소 앞 가능'],
            ['문의', '노드트리 사무국'],
            ['이메일', OFFICE_EMAIL, `mailto:${OFFICE_EMAIL}`],
          ]}
        />
        <InfoCard
          color="#ffc90e"
          title="주민자치센터"
          charSrc="char-18.svg"
          rows={[
            ['주소', '부여군 장암면 석동로 16, 2층'],
            ['도보', '생산소에서 도보 약 3분'],
            ['주차', '면사무소 공용주차장'],
            ['안내', '문의·예약은 장암 생산소로'],
          ]}
        />
      </div>
    </section>
  );
};

export default Directions;
