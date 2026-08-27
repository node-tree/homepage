// ════════════════════════════════════════════════════════════════════════
// works.ts — Works(작품) 페이지 + Work 상세
//   문구 정본: _workspace/03_mock/v5/works.html · work.html
//   · FEATURES 8점 = 도판 흐름(정간 어긋남 i1~i8). 스틸 없는 작품은 still: null → absent 도판 창.
//   · INDEX_GROUPS 24행 = 텍스트 인덱스(확신도 선질 measured/stated/proxy/absent).
//   · DETAILS = /work/:slug 본문. 원문이 수령된 작품(imul)만 전문이 있고,
//     나머지는 「본문 미기재」로 자리만 남긴다(결측은 자리가 남고 값이 없는 것).
// ════════════════════════════════════════════════════════════════════════
import { AbsentPlate, Confidence, Still } from './types';

export interface FeatureWork {
  slug: string;
  title: string;
  /** 스펙 한 줄 — 매체 · 연도 · 장소 */
  spec: string;
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  still: Still | null;
  absent?: AbsentPlate;
}

export const FEATURES: FeatureWork[] = [
  {
    slug: 'imul',
    title: '공생직조 〈이물〉',
    spec: '폐어망·부식금속 설치, 사운드, 영상 · 2026 · 부산현대미술관 전시실 5',
    slot: 1,
    still: null,
    absent: { note: 'ABSENT · 제작 중 · 도판 미기재' },
  },
  {
    slug: 'nakwon-siktang',
    title: 'Reconnect: 낙원식당(樂源識鄕)',
    spec: '인터랙티브 미디어·사운드·퍼포먼스 · 2026 · 충남창작스튜디오, 태안',
    slot: 2,
    still: { ratio: '16/9', position: '30% 40%' },
  },
  {
    slug: 'itorok',
    title: '이토록 고요한 파동',
    spec: '퍼포먼스 필름, 20분 · 2026 · 서산문화원 상영',
    slot: 3,
    still: null,
    absent: { note: 'ABSENT · 후반 작업 중 · 도판 미기재', ratio: '3/2' },
  },
  {
    slug: 'ediaphonic',
    title: '유기적 공명: 에디아포닉',
    spec: '설치·사운드 · 2025 · CN갤러리, 서울',
    slot: 4,
    still: { ratio: '3/2', position: '65% 25%' },
  },
  {
    slug: 'heoeum-mangmu',
    title: '虛陰網巫 허음망무',
    spec: '설치 · 2025 · 판교극장, 서천',
    slot: 5,
    still: { ratio: '4/5', position: '15% 70%' },
  },
  {
    slug: 'ihaeng-gwedo',
    title: '위성악보: 이행궤도',
    spec: '싱글채널 비디오, 22분 29초 · 2026 · 장소 미정',
    slot: 6,
    still: null,
    absent: { note: 'ABSENT · 미공개 · 도판 미기재' },
  },
  {
    slug: 'satellite-border',
    title: '위성악보시리즈: 국경',
    spec: '영상·설치 · 2024 · 신동엽문학관, 부여',
    slot: 7,
    still: { ratio: '16/10', position: '50% 80%' },
  },
  {
    slug: 'sodalguji',
    title: '소달구지 (Sodalguji)',
    spec: '사운드 키네틱 설치 · 2019 · 경기상상캠퍼스, 수원',
    slot: 8,
    still: null,
    absent: { note: 'ABSENT · 아카이브 스틸 미확보', ratio: '1/1' },
  },
];

/** 텍스트 인덱스 한 행 — 제목(확신도) · 매체 · 연도 · 장소 */
export interface IndexRow {
  title: string;
  confidence: Exclude<Confidence, 'absent'>;
  medium: string;
  year: string;
  /** null = absent(자리는 남기고 값 없음 → `—`) */
  place: string | null;
  slug?: string;
}

export interface TrajectoryGroup {
  /** 필터 토글 id */
  id: string;
  label: string;
  /** 우측 필터에 쓰는 짧은 표기(목업 그대로) */
  short: string;
  rows: IndexRow[];
}

