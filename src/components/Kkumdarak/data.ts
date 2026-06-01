// ═══════════════════════════════════════════════════════════════
// 꿈다락 문화예술학교 마이크로사이트 — 데이터 / 디자인 토큰
// 2026 생활거점형 1년차 · 충남 부여군 장암면
// 디자인: 크림 종이 위 굵은 라인, 페스티벌 쉐이프, 절제된 파이프 그래픽
// ═══════════════════════════════════════════════════════════════

// 외부 신청 폼 링크 (사용자가 추후 입력)
export const KKUMDARAK_APPLY_URL = '#';

// ── 디자인 토큰: 색 (maeve 대담 조합) ───────────────────────────
export const COLORS = {
  // 핵심 원색
  pink: '#E987B2',
  teal: '#1FB2D0',
  tealDeep: '#178B4B',
  yellow: '#F7BE2C',
  purple: '#2F68D8',
  cream: '#F6EEDC',
  // 중립
  ink: '#211914',
  paper: '#F6EEDC',
  surface: '#FFF9EA',
  // 씬용 보조
  pinkDeep: '#F23B2E',
  tealLite: '#CBEFE4',
  skyNight: '#F6EEDC',
  skyNight2: '#FFF9EA',
} as const;

// 프로그램/블록 색 키
export type PaletteKey = 'pink' | 'teal' | 'yellow' | 'purple' | 'tealDeep';

// ── 모션 토큰 (탄력·장난기) ─────────────────────────────────────
export const MOTION = {
  durFast: 0.18,
  durBase: 0.3,
  durSlow: 0.45,
  durSlower: 0.65,
  ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number],
  easeOutBack: [0.34, 1.4, 0.64, 1] as [number, number, number, number],
};

// ── 네비게이션 (5섹션) ──────────────────────────────────────────
export interface NavSection {
  id: string;
  label: string;
}
export const SECTIONS: NavSection[] = [
  { id: 'main', label: '홈' },
  { id: 'intro', label: '소개' },
  { id: 'programs', label: '프로그램' },
  { id: 'schedule', label: '일정' },
  { id: 'diary', label: '마을일기' },
  { id: 'directions', label: '오시는 길' },
];

// 상단 안내 띠 문구
export const ANNOUNCE = '2026 꿈다락 문화예술학교 · 다섯 세대가 함께 짓는 마을 — 참여자 모집';

// ── 4단계 흐름 (소개) ───────────────────────────────────────────
export const FLOW_STEPS = [
  { id: 1, title: '만들기', en: 'MAKE', color: 'pink' as PaletteKey, desc: '주민이 직접 공간과 도구, 프로그램을 만듭니다.' },
  { id: 2, title: '채우기', en: 'FILL', color: 'yellow' as PaletteKey, desc: '만든 공간을 기록·소리·풍경으로 채웁니다.' },
  { id: 3, title: '나누기', en: 'SHARE', color: 'teal' as PaletteKey, desc: '채워진 이야기를 마을과 세대가 함께 나눕니다.' },
  { id: 4, title: '지속하기', en: 'SUSTAIN', color: 'purple' as PaletteKey, desc: '나눈 경험이 마을의 일상으로 이어집니다.' },
];

// ── 사업 개요 ────────────────────────────────────────────────────
export const OVERVIEW = [
  { k: '주최', v: '문화체육관광부' },
  { k: '주관', v: '한국문화예술교육진흥원' },
  { k: '기간', v: '2026. 5 – 12' },
  { k: '대상', v: '다섯 세대 228명' },
  { k: '장소', v: '충남 부여군 장암면' },
];

// ── 「이소(異素)」 소개 ───────────────────────────────────────────
// 시민 대상 자료 — 현장 표기 「異素」 기준. 운영 주체 언급 없이 「이소」에 대해서만 소개.

// 블록 A — 「이소」란 (異素 한자 풀이): 두 한자를 토큰 색으로 강조
export interface IsoGlyph {
  glyph: string;   // 한자
  reading: string; // 음·훈 (예: '다를 이')
  color: PaletteKey;
  desc: string;
}
export const ISO_MEANING = {
  title: '「이소」란',
  glyphs: [
    { glyph: '異', reading: '다를 이', color: 'pink' as PaletteKey,
      desc: '어린이마다, 어르신마다, 마을마다 서로 다른 본질이 있습니다.' },
    { glyph: '素', reading: '본디 소', color: 'teal' as PaletteKey,
      desc: '꾸미지 않은 바탕, 저마다의 시작점.' },
  ] as IsoGlyph[],
  body: '「이소(異素)」는 서로 다른 본질들이 만나는 자리입니다. 다름을 한 가지로 모으지 않고, 서로 다른 그대로 만나게 합니다. 마을이 곧 문화예술학교가 되는 자리입니다.',
};

// 블록 B — 듣고, 빛내며 (부엉이와 반딧불이)
export const ISO_OWL_FIREFLY = {
  title: '듣고, 빛내며 — 부엉이와 반딧불이',
  body: '장암면에는 지금도 부엉이와 반딧불이가 함께 삽니다. 부엉이는 마을의 소리를 듣고 기억하는 자리, 반딧불이는 빛을 내어 신호를 보내는 자리입니다. 「이소」는 마을의 소리를 듣고, 다시 빛내며 발화하는 학교입니다.',
};

