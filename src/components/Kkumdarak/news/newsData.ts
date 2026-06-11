// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이소(異素)의 웹 신문 · 데이터 모델 + 호(號) 데이터
// 종이 소식지(장암면 1,446세대 우편 배포)의 웹판 형제 매체.
// 부엉이가 들은 것을 반딧불이가 발화하는 신문.
//
// 아키텍처: "고정 프레임 + 호별 가변"
//   · 고정: 제호(마스트헤드)·날짜줄(Folio)·콜로폰 — VillageNews.tsx 가 렌더
//   · 가변: blocks[] 배열을 호마다 통째로 갈아끼움 → 템플릿 느낌 제거, 자유도 최대
//
// 다음 호 추가법(3줄):
//   1) 아래 NEWS_ISSUES 배열에 NewsIssue 하나를 push (no/title/dateline/theme/blocks).
//   2) theme 의 paper/ink/spot 만 바꿔도 호 전체 무드가 전환된다(CSS 변수 주입).
//   3) blocks 에 TopStory·Article·Verse·PhotoSpread·Collage·ProgramBoard·NoticeBox·Custom
//      을 순서대로 나열 — 배열 순서 + span 조합이 곧 신문 지면 조판이 된다.
// ═══════════════════════════════════════════════════════════════

import { ReactNode } from 'react';

// ── 공통 블록 옵션 ───────────────────────────────────────────────
//   지면 조판 언어: 폭(span)·먹면 반전(tone)·기울임(rotate)·상단 괘선 위계(ruleTop).
export type BlockSpan = 'full' | 'half' | 'third';
export type BlockTone = 'paper' | 'ink' | 'spot';
export type RuleTop = 'bold' | 'thin' | 'double' | 'none';

interface BlockCommon {
  span?: BlockSpan;     // 6단 그리드 점유 폭 (기본 full)
  tone?: BlockTone;     // paper=기본 / ink=먹면 반전 / spot=신호색 면
  rotate?: number;      // 스크랩 기울임(deg) — Collage 등에서 사용
  ruleTop?: RuleTop;    // 상단 괘선 위계 (굵은=섹션 / 얇은=기사 / 이중 / 없음)
}

// ── 신문 관용 블록 라이브러리 (discriminated union) ──────────────

/** 컷: 거대 헤드라인 + 데크 + 리드 + 본문 (1면 톱) */
export interface TopStoryBlock extends BlockCommon {
  kind: 'topStory';
  kicker: string;        // 분류 라벨 (예: "창간사")
  headline: string;      // 컷(초대형 헤드라인)
  deck?: string;         // 데크(부제)
  lead: string;          // 리드문(굵게)
  body: string[];        // 본문 문단들
  byline?: string;       // 바이라인
}

/** 키커 + 헤드라인 + 바이라인 + 멀티컬럼 본문(드롭캡 옵션) */
export interface ArticleBlock extends BlockCommon {
  kind: 'article';
  kicker: string;
  headline: string;
  deck?: string;
  byline?: string;       // "글·사진 ○○○"
  columns?: 2 | 3;       // 본문 다단 수(데스크톱). 기본 2. 모바일은 1단 리플로우.
  dropCap?: boolean;     // 드롭캡(::first-letter)
  body: string[];
  pullQuote?: string;    // 발췌 인용(본문 사이 강조)
}

/** 세로쓰기(writing-mode: vertical-rl) 시·구술 코너 — 부엉이의 '기억' 정서 */
export interface VerseBlock extends BlockCommon {
  kind: 'verse';
  kicker?: string;
  title?: string;
  lines: string[];       // 세로단으로 흐를 본문 문단들
  attribution?: string;  // 출처/맺음
}

/** 사진/일러스트 + 캡션 (풀폭/하프) */
export interface PhotoSpreadBlock extends BlockCommon {
  kind: 'photoSpread';
  images: { src: string; alt: string; rotate?: number }[];
  caption?: string;
  credit?: string;       // 사진/그림 크레딧
}

/** 기울임·겹침 스크랩 모드 (이소 캐릭터·마스코트 활용) */
export interface CollageBlock extends BlockCommon {
  kind: 'collage';
  title?: string;
  items: { src: string; alt: string; rotate?: number; scale?: number }[];
  caption?: string;
}

