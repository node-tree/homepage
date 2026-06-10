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
//   백엔드 KkumdarakSettings.data = {
//     programs:       { [program.name]: ProgramSetting }     // 신청 링크/마감
//     programContent: { [program.name]: ProgramContent }     // 인라인 텍스트 편집(이번 추가)
//   }
//   식별자는 Programs 가 렌더하는 인라인 PROGRAMS 의 name (id 가 없어 name 으로 key).
interface ProgramSetting {
  applyUrl?: string;
  closed?: boolean;
}
type ProgramSettingsMap = Record<string, ProgramSetting>;

// 모집 상태(인라인 선택, 3단계).
//   'ongoing'   = 진행중   (프로그램 운영 중, 일반 진행 톤)
//   'recruiting'= 모집중   (지원 모집 중, 강조/활성 톤)
//   'closed'    = 모집마감 (비활성/회색 톤)
//   미설정(undefined) 시 레거시 setting.closed 로 폴백한다(아래 resolveStatus 참고).
type ProgramStatus = 'ongoing' | 'recruiting' | 'closed';

// 상태별 표시 라벨 + 배지 modifier 클래스(데스크톱·모바일 공용).
const STATUS_META: Record<ProgramStatus, { label: string; cls: string }> = {
  recruiting: { label: '모집중', cls: 'is-recruiting' },
  ongoing:    { label: '진행중', cls: 'is-ongoing' },
  closed:     { label: '모집마감', cls: 'is-closed' },
};
const STATUS_ORDER: ProgramStatus[] = ['ongoing', 'recruiting', 'closed'];

// 인라인 편집으로 덮어쓸 수 있는 텍스트 필드. 값이 없으면(빈 문자열·undefined) 하드코딩 기본값 사용.
//   status 는 모집 상태(진행중/모집중/마감) — 표시 배지 + 신청 버튼 활성화의 1차 소스.
interface ProgramContent {
  name?: string;
  en?: string;
  summary?: string;
  desc?: string;
  status?: ProgramStatus;
}
type ProgramContentMap = Record<string, ProgramContent>;

// 백엔드 단일 진실 소스 전체 형태(둘 다 선택적).
interface KkumdarakSettingsData {
  programs?: ProgramSettingsMap;
  programContent?: ProgramContentMap;
}

// 프로그램별 실효 신청 URL: 오버라이드 > data.ts 기본값.
const resolveApplyUrl = (setting?: ProgramSetting): string =>
  (setting?.applyUrl && setting.applyUrl.trim()) || KKUMDARAK_APPLY_URL;

// 링크가 유효(실제 URL)한지 — '#' 또는 빈 값이면 비활성 처리.
const isLiveUrl = (url: string): boolean => !!url && url !== '#';

// 텍스트 필드 실효값: 오버라이드(공백 트림 후 비어있지 않을 때) > 하드코딩 기본값.
//   '한 글자라도 지운 채 저장'으로 빈 문자열이 들어오면 기본값으로 자연 복귀한다.
const pick = (override: string | undefined, fallback: string): string => {
  const v = (override ?? '').trim();
  return v ? v : fallback;
};

// 하드코딩 프로그램 + 콘텐츠 오버라이드 → 화면에 실제로 그릴 '실효 프로그램'.
type Program = typeof PROGRAMS[number];
const resolveProgram = (program: Program, content?: ProgramContent): Program => {
  if (!content) return program;
  const name = pick(content.name, program.name);
  return {
    ...program,
    name,
    en: pick(content.en, program.en),
    summary: pick(content.summary, program.summary),
    desc: pick(content.desc, program.desc),
    // label 은 줄바꿈용 보조 표기 — name 을 편집하면 더 이상 유효하지 않으므로
    //   오버라이드가 name 을 바꾼 경우 label 을 떨어뜨려 새 name 한 줄로 렌더한다.
    label: name === program.name ? program.label : undefined,
  };
};

