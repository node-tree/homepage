import React from 'react';
import MotionCharacter from './MotionCharacter';

const SCHEDULE_CHARACTER = '05-character-05-yellow-signal.svg';

const MONTHS = ['5월', '6월', '7월', '8월', '9월', '10월', '11월'];
const BARS = [
  { name: '장암 책정', x: 474, y: 320, w: 475, color: '#ffc90e' },
  { name: '기억순환 정류장', x: 571, y: 388, w: 744, color: '#259f3e' },
  { name: '손의 기억', x: 680, y: 456, w: 560, color: '#1b55e2' },
  { name: '소리일기', x: 680, y: 524, w: 544, color: '#f18bb1' },
  { name: '풍경일기', x: 680, y: 592, w: 544, color: '#ec251f' },
  { name: '마을의 신호', x: 798, y: 660, w: 517, color: '#ffc90e' },
];

const Schedule: React.FC = () => {
  return (
    <section className="kd-figma-schedule">
      <div className="kd-schedule-desktop" data-name="일정 — Desktop">
        <div className="kd-section-rule kd-section-rule--s3" />
        <h1>일정</h1>
        <p className="schedule-date">2026. 5 - 11</p>
        {MONTHS.map((month, index) => {
          const x = 360 + index * 160;
          return (
            <React.Fragment key={month}>
              <i className="schedule-line" style={{ left: x }} />
              <span className="schedule-month" style={{ left: x - 10 }}>{month}</span>
            </React.Fragment>
          );
        })}
        {BARS.map((bar, index) => (
          <React.Fragment key={bar.name}>
            <span className="schedule-label" style={{ top: bar.y - 70 }}>{bar.name}</span>
            <i
              className="schedule-bar"
              style={{ left: bar.x, top: bar.y - 80, width: bar.w, background: bar.color, '--bar-delay': `${0.28 + index * 0.1}s` } as React.CSSProperties}
            />
          </React.Fragment>
        ))}
        <span className="schedule-label festival-label">다시, 안녕 (축제)</span>
        <MotionCharacter src={SCHEDULE_CHARACTER} alt="" className="schedule-character" />
        <span className="schedule-fest-date">11.7</span>
      </div>

      <div className="kd-schedule-mobile" data-name="일정 — Mobile">
        <div className="kd-section-rule kd-section-rule--s3" />
        <h1>일정</h1>
        <p className="schedule-date">2026. 5 — 11</p>
        {['5', '6', '7', '8', '9', '10', '11'].map((month, index) => {
          const x = [100, 140, 180, 220, 260, 300, 340][index];
          return (
            <React.Fragment key={month}>
              <i className="schedule-line" style={{ left: x }} />
              <span className="schedule-month" style={{ left: x - 4 }}>{month}</span>
            </React.Fragment>
          );
        })}
        {[
          { name: '장암 책정', x: 129, y: 232, w: 119, color: '#e4352b' },
          { name: '기억순환 정류장', x: 153, y: 296, w: 186, color: '#3ca03c' },
          { name: '손의 기억', x: 211, y: 360, w: 128, color: '#f2a0c0' },
          { name: '소리일기', x: 180, y: 424, w: 159, color: '#f5c518' },
          { name: '풍경일기', x: 180, y: 488, w: 159, color: '#2d5be3' },
          { name: '마을의 신호', x: 211, y: 552, w: 128, color: '#2d5be3' },
        ].map((bar, index) => (
          <React.Fragment key={bar.name}>
            <span className="schedule-label" style={{ top: bar.y - 2 }}>{bar.name}</span>
            <i
              className="schedule-bar"
              style={{ left: bar.x, top: bar.y, width: bar.w, background: bar.color, '--bar-delay': `${0.28 + index * 0.1}s` } as React.CSSProperties}
            />
          </React.Fragment>
        ))}
        <span className="schedule-label festival-label">다시, 안녕 (축제)</span>
        <MotionCharacter src={SCHEDULE_CHARACTER} alt="" className="schedule-character" />
        <span className="schedule-fest-date">11.7</span>
      </div>
    </section>
  );
};

export default Schedule;
