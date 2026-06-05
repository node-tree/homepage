import React, { useState, useEffect } from 'react';
import { KKUMDARAK_APPLY_URL } from './data';
import MotionCharacter from './MotionCharacter';

const PROGRAMS: Array<{
  name: string;
  label?: string[];
  en: string;
  summary: string;
  desc: string;
  field: string;
  meta: string[][];
  brief: string;
  color: string;
  mobileMark: string;
  action: string;
  character: string;
  festival?: boolean;
}> = [
  {
    name: '장암 책정',
    en: 'Jangam Library Pavilion',
    summary: '다섯 세대가 함께 짓는 마을의 정자.',
    desc: '작은도서관·도서실을 다섯 세대가 함께 설계·목공·설치로 다시 짓는 융복합 워크숍. 마을의 새로운 정자가 됩니다.',
    field: '융복합 · 건축/공예',
    meta: [['회차', '12회 · 36시수'], ['모집', '전생애 15명'], ['기간', '5.23 – 8.22']],
    brief: '전생애 15명 · 5.23-8.22',
    color: '#e4352b',
    mobileMark: '#259f3e',
    action: '신청하기 →',
    character: '19-character-19-crossing-knot.svg',
  },
  {
    name: '마을의 신호',
    en: 'Signal Village',
    summary: '마을이라는 악기를, 청소년의 손으로.',
    desc: 'Makey Makey·MCU 보드로 마을의 소리와 신호를 채집해, 청소년이 직접 인터랙티브 미디어 작품으로 만드는 미디어 랩입니다.',
    field: '미디어 · 인터랙티브',
    meta: [['회차', '10회 · 30시수'], ['모집', '청소년 12명'], ['기간', '7.24 – 10.31']],
    brief: '청소년 12명 · 7.24-10.31',
    color: '#2d5be3',
    mobileMark: '#1b55e2',
    action: '신청하기 →',
    character: '20-character-20-green-heart-night.svg',
  },
  {
    name: '기억순환 정류장',
    label: ['기억순환', '정류장'],
    en: 'Memory Circulation',
    summary: '어르신의 기억을 청소년의 손으로.',
    desc: '어르신의 기억이 청소년의 손을 거쳐 다음 세대로 흐르는 마을 아카이브 융복합 미디어 워크숍입니다.',
    field: '융복합 · 아카이브',
    meta: [['회차', '10회 · 30시수'], ['모집', '아동·청소년 15명'], ['기간', '6.10 – 10.31']],
    brief: '아동·청소년 15명 · 6.10-10.31',
    color: '#3ca03c',
    mobileMark: '#f18bb1',
    action: '신청하기 →',
    character: '21-character-21-night-house.svg',
  },
  {
    name: '손의 기억',
    en: 'Memory of Hands',
    summary: '손이 기억하는 풍경을 그리다.',
    desc: '어르신 112명이 손으로 기억하는 마을의 풍경과 삶을 드로잉으로 남기는 미술 프로그램입니다.',
    field: '미술 · 드로잉',
    meta: [['회차', '16회 · 48시수'], ['모집', '어르신 112명'], ['기간', '7 – 10월']],
    brief: '어르신 112명 · 7-10월',
    color: '#f2a0c0',
    mobileMark: '#ec251f',
    action: '신청하기 →',
    character: '03-character-03-listening-night.svg',
  },
  {
    name: '소리일기',
    en: 'Sound Diary',
    summary: '마을의 소리를 채집하다.',
    desc: '마을 곳곳을 다니며 소리를 채집하고 기록하는 전생애 사운드 미디어 워크숍입니다.',
    field: '미디어 · 사운드',
    meta: [['회차', '6회 · 18시수'], ['모집', '전생애 6명'], ['기간', '7 – 10월']],
    brief: '전생애 6명 · 7-10월',
    color: '#f5c518',
    mobileMark: '#ffc90e',
    action: '신청하기 →',
    character: '06-character-06-flower-face.svg',
  },
  {
    name: '풍경일기',
    en: 'Landscape Diary',
    summary: '부여의 사계를 그리다.',
    desc: '백마강과 부여 일대를 거닐며 사계의 풍경을 그리는 아동·청소년 야외 드로잉 프로그램입니다.',
    field: '미술 · 드로잉',
    meta: [['회차', '8회 · 24시수'], ['모집', '아동·청소년 12명'], ['기간', '7 – 10월']],
    brief: '아동·청소년 12명 · 7-10월',
    color: '#2d5be3',
    mobileMark: '#259f3e',
    action: '신청하기 →',
    character: '08-character-08-gray-heart.svg',
  },
  {
    name: '다시, 안녕',
    en: 'Hello, Again 축제',
    summary: '마을이 함께 여는 축제.',
    desc: '7개 프로그램의 결과물이 한꺼번에 펼쳐지는 마을 통합 축제. 누구나 무료로 즐길 수 있습니다.',
    field: '축제 · 오픈클래스',
    meta: [['일시', '11.7 (토)'], ['대상', '누구나'], ['관람', '무료 개방']],
    brief: '누구나 · 11.7',
    color: '#ffffff',
    mobileMark: '#1b55e2',
    action: '무료 개방',
    festival: true,
    character: '12-character-12-rice-bow.svg',
  },
];