// ── 모집 상태 통합 해석 ─────────────────────────────────────────────
//   소스가 둘이다: (신규) programContent.status(3단계), (레거시) settings.programs[].closed(boolean).
//   '실효 상태' 를 단일 함수로 통합한다:
//     · content.status 가 명시되면 그 값이 우선(ongoing|recruiting|closed)
//     · 레거시 'open' 값이 저장돼 있던 경우(이전 2단계 버전) → 'ongoing' 으로 매핑
//     · status 미설정이면 레거시 setting.closed → closed | ongoing
//   이렇게 하면 기존 데이터(closed/open)도 그대로 동작하고, 새 status 가 1차 컨트롤이 된다.
const resolveStatus = (content?: ProgramContent, setting?: ProgramSetting): ProgramStatus => {
  const raw = content?.status as string | undefined;
  if (raw === 'closed' || raw === 'recruiting' || raw === 'ongoing') return raw;
  if (raw === 'open') return 'ongoing';   // 이전 2단계 버전 호환
  return setting?.closed ? 'closed' : 'ongoing';
};

// 공개 표시용 모집 상태 배지 (진행중 / 모집중 / 모집마감). 축제 카드는 신청 개념이 없어 렌더하지 않는다.
const ProgramStatusBadge: React.FC<{
  program: Program;
  status: ProgramStatus;
  className?: string;
}> = ({ program, status, className }) => {
  if (program.festival) return null;
  const meta = STATUS_META[status];
  return (
    <span
      className={`program-status-badge ${meta.cls}${className ? ' ' + className : ''}`}
      data-name="모집 상태"
    >
      {meta.label}
    </span>
  );
};