// 블록 C — 다섯 세대가 만나는 자리
export const ISO_GENERATIONS = {
  title: '다섯 세대가 만나는 자리',
  body: '어린이·청소년·청년·어른·어르신 — 다섯 세대가 서로 다른 그대로 한자리에서 만납니다. 가르치는 사람과 배우는 사람의 자리를 고정하지 않고, 저마다의 다름(異)과 바탕(素)이 그대로 만나는 자리를 만듭니다.',
};

// ── 멤버 소개 ────────────────────────────────────────────────────
// 5명을 팔레트 토큰 5개에 1:1 매핑. 소개글/역할은 모두 임시 placeholder이며
// 추후 사용자가 직접 입력 예정이므로 일괄 치환이 쉽도록 동일 문구를 사용한다.
export interface Member {
  id: string;
  name: string;       // 활동명 — 이름 그대로 표시
  color: PaletteKey;
  role: string;       // placeholder 역할 라벨
  desc: string;       // placeholder 소개글
  character?: string; // 캐릭터 일러스트 경로(추후 입력). 없으면 placeholder 슬롯 렌더
}

const MEMBER_DESC_PLACEHOLDER = '소개글은 추후 업데이트될 예정입니다.';
const MEMBER_ROLE_PLACEHOLDER = '역할 추후 입력';

export const MEMBERS: Member[] = [
  { id: 'deulpan', name: '들판',   color: 'pink',     role: MEMBER_ROLE_PLACEHOLDER, desc: MEMBER_DESC_PLACEHOLDER },
  { id: 'karei',   name: '까레이', color: 'yellow',   role: MEMBER_ROLE_PLACEHOLDER, desc: MEMBER_DESC_PLACEHOLDER },
  { id: 'gogi',    name: '고기',   color: 'teal',     role: MEMBER_ROLE_PLACEHOLDER, desc: MEMBER_DESC_PLACEHOLDER },
  { id: 'haetsal', name: '햇살',   color: 'purple',   role: MEMBER_ROLE_PLACEHOLDER, desc: MEMBER_DESC_PLACEHOLDER },
  { id: 'parang',  name: '파랑',   color: 'tealDeep', role: MEMBER_ROLE_PLACEHOLDER, desc: MEMBER_DESC_PLACEHOLDER },
];

// ── 7개 프로그램 ─────────────────────────────────────────────────
export interface Program {
  id: string;
  name: string;
  en: string;
  color: PaletteKey;
  field: string;
  desc: string;
  rounds: string;
  recruit: string;
  period: string;
  festival?: boolean;
  date?: string;
}

export const PROGRAMS: Program[] = [
  {
    id: 'jangam-chaekjeong',
    name: '장암 책정',
    en: 'Jangam Bookstop',
    color: 'pink',
    field: '책·기록',
    desc: '마을 곳곳에 작은 책의 정거장을 만들고, 주민이 읽고 쓰며 장암의 이야기를 모읍니다.',
    rounds: '총 8회차',
    recruit: '20명 모집',
    period: '2026. 5 – 8',
  },
  {
    id: 'maeul-signal',
    name: '마을의 신호',
    en: 'Village Signals',
    color: 'yellow',
    field: '사운드·미디어',
    desc: '마을에서 들리는 소리와 신호를 채집해 세대가 함께 듣는 사운드 지도를 만듭니다.',
    rounds: '총 10회차',
    recruit: '24명 모집',
    period: '2026. 5 – 9',
  },
  {
    id: 'memory-station',
    name: '기억순환 정류장',
    en: 'Memory Circulation Station',
    color: 'teal',
    field: '구술·아카이브',
    desc: '버스 정류장을 기억의 정거장으로 바꾸어 세대 간 이야기를 주고받습니다.',
    rounds: '총 8회차',
    recruit: '24명 모집',
    period: '2026. 6 – 10',
  },
  {
    id: 'hand-memory',
    name: '손의 기억',
    en: 'Memory of Hands',
    color: 'purple',
    field: '공예·손작업',
    desc: '손으로 만들고 다듬는 작업 속에서 몸이 기억하는 마을의 기술을 잇습니다.',
    rounds: '총 10회차',
    recruit: '20명 모집',
    period: '2026. 6 – 10',
  },
  {
    id: 'sound-diary',
    name: '소리일기',
    en: 'Sound Diary',
    color: 'pink',
    field: '사운드·일상',
    desc: '하루의 소리를 일기처럼 기록하며 세대마다 다른 마을의 시간을 모읍니다.',
    rounds: '총 8회차',
    recruit: '20명 모집',
    period: '2026. 7 – 10',
  },
  {
    id: 'scape-diary',
    name: '풍경일기',
    en: 'Scape Diary',
    color: 'teal',
    field: '영상·풍경',
    desc: '계절마다 변하는 장암의 풍경을 영상과 사진으로 기록하는 마을 일기입니다.',
    rounds: '총 8회차',
    recruit: '20명 모집',
    period: '2026. 7 – 11',
  },
  {
    id: 'goodbye-again',
    name: '〈다시, 안녕〉',
    en: 'Hello, Again',
    color: 'yellow',
    field: '마을 축제',
    desc: '한 해 동안 만든 기록·소리·풍경을 모아 모든 세대가 함께 여는 마을 축제입니다.',
    rounds: '1일 축제',
    recruit: '전체 개방',
    period: '2026. 11. 7',
    festival: true,
    date: '2026. 11. 7',
  },
];

