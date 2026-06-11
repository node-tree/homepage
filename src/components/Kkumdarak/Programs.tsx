import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KKUMDARAK_APPLY_URL } from './data';
import MotionCharacter from './MotionCharacter';
import ProgramCharacterPng, { characterPngForName } from './programCharacters';
import { useKkumdarakAuth } from './KkumdarakAuthContext';
import { kkumdarakSettingsAPI } from '../../services/api';
import { lsGet, lsSet } from '../../utils/lsCache';

// ── 캐시 우선 시드(이전 내용 플래시 제거) ─────────────────────────────
//   재방문 시 마지막으로 본 '현재' 내용(programs/programContent)을 첫 페인트부터 즉시 렌더해
//   백엔드(Render) 콜드스타트 동안 하드코딩 옛 값이 떴다 바뀌는 플래시를 없앤다.
//   캐시 키는 버전 접미사. 민감정보 없음(프로그램 텍스트·상태만).
const PROGRAMS_CACHE_KEY = 'kkumdarakSettings_v1';

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
    // 축제 〈다시, 안녕〉 — 다섯 세대가 다시 만나는 마을 통합 축제.
    //   PNG 가 없어 chars-v2 6프레임 리그로 폴백. character-19(crossing-knot):
    //   세 색이 서로 엮인 매듭 = '만남·연결'을 상징(축제 빨강 #e4352b 포함, PNG 세트와 톤 일치).
    character: '19-character-19-crossing-knot.svg',
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

// ── 모집 상태: 서로 독립적인 두 축 ─────────────────────────────────
//   ① applyStatus — 신청 버튼 축: 'open'(신청하기) ↔ 'closed'(모집마감)
//   ② phaseStatus — 상단 배지 축: 'ongoing'(진행중) ↔ 'recruiting'(신청중)
//   두 축은 독립이라 (배지=진행중 + 버튼=모집마감), (배지=신청중 + 버튼=신청하기) 등 임의 조합 가능.
//   레거시 단일 status('ongoing'|'recruiting'|'closed'|'open')·setting.closed 에서 폴백·마이그레이션
//   (아래 resolveApplyStatus / resolvePhaseStatus 참고).
type ApplyStatus = 'open' | 'closed';
type PhaseStatus = 'ongoing' | 'recruiting';

// 이전 버전 단일 status 값(읽기 전용 마이그레이션 소스).
type LegacyStatus = 'ongoing' | 'recruiting' | 'closed' | 'open';

// 배지(phaseStatus) 표시 라벨 + modifier 클래스(데스크톱·모바일 공용).
const PHASE_META: Record<PhaseStatus, { label: string; cls: string }> = {
  ongoing:    { label: '진행중', cls: 'is-ongoing' },
  recruiting: { label: '신청중', cls: 'is-recruiting' },
};
const PHASE_ORDER: PhaseStatus[] = ['ongoing', 'recruiting'];

// 신청 버튼(applyStatus) 편집 라벨.
const APPLY_META: Record<ApplyStatus, { label: string }> = {
  open:   { label: '신청하기' },
  closed: { label: '모집마감' },
};
const APPLY_ORDER: ApplyStatus[] = ['open', 'closed'];