export const INDEX_GROUPS: TrajectoryGroup[] = [
  {
    id: 'resonance',
    label: '공명 RESONANCE · 2025—2026',
    short: '공명 RESONANCE 2025—26',
    rows: [
      { title: '공생직조 〈이물〉', confidence: 'proxy', medium: '폐어망·부식금속 설치, 사운드, 영상', year: '2026', place: '부산현대미술관 전시실 5', slug: 'imul' },
      { title: '이토록 고요한 파동', confidence: 'proxy', medium: '퍼포먼스 필름, 20분', year: '2026', place: '서산문화원', slug: 'itorok' },
      { title: '위성악보: 이행궤도', confidence: 'stated', medium: '싱글채널 비디오, 22분 29초', year: '2026', place: null, slug: 'ihaeng-gwedo' },
      { title: 'Reconnect: 낙원식당(樂源識鄕)', confidence: 'measured', medium: '인터랙티브 미디어·사운드·퍼포먼스', year: '2026', place: '충남창작스튜디오, 태안', slug: 'nakwon-siktang' },
      { title: '유기적 공명: 에디아포닉', confidence: 'measured', medium: '설치·사운드', year: '2025', place: 'CN갤러리, 서울', slug: 'ediaphonic' },
      { title: '虛陰網巫 허음망무', confidence: 'measured', medium: '설치', year: '2025', place: '판교극장, 서천', slug: 'heoeum-mangmu' },
      { title: '경계의 울림 — 설치버전', confidence: 'measured', medium: '설치·사운드스케이프·관객참여', year: '2025', place: '충남창작스튜디오, 태안' },
    ],
  },
  {
    id: 'crossing',
    label: '횡단 CROSSING · 2023—2024',
    short: '횡단 CROSSING 2023—24',
    rows: [
      { title: '위성악보시리즈: 국경', confidence: 'measured', medium: '영상·설치', year: '2024', place: '신동엽문학관, 부여', slug: 'satellite-border' },
      { title: '위성악보시리즈: 남미농장', confidence: 'measured', medium: '온라인 영상', year: '2023', place: '온라인미디어 예술활동' },
      { title: '안녕, 소리. 자율-이동+', confidence: 'stated', medium: '공공예술', year: '2023', place: '아르코 공공예술' },
      { title: '교감생물', confidence: 'stated', medium: '키네틱 오브제', year: '2023', place: '전주 남부시장' },
    ],
  },
  {
    id: 'landing',
    label: '착지 LANDING · 2020—2022',
    short: '착지 LANDING 2020—22',
    rows: [
      { title: '오드라데크: 땡볕, 초승달과 대추', confidence: 'measured', medium: '전시', year: '2022', place: '아마도예술공간, 서울' },
      { title: '복합돌봄장치', confidence: 'measured', medium: '전시', year: '2022', place: '울산현대미술제 · 울산시립미술관' },
      { title: '소리탐사조', confidence: 'stated', medium: '아르코 공공예술', year: '2022', place: null },
      { title: '위성악보시리즈: KARMA', confidence: 'measured', medium: '전시·공연', year: '2021', place: '부소갤러리, 부여' },
      { title: '위성악보시리즈', confidence: 'stated', medium: '온라인 영상', year: '2020', place: '한문예위 온라인미디어' },
      { title: '노드트리: 아르카이옵테리스', confidence: 'stated', medium: '영상', year: '2020', place: '한문예위' },
      { title: 'The Mirror of Dragon-Cat', confidence: 'stated', medium: '레지던시', year: '2020', place: '스페인' },
    ],
  },
  {
    id: 'detection',
    label: '탐지 DETECTION · 2016—2019',
    short: '탐지 DETECTION 2016—19',
    rows: [
      { title: '소달구지 (Sodalguji)', confidence: 'measured', medium: '사운드 키네틱 설치', year: '2019', place: '경기상상캠퍼스, 수원', slug: 'sodalguji' },
      { title: '고속화도로 로망스', confidence: 'measured', medium: '리서치·워크숍·전시·공연', year: '2019', place: '경기상상캠퍼스, 수원' },
      { title: '레트로 도시건설', confidence: 'stated', medium: '사운드스케이프 영상집', year: '2018', place: null },
      { title: '분실물보관소에서의 연설', confidence: 'measured', medium: '공연', year: '2017', place: '국립아시아문화전당, 광주' },
      { title: 'WHITE RABBIT', confidence: 'measured', medium: '융복합 공연', year: '2017', place: '정다방 프로젝트, 서울' },
      { title: 'WHAT DO YOU SEE?', confidence: 'measured', medium: '사물 해킹·가변 설치', year: '2016', place: '문화공간 지나, 서울' },
    ],
  },
];