// ── 일정 (타임라인) ─────────────────────────────────────────────
export const SCHEDULE_MONTHS = ['5월', '6월', '7월', '8월', '9월', '10월', '11월'];

export interface GanttBar {
  id: string;
  name: string;
  color: PaletteKey;
  start: number;
  end: number;
  festival?: boolean;
  marker?: number;
}

export const GANTT: GanttBar[] = [
  { id: 'jangam-chaekjeong', name: '장암 책정', color: 'pink', start: 0, end: 3 },
  { id: 'maeul-signal', name: '마을의 신호', color: 'yellow', start: 0, end: 4 },
  { id: 'memory-station', name: '기억순환 정류장', color: 'teal', start: 1, end: 5 },
  { id: 'hand-memory', name: '손의 기억', color: 'purple', start: 1, end: 5 },
  { id: 'sound-diary', name: '소리일기', color: 'pink', start: 2, end: 5 },
  { id: 'scape-diary', name: '풍경일기', color: 'teal', start: 2, end: 6 },
  { id: 'goodbye-again', name: '〈다시, 안녕〉', color: 'yellow', start: 6, end: 6, festival: true, marker: 6 },
];

// ── 마을일기: 프로그램별 사진+글 피드 ───────────────────────────
export interface DiaryEntry {
  programId: string;
  text: string;
}
export const DIARY: Record<string, DiaryEntry[]> = {
  'jangam-chaekjeong': [
    { programId: 'jangam-chaekjeong', text: '첫 번째 책정거장을 마을회관 앞에 세웠다. 어르신들이 옛날 책을 가져오셨다.' },
    { programId: 'jangam-chaekjeong', text: '아이들이 직접 쓴 장암 이야기 한 줄이 책장에 꽂혔다.' },
    { programId: 'jangam-chaekjeong', text: '비 오는 날, 정거장 지붕 아래 모여 함께 읽었다.' },
  ],
  'maeul-signal': [
    { programId: 'maeul-signal', text: '논 위로 지나가는 바람 소리를 처음으로 녹음했다.' },
    { programId: 'maeul-signal', text: '마을 종소리와 트랙터 소리를 겹쳐 들어봤다.' },
    { programId: 'maeul-signal', text: '세대별로 좋아하는 소리가 이렇게 다를 줄이야.' },
  ],
  'memory-station': [
    { programId: 'memory-station', text: '버스 정류장에 어르신의 옛 이야기를 적은 카드가 붙었다.' },
    { programId: 'memory-station', text: '청년이 그 카드에 답장을 남겼다.' },
  ],
  'hand-memory': [
    { programId: 'hand-memory', text: '손으로 빚은 그릇이 가마에서 나왔다.' },
    { programId: 'hand-memory', text: '할머니의 바느질을 손주가 따라 배웠다.' },
  ],
  'sound-diary': [
    { programId: 'sound-diary', text: '아침 6시, 마을의 첫 소리를 일기로 남겼다.' },
    { programId: 'sound-diary', text: '같은 장소, 다른 계절의 소리를 모았다.' },
  ],
  'scape-diary': [
    { programId: 'scape-diary', text: '안개 낀 금강 변을 카메라에 담았다.' },
    { programId: 'scape-diary', text: '벼가 익어가는 들판의 색을 매주 기록했다.' },
  ],
  'goodbye-again': [
    { programId: 'goodbye-again', text: '한 해의 기록이 마을 축제로 펼쳐졌다.' },
    { programId: 'goodbye-again', text: '모든 세대가 한자리에 모여 다시, 안녕.' },
  ],
};

// ── 오시는 길 ────────────────────────────────────────────────────
export const PLACES = {
  saengsanso: {
    name: '장암 생산소',
    address: '충남 부여군 장암면 석동로29번길 3',
    color: COLORS.pink,
  },
  jumin: {
    name: '주민자치센터',
    address: '충남 부여군 장암면 석동로 16, 2층',
    color: COLORS.teal,
  },
  nonghyup: { name: '농협', color: COLORS.purple },
  myeon: { name: '면사무소', color: COLORS.yellow },
};

export const DIRECTIONS_INFO = [
  { k: '주소', v: '충남 부여군 장암면 석동로29번길 3 (장암 생산소)' },
  { k: '교통', v: '부여시외버스터미널 → 장암면 방면 농어촌버스 이용' },
  { k: '도보', v: '장암면 주민자치센터에서 도보 약 5분' },
];
