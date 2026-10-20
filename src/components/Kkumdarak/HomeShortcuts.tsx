import React from 'react';
import MotionCharacter from './MotionCharacter';
import { daysUntilFestival } from './programIndex';

// ═══════════════════════════════════════════════════════════════
// 홈 바로가기 (2026-10-20) — 홈이 히어로만 있어 다른 화면으로 가는 길이 없었다.
//   · 히어로 글 아래 축제 알약(FestivalPill): 첫 화면 안에서 축제를 알린다 → 아래 띠로 내려 준다.
//   · 히어로 아래 띠(HomeShortcuts): 축제(큰 칸) · 마을일기 · 부흥여지도.
//   글은 사이트에 이미 있는 문장을 쓴다(축제 = 프로그램 축제 카드 문구 안, 지도 = 마을기록 설명, 일기 = 마을일기 부제).
//   ⚠️ 해시 링크 대신 스크롤 버튼: #home-… 같은 해시는 Kkumdarak 이 모르는 섹션이라 홈 맨 위로 돌아간다.
// ═══════════════════════════════════════════════════════════════

const WAYS_ID = 'kd-home-ways';
const FEST_CHARACTER = '19-character-19-crossing-knot.svg';

const scrollToWays = () => {
  const el = document.getElementById(WAYS_ID);
  if (!el) return;
  const header = document.querySelector('.kd-header');
  const headerH = header ? header.getBoundingClientRect().height : 80;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 16, behavior: 'smooth' });
};

const dayLabel = (d: number) => (d === 0 ? '오늘' : `D-${d}`);

export const FestivalPill: React.FC<{ className: string }> = ({ className }) => {
  const d = daysUntilFestival();
  if (d < 0) return null;
  return (
    <button type="button" className={className} onClick={scrollToWays}>
      <b>{dayLabel(d)}</b>
      <span>11.7 토 〈다시, 안녕〉 축제</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6 1.5v9M2 6.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

const HomeShortcuts: React.FC = () => {
  const d = daysUntilFestival();
  const past = d < 0;
  return (
    <section className="kd-home-ways" id={WAYS_ID} aria-label="바로가기">
      <article className="kd-home-way kd-home-way--fest">
        <div className="kd-home-fest-head">
          {!past && <span className="kd-home-dday">{dayLabel(d)}</span>}
          <p className="kd-home-kicker">{past ? '11월 7일에 열렸습니다' : '11월 7일 토요일 · 장암면'}</p>
        </div>
        <h2>〈다시, 안녕〉 축제</h2>
        <p className="kd-home-text">
          일곱 프로그램에서 만든 가구와 그림, 소리와 영상을 하루에 펼치는 마을 축제입니다. 누구나 무료로 올 수 있습니다.
        </p>
        <div className="kd-home-actions">
          {past ? (
            <a className="kd-home-btn is-primary" href="#results/goodbye-again">축제 기록 →</a>
          ) : (
            <a className="kd-home-btn is-primary" href="#programs">프로그램 보기 →</a>
          )}
          <a className="kd-home-btn" href="#directions">오시는 길 →</a>
        </div>
        <div className="kd-home-fest-char" aria-hidden="true">
          <MotionCharacter src={FEST_CHARACTER} alt="" className="kd-home-char" />
        </div>
      </article>

      <a className="kd-home-way kd-home-way--diary" href="#diary">
        <p className="kd-home-kicker">마을일기</p>
        <h2>그날의 기록</h2>
        <p className="kd-home-text">프로그램마다 그날의 기록을 모았습니다.</p>
        <span className="kd-home-arrow" aria-hidden="true">→</span>
      </a>

      <div className="kd-home-way kd-home-way--map">
        <a className="kd-home-way-main" href="#signal-map-3d">
          <p className="kd-home-kicker">마을기록 · 지도</p>
          <h2>부흥여지도</h2>
          <p className="kd-home-text">참여자가 나무판 위에 지은 마을을 웹 위에 다시 세웠습니다.</p>
          <span className="kd-home-arrow" aria-hidden="true">→</span>
        </a>
        <a className="kd-home-sub" href="#sound-map">장암면 소리지도 →</a>
      </div>
    </section>
  );
};

export default HomeShortcuts;
