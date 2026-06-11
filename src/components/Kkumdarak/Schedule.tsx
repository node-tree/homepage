import React from 'react';
import MotionCharacter from './MotionCharacter';

const SCHEDULE_CHARACTER = '05-character-05-yellow-signal.svg';

const MONTHS = ['5월', '6월', '7월', '8월', '9월', '10월', '11월'];
const MONTH_MOBILE = ['5', '6', '7', '8', '9', '10', '11'];

// ── 권위 기간 정의 (= 프로그램 카드 표시값) ───────────────────────────
//   막대 좌표는 아래 기간(시작 월·일 → 끝 월·일)에서 월축으로 파생 계산한다.
//   ⚠️ 사용자가 프로그램 카드 기간(programContent override)을 편집해도 이 일정 막대는
//      자동 반영되지 않는다(하드코딩). 기간이 바뀌면 아래 PERIODS 도 함께 수정해야 한다.
type Period = { sm: number; sd: number; em: number; ed: number };
const PERIODS: Array<{ name: string; period: Period; color: string; mobileColor: string }> = [
  { name: '장암 책정',      period: { sm: 5, sd: 23, em: 8, ed: 22 },  color: '#e4352b', mobileColor: '#e4352b' },
  { name: '기억순환 정류장', period: { sm: 6, sd: 18, em: 7, ed: 31 },  color: '#3ca03c', mobileColor: '#3ca03c' },
  { name: '손의 기억',      period: { sm: 7, sd: 1,  em: 10, ed: 31 }, color: '#f2a0c0', mobileColor: '#f2a0c0' },
  { name: '소리일기',       period: { sm: 6, sd: 23, em: 7, ed: 28 },  color: '#f5c518', mobileColor: '#f5c518' },
  { name: '풍경일기',       period: { sm: 5, sd: 23, em: 7, ed: 18 },  color: '#2d5be3', mobileColor: '#2d5be3' },
  { name: '마을의 신호',    period: { sm: 7, sd: 1,  em: 7, ed: 31 },  color: '#1b55e2', mobileColor: '#1b55e2' },
];

// 〈다시, 안녕〉(축제)은 11.7 하루짜리라 막대 대신 짧은 점 마커로 표시.
const FESTIVAL = { name: '다시, 안녕', month: 11, day: 7 };

// 월축 좌표 → 픽셀 환산. 월 라벨 간격(monthGap)·기준점(baseX)·한 달 길이를 받아
//   (월·일) 한 점을 픽셀로, (시작·끝) 한 구간을 (x, width)로 변환한다. 한 달=31일 비례.
const dayToX = (month: number, day: number, baseX: number, monthGap: number) =>
  baseX + (month - 5) * monthGap + ((day - 1) / 31) * monthGap;

const barGeom = (p: Period, baseX: number, monthGap: number) => {
  const x = dayToX(p.sm, p.sd, baseX, monthGap);
  const xEnd = dayToX(p.em, p.ed, baseX, monthGap);
  return { x: Math.round(x), w: Math.max(8, Math.round(xEnd - x)) };
};

const Schedule: React.FC = () => {
  // 데스크톱 축: 월 라벨 x = 360 + i*160 (5월=360 … 11월=1320), 한 달 폭 160.
  const D_BASE = 360, D_GAP = 160, D_ROW0 = 320, D_ROW_GAP = 68;
  // 모바일 축: 월 라벨 x = 100 + i*40 (5=100 … 11=340), 한 달 폭 40.
  const M_BASE = 100, M_GAP = 40, M_ROW0 = 232, M_ROW_GAP = 64;

  return (
    <section className="kd-figma-schedule">
      <div className="kd-schedule-desktop" data-name="일정 — Desktop">
        <div className="kd-section-rule kd-section-rule--s3" />
        <h1>일정</h1>
        <p className="schedule-date">2026. 5 - 11</p>
        {MONTHS.map((month, index) => {
          const x = D_BASE + index * D_GAP;
          return (
            <React.Fragment key={month}>
              <i className="schedule-line" style={{ left: x }} />
              <span className="schedule-month" style={{ left: x - 10 }}>{month}</span>
            </React.Fragment>
          );
        })}
        {PERIODS.map((bar, index) => {
          const { x, w } = barGeom(bar.period, D_BASE, D_GAP);
          const y = D_ROW0 + index * D_ROW_GAP;
          return (
            <React.Fragment key={bar.name}>
              <span className="schedule-label" style={{ top: y - 70 }}>{bar.name}</span>
              <i
                className="schedule-bar"
                style={{ left: x, top: y - 80, width: w, background: bar.color, '--bar-delay': `${0.28 + index * 0.1}s` } as React.CSSProperties}
              />
            </React.Fragment>
          );
        })}
        {/* 〈다시, 안녕〉 축제 — 11.7 짧은 점 마커 */}
        {(() => {
          const x = dayToX(FESTIVAL.month, FESTIVAL.day, D_BASE, D_GAP);
          const y = D_ROW0 + PERIODS.length * D_ROW_GAP;
          return (
            <>
              <span className="schedule-label" style={{ top: y - 70 }}>{FESTIVAL.name} (축제)</span>
              <i
                className="schedule-bar schedule-bar--dot"
                style={{ left: Math.round(x) - 7, top: y - 80, width: 14, background: '#ffc90e', '--bar-delay': `${0.28 + PERIODS.length * 0.1}s` } as React.CSSProperties}
              />
            </>
          );
        })()}
        <MotionCharacter src={SCHEDULE_CHARACTER} alt="" className="schedule-character" />
        <span className="schedule-fest-date">11.7</span>
      </div>

      <div className="kd-schedule-mobile" data-name="일정 — Mobile">
        <div className="kd-section-rule kd-section-rule--s3" />
        <h1>일정</h1>
        <p className="schedule-date">2026. 5 — 11</p>
        {MONTH_MOBILE.map((month, index) => {
          const x = M_BASE + index * M_GAP;
          return (
            <React.Fragment key={month}>
              <i className="schedule-line" style={{ left: x }} />
              <span className="schedule-month" style={{ left: x - 4 }}>{month}</span>
            </React.Fragment>
          );
        })}
        {PERIODS.map((bar, index) => {
          const { x, w } = barGeom(bar.period, M_BASE, M_GAP);
          const y = M_ROW0 + index * M_ROW_GAP;
          return (
            <React.Fragment key={bar.name}>
              <span className="schedule-label" style={{ top: y - 2 }}>{bar.name}</span>
              <i
                className="schedule-bar"
                style={{ left: x, top: y, width: w, background: bar.mobileColor, '--bar-delay': `${0.28 + index * 0.1}s` } as React.CSSProperties}
              />
            </React.Fragment>
          );
        })}
        {/* 〈다시, 안녕〉 축제 — 11.7 짧은 점 마커 */}
        {(() => {
          const x = dayToX(FESTIVAL.month, FESTIVAL.day, M_BASE, M_GAP);
          const y = M_ROW0 + PERIODS.length * M_ROW_GAP;
          return (
            <>
              <span className="schedule-label" style={{ top: y - 2 }}>{FESTIVAL.name} (축제)</span>
              <i
                className="schedule-bar schedule-bar--dot"
                style={{ left: Math.round(x) - 5, top: y, width: 10, background: '#ffc90e', '--bar-delay': `${0.28 + PERIODS.length * 0.1}s` } as React.CSSProperties}
              />
            </>
          );
        })()}
        <MotionCharacter src={SCHEDULE_CHARACTER} alt="" className="schedule-character" />
        <span className="schedule-fest-date">11.7</span>
      </div>
    </section>
  );
};

export default Schedule;