const ProgramCard: React.FC<{ program: typeof PROGRAMS[number]; walkPhase: 'left' | 'right' }> = ({ program, walkPhase }) => {
  const labelLines = program.label ?? [program.name];
  return (
    <article className="program-card" style={{ '--accent': program.color } as React.CSSProperties}>
      <div className="program-card-art">
        <div className={`program-character-frame ${walkPhase === 'right' ? 'is-step-right' : 'is-step-left'}`}>
          <MotionCharacter src={program.character} alt={labelLines.join(' ')} className="program-rig" />
        </div>
      </div>
      <h3 className="program-name">{program.name}</h3>
      <p className="program-en">{program.en}</p>
      <h2>{program.summary}</h2>
      <p className="program-desc">{program.desc}</p>
      <div className="program-meta">
        {program.meta.map(([key, value]) => (
          <p key={key}><span>{key}</span><b>{value}</b></p>
        ))}
      </div>
      <a
        className="program-action"
        href={KKUMDARAK_APPLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => { if (KKUMDARAK_APPLY_URL === '#') event.preventDefault(); }}
      >
        {program.action}
      </a>
    </article>
  );
};

const MobileProgramCard: React.FC<{ program: typeof PROGRAMS[number] }> = ({ program }) => (
  <article className="mobile-program-card" style={{ '--accent': program.color, '--mark': program.mobileMark } as React.CSSProperties}>
    <div className="mobile-program-head">
      <div className="mobile-program-character" aria-hidden="true">
        <MotionCharacter src={program.character} alt="" className="program-rig-mobile" />
      </div>
      <div>
        <h2>{program.name}</h2>
        <p>{program.en}</p>
      </div>
    </div>
    <div className="mobile-program-meta">
      <span>{program.field}</span>
      <b>{program.brief}</b>
    </div>
    <a
      className="mobile-program-action"
      href={KKUMDARAK_APPLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => { if (KKUMDARAK_APPLY_URL === '#') event.preventDefault(); }}
    >
      {program.action}
    </a>
  </article>
);

const Programs: React.FC = () => {
  const [walkPhase, setWalkPhase] = useState<'left' | 'right'>('left');

  useEffect(() => {
    const t = setInterval(() => setWalkPhase(p => p === 'left' ? 'right' : 'left'), 420);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="kd-figma-programs">
      <div className="kd-program-desktop" data-name="프로그램 — Desktop">
        <div className="kd-section-rule kd-section-rule--s2" />
        <p className="program-kicker">7개의 프로그램은 한 줄로 흐른다</p>
        <h1>프로그램</h1>
        <div className="program-soft-field" />
        <div className="program-grid">
          {PROGRAMS.map((program) => (
            <ProgramCard key={program.name} program={program} walkPhase={walkPhase} />
          ))}
        </div>
      </div>

      <div className="kd-program-mobile" data-name="프로그램 — Mobile">
        <div className="kd-section-rule kd-section-rule--s2" />
        <h1>프로그램</h1>
        <div className="mobile-program-list">
          {PROGRAMS.map((program) => (
            <MobileProgramCard key={program.name} program={program} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Programs;
