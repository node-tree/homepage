// ════════════════════════════════════════════════════════════════════════
// feed.ts — Current(홈) 피드 6항목
//   문구 정본: _workspace/03_mock/v5/index.html <section class="feed">
//   grid 클래스 i1~i6 = 정간 어긋남(대강 3·5·8·11·13·16). 순서를 바꾸면 어긋남도 바뀐다.
// ════════════════════════════════════════════════════════════════════════
import { AbsentPlate, Still } from './types';

export interface FeedItem {
  id: string;
  /** 목업의 .i1~.i6 — 도판이 놓이는 정간 열 */
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  /** 클릭 시 이동할 내부 경로(없으면 링크 없음) */
  href?: string;
  still: Still | null;
  absent?: AbsentPlate;
  /** 첫 문장 앞머리 굵은 표제(.h) */
  head?: string;
  paras: string[];
  /** Mono 메타 칩 — kind: now(주서) · t(연한 회색 날짜) */
  meta: { text: string; kind?: 'now' | 't' }[];
}

export const FEED: FeedItem[] = [
  {
    id: 'imul',
    slot: 1,
    href: '/work/imul',
    still: {},
    head: '공생직조 〈이물〉',
    paras: [
      '— 국가가 개봉하고 계측한 빈 외피. 1488년 서산 개심사 협시불 복장유물의 발원문이 12m 벽이 되고, 독송 시계가 한 박에 한 사람씩 3,029명을 하루 동안 부른다. 실제 폐어망 누에고치 아래에서 관객은 그 안(腹藏)을 본다.',
      '부산현대미술관 전시실 5, 2026년 12월 11일 개막. 2채널 영상 · 초지향성 스피커 2 · 삼베 1필.',
    ],
    meta: [
      { text: 'Upcoming', kind: 'now' },
      { text: 'Exhibition' },
      { text: '2026.12.11', kind: 't' },
    ],
  },
  {
    id: 'itorok',
    slot: 2,
    href: '/work/itorok',
    still: { open: true, ratio: '3/2', position: '20% 40%' },
    head: '이토록 고요한 파동',
    paras: [
      '— 서산 부석 간월암, 가로림만 웅도, 부남호. 물이 빠진 자리에서 찍은 퍼포먼스 필름. 경첩처럼 접히는 두 개의 시간.',
    ],
    meta: [
      { text: 'Screening' },
      { text: '서산문화원 · 1회 11:00 · 2회 14:00' },
      { text: '2026.11.01', kind: 't' },
    ],
  },
  {
    id: 'yeokryu',
    slot: 3,
    still: { ratio: '1/1', position: '70% 30%' },
    head: '위성악보 · 역류',
    paras: [
      '— 와유산수 Project I. 쇄귀된 포구를 단채널 영상 설치로 읽는 위성악보 연작의 첫 공개.',
    ],
    meta: [
      { text: 'Exhibition' },
      { text: '강경창작스튜디오' },
      { text: '2026.10.10 — 10.16', kind: 't' },
    ],
  },
  {
    id: 'essay',
    slot: 4,
    still: { ratio: '4/5', position: '40% 60%' },
    paras: [
      '인스타그램 에세이 연재. 수·일 21시, 35회. 재배치와 다시 발화에 관한 짧은 글과 한 장의 이미지.',
    ],
    meta: [{ text: 'Series' }, { text: '2026.08.16 —', kind: 't' }],
  },
  {
    id: 'busanhang',
    slot: 5,
    still: { open: true, ratio: '16/10', position: '55% 20%' },
    head: '부산항 — 고향 없는 고향',
    paras: [
      '— 삼베 한 필이 몸보다 먼저 만주에 도착해 기다린다. 아미동 비석마을의 풍화된 비석을 데이터화하는 공생직조 리서치 아카이브, 1인 퍼포먼스.',
    ],
    meta: [
      { text: 'Research' },
      { text: 'Busan · Manchuria' },
      { text: '2026.07 — 08', kind: 't' },
    ],
  },
  {
    id: 'mediation',
    slot: 6,
    still: { ratio: '3/2', position: '10% 80%' },
    paras: [
      '노드 트리가 매개하는 공공 사업 — 이소예술랩·꿈다락 문화예술학교·디지털도화서. 본체는 각자의 도메인에 있다.',
    ],
    meta: [
      { text: 'Mediation' },
      { text: 'isoartlab.com · saengsanso.com' },
      { text: '常時', kind: 't' },
    ],
  },
];