// ── 신청 버튼 (데스크톱·모바일 공용 로직) ───────────────────────────
//   · 마감(closed) → 비활성 버튼 "마감되었습니다"
//   · 축제(festival) → 기존 라벨(무료 개방) 그대로, 링크 없이 표시
//   · 그 외 → 항상 "신청하기 →" 라벨 노출(요구사항 1). URL 이 아직 '#'(미설정)이면
//     클릭만 막고(preventDefault) 라벨은 그대로 — 기존 동작과 동일하게 유지한다.
const ApplyButton: React.FC<{
  program: Program;
  setting?: ProgramSetting;
  closed: boolean;           // 실효 상태(resolveStatus)에서 파생한 마감 여부
  className: string;
}> = ({ program, setting, closed, className }) => {
  // 축제 카드는 신청 개념이 없다 — 마감만 반영, 아니면 정보성 라벨 유지.
  if (program.festival && !closed) {
    return <span className={className} aria-disabled="true">{program.action}</span>;
  }

  if (closed) {
    return (
      <span className={`${className} is-closed`} aria-disabled="true">
        모집마감
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

// ── 신청 링크 편집 패널 (로그인 시에만 렌더) ───────────────────────
//   신청 URL 입력만 담당. 모집 상태(진행중/마감)는 ContentEditPanel 의 status 로 일원화했다
//   (중복 컨트롤 제거). 단, 저장 시 레거시 setting.closed 값은 그대로 보존해 폴백 동작을 깨지 않는다.
const SettingEditPanel: React.FC<{
  program: Program;
  setting?: ProgramSetting;
  saving: boolean;   // 이 카드의 저장이 진행 중
  locked: boolean;   // 다른 어떤 카드든 저장이 진행 중(전역 in-flight)
  onSave: (name: string, next: ProgramSetting) => void;
}> = ({ program, setting, saving, locked, onSave }) => {
  const [url, setUrl] = useState<string>(setting?.applyUrl ?? '');

  // 외부(다른 카드 저장 후 refetch 등)에서 setting 이 바뀌면 입력값 동기화.
  useEffect(() => {
    setUrl(setting?.applyUrl ?? '');
  }, [setting?.applyUrl]);

  const dirty = (setting?.applyUrl ?? '') !== url;

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
      <button
        type="button"
        className="program-edit-save"
        // ⚠️ 저장 직렬화: 전체 맵을 통째로 PUT(last-write-wins)하는 구조라, 한 카드의 저장이
        //   비행 중일 때 다른 카드를 저장하면 base 맵이 옛 값이라 방금 저장한 변경이 덮어써진다.
        //   → 어떤 카드든 저장 중(locked)이면 모든 저장 버튼을 비활성화해 저장을 직렬화한다.
        //   레거시 closed 는 status 로 대체했으나 기존 값은 보존(폴백 호환).
        disabled={locked || !dirty}
        onClick={() => onSave(program.name, { applyUrl: url.trim(), closed: !!setting?.closed })}
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );
};

// ── 텍스트 콘텐츠 편집 패널 (로그인 시에만 렌더) ───────────────────
//   프로그램 제목/영문/한줄소개/본문을 인라인 편집해 DB(programContent)로 저장한다.
//   · baseProgram = 하드코딩 기본값(빈 입력 시 어디로 복귀하는지 placeholder 로 안내)
//   · 식별 키는 '편집 시작 시점의 name'(baseProgram.name) 으로 고정해, 제목을 바꿔도
//     같은 슬롯에 저장된다(저장 키가 입력값을 따라 떠다니지 않도록).
const ContentEditPanel: React.FC<{
  baseProgram: Program;        // 하드코딩 기본값(placeholder·저장 키 기준)
  content?: ProgramContent;    // 현재 저장된 오버라이드
  setting?: ProgramSetting;    // 레거시 closed 폴백(status 미설정 시 기본 선택값)
  saving: boolean;
  locked: boolean;
  onSave: (name: string, next: ProgramContent) => void;
}> = ({ baseProgram, content, setting, saving, locked, onSave }) => {
  const [name, setName] = useState<string>(content?.name ?? '');
  const [en, setEn] = useState<string>(content?.en ?? '');
  const [summary, setSummary] = useState<string>(content?.summary ?? '');
  const [desc, setDesc] = useState<string>(content?.desc ?? '');
  // 모집 상태 — 저장된 실효 상태(resolveStatus)를 기본 선택값으로 끌어와 토글 일관성 유지.
  const [status, setStatus] = useState<ProgramStatus>(resolveStatus(content, setting));

  useEffect(() => {
    setName(content?.name ?? '');
    setEn(content?.en ?? '');
    setSummary(content?.summary ?? '');
    setDesc(content?.desc ?? '');
    setStatus(resolveStatus(content, setting));
  }, [content, setting]);

  // dirty: status 는 '실효 상태' 기준으로 비교(미설정 content + 동일 폴백이면 변경 없음으로 본다).
  const effectiveSavedStatus: ProgramStatus = resolveStatus(content, setting);
  const dirty =
    (content?.name ?? '') !== name ||
    (content?.en ?? '') !== en ||
    (content?.summary ?? '') !== summary ||
    (content?.desc ?? '') !== desc ||
    effectiveSavedStatus !== status;

  return (
    <div className="program-edit-panel program-content-edit" data-name="텍스트 편집">
      <p className="program-content-edit-title">텍스트 편집</p>
      <label className="program-edit-field">
        <span>제목</span>
        <input
          type="text"
          className="program-edit-input"
          value={name}
          placeholder={baseProgram.name}
          onChange={(e) => setName(e.target.value)}
          disabled={locked}
        />
      </label>
      <label className="program-edit-field">
        <span>영문</span>
        <input
          type="text"
          className="program-edit-input"
          value={en}
          placeholder={baseProgram.en}
          onChange={(e) => setEn(e.target.value)}
          disabled={locked}
        />
      </label>
      <label className="program-edit-field">
        <span>한 줄 소개</span>
        <input
          type="text"
          className="program-edit-input"
          value={summary}
          placeholder={baseProgram.summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={locked}
        />
      </label>
      <label className="program-edit-field">
        <span>설명</span>
        <textarea
          className="program-edit-input program-edit-textarea"
          value={desc}
          placeholder={baseProgram.desc}
          rows={3}
          onChange={(e) => setDesc(e.target.value)}
          disabled={locked}
        />
      </label>
      {!baseProgram.festival && (
        <div className="program-edit-field program-status-field" role="group" aria-label="모집 상태">
          <span>모집 상태</span>
          <div className="program-status-options">
            {STATUS_ORDER.map((opt) => (
              <label key={opt} className={`program-status-radio ${STATUS_META[opt].cls}`}>
                <input
                  type="radio"
                  name={`status-${baseProgram.name}`}
                  checked={status === opt}
                  onChange={() => setStatus(opt)}
                  disabled={locked}
                />
                <span>{STATUS_META[opt].label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="program-edit-save"
        disabled={locked || !dirty}
        onClick={() =>
          onSave(baseProgram.name, {
            name: name.trim(),
            en: en.trim(),
            summary: summary.trim(),
            desc: desc.trim(),
            // 축제 카드는 모집 개념이 없어 status 를 저장하지 않는다.
            ...(baseProgram.festival ? {} : { status }),
          })
        }
      >
        {saving ? '저장 중…' : '텍스트 저장'}
      </button>
      <p className="program-content-edit-hint">
        비워두면 기본 문구로 돌아갑니다.
      </p>
    </div>
  );
};

const ProgramCard: React.FC<{
  baseProgram: Program;        // 하드코딩 원본(편집 placeholder·저장 키)
  program: Program;            // 오버라이드 반영된 실효 표시값
  walkPhase: 'left' | 'right';
  setting?: ProgramSetting;
  content?: ProgramContent;
  authed: boolean;
  saving: boolean;
  locked: boolean;
  onSaveSetting: (name: string, next: ProgramSetting) => void;
  onSaveContent: (name: string, next: ProgramContent) => void;
}> = ({ baseProgram, program, walkPhase, setting, content, authed, saving, locked, onSaveSetting, onSaveContent }) => {
  const labelLines = program.label ?? [program.name];
  const status = resolveStatus(content, setting);
  const closed = status === 'closed';
  return (
    <article className="program-card" style={{ '--accent': program.color } as React.CSSProperties}>
      <div className="program-card-art">
        <div className={`program-character-frame ${walkPhase === 'right' ? 'is-step-right' : 'is-step-left'}`}>
          <MotionCharacter src={program.character} alt={labelLines.join(' ')} className="program-rig" />
        </div>
      </div>
      <div className="program-title-row">
        <h3 className="program-name">{program.name}</h3>
        <ProgramStatusBadge program={program} status={status} />
      </div>
      <p className="program-en">{program.en}</p>
      <h2>{program.summary}</h2>
      <p className="program-desc">{program.desc}</p>
      <div className="program-meta">
        {program.meta.map(([key, value]) => (
          <p key={key}><span>{key}</span><b>{value}</b></p>
        ))}
      </div>
      <ApplyButton program={program} setting={setting} closed={closed} className="program-action" />
      {authed && (
        <>
          <ContentEditPanel
            baseProgram={baseProgram}
            content={content}
            setting={setting}
            saving={saving}
            locked={locked}
            onSave={onSaveContent}
          />
          <SettingEditPanel program={baseProgram} setting={setting} saving={saving} locked={locked} onSave={onSaveSetting} />
        </>
      )}
    </article>
  );
};

const MobileProgramCard: React.FC<{
  baseProgram: Program;
  program: Program;
  setting?: ProgramSetting;
  content?: ProgramContent;
  authed: boolean;
  saving: boolean;
  locked: boolean;
  onSaveSetting: (name: string, next: ProgramSetting) => void;
  onSaveContent: (name: string, next: ProgramContent) => void;
}> = ({ baseProgram, program, setting, content, authed, saving, locked, onSaveSetting, onSaveContent }) => {
  const status = resolveStatus(content, setting);
  const closed = status === 'closed';
  return (
  <article className="mobile-program-card" style={{ '--accent': program.color, '--mark': program.mobileMark } as React.CSSProperties}>
    <div className="mobile-program-head">
      <div className="mobile-program-character" aria-hidden="true">
        <MotionCharacter src={program.character} alt="" className="program-rig-mobile" />
      </div>
      <div className="mobile-program-titles">
        <div className="mobile-program-title-row">
          <h2>{program.name}</h2>
          <ProgramStatusBadge program={program} status={status} className="is-mobile" />
        </div>
        <p>{program.en}</p>
      </div>
    </div>
    <p className="mobile-program-summary">{program.summary}</p>
    <div className="mobile-program-meta">
      <span>{program.field}</span>
      <b>{program.brief}</b>
    </div>
    <ApplyButton program={program} setting={setting} closed={closed} className="mobile-program-action" />
    {authed && (
      <>
        <ContentEditPanel
          baseProgram={baseProgram}
          content={content}
          setting={setting}
          saving={saving}
          locked={locked}
          onSave={onSaveContent}
        />
        <SettingEditPanel program={baseProgram} setting={setting} saving={saving} locked={locked} onSave={onSaveSetting} />
      </>
    )}
  </article>
  );
};

const Programs: React.FC = () => {
  const [walkPhase, setWalkPhase] = useState<'left' | 'right'>('left');
  const { authed } = useKkumdarakAuth();

  // 신청 링크/마감 오버라이드 + 텍스트 콘텐츠 오버라이드 (백엔드 단일 진실 소스, name 으로 key)
  const [settings, setSettings] = useState<ProgramSettingsMap>({});
  const [contentMap, setContentMap] = useState<ProgramContentMap>({});
  const [savingName, setSavingName] = useState<string | null>(null);

  // 저장 시 머지 기준이 되는 '최신' 전체 data 스냅샷({ programs, programContent }).
  //   stale-closure 방지 + 초기 GET 미완료 상태에서 저장 시 다른 값이 누락되는 사고를 막기 위해
  //   ref 로 항상 최신 맵을 들고 있는다(handleSave* 가 이 ref 를 머지한다).
  const dataRef = useRef<KkumdarakSettingsData>({});
  // GET(로드)이 한 번이라도 완료됐는지. 로드 전에는 저장을 막아 빈 맵으로 덮어쓰는 사고를 차단.
  const loadedRef = useRef<boolean>(false);
  // 직전 GET 이 '실패'로 끝났는지. 이 경우 dataRef 가 신뢰 불가라, 저장 전 GET 을 한 번 더 시도해 복구한다.
  const loadFailedRef = useRef<boolean>(false);
  // 저장 in-flight 가드(방어적 직렬화). UI 의 locked 비활성화가 우회돼도 한 번에 한 PUT 만 보낸다.
  const savingRef = useRef<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setWalkPhase(p => p === 'left' ? 'right' : 'left'), 420);
    return () => clearInterval(t);
  }, []);

  // 전체 data 를 ref·상태에 반영하는 헬퍼.
  const applyData = useCallback((data: KkumdarakSettingsData) => {
    dataRef.current = data || {};
    setSettings((data && data.programs) || {});
    setContentMap((data && data.programContent) || {});
  }, []);

  // 설정 로드 (공개 GET) — 언마운트 후 setState 방지.
  //   kkumdarakSettingsAPI.get() 은 내부에서 cdnBustUrl 로 Vercel Edge Cache 를 우회한다
  //   (저장 직후 5분 창 한정). 이 우회가 없으면 저장 직후 재진입 시 저장 이전 응답을 받는다.
  useEffect(() => {
    let alive = true;
    kkumdarakSettingsAPI.get()
      .then((data: KkumdarakSettingsData) => {
        if (!alive) return;
        applyData(data || {});
        loadedRef.current = true;
        loadFailedRef.current = false;
      })
      .catch(() => {
        if (!alive) return;
        // 폴백: 오버라이드 없음(기본 동작 유지). 로드는 '완료'로 보되 '실패'로 표시한다.
        loadedRef.current = true;
        loadFailedRef.current = true;
      });
    return () => { alive = false; };
  }, [applyData]);

  // 공통 저장 코어 — 최신 ref(data)에 한 항목을 머지해 전체 data 를 통째로 PUT.
  //   key 는 'programs' | 'programContent', next 는 해당 맵에 머지될 단일 항목.
  //   · 머지 기준을 state 대신 dataRef.current 로 잡아 stale-closure 유실을 방지한다.
  //   · 초기 GET 미완료(loadedRef=false) 상태면 저장을 막는다(빈 맵 덮어쓰기 차단).
  const saveCore = useCallback(
    async <K extends keyof KkumdarakSettingsData>(
      bucket: K,
      name: string,
      next: ProgramSetting | ProgramContent,
    ) => {
      if (!loadedRef.current) {
        alert('설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      if (savingRef.current) {
        alert('다른 항목을 저장하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      savingRef.current = true;
      setSavingName(name);
      try {
        // 직전 GET 실패 시 base(dataRef)가 비어 있을 수 있어, 저장 전 GET 을 재시도해 복구한다
        //   (빈 맵으로 통째 덮어쓰기 방지). 재시도도 실패하면 알리고 저장을 중단한다.
        if (loadFailedRef.current) {
          try {
            const data: KkumdarakSettingsData = await kkumdarakSettingsAPI.get();
            applyData(data || {});
            loadFailedRef.current = false;
          } catch {
            alert('설정을 다시 불러오지 못했습니다. 네트워크 확인 후 다시 시도해주세요.');
            return;
          }
        }
        const base = dataRef.current || {};
        const currentBucket = (base[bucket] as Record<string, unknown>) || {};
        const optimistic: KkumdarakSettingsData = {
          ...base,
          [bucket]: { ...currentBucket, [name]: next },
        };
        await kkumdarakSettingsAPI.save(optimistic);
        applyData(optimistic);
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
    },
    [applyData],
  );

  const handleSaveSetting = useCallback(
    (name: string, next: ProgramSetting) => saveCore('programs', name, next),
    [saveCore],
  );
  const handleSaveContent = useCallback(
    (name: string, next: ProgramContent) => saveCore('programContent', name, next),
    [saveCore],
  );

  return (
    <section className={`kd-figma-programs${authed ? ' is-editing' : ''}`}>
      <div className={`kd-program-desktop${authed ? ' is-editing' : ''}`} data-name="프로그램 — Desktop">
        <div className="kd-section-rule kd-section-rule--s2" />
        <p className="program-kicker">7개의 프로그램은 한 줄로 흐른다</p>
        <h1>프로그램</h1>
        <div className="program-soft-field" />
        <div className="program-grid">
          {PROGRAMS.map((base) => (
            <ProgramCard
              key={base.name}
              baseProgram={base}
              program={resolveProgram(base, contentMap[base.name])}
              walkPhase={walkPhase}
              setting={settings[base.name]}
              content={contentMap[base.name]}
              authed={authed}
              saving={savingName === base.name}
              locked={savingName !== null}
              onSaveSetting={handleSaveSetting}
              onSaveContent={handleSaveContent}
            />
          ))}
        </div>
      </div>

      <div className={`kd-program-mobile${authed ? ' is-editing' : ''}`} data-name="프로그램 — Mobile">
        <div className="kd-section-rule kd-section-rule--s2" />
        <h1>프로그램</h1>
        <div className="mobile-program-list">
          {PROGRAMS.map((base) => (
            <MobileProgramCard
              key={base.name}
              baseProgram={base}
              program={resolveProgram(base, contentMap[base.name])}
              setting={settings[base.name]}
              content={contentMap[base.name]}
              authed={authed}
              saving={savingName === base.name}
              locked={savingName !== null}
              onSaveSetting={handleSaveSetting}
              onSaveContent={handleSaveContent}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Programs;
