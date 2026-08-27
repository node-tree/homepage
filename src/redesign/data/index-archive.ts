// ════════════════════════════════════════════════════════════════════════
// index-archive.ts — Index(인덱스) 페이지
//   문구 정본: _workspace/03_mock/v5/index-archive.html
//   entry 안의 **굵게** = 목업의 <b> (rich.tsx 가 해석). 확인되지 않은 항목은 만들지 않는다.
// ════════════════════════════════════════════════════════════════════════

export interface ArchiveRow {
  /** 연도 표기. null 이면 같은 해 이어지는 행(`·` dim) */
  year: string | null;
  tag: string;
  /** **굵게** 마크업 허용 */
  entry: string;
  /** null = absent(자리는 남기고 값 없음) */
  place: string | null;
  /** 앵커 id — #cv · #press · #publication */
  anchor?: string;
  /** 연도 첫 행(2px 계선) */
  head?: boolean;
}

export const ARCHIVE: ArchiveRow[] = [
  { year: '2026', tag: 'EXHIBITION', entry: '**공생직조 〈이물〉** — 부산현대미술관 플랫폼 《공생 직조》 Corrosia, 개막 12.11', place: '부산현대미술관 전시실 5', anchor: 'cv', head: true },
  { year: null, tag: 'SCREENING', entry: '**이토록 고요한 파동** — 충남문화관광재단 〈감각 번역〉, 1회 11:00 · 2회 14:00', place: '서산문화원' },
  { year: null, tag: 'EXHIBITION', entry: '**위성악보 · 역류** — 와유산수 Project I, 10.10—10.16', place: '강경창작스튜디오' },
  { year: null, tag: 'EXHIBITION', entry: '**Reconnect: 낙원식당(樂源識鄕)** — 전시·퍼포먼스, 01.29—02.13', place: '충남창작스튜디오, 태안' },
  { year: null, tag: 'EXHIBITION', entry: '교류·횡단 EXCHANGE/CROSSING', place: '대구예술발전소' },
  { year: null, tag: 'PRESS', entry: 'KBS 충청은 오늘 「잇다 엮다 살다 — 현대예술가 이화영」 (02.19)', place: 'KBS', anchor: 'press' },
  { year: null, tag: 'PUBLICATION', entry: 'NODE TREE 그룹 단행본 — 히스테리안 발간 예정', place: '히스테리안', anchor: 'publication' },
  { year: null, tag: 'PUBLICATION', entry: '여성농민회 토종씨앗 책 · 꿈다락 결과발표 도록 — 히스테리안 발간 예정', place: '히스테리안' },

  { year: '2025', tag: 'EXHIBITION', entry: '**유기적 공명: 에디아포닉** — 11.28—12.07', place: 'CN갤러리, 서울', head: true },
  { year: null, tag: 'EXHIBITION', entry: '**虛陰網巫 허음망무** — 《둔주: 그림자가 된 전통》, 09.20—12.20', place: '판교극장, 서천' },
  { year: null, tag: 'EXHIBITION', entry: '**경계의 울림** — 《땅끝: 서쪽으로 가는 길》 프리뷰전, 05.02—07.04', place: '충남창작스튜디오, 태안' },
  { year: null, tag: 'RESIDENCY', entry: '충남창작스튜디오 2기 입주작가 (2025—2026)', place: '태안' },
  { year: null, tag: 'PRESS', entry: 'KBS 문화스케치 93회 「잇다 엮다 살다 — 현대예술가 이화영」 (09.15)', place: 'KBS' },

  { year: '2024', tag: 'EXHIBITION', entry: '**위성악보시리즈: 국경** — 11.07—11.13', place: '신동엽문학관, 부여', head: true },
  { year: null, tag: 'GRANT', entry: '2024 충남문화예술지원사업 선정 — 국경', place: '충청남도' },

  { year: '2023', tag: 'EXHIBITION', entry: '**위성악보시리즈: 남미농장** — 온라인미디어 예술활동, 05.01—10.30', place: '온라인', head: true },
  { year: null, tag: 'PUBLIC ART', entry: '**안녕, 소리. 자율-이동+** — 아르코 공공예술', place: '메트로미술관' },
  { year: null, tag: 'EXHIBITION', entry: '**교감생물** — 키네틱 오브제', place: '전주 남부시장' },

  { year: '2022', tag: 'EXHIBITION', entry: '**오드라데크: 땡볕, 초승달과 대추** — 03.11—04.07', place: '아마도예술공간, 서울', head: true },
  { year: null, tag: 'EXHIBITION', entry: '**복합돌봄장치** — 울산현대미술제', place: '울산시립미술관' },
  { year: null, tag: 'PUBLIC ART', entry: '**소리탐사조** — 아르코 공공예술 《출몰지》', place: null },
  { year: null, tag: 'AWARD', entry: '제9회 아마도 전시기획공모상 — 기획 강정아, 참여 단체', place: '아마도예술공간' },

  { year: '2021', tag: 'EXHIBITION', entry: '**위성악보시리즈: KARMA** — 부여 최초의 뉴미디어아트 전시, 10.14—10.19', place: '부소갤러리, 부여', head: true },

  { year: '2020', tag: 'AWARD', entry: '제23회 Japan Media Arts Festival 아트부문 심사위원 추천작 — 〈소달구지〉', place: 'Tokyo', head: true },
  { year: null, tag: 'RESIDENCY', entry: 'The Mirror of Dragon-Cat — 레지던시', place: '스페인' },
  { year: null, tag: 'SCREENING', entry: '**위성악보시리즈** · **노드트리: 아르카이옵테리스** — 온라인미디어 예술활동', place: '한문예위' },

  { year: '2019', tag: 'EXHIBITION', entry: '**소달구지 (Sodalguji)** — 사운드 키네틱 설치', place: '경기상상캠퍼스, 수원', head: true },
  { year: null, tag: 'PROJECT', entry: '**고속화도로 로망스** — 리서치·워크숍·전시·공연', place: '경기상상캠퍼스, 수원' },

  { year: '2018', tag: 'CONFERENCE', entry: 'ICMC 대구 · Nemaf 입상 — 〈WHAT DO YOU SEE?〉 발표', place: '대구 · 서울', head: true },
  { year: null, tag: 'AWARD', entry: '제24회 무용예술상 포스트 젊은 예술가상 — 정강현', place: null },
  { year: null, tag: 'PROJECT', entry: '**레트로 도시건설** — 사운드스케이프 영상집', place: null },

  { year: '2017', tag: 'PERFORMANCE', entry: '**분실물보관소에서의 연설** — ACC 창·제작센터 레지던시', place: '국립아시아문화전당, 광주', head: true },
  { year: null, tag: 'PERFORMANCE', entry: '**WHITE RABBIT** — NODE TREE 첫 발표', place: '정다방 프로젝트, 서울' },

  { year: '2016', tag: 'EXHIBITION', entry: '**WHAT DO YOU SEE?** — NODE TREE의 출발점, 사물 해킹·가변 설치', place: '문화공간 지나, 서울', head: true },
];

export const ARCHIVE_SOURCE =
  '출처 · NODE TREE/CV/NODE-TREE-프로필-CV.md(전체 연혁·수상·보도) · NODE TREE/전시/_INDEX.md · NODE TREE/출판/_INDEX.md — 없는 항목은 자리만 두고 비운다';

export const ARCHIVE_NOTE =
  '전시·상영·공공예술·수상·레지던시·출판·언론을 한 줄에 모아 연도 역순으로 둔다. 확인되지 않은 항목은 만들지 않고 자리만 비운다.';

export const ARCHIVE_ANCHORS = [
  { id: 'cv', label: '#cv · 활동 연혁' },
  { id: 'press', label: '#press · 언론' },
  { id: 'publication', label: '#publication · 출판' },
];

export const ARCHIVE_COUNTS = ['전시 · 상영 16', '공공예술 3', '수상 · 선정 4', '출판 2', '언론 2'];