// 인라인 편집으로 덮어쓸 수 있는 텍스트 필드. 값이 없으면(빈 문자열·undefined) 하드코딩 기본값 사용.
//   applyStatus = 신청 버튼 축, phaseStatus = 상단 배지 축(둘 다 독립).
//   status(레거시 단일 필드)는 더 이상 쓰지 않지만 옛 저장값 폴백용으로 타입에만 남긴다.
interface ProgramContent {
  name?: string;
  en?: string;
  summary?: string;
  desc?: string;
  // 카드 meta(회차/모집/기간) 인라인 편집. 비우면 하드코딩 PROGRAMS.meta 기본값으로 복귀.
  rounds?: string;   // 회차 (예: '12회 · 36시수')
  recruit?: string;  // 모집 (예: '전생애 15명')
  period?: string;   // 기간 (예: '5.23 – 8.22')
  applyStatus?: ApplyStatus;
  phaseStatus?: PhaseStatus;
  status?: LegacyStatus;   // @deprecated — 폴백 전용(쓰기 안 함)
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

// meta 배열에서 특정 key 의 기본값 조회(없으면 '').
type Program = typeof PROGRAMS[number];
const metaValue = (program: Program, key: string): string => {
  const row = program.meta.find(([k]) => k === key);
  return row ? row[1] : '';
};

// 카드 하단 'brief'(모바일 한 줄 요약) 기본값 = '모집 · 기간' 형태.
//   회차/모집/기간 오버라이드가 있으면 모바일 brief 도 그 값으로 재구성해 일관 표시.
const buildBrief = (recruit: string, period: string, fallback: string): string => {
  const r = recruit.trim(), p = period.trim();
  if (!r && !p) return fallback;
  return [r, p].filter(Boolean).join(' · ');
};

// 하드코딩 프로그램 + 콘텐츠 오버라이드 → 화면에 실제로 그릴 '실효 프로그램'.
const resolveProgram = (program: Program, content?: ProgramContent): Program => {
  if (!content) return program;
  const name = pick(content.name, program.name);

  // meta(회차/모집/기간) 오버라이드 — 해당 key 행만 값 교체, 그 외 행(축제의 일시/대상/관람 등)은 보존.
  const recruit = pick(content.recruit, metaValue(program, '모집'));
  const period = pick(content.period, metaValue(program, '기간'));
  const rounds = pick(content.rounds, metaValue(program, '회차'));
  const meta = program.meta.map(([k, v]) => {
    if (k === '회차') return [k, rounds];
    if (k === '모집') return [k, recruit];
    if (k === '기간') return [k, period];
    return [k, v];
  });

  return {
    ...program,
    name,
    en: pick(content.en, program.en),
    summary: pick(content.summary, program.summary),
    desc: pick(content.desc, program.desc),
    meta,
    // 모바일 brief: 회차/모집/기간 중 모집·기간 오버라이드가 있으면 재구성, 없으면 기본 brief.
    brief: buildBrief(content.recruit ?? '', content.period ?? '', program.brief),
    // label 은 줄바꿈용 보조 표기 — name 을 편집하면 더 이상 유효하지 않으므로
    //   오버라이드가 name 을 바꾼 경우 label 을 떨어뜨려 새 name 한 줄로 렌더한다.
    label: name === program.name ? program.label : undefined,
  };
};

// ── 모집 상태: 두 축 독립 해석 ─────────────────────────────────────
//   소스 우선순위: (신규) content.applyStatus/phaseStatus > (레거시) content.status > (레거시) setting.closed.
//
//   ① 신청 버튼 축 applyStatus:
//      · content.applyStatus 명시 → 그대로(open|closed)
//      · 아니면 레거시 status: 'closed'→closed, 'recruiting'|'ongoing'|'open'→open
//      · 아니면 setting.closed(boolean): true→closed, else open
const resolveApplyStatus = (content?: ProgramContent, setting?: ProgramSetting): ApplyStatus => {
  if (content?.applyStatus === 'open' || content?.applyStatus === 'closed') return content.applyStatus;
  const legacy = content?.status as string | undefined;
  if (legacy === 'closed') return 'closed';
  if (legacy === 'recruiting' || legacy === 'ongoing' || legacy === 'open') return 'open';
  return setting?.closed ? 'closed' : 'open';
};

//   ② 상단 배지 축 phaseStatus:
//      · content.phaseStatus 명시 → 그대로(ongoing|recruiting)
//      · 아니면 레거시 status: 'recruiting'→recruiting(신청중), 그 외(ongoing|closed|open)→ongoing(진행중)
//      · 아니면 기본 ongoing
const resolvePhaseStatus = (content?: ProgramContent): PhaseStatus => {
  if (content?.phaseStatus === 'ongoing' || content?.phaseStatus === 'recruiting') return content.phaseStatus;
  const legacy = content?.status as string | undefined;
  if (legacy === 'recruiting') return 'recruiting';
  return 'ongoing';
};

// 공개 표시용 모집 단계 배지 (진행중 / 신청중). 축제 카드는 신청 개념이 없어 렌더하지 않는다.
const ProgramStatusBadge: React.FC<{
  program: Program;
  phase: PhaseStatus;
  className?: string;
}> = ({ program, phase, className }) => {
  if (program.festival) return null;
  const meta = PHASE_META[phase];
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
  closed: boolean;           // applyStatus==='closed' 에서 파생한 신청 버튼 마감 여부
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
  // meta 인라인 편집 — 비우면 하드코딩 meta 로 복귀(placeholder 로 기본값 안내).
  const [rounds, setRounds] = useState<string>(content?.rounds ?? '');
  const [recruit, setRecruit] = useState<string>(content?.recruit ?? '');
  const [period, setPeriod] = useState<string>(content?.period ?? '');
  // 두 축 — 저장된 실효 상태(resolve*)를 기본 선택값으로 끌어와 토글 일관성 유지.
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>(resolveApplyStatus(content, setting));
  const [phaseStatus, setPhaseStatus] = useState<PhaseStatus>(resolvePhaseStatus(content));

  useEffect(() => {
    setName(content?.name ?? '');
    setEn(content?.en ?? '');
    setSummary(content?.summary ?? '');
    setDesc(content?.desc ?? '');
    setRounds(content?.rounds ?? '');
    setRecruit(content?.recruit ?? '');
    setPeriod(content?.period ?? '');
    setApplyStatus(resolveApplyStatus(content, setting));
    setPhaseStatus(resolvePhaseStatus(content));
  }, [content, setting]);

  // dirty: 두 축은 '실효 상태' 기준 비교(미설정 content + 동일 폴백이면 변경 없음으로 본다).
  const savedApply: ApplyStatus = resolveApplyStatus(content, setting);
  const savedPhase: PhaseStatus = resolvePhaseStatus(content);
  const dirty =
    (content?.name ?? '') !== name ||
    (content?.en ?? '') !== en ||
    (content?.summary ?? '') !== summary ||
    (content?.desc ?? '') !== desc ||
    (content?.rounds ?? '') !== rounds ||
    (content?.recruit ?? '') !== recruit ||
    (content?.period ?? '') !== period ||
    savedApply !== applyStatus ||
    savedPhase !== phaseStatus;

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
        <>
          <label className="program-edit-field">
            <span>회차</span>
            <input
              type="text"
              className="program-edit-input"
              value={rounds}
              placeholder={metaValue(baseProgram, '회차')}
              onChange={(e) => setRounds(e.target.value)}
              disabled={locked}
            />
          </label>
          <label className="program-edit-field">
            <span>모집</span>
            <input
              type="text"
              className="program-edit-input"
              value={recruit}
              placeholder={metaValue(baseProgram, '모집')}
              onChange={(e) => setRecruit(e.target.value)}
              disabled={locked}
            />
          </label>
          <label className="program-edit-field">
            <span>기간</span>
            <input
              type="text"
              className="program-edit-input"
              value={period}
              placeholder={metaValue(baseProgram, '기간')}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={locked}
            />
          </label>
          <div className="program-edit-field program-status-field" role="group" aria-label="상단 배지 상태">
            <span>상단 배지</span>
            <div className="program-status-options">
              {PHASE_ORDER.map((opt) => (
                <label key={opt} className={`program-status-radio ${PHASE_META[opt].cls}`}>
                  <input
                    type="radio"
                    name={`phase-${baseProgram.name}`}
                    checked={phaseStatus === opt}
                    onChange={() => setPhaseStatus(opt)}
                    disabled={locked}
                  />
                  <span>{PHASE_META[opt].label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="program-edit-field program-status-field" role="group" aria-label="신청 버튼 상태">
            <span>신청 버튼</span>
            <div className="program-status-options">
              {APPLY_ORDER.map((opt) => (
                <label key={opt} className={`program-status-radio ${opt === 'closed' ? 'is-closed' : 'is-apply-open'}`}>
                  <input
                    type="radio"
                    name={`apply-${baseProgram.name}`}
                    checked={applyStatus === opt}
                    onChange={() => setApplyStatus(opt)}
                    disabled={locked}
                  />
                  <span>{APPLY_META[opt].label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
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
            // 축제 카드는 모집·회차·기간 개념이 없어 해당 필드를 저장하지 않는다.
            //   신규 두 축으로 저장하고, 더 이상 레거시 단일 status 는 쓰지 않는다(폴백 전용).
            ...(baseProgram.festival ? {} : {
              rounds: rounds.trim(),
              recruit: recruit.trim(),
              period: period.trim(),
              applyStatus,
              phaseStatus,
            }),
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

// ── 스켈레톤(첫 방문 + 데이터 미도착 전용) ─────────────────────────────
//   캐시가 없는 첫 방문에서 GET 도착 전까지, 하드코딩 옛 값을 그대로 노출하는 대신
//   오버라이드 대상 영역(제목/영문/한줄소개/기간/모집/회차/배지/신청버튼)을 중립 회색
//   placeholder 로 가린다 → 옛 값이 떴다 바뀌는 플래시 0. 카드 골격·캐릭터·레이아웃은 유지.
//   hydrated=true(캐시 있었음 또는 GET 완료)면 스켈레톤은 렌더되지 않는다.
const SkelBar: React.FC<{ w?: string; h?: number; className?: string }> = ({ w = '100%', h = 14, className }) => (
  <span className={`kd-prog-skel${className ? ' ' + className : ''}`} style={{ width: w, height: h }} aria-hidden="true" />
);

// 데스크톱 카드 스켈레톤 — 실제 영역과 비슷한 크기로 레이아웃 점프 최소화.
const ProgramCardSkeleton: React.FC<{ program: Program; walkPhase: 'left' | 'right' }> = ({ program, walkPhase }) => {
  const labelLines = program.label ?? [program.name];
  return (
    <article className="program-card is-skeleton" style={{ '--accent': program.color } as React.CSSProperties} aria-busy="true">
      <div className="program-card-art">
        <div className={`program-character-frame ${walkPhase === 'right' ? 'is-step-right' : 'is-step-left'}`}>
          {characterPngForName(program.name)
            ? <ProgramCharacterPng name={program.name} alt={labelLines.join(' ')} className="program-rig program-rig-png" />
            : <MotionCharacter src={program.character} alt={labelLines.join(' ')} className="program-rig" />}
        </div>
      </div>
      <div className="program-title-row">
        <SkelBar w="56%" h={22} />
      </div>
      <p className="program-en"><SkelBar w="40%" h={13} /></p>
      <h2><SkelBar w="80%" h={20} /></h2>
      <p className="program-desc"><SkelBar w="100%" h={14} className="kd-prog-skel-line" /><SkelBar w="92%" h={14} className="kd-prog-skel-line" /></p>
      <div className="program-meta">
        <p><SkelBar w="44px" h={13} /><SkelBar w="62%" h={13} /></p>
        <p><SkelBar w="44px" h={13} /><SkelBar w="50%" h={13} /></p>
        <p><SkelBar w="44px" h={13} /><SkelBar w="56%" h={13} /></p>
      </div>
      <span className="program-action is-skeleton" aria-hidden="true"><SkelBar w="40%" h={18} /></span>
    </article>
  );
};

// 모바일 카드 스켈레톤.
const MobileProgramCardSkeleton: React.FC<{ program: Program }> = ({ program }) => (
  <article className="mobile-program-card is-skeleton" style={{ '--accent': program.color, '--mark': program.mobileMark } as React.CSSProperties} aria-busy="true">
    <div className="mobile-program-head">
      <div className="mobile-program-character" aria-hidden="true">
        {characterPngForName(program.name)
          ? <ProgramCharacterPng name={program.name} alt="" className="program-rig-mobile program-rig-png" />
          : <MotionCharacter src={program.character} alt="" className="program-rig-mobile" />}
      </div>
      <div className="mobile-program-titles">
        <div className="mobile-program-title-row"><SkelBar w="58%" h={16} /></div>
        <p><SkelBar w="40%" h={12} /></p>
      </div>
    </div>
    <p className="mobile-program-summary"><SkelBar w="86%" h={14} /></p>
    <div className="mobile-program-meta">
      <SkelBar w="30%" h={12} />
      <SkelBar w="48%" h={12} />
    </div>
    <span className="mobile-program-action is-skeleton" aria-hidden="true"><SkelBar w="44%" h={15} /></span>
  </article>
);

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
  const phase = resolvePhaseStatus(content);
  const closed = resolveApplyStatus(content, setting) === 'closed';
  return (
    <article className="program-card" style={{ '--accent': program.color } as React.CSSProperties}>
      <div className="program-card-art">
        <div className={`program-character-frame ${walkPhase === 'right' ? 'is-step-right' : 'is-step-left'}`}>
          {characterPngForName(baseProgram.name)
            ? <ProgramCharacterPng name={baseProgram.name} alt={labelLines.join(' ')} className="program-rig program-rig-png" />
            : <MotionCharacter src={program.character} alt={labelLines.join(' ')} className="program-rig" />}
        </div>
      </div>
      <div className="program-title-row">
        <h3 className="program-name">{program.name}</h3>
        <ProgramStatusBadge program={program} phase={phase} />
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
  const phase = resolvePhaseStatus(content);
  const closed = resolveApplyStatus(content, setting) === 'closed';
  return (
  <article className="mobile-program-card" style={{ '--accent': program.color, '--mark': program.mobileMark } as React.CSSProperties}>
    <div className="mobile-program-head">
      <div className="mobile-program-character" aria-hidden="true">
        {characterPngForName(baseProgram.name)
          ? <ProgramCharacterPng name={baseProgram.name} alt="" className="program-rig-mobile program-rig-png" />
          : <MotionCharacter src={program.character} alt="" className="program-rig-mobile" />}
      </div>
      <div className="mobile-program-titles">
        <div className="mobile-program-title-row">
          <h2>{program.name}</h2>
          <ProgramStatusBadge program={program} phase={phase} className="is-mobile" />
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

  // ── 편집 모드 토글 (작업 2) ───────────────────────────────────────
  //   로그인(authed) 만으로 편집 패널이 상시 노출되던 것을, VillageDiary 패턴처럼
  //   「편집」 버튼을 눌러야(editMode) 편집 UI 가 뜨도록 한 겹 게이트한다.
  //   authed && !editMode = 공개 화면(편집 패널 0), authed && editMode = 편집 화면.
  //   비로그인은 토글 자체가 안 보인다(editing 항상 false).
  const [editMode, setEditMode] = useState(false);
  // 로그아웃/인증 만료 시 편집 모드 강제 종료(카드가 편집 비주얼로 남지 않게).
  useEffect(() => {
    if (!authed) setEditMode(false);
  }, [authed]);
  // 실제 편집 노출 여부 = 로그인 AND 편집모드.
  const editing = authed && editMode;

  // ── 캐시 우선 시드 ─────────────────────────────────────────────────
  //   localStorage 캐시(있으면)로 settings/contentMap/dataRef 를 lazy initializer 로 시드해
  //   첫 페인트부터 마지막으로 본 현재 값을 그린다(옛 하드코딩 플래시 0). VillageDiary 패턴 이식.
  const cachedData: KkumdarakSettingsData | null = lsGet<KkumdarakSettingsData>(PROGRAMS_CACHE_KEY);
  const hadCache = !!cachedData;

  // 신청 링크/마감 오버라이드 + 텍스트 콘텐츠 오버라이드 (백엔드 단일 진실 소스, name 으로 key)
  const [settings, setSettings] = useState<ProgramSettingsMap>(() => cachedData?.programs ?? {});
  const [contentMap, setContentMap] = useState<ProgramContentMap>(() => cachedData?.programContent ?? {});
  const [savingName, setSavingName] = useState<string | null>(null);

  // ── 로드 게이트 ────────────────────────────────────────────────────
  //   hydrated = (캐시 있었음) || (GET 완료). false(첫 방문 + GET 미완)면 오버라이드 영역을
  //   하드코딩 옛 값 대신 스켈레톤으로 가린다. 캐시가 있으면 처음부터 true → 스켈레톤 미표시.
  const [hydrated, setHydrated] = useState<boolean>(hadCache);

  // 저장 시 머지 기준이 되는 '최신' 전체 data 스냅샷({ programs, programContent }).
  //   stale-closure 방지 + 초기 GET 미완료 상태에서 저장 시 다른 값이 누락되는 사고를 막기 위해
  //   ref 로 항상 최신 맵을 들고 있는다(handleSave* 가 이 ref 를 머지한다).
  const dataRef = useRef<KkumdarakSettingsData>(cachedData ?? {});
  // GET(로드)이 한 번이라도 완료됐는지. 로드 전에는 저장을 막아 빈 맵으로 덮어쓰는 사고를 차단.
  const loadedRef = useRef<boolean>(false);
  // 직전 GET 이 '실패'로 끝났는지. 이 경우 dataRef 가 신뢰 불가라, 저장 전 GET 을 한 번 더 시도해 복구한다.
  const loadFailedRef = useRef<boolean>(false);
  // GET 이 '한 번이라도 성공'했는지(=dataRef 가 실제 서버 맵을 담은 적 있는지).
  //   콜드스타트/일시 네트워크 오류로 초기 GET 이 실패해도, 한 번 성공해 base 맵이 있으면
  //   저장 전 재조회가 또 실패하더라도 저장을 막지 않는다(빈 맵 덮어쓰기 위험이 없으므로).
  const everLoadedRef = useRef<boolean>(false);
  // 저장 in-flight 가드(방어적 직렬화). UI 의 locked 비활성화가 우회돼도 한 번에 한 PUT 만 보낸다.
  const savingRef = useRef<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setWalkPhase(p => p === 'left' ? 'right' : 'left'), 420);
    return () => clearInterval(t);
  }, []);

  // 전체 data 를 ref·상태에 반영하는 헬퍼.
  const applyData = useCallback((data: KkumdarakSettingsData, cache = false) => {
    const next = data || {};
    dataRef.current = next;
    setSettings(next.programs || {});
    setContentMap(next.programContent || {});
    // GET 성공/저장 성공 시에만 캐시 write(실패 시 기존 캐시 유지) — '표시 가속'용.
    if (cache) lsSet(PROGRAMS_CACHE_KEY, next);
  }, []);

  // 설정 로드 (공개 GET) — 언마운트 후 setState 방지.
  //   kkumdarakSettingsAPI.get() 은 내부에서 cdnBustUrl 로 Vercel Edge Cache 를 우회한다
  //   (저장 직후 5분 창 한정). 이 우회가 없으면 저장 직후 재진입 시 저장 이전 응답을 받는다.
  useEffect(() => {
    let alive = true;
    kkumdarakSettingsAPI.get()
      .then((data: KkumdarakSettingsData) => {
        if (!alive) return;
        applyData(data || {}, true);   // 성공 → 캐시 갱신
        loadedRef.current = true;
        loadFailedRef.current = false;
        everLoadedRef.current = true;
        setHydrated(true);             // GET 완료 → 게이트 해제
      })
      .catch(() => {
        if (!alive) return;
        // 폴백: 오버라이드 없음(기본 동작 유지). 로드는 '완료'로 보되 '실패'로 표시한다.
        //   GET 은 '완료'됐으므로 게이트는 해제(첫 방문은 하드코딩 기본값으로 폴백 — DB 가 없으니 옛 값 아님).
        loadedRef.current = true;
        loadFailedRef.current = true;
        setHydrated(true);
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
        // 직전 GET 이 실패했다면 base(dataRef)가 최신이 아닐 수 있어, 저장 전 GET 을 한 번 더 시도해 복구한다.
        //   ⚠️ 핵심 수정: 재시도가 또 실패해도 무조건 중단하지 않는다.
        //     · 과거 한 번이라도 성공해 base 맵을 가진 적 있으면(everLoadedRef) → 그 base 로 진행(저장 강행).
        //       (백엔드 콜드스타트/일시 오류로 재조회만 실패한 경우까지 저장을 막아 '저장이 안 된다'는
        //        증상을 유발하던 회귀를 제거. 단일 항목만 머지하므로 다른 프로그램 값 유실 위험 없음.)
        //     · 한 번도 성공한 적 없으면(=base 가 빈 맵일 위험) → 빈 맵 덮어쓰기 방지 위해 중단.
        if (loadFailedRef.current) {
          try {
            const data: KkumdarakSettingsData = await kkumdarakSettingsAPI.get();
            applyData(data || {}, true);
            loadFailedRef.current = false;
            everLoadedRef.current = true;
          } catch {
            if (!everLoadedRef.current) {
              alert('설정을 불러오지 못해 저장할 수 없습니다. 네트워크 확인 후 다시 시도해주세요.');
              return;
            }
            // base 맵은 이전 성공 로드값을 그대로 보유 → 저장 강행(중단하지 않음).
          }
        }
        const base = dataRef.current || {};
        const currentBucket = (base[bucket] as Record<string, unknown>) || {};
        const optimistic: KkumdarakSettingsData = {
          ...base,
          [bucket]: { ...currentBucket, [name]: next },
        };
        await kkumdarakSettingsAPI.save(optimistic);
        applyData(optimistic, true);   // 저장 성공 → 캐시 갱신
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

  // 편집 토글 버튼 — 로그인 시에만 노출(VillageDiary .kd-diary-edit-btn 톤과 일관).
  const renderEditToggle = () =>
    authed ? (
      <button
        type="button"
        className={`kd-program-edit-btn${editMode ? ' is-editing' : ''}`}
        onClick={() => setEditMode((v) => !v)}
      >
        {editMode ? '완료' : '편집'}
      </button>
    ) : null;

  return (
    <section className={`kd-figma-programs${editing ? ' is-editing' : ''}`}>
      <div className={`kd-program-desktop${editing ? ' is-editing' : ''}`} data-name="프로그램 — Desktop">
        <div className="kd-section-rule kd-section-rule--s2" />
        <p className="program-kicker">7개의 프로그램은 한 줄로 흐른다</p>
        <h1>프로그램</h1>
        {renderEditToggle()}
        <div className="program-soft-field" />
        <div className="program-grid">
          {PROGRAMS.map((base) =>
            hydrated ? (
              <ProgramCard
                key={base.name}
                baseProgram={base}
                program={resolveProgram(base, contentMap[base.name])}
                walkPhase={walkPhase}
                setting={settings[base.name]}
                content={contentMap[base.name]}
                authed={editing}
                saving={savingName === base.name}
                locked={savingName !== null}
                onSaveSetting={handleSaveSetting}
                onSaveContent={handleSaveContent}
              />
            ) : (
              <ProgramCardSkeleton key={base.name} program={base} walkPhase={walkPhase} />
            ),
          )}
        </div>
      </div>

      <div className={`kd-program-mobile${editing ? ' is-editing' : ''}`} data-name="프로그램 — Mobile">
        <div className="kd-section-rule kd-section-rule--s2" />
        <h1>프로그램</h1>
        {renderEditToggle()}
        <div className="mobile-program-list">
          {PROGRAMS.map((base) =>
            hydrated ? (
              <MobileProgramCard
                key={base.name}
                baseProgram={base}
                program={resolveProgram(base, contentMap[base.name])}
                setting={settings[base.name]}
                content={contentMap[base.name]}
                authed={editing}
                saving={savingName === base.name}
                locked={savingName !== null}
                onSaveSetting={handleSaveSetting}
                onSaveContent={handleSaveContent}
              />
            ) : (
              <MobileProgramCardSkeleton key={base.name} program={base} />
            ),
          )}
        </div>
      </div>
    </section>
  );
};

export default Programs;
