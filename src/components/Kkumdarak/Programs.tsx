import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KKUMDARAK_APPLY_URL } from './data';
import MotionCharacter from './MotionCharacter';
import { useKkumdarakAuth } from './KkumdarakAuthContext';
import { kkumdarakSettingsAPI } from '../../services/api';

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

// ── 설정 오버라이드 타입 ──────────────────────────────────────────
//   백엔드 KkumdarakSettings.data = { programs: { [program.name]: ProgramSetting } }
//   식별자는 Programs 가 렌더하는 인라인 PROGRAMS 의 name (id 가 없어 name 으로 key).
interface ProgramSetting {
  applyUrl?: string;
  closed?: boolean;
}
type ProgramSettingsMap = Record<string, ProgramSetting>;

// 프로그램별 실효 신청 URL: 오버라이드 > data.ts 기본값.
const resolveApplyUrl = (setting?: ProgramSetting): string =>
  (setting?.applyUrl && setting.applyUrl.trim()) || KKUMDARAK_APPLY_URL;

// 링크가 유효(실제 URL)한지 — '#' 또는 빈 값이면 비활성 처리.
const isLiveUrl = (url: string): boolean => !!url && url !== '#';

// ── 신청 버튼 (데스크톱·모바일 공용 로직) ───────────────────────────
//   · 마감(closed) → 비활성 버튼 "마감되었습니다"
//   · 축제(festival) → 기존 라벨(무료 개방) 그대로, 링크 없이 표시
//   · 그 외 → 항상 "신청하기 →" 라벨 노출(요구사항 1). URL 이 아직 '#'(미설정)이면
//     클릭만 막고(preventDefault) 라벨은 그대로 — 기존 동작과 동일하게 유지한다.
const ApplyButton: React.FC<{
  program: typeof PROGRAMS[number];
  setting?: ProgramSetting;
  className: string;
}> = ({ program, setting, className }) => {
  const closed = !!setting?.closed;

  // 축제 카드는 신청 개념이 없다 — 마감만 반영, 아니면 정보성 라벨 유지.
  if (program.festival && !closed) {
    return <span className={className} aria-disabled="true">{program.action}</span>;
  }

  if (closed) {
    return (
      <span className={`${className} is-closed`} aria-disabled="true">
        마감되었습니다
      </span>
    );
  }

  // 신청 링크 — 라벨은 항상 노출, URL 미설정('#') 시에만 이동을 막는다.
  const url = resolveApplyUrl(setting);
  const live = isLiveUrl(url);

  return (
    <a
      className={className}
      href={url}
      target={live ? '_blank' : undefined}
      rel={live ? 'noopener noreferrer' : undefined}
      onClick={(event) => { if (!live) event.preventDefault(); }}
    >
      {program.action}
    </a>
  );
};

// ── 편집 패널 (로그인 시에만 렌더) ─────────────────────────────────
//   신청 URL 입력 + 마감 토글. 저장은 부모(onSave)로 위임.
const EditPanel: React.FC<{
  program: typeof PROGRAMS[number];
  setting?: ProgramSetting;
  saving: boolean;   // 이 카드의 저장이 진행 중
  locked: boolean;   // 다른 어떤 카드든 저장이 진행 중(전역 in-flight)
  onSave: (name: string, next: ProgramSetting) => void;
}> = ({ program, setting, saving, locked, onSave }) => {
  const [url, setUrl] = useState<string>(setting?.applyUrl ?? '');
  const [closed, setClosed] = useState<boolean>(!!setting?.closed);

  // 외부(다른 카드 저장 후 refetch 등)에서 setting 이 바뀌면 입력값 동기화.
  useEffect(() => {
    setUrl(setting?.applyUrl ?? '');
    setClosed(!!setting?.closed);
  }, [setting?.applyUrl, setting?.closed]);

  const dirty = (setting?.applyUrl ?? '') !== url || !!setting?.closed !== closed;

  return (
    <div className="program-edit-panel" data-name="신청 링크 편집">
      <label className="program-edit-field">
        <span>신청 URL</span>
        <input
          type="url"
          className="program-edit-input"
          value={url}
          placeholder="https://… (신청 폼 주소)"
          onChange={(e) => setUrl(e.target.value)}
          disabled={locked}
        />
      </label>
      <label className="program-edit-toggle">
        <input
          type="checkbox"
          checked={closed}
          onChange={(e) => setClosed(e.target.checked)}
          disabled={locked}
        />
        <span>모집 마감</span>
      </label>
      <button
        type="button"
        className="program-edit-save"
        // ⚠️ 저장 직렬화: 전체 맵을 통째로 PUT(last-write-wins)하는 구조라, 한 카드의 저장이
        //   비행 중일 때 다른 카드를 저장하면 base 맵이 옛 값이라 방금 저장한 변경이 덮어써진다.
        //   → 어떤 카드든 저장 중(locked)이면 모든 저장 버튼을 비활성화해 저장을 직렬화한다.
        disabled={locked || !dirty}
        onClick={() => onSave(program.name, { applyUrl: url.trim(), closed })}
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );
};

