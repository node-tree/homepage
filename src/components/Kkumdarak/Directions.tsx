import React from 'react';
import IntroChar from './IntroChar';

// ── 모바일 오시는길 캐릭터-그림자 정렬 패치 (모바일 전용) ─────────────
// 라벨(생산소·주민 자치)은 지도 위치 기준점 → 원래 자리에 고정(라벨 이동 금지).
// 정렬은 캐릭터+그림자를 라벨의 원래 가로 중심으로 옮겨서 맞춘다.
// 측정(폭390, CSS px): 라벨 원래 중심 = 생산소 309, 주민자치 181.
//   기존 캐릭터 시각 중심 = 생산소 332, 주민자치 204 → 각각 ~23px 우측 치우침.
// 해결: 캐릭터 .map-character-scale 의 translate-x 와 그림자 ::after 의 left 를
//   같은 양(−23px)만큼 좌로 이동 → 캐릭터·그림자가 한 몸으로 라벨 위 중앙에.
//   (세로 위치·캐릭터↔그림자 수직 정렬은 유지.)
// 데스크톱(.kd-map-desktop) 무영향. 주입 패턴은 HeroScene·VillageDiary와 일관.
//   (kkumdarak.css 직접편집 불가 → 컴포넌트 오버라이드)
const MAP_MOBILE_SHADOW_CSS = `
@media (max-width: 900px) {
  /* 생산소(char-09): 캐릭터 중심 332→309. translate-x 30→7(−23), 그림자 left 71→48(−23).
     세로(translate-y -26, bottom 58)는 유지 → 발밑 그림자 수직 정렬 보존 */
  .kd-map-mobile .pin-saengsanso .map-character-scale {
    transform: translate(7px, -26px) scale(0.48);
  }
  .kd-map-mobile .pin-saengsanso::after {
    left: 48px;
    bottom: 58px;
    width: 50px;
  }
  /* 주민자치(char-18): 캐릭터 중심 204→181. base는 translate 없음 → translate-x 0→−23,
     그림자 left 40→17(−23). 세로(bottom 44)·scale(0.48)·origin 유지 */
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

// ── 오시는길 「문의 · 노드트리 사무국」 표기 (추가 2026-06) ──────────
//   사용자 요청: 오시는길에 노드트리 사무국 문의처(이메일)를 표기.
//   이메일은 mailto 링크(탭/복사 쉬운 형태). 전화번호는 표기하지 않는다(사용자 지시, 2026-06-11).
//   기존 오시는길 정보 블록(InfoCard 의 라벨/괘선/타이포)에 맞춰 자연스럽게 행으로 더한다.
const OFFICE_EMAIL = 'nodetree.pmaker@gmail.com';

// 오시는길 정보 행 타입: [라벨, 값, href?].
//   href 가 있으면 값(value)을 링크(<a>)로 렌더 — 이메일(mailto)·전화(tel) 등.
type InfoRow = [label: string, value: string, href?: string];

const CharacterPin: React.FC<{ className: string; src: string; label: string }> = ({ className, src, label }) => (
  <div className={`map-character-pin ${className}`}>
    <div className="map-character-scale">
      <IntroChar src={src} alt={label} />
    </div>
    <span className="map-pin-label">{label}</span>
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

const Directions: React.FC = () => {
  const firstRows: InfoRow[] = [
    ['주소', '충청남도 부여군 장암면 석동로29번길 3'],
    ['대중교통', '부여터미널 → 장암면 버스'],
    ['주차', '생산소 앞 주차 가능'],
  ];
  // 주민자치센터 카드에 「문의 · 노드트리 사무국」 — 이메일(mailto) 표기.
  const secondRows: InfoRow[] = [
    ['주소', '충청남도 부여군 장암면 석동로 16, 2층'],
    ['도보', '생산소에서 석동로 따라 도보 약 3분'],
    ['문의', '노드트리 사무국'],
    ['이메일', OFFICE_EMAIL, `mailto:${OFFICE_EMAIL}`],
  ];

  return (
    <section className="kd-figma-map kd-directions">
      {/* 모바일 오시는길 캐릭터-그림자 정렬 패치 — 데스크톱 무영향(@media max-width:900px) */}
      <style>{MAP_MOBILE_SHADOW_CSS}</style>
      <div className="kd-map-desktop" data-name="오시는 길 — Desktop">
        <div className="kd-section-rule kd-section-rule--s5" />
        <h1>오시는 길</h1>
        <p className="map-sub">충청남도 부여군 장암면 석동로 일대</p>
        <span className="walk-label">도보 3분 코스</span>
        <div className="figma-map-canvas">
          <i className="road road-pink" />
          <i className="road road-red" />
          <i className="road road-gray road-v1" />
          <i className="road road-gray road-v2" />
          <i className="road road-gray road-v3" />
          <i className="road road-yellow" />
          <div className="nonghyup">장암농협</div>
          <div className="office">장암면사무소</div>
          <CharacterPin className="pin-saengsanso" src="char-09.svg" label="생산소" />
          <CharacterPin className="pin-jumin" src="char-18.svg" label="주민 자치센터" />
          <div className="mountain-tile">지도</div>
        </div>
        <div className="map-card-row">
          <InfoCard color="#259f3e" title="장암 생산소" charSrc="char-09.svg" rows={firstRows} />
          <InfoCard color="#1b55e2" title="주민자치센터" charSrc="char-18.svg" rows={secondRows} />
        </div>
      </div>

      <div className="kd-map-mobile" data-name="오시는 길 — Mobile">
        <div className="kd-section-rule kd-section-rule--s5" />
        <h1>오시는 길</h1>
        <p className="map-sub">충청남도 부여군 장암면 석동로 일대</p>
        <span className="walk-label">도보 3분 코스</span>
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
          <div className="mountain-tile">지도</div>
        </div>
        <InfoCard
          color="#ec251f"
          title="장암 생산소"
          charSrc="char-09.svg"
          rows={[
            ['주소', '부여군 장암면 석동로29번길 3'],
            ['교통', '부여터미널 → 장암면 버스'],
            ['주차', '생산소 앞 가능'],
          ]}
        />
        <InfoCard
          color="#ffc90e"
          title="주민자치센터"
          charSrc="char-18.svg"
          rows={[
            ['주소', '부여군 장암면 석동로 16, 2층'],
            ['도보', '생산소에서 도보 약 3분'],
            ['문의', '노드트리 사무국'],
            ['이메일', OFFICE_EMAIL, `mailto:${OFFICE_EMAIL}`],
          ]}
        />
      </div>
    </section>
  );
};

export default Directions;