export const WORKS_COUNT = INDEX_GROUPS.reduce((n, g) => n + g.rows.length, 0);

export const WORKS_SOURCE =
  '출처 · NODE TREE/작품/NODE-TREE-작품-아카이브.md · NODE TREE/About/포트폴리오-재구성-2026.md §4 · NODE TREE/전시/_INDEX.md';

export const WORKS_NOTE =
  '2016년 서울에서 시작해 부여에 착지한 뒤, 위성악보 연작은 마을에서 국경 너머로 확장했다. 도판이 없는 작품은 자리를 비워 둔다 — 결측은 자리가 남고 값이 없는 것이다.';

// ── Work 상세 ───────────────────────────────────────────────────────────
export type DetailBlock =
  | { kind: 'plate'; caption: string; still: Still | null; absent?: AbsentPlate }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string };

export interface WorkDetail {
  slug: string;
  title: string;
  titleEn?: string;
  sub: string;
  /** 세로쓰기 메타 — 목업 .metav */
  meta: { k: string; v: string }[];
  blocks: DetailBlock[];
  source?: string;
  /** 하단 「다음 작품」 */
  next: { slug: string; title: string };
}

export const DETAILS: WorkDetail[] = [
  {
    slug: 'imul',
    title: '공생직조 〈이물〉',
    titleEn: 'Imul',
    sub: '2026 · 부산현대미술관 전시실 5 · UPCOMING 2026.12.11',
    meta: [
      { k: '年 YEAR', v: '2026' },
      { k: '媒體 MEDIUM', v: '2채널 영상 · 초지향성 스피커 2 · 삼베 1필 · 폐어망·부식금속 설치' },
      { k: '場所 VENUE', v: '부산현대미술관 전시실 5' },
      { k: '플랫폼 PLATFORM', v: '《공생 직조》 Corrosia — 미술관 플랫폼이며 작품명이 아니다' },
      { k: '크레딧 CREDIT', v: '이화영 조형·리서치 / 정강현 사운드·영상 / 리서치 아카이브 〈부산항 - 고향 없는 고향〉' },
      { k: '전시이력 HISTORY', v: '2026.12.11 개막 예정 · 부산현대미술관 Corrosia 선정' },
    ],
    blocks: [
      {
        kind: 'plate',
        still: {},
        caption: '도판 1 · 개심사 협시불 복장 발원문 전판(반전 스캔) — 봉인 상태. 호버 시 개봉.',
      },
      {
        kind: 'p',
        text: '이물(船首)은 수면을 가르는 뱃머리이자, 전진하려는 거대한 힘이 물살과 부딪히며 하얀 포말을 일으키는 마찰의 정점이다. 바다를 가르며 물자와 자원, 인류를 이동시켰던 이 역동은 기술 발전에 밀려 영원성을 상실했고, 또 다른 미래가 저만치 앞서간다. 작품 〈이물〉은 이렇듯 속도와 힘의 세계에서 쓰임을 다하고 배제된 ‘이물(異物)’의 신체성을 탐구한다. 속도전 속에서 탈각된 존재들은 바람의 재가 되거나 원형을 잃은 채 이름 없는 무언가로 남겨진다.',
      },
      {
        kind: 'p',
        text: '단단했던 선체는 시간의 파도 속에서 침식되고 부식된다. 이 거친 닳아짐은 고정된 형태를 해체하여 물질을 마치 올이 풀린 실처럼 유연한 파편들로 되돌려 놓는다. 〈이물〉은 부식을 거쳐 느슨해진 파편들을 날실과 씨실로 삼아, 세계의 마찰을 견뎌낼 새로운 외피(의복)로 다시 직조한다. 본 작업은 완전히 소멸하지 않고 잔존하여 유산(遺産)된 물질들이, 어떻게 동시대의 새로운 외피로서 또 다른 물질성을 획득하는지 고찰한다.',
      },
      { kind: 'h2', text: '리서치 아카이브 — 부산항, 고향 없는 고향' },
      {
        kind: 'p',
        text: '리서치 아카이브 〈부산항 - 고향 없는 고향〉은 식민지기 욕망의 ‘출구’이자 패전 후 귀환자들의 ‘입구’라는 이중적 인프라 속에서 전혀 다른 주체성을 생산해 낸 공간과 신체를 추적한다. 이러한 사유를 물질화하기 위해 일본인 공동묘지 위 실향민의 터전이 된 ‘아미동 비석마을’의 풍화된 비석들을 데이터화하고 조선 디아스포라의 유랑사를 탐구한다.',
      },
      {
        kind: 'p',
        text: '역사적 풍화를 시각화하는 과정에서 리서치는 수의(壽衣)로 쓰이는 ‘삼베’를 땅에 묻어 부식의 경로를 탐색한다. 대지 속에서 해체되는 삼베의 흔적은 마모된 비석의 표면이자 유산된 신체성을 대변하며, 불상 내부에 직물과 염원을 봉안했던 국가유산 ‘복장유물(腹藏遺物)’의 사유와 조응한다.',
      },
      {
        kind: 'plate',
        still: { position: '35% 65%' },
        caption: '도판 2 · 땅에 묻은 삼베의 부식 경로, 아미동 비석마을 표면 데이터 — 봉인 상태. 호버 시 개봉.',
      },
    ],
    source:
      '출처 · NODE TREE/작품/2026/공생직조/작품설명_부산현대미술관.md §1 〈이물(船首)〉 · §2 리서치 아카이브 〈부산항 - 고향 없는 고향〉 (2026-05-30 수령 원문)',
    next: { slug: 'itorok', title: '이토록 고요한 파동' },
  },
];