const ProgramCard: React.FC<{
  program: typeof PROGRAMS[number];
  walkPhase: 'left' | 'right';
  setting?: ProgramSetting;
  authed: boolean;
  saving: boolean;
  locked: boolean;
  onSave: (name: string, next: ProgramSetting) => void;
}> = ({ program, walkPhase, setting, authed, saving, locked, onSave }) => {
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
      <ApplyButton program={program} setting={setting} className="program-action" />
      {authed && (
        <EditPanel program={program} setting={setting} saving={saving} locked={locked} onSave={onSave} />
      )}
    </article>
  );
};

const MobileProgramCard: React.FC<{
  program: typeof PROGRAMS[number];
  setting?: ProgramSetting;
  authed: boolean;
  saving: boolean;
  locked: boolean;
  onSave: (name: string, next: ProgramSetting) => void;
}> = ({ program, setting, authed, saving, locked, onSave }) => (
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
    <ApplyButton program={program} setting={setting} className="mobile-program-action" />
    {authed && (
      <EditPanel program={program} setting={setting} saving={saving} locked={locked} onSave={onSave} />
    )}
  </article>
);

const Programs: React.FC = () => {
  const [walkPhase, setWalkPhase] = useState<'left' | 'right'>('left');
  const { authed } = useKkumdarakAuth();

  // 신청 링크/마감 오버라이드 (백엔드 단일 진실 소스, name 으로 key)
  const [settings, setSettings] = useState<ProgramSettingsMap>({});
  const [savingName, setSavingName] = useState<string | null>(null);

  // 저장 시 머지 기준이 되는 '최신' settings 스냅샷.
  //   stale-closure 방지 + 초기 GET 미완료 상태에서 저장 시 다른 프로그램 값이 누락되는
  //   사고를 막기 위해 ref 로 항상 최신 맵을 들고 있는다(handleSave 가 이 ref 를 머지한다).
  const settingsRef = useRef<ProgramSettingsMap>({});
  // GET(로드)이 한 번이라도 완료됐는지. 로드 전에는 저장을 막아 빈 맵으로 덮어쓰는 사고를 차단.
  const loadedRef = useRef<boolean>(false);
  // 직전 GET 이 '실패'로 끝났는지(네트워크 일시 오류 등). 이 경우 settingsRef 가 신뢰 불가
  //   (다른 프로그램 값이 비어 있을 수 있음)이라, 저장 전 GET 을 한 번 더 시도해 base 맵을 복구한다.
  const loadFailedRef = useRef<boolean>(false);
  // 저장 in-flight 가드(방어적 직렬화). UI 의 locked 비활성화가 우회돼도 한 번에 한 PUT 만 보낸다.
  const savingRef = useRef<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setWalkPhase(p => p === 'left' ? 'right' : 'left'), 420);
    return () => clearInterval(t);
  }, []);

  // 설정 로드 (공개 GET) — 언마운트 후 setState 방지.
  //   ⚠️ kkumdarakSettingsAPI.get() 은 내부에서 cdnBustUrl 로 Vercel Edge Cache 를
  //   우회한다(저장 직후 5분 창 한정 ?_t= 부착; 서버 GET 라우트의 s-maxage=60·
  //   stale-while-revalidate=300 때문). 이 우회가 없으면 '모집 마감' 저장 직후 재진입 시
  //   엣지 캐시의 저장 이전 응답을 받아 체크가 풀린다.
  useEffect(() => {
    let alive = true;
    kkumdarakSettingsAPI.get()
      .then((data) => {
        if (!alive) return;
        const programs = (data && data.programs) || {};
        settingsRef.current = programs as ProgramSettingsMap;
        loadedRef.current = true;
        loadFailedRef.current = false;
        setSettings(programs as ProgramSettingsMap);
      })
      .catch(() => {
        if (!alive) return;
        // 폴백: 오버라이드 없음(기본 동작 유지). 로드는 '완료'로 보되 '실패'로 표시한다.
        //   (네트워크 일시 실패까지 저장을 영구 차단하지 않되, 저장 직전 GET 재시도로 base 복구.)
        loadedRef.current = true;
        loadFailedRef.current = true;
      });
    return () => { alive = false; };
  }, []);

  // 저장 — 단일 프로그램 설정을 '최신 ref 맵'에 머지해 통째로 PUT, 성공 시 로컬 상태 낙관적 갱신.
  //   · 머지 기준을 state(settings) 대신 settingsRef.current 로 잡아 stale-closure 로
  //     인한 다른 프로그램 값 유실을 방지한다.
  //   · 초기 GET 미완료(loadedRef=false) 상태면 저장을 막는다(빈 맵 덮어쓰기 차단).
  const handleSave = useCallback(async (name: string, next: ProgramSetting) => {
    if (!loadedRef.current) {
      alert('설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    // 방어적 직렬화: 이미 다른 저장이 비행 중이면 무시(UI locked 우회 대비).
    //   전체 맵 PUT(last-write-wins) 구조라 동시 저장은 base 맵을 옛 값으로 만들어 변경을 덮어쓴다.
    if (savingRef.current) {
      alert('다른 항목을 저장하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    savingRef.current = true;
    setSavingName(name);
    try {
      // 직전 GET 이 실패했다면 settingsRef(base 맵)가 비어 있을 수 있어, 저장 전 GET 을 한 번
      //   더 시도해 다른 프로그램 값을 복구한다(빈 맵으로 통째 덮어쓰기 방지). 재시도도 실패하면
      //   사용자에게 알리고 저장을 중단한다(타 프로그램 값 유실 위험을 무릅쓰지 않는다).
      if (loadFailedRef.current) {
        try {
          const data = await kkumdarakSettingsAPI.get();
          const programs = (data && data.programs) || {};
          settingsRef.current = programs as ProgramSettingsMap;
          loadFailedRef.current = false;
          setSettings(programs as ProgramSettingsMap);
        } catch {
          alert('설정을 다시 불러오지 못했습니다. 네트워크 확인 후 다시 시도해주세요.');
          return;
        }
      }
      const optimistic: ProgramSettingsMap = { ...settingsRef.current, [name]: next };
      await kkumdarakSettingsAPI.save({ programs: optimistic });
      settingsRef.current = optimistic;
      setSettings(optimistic);
    } catch (err: any) {
      if (err?.code === 'KKUM_AUTH_EXPIRED') {
        alert('꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        alert(err?.message || '저장에 실패했습니다.');
      }
    } finally {
      savingRef.current = false;
      setSavingName(null);
    }
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
            <ProgramCard
              key={program.name}
              program={program}
              walkPhase={walkPhase}
              setting={settings[program.name]}
              authed={authed}
              saving={savingName === program.name}
              locked={savingName !== null}
              onSave={handleSave}
            />
          ))}
        </div>
      </div>

      <div className="kd-program-mobile" data-name="프로그램 — Mobile">
        <div className="kd-section-rule kd-section-rule--s2" />
        <h1>프로그램</h1>
        <div className="mobile-program-list">
          {PROGRAMS.map((program) => (
            <MobileProgramCard
              key={program.name}
              program={program}
              setting={settings[program.name]}
              authed={authed}
              saving={savingName === program.name}
              locked={savingName !== null}
              onSave={handleSave}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Programs;