/** 프로그램 단신 게시판 (신문 공고란 스타일) */
export interface ProgramBoardBlock extends BlockCommon {
  kind: 'programBoard';
  title: string;
  notes: {
    no: string;          // 게시 번호 (예: "①")
    name: string;        // 프로그램명 〈 〉 포함 표기
    field: string;       // 분야
    target: string;      // 대상/정원
    period: string;      // 기간
    extra?: string;      // 부기 한 줄
  }[];
  footer?: string;       // 공통 안내 (문의 등)
}

/** 사고(社告) 박스 */
export interface NoticeBoxBlock extends BlockCommon {
  kind: 'noticeBox';
  label?: string;        // "사고(社告)" 등
  body: string;
}

/** 호별 완전 자유 탈출구 — 임의 ReactNode 렌더 */
export interface CustomBlock extends BlockCommon {
  kind: 'custom';
  render: () => ReactNode;
}

export type NewsBlock =
  | TopStoryBlock
  | ArticleBlock
  | VerseBlock
  | PhotoSpreadBlock
  | CollageBlock
  | ProgramBoardBlock
  | NoticeBoxBlock
  | CustomBlock;

// ── 호별 아트디렉션 ──────────────────────────────────────────────
//   CSS 변수(--kd-news-*)로 주입 → 호마다 무드 전환. 임의 hex 산재 금지.
export interface NewsTheme {
  paper: string;          // 종이 바탕(뉴스프린트 미색)
  ink: string;            // 먹(순흑 회피)
  spot: string;           // 신호색(빨강 1도, 절제) = 반딧불이의 발화
  spot2?: string;         // 보조 신호색(선택)
  headlineFont?: string;  // 제호·헤드라인 폰트(기본 명조, 호별 교체 가능)
  texture?: 'newsprint' | 'none';
}

// ── 호(號) 공개 상태 ──────────────────────────────────────────────
//   published = 발행(비로그인 포함 누구나 열람) / draft = 공개 전 준비중(교정쇄, 편집자만).
//   런타임 토글은 kkumdarak-settings 의 newsStatus 버킷에 영속되며(아래 NewsStatusMap),
//   정적 status 보다 우선한다. 유효 상태 = override[id] ?? issue.status ?? 'published'.
export type NewsStatus = 'published' | 'draft';

// 호 id → 상태 오버라이드 맵(kkumdarak-settings.data.newsStatus 와 동일 형태).
export type NewsStatusMap = Record<string, NewsStatus>;

// ── 호(號) ───────────────────────────────────────────────────────
export interface NewsIssue {
  id: string;
  no: number;             // 호수
  title: string;          // 호 제목(아카이브 표기용)
  dateline: string;       // 날짜줄 본문 ("창간호 · 2026년 6월 …")
  status?: NewsStatus;    // 정적 기본 상태(미지정 = published). 런타임 override 가 이 값을 덮는다.
  theme: NewsTheme;
  blocks: NewsBlock[];
}

// ── 유효 상태 해석 ────────────────────────────────────────────────
//   런타임 override(서버 newsStatus) → 정적 issue.status → 'published' 순으로 폴백.
//   settings 미도착(콜드스타트) 구간에는 override 가 undefined 라 정적 status 로 낙관 렌더한다.
export function resolveIssueStatus(
  issue: Pick<NewsIssue, 'id' | 'status'>,
  override?: NewsStatusMap,
): NewsStatus {
  return (override && override[issue.id]) ?? issue.status ?? 'published';
}

// 매체 정체성(고정 프레임에서 공통으로 쓰는 상수)
export const MASTHEAD = {
  title: '마을소식',
  motto: '마을의 소리를 듣고, 다시 빛내며 발화하는 신문',
  publisher: '꿈다락 문화예술학교 이소(異素)',
};

// 콜로폰(판권) — 면 최하단. 신문의 자기 정체성.
export const COLOPHON_LINES = [
  '펴낸곳 꿈다락 문화예술학교 이소(異素)',
  '운영 노드트리 × 장암면 주민자치회',
  '주최 문화체육관광부 · 주관 한국문화예술교육진흥원',
  '충남 부여군 장암면 석동로29번길 3',
  '문의 nodetree.pmaker@gmail.com',
];