/** 원문이 없는 작품의 상세 — 스펙만 세우고 본문 자리는 비운다. */
export function fallbackDetail(work: FeatureWork, next: FeatureWork): WorkDetail {
  const [medium, year, venue] = work.spec.split(' · ');
  return {
    slug: work.slug,
    title: work.title,
    sub: [year, venue].filter(Boolean).join(' · '),
    meta: [
      { k: '年 YEAR', v: year ?? '未詳' },
      { k: '媒體 MEDIUM', v: medium ?? '未詳' },
      { k: '場所 VENUE', v: venue ?? '未詳' },
      { k: '확신도 CONFIDENCE', v: 'stated — 스펙 한 줄만 확인됨' },
    ],
    blocks: [
      work.still
        ? { kind: 'plate', still: work.still, caption: '도판 1 · 아카이브 스틸 — 봉인 상태. 호버 시 개봉.' }
        : {
            kind: 'plate',
            still: null,
            absent: work.absent ?? { note: 'ABSENT · 도판 미기재' },
            caption: '도판 · 미기재. 자리는 남기고 값을 비운다.',
          },
      { kind: 'p', text: '본문 미기재 — 작품 원문이 아직 수령되지 않았다. 확인되지 않은 문장은 만들지 않고 자리만 둔다.' },
    ],
    next: { slug: next.slug, title: next.title },
  };
}

export const findFeature = (slug: string) => FEATURES.find((w) => w.slug === slug);
export const findDetail = (slug: string) => DETAILS.find((d) => d.slug === slug);