// public 자산 경로(스크랩 콜라주용)
const CHAR = '/kkumdarak/chars-v2';      // 부엉이(03)·반딧불이(09) 프레임
const MASCOT = '/kkumdarak/characters-png'; // 프로그램 마스코트 PNG

// ═══════════════════════════════════════════════════════════════
// 창간호 — 2026년 6월 10일
//   사실 근거: 스프린트 §5(옵시디안 정본). 새 사실·인명·날짜·수치 창작 금지.
//   문장은 위 근거 안에서 신문 문체로 다듬음.
// ═══════════════════════════════════════════════════════════════
const ISSUE_NO1: NewsIssue = {
  id: 'no1',
  no: 1,
  title: '창간호',
  dateline:
    '창간호 · 2026년 6월 10일 · 충남 부여군 장암면  |  펴낸곳 꿈다락 문화예술학교 이소(異素)',
  status: 'published',     // 창간호는 발행 상태로 명시(정적·기본). 런타임 override 로만 준비중 전환.
  theme: {
    paper: '#ffffff',         // 배경 흰색(사용자 요청, 일단)
    ink: '#251b13',           // 먹 (--kd-figma-ink 계열, 순흑 회피)
    spot: '#f02e1f',          // 신호 빨강 1도 (--kd-figma-red) = 반딧불이
    spot2: '#0f7a38',         // 보조(드물게)
    texture: 'newsprint',
  },
  blocks: [
    // ── 1면 톱: 창간사 ──────────────────────────────────────────
    {
      kind: 'topStory',
      span: 'full',
      ruleTop: 'none',
      kicker: '창간사',
      headline: '마을이 곧 학교가 되다',
      deck: '장암면 주민자치센터, 주민이 주도하는 생활문화 거점으로',
      lead:
        '꿈다락 문화예술학교 「이소(異素)」가 장암면에서 문을 연다. 異(다를 이)와 素(본디 소) — 서로 다른 본질들이 만나는 자리다.',
      body: [
        '「이소」는 다름을 한 가지로 모으지 않는다. 어린이와 어르신, 청년과 어른이 저마다 다른 그대로 한자리에서 만나게 한다. 가르치는 사람과 배우는 사람의 자리를 고정하지 않고, 저마다의 다름(異)과 바탕(素)이 그대로 맞닿는 자리를 짓는 일이다.',
        '사업은 장암면 주민자치센터를 주민이 주도하는 생활문화 거점으로 바꾸는 데서 시작한다. 만들고(만들기), 기록과 소리와 풍경으로 채우고(채우기), 마을과 세대가 함께 나누고(나누기), 그 경험을 일상으로 이어가는(지속하기) 네 단계의 흐름을 한 해에 걸쳐 그린다.',
        '운영을 맡은 노드트리는 “이 사업은 세대와 세대가 만나는 거점을 그린다. 공간에 온기가 생겼으면 한다”고 밝혔다. 사업기간은 5월 11일부터 12월 31일까지, 장소는 장암면 생산소(석동로29번길 3)와 주민자치센터다. 참가비는 한국문화예술교육진흥원 지원으로 모두 무료다.',
      ],
      byline: '꿈다락 문화예술학교 이소 · 운영 노드트리 × 장암면 주민자치회',
    },

    // ── 특집 1: 장암 책정 (멀티컬럼 + 드롭캡) ────────────────────
    {
      kind: 'article',
      span: 'full',
      ruleTop: 'bold',
      kicker: '특집 · 책의 정자(亭)',
      headline: '다섯 세대가 함께 도서관을 짓습니다',
      deck: '〈장암 책정 章岩 冊亭〉 — 진단·드로잉·설계에서 목공 제작, 미디어 결합까지',
      byline: '글·사진 이소 편집실',
      columns: 3,
      dropCap: true,
      body: [
        '〈장암 책정 章岩 冊亭〉은 다섯 세대가 손을 모아 마을의 작은 도서관을 짓는 프로그램이다. 5월 23일부터 8월 22일까지 매주 토요일 오후 2시부터 5시까지, 전생애 15명이 생산소 목공실과 주민자치센터 작은도서관을 오가며 함께한다.',
        '과정은 세 단계로 흐른다. 5월과 6월에는 공간을 진단하고 함께 드로잉하며 설계한다. 6월과 7월에는 손으로 목공 제작에 들어간다. 7월과 8월에는 페인트칠과 설치를 거쳐 미디어를 결합한다.',
        '“사용자가 만든 공간은 다르게 작동합니다.” 책정의 설계는 이 한 문장에서 출발한다. 도면을 받아 짓는 도서관이 아니라, 쓸 사람이 직접 진단하고 그려 세우는 도서관이다.',
        '책정은 장암면의 풍경을 품는 공간을 상상한다. 정암리에 있었으나 지금은 사라진 월파정(月波亭)이 달과 물결의 풍경을 품었듯, 〈장암 책정〉은 장암면의 자연과 삶과 기억을 품는 자리가 되려 한다.',
      ],
      pullQuote: '“사용자가 만든 공간은 다르게 작동합니다.”',
    },

    // ── 부엉이·반딧불이 스크랩 콜라주 (이소의 식구들) ──────────────
    {
      kind: 'collage',
      span: 'half',
      ruleTop: 'thin',
      title: '이소의 식구들',
      items: [
        { src: `${CHAR}/character-03/frame-01.svg`, alt: '마을의 소리를 듣는 수리부엉이', rotate: -5, scale: 1.08 },
        { src: `${CHAR}/character-09/frame-01.svg`, alt: '빛을 내어 신호를 보내는 반딧불이', rotate: 6, scale: 0.95 },
        { src: `${MASCOT}/jangam-chaekjeong.png`, alt: '〈장암 책정〉 마스코트', rotate: -3 },
        { src: `${MASCOT}/son-gieok.png`, alt: '〈손의 기억〉 마스코트', rotate: 4 },
      ],
      caption: '부엉이는 듣고 기억하며, 반딧불이는 빛을 내어 발화한다.',
    },

    // ── 세로쓰기 코너: 한 편의 시처럼 ────────────────────────────
    {
      kind: 'verse',
      span: 'half',
      ruleTop: 'thin',
      kicker: '듣고, 빛내며',
      title: '한 자리에서',
      lines: [
        '꿈다락 문화예술학교 「이소」는,',
        '동아시아 개인 서정시의 출발점인 한 편의 시가',
        '음률과 서정으로 2300년을 건너',
        '오늘의 노래와 공동체의 자리가 되었듯,',
        '삶-터를 살아가는 사람들의 감각과 문화가',
        '다음 세대로 이어지는 자리입니다.',
        '마을이 곧 학교가 되는 자리입니다.',
      ],
      attribution: '— 「이소」 창간에 부쳐',
    },

    // ── 특집 2: 손의 기억 ───────────────────────────────────────
    {
      kind: 'article',
      span: 'full',
      ruleTop: 'bold',
      kicker: '특집 · 수리부엉이가 들은 이야기',
      headline: '수리부엉이가 이 이야기를 들었는데요',
      deck: '〈손의 기억〉 — 어르신의 삶의 풍경을 그리고, 구술로 잇는다',
      byline: '글 이소 편집실',
      columns: 2,
      dropCap: false,
      body: [
        '〈손의 기억〉은 장암면에 전해 오는 수리부엉이 전설을 실마리로 삼는다. 매 회차 강사는 “수리부엉이가 이 이야기를 들었는데요”라는 화자 구조로 이야기를 연다. 어르신은 태어난 마을, 가꾸던 논밭, 집 마당 — 삶의 풍경을 그리고 그 곁의 이야기를 구술한다.',
        '진행은 두 갈래다. A형은 주민자치회 12명과 함께 9월 2일부터 10월 7일까지 수요일에 만난다. B형은 10개 리의 경로당과 마을회관을 순회한다. 석동리에서 시작해 원문리·합곡리·점상리·지토리·하황리·상황리·장하리·북고리를 지나 정암리에 닿는다. 7월 6일부터 17일까지다.',
        '릴레이는 사라진 월파정 자리인 정암리에서 마무리된다. 모인 이야기는 단행본 《장암면 손의 기억 — 수리부엉이가 들은 이야기》로 묶여 장암면 1,446세대에 배포될 예정이다.',
      ],
    },

    // ── 프로그램 단신 게시판 (공고란) ───────────────────────────
    {
      kind: 'programBoard',
      span: 'full',
      ruleTop: 'double',
      title: '프로그램 단신',
      notes: [
        { no: '①', name: '〈장암 책정〉', field: '융복합', target: '전생애 15명', period: '5.23–8.22 토' },
        { no: '②', name: '〈마을의 신호〉', field: '인터랙티브 미디어', target: '초5~중고생 12명', period: '7.24–10.31 금·토', extra: 'Makey Makey·MCU — “코딩은 몰라도 됩니다”' },
        { no: '③', name: '〈기억순환 정류장〉', field: '어르신 기억 × 청소년 재현', target: '아동·청소년 15명', period: '6.10–10.31 수~금', extra: '지역아동센터' },
        { no: '④', name: '〈다시, 안녕〉', field: '마을 통합 축제', target: '누구나', period: '11.7(토) 10:00–16:00', extra: '무료' },
        { no: '⑤', name: '〈손의 기억〉', field: '어르신 드로잉', target: '경로당 순회', period: '7–10월 수요일' },
        { no: '⑥', name: '〈소리일기〉', field: '필드레코딩', target: '전생애 12명', period: '6.23–7.28 화 19:00–21:00' },
        { no: '⑦', name: '〈풍경일기〉', field: '야외 드로잉', target: '아동·청소년 12명', period: '7–10월', extra: '백마강·임천·부여읍' },
      ],
      footer: '공통 — 장암면 거주자 우선 · 무료 · 문의 nodetree.pmaker@gmail.com',
    },

    // ── 프로그램 마스코트 스크랩 ────────────────────────────────
    {
      kind: 'collage',
      span: 'full',
      ruleTop: 'thin',
      title: '한 해의 식구들',
      items: [
        { src: `${MASCOT}/jangam-chaekjeong.png`, alt: '〈장암 책정〉', rotate: -4 },
        { src: `${MASCOT}/maeul-sinho.png`, alt: '〈마을의 신호〉', rotate: 3 },
        { src: `${MASCOT}/gieok-sunhwan.png`, alt: '〈기억순환 정류장〉', rotate: -2 },
        { src: `${MASCOT}/son-gieok.png`, alt: '〈손의 기억〉', rotate: 5 },
        { src: `${MASCOT}/sori-ilgi.png`, alt: '〈소리일기〉', rotate: -3 },
        { src: `${MASCOT}/punggyeong-ilgi.png`, alt: '〈풍경일기〉', rotate: 4 },
      ],
      caption: '올해 장암면을 함께 걷는 프로그램의 식구들.',
    },

    // ── 사고(社告) ──────────────────────────────────────────────
    {
      kind: 'noticeBox',
      span: 'full',
      ruleTop: 'thin',
      tone: 'spot',
      label: '사고(社告)',
      body:
        '본지는 장암면 1,446세대에 우편으로도 찾아갑니다. 다음 호는 〈다시, 안녕〉 축제(11.7) 특집입니다.',
    },
  ],
};

export const NEWS_ISSUES: NewsIssue[] = [ISSUE_NO1];

// ═══════════════════════════════════════════════════════════════
// 직렬화 가능 블록 / 호 — 백엔드 편집 사본(village_news)의 형태
//   Custom(render 함수) 블록은 JSON 직렬화 불가 → 백엔드/에디터에서 제외한다.
//   에디터가 만들 수 있는 블록은 아래 7종(SerializableBlock)뿐.
// ═══════════════════════════════════════════════════════════════
export type SerializableBlock = Exclude<NewsBlock, CustomBlock>;

// 에디터가 다루는 블록 종류(Custom 제외) — UI 의 "블록 추가" 메뉴 순서.
export const EDITABLE_BLOCK_KINDS: SerializableBlock['kind'][] = [
  'topStory',
  'article',
  'verse',
  'photoSpread',
  'collage',
  'programBoard',
  'noticeBox',
];

// 블록 종류 → 한글 라벨 + 한 줄 설명(에디터 "블록 추가" 메뉴용).
export const BLOCK_KIND_META: Record<
  SerializableBlock['kind'],
  { label: string; hint: string }
> = {
  topStory: { label: '톱기사', hint: '1면 머리기사 — 초대형 헤드라인·리드·본문' },
  article: { label: '기사', hint: '키커·헤드라인·다단 본문(드롭캡·인용 옵션)' },
  verse: { label: '세로쓰기', hint: '시·구술 코너 — 세로로 흐르는 글' },
  photoSpread: { label: '사진', hint: '사진/그림 + 캡션(여러 장 배치)' },
  collage: { label: '콜라주', hint: '기울인 스크랩 모음 — 캐릭터·사진 겹치기' },
  programBoard: { label: '공고란', hint: '프로그램 단신 게시판(번호·이름·기간 행)' },
  noticeBox: { label: '사고(社告)', hint: '짧은 알림 박스 — 신호색 강조 가능' },
};

// 백엔드에 저장되는 호(號)의 형태. NewsIssue 와 같되 blocks 가 SerializableBlock[].
export interface SerializedNewsIssue {
  id: string;
  no: number;
  title: string;
  dateline: string;
  status?: NewsStatus;
  theme: NewsTheme;
  blocks: SerializableBlock[];
}

// 백엔드 편집 사본 페이로드(api.villageNewsAPI 가 주고받는 형태).
export interface VillageNewsData {
  issues: Record<string, SerializedNewsIssue>;
}

// ── 호 병합 ──────────────────────────────────────────────────────
//   유효 호 목록 = 정적 NEWS_ISSUES + 백엔드 issues. 같은 id 면 백엔드가 우선
//   (→ 창간호도 나중에 UI 에서 수정 가능). 정렬: no 내림차순(최신 위), 동률은 id.
//   backend 가 undefined(콜드스타트 미도착)면 정적 목록만으로 낙관 렌더.
export function mergeIssues(
  backend?: Record<string, SerializedNewsIssue> | null,
): NewsIssue[] {
  const map = new Map<string, NewsIssue>();
  // 1) 정적 기준선.
  for (const it of NEWS_ISSUES) map.set(it.id, it);
  // 2) 백엔드 사본으로 덮어쓰기/추가(같은 id 우선).
  if (backend && typeof backend === 'object') {
    for (const id of Object.keys(backend)) {
      const b = backend[id];
      if (b && typeof b === 'object' && typeof b.id === 'string') {
        map.set(b.id, b as NewsIssue);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.no !== a.no) return b.no - a.no;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// 정적(코드 내장) 호인지 — 에디터에서 "삭제"가 아니라 "정적본으로 되돌리기"가 되는 호.
export function isStaticIssue(id: string): boolean {
  return NEWS_ISSUES.some((it) => it.id === id);
}

// 다음 호수 제안값(현재 최대 no + 1). 빈 목록이면 1.
export function suggestNextNo(issues: NewsIssue[]): number {
  return issues.reduce((mx, it) => Math.max(mx, it.no), 0) + 1;
}

// ── 신문 테마 프리셋(에디터 팔레트) ──────────────────────────────
//   임의 hex 산재 방지 + 신문에 어울리는 무드 6종. 자유 입력도 허용(에디터에서).
export interface ThemePreset {
  key: string;
  label: string;
  theme: NewsTheme;
}
export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'newsprint',
    label: '뉴스프린트(창간호)',
    theme: { paper: '#f6f2e7', ink: '#251b13', spot: '#f02e1f', spot2: '#0f7a38', texture: 'newsprint' },
  },
  {
    key: 'dawn',
    label: '새벽 미색·쪽빛',
    theme: { paper: '#efeee4', ink: '#1b2430', spot: '#1f5f8f', spot2: '#c8632a', texture: 'newsprint' },
  },
  {
    key: 'pine',
    label: '한지·솔빛',
    theme: { paper: '#f4f1e3', ink: '#20281f', spot: '#0f7a38', spot2: '#b5862f', texture: 'newsprint' },
  },
  {
    key: 'persimmon',
    label: '감빛·먹',
    theme: { paper: '#f7efe0', ink: '#2a1d12', spot: '#d2691e', spot2: '#7a5c2e', texture: 'newsprint' },
  },
  {
    key: 'plum',
    label: '매화·자주',
    theme: { paper: '#f5f0ea', ink: '#241a22', spot: '#9c2b54', spot2: '#5a7a4a', texture: 'newsprint' },
  },
  {
    key: 'ink',
    label: '먹·재(灰)',
    theme: { paper: '#eceae3', ink: '#1c1c1a', spot: '#7a4a2e', spot2: '#4a4a48', texture: 'newsprint' },
  },
];

