// ════════════════════════════════════════════════════════════════════════
// about.ts — About(소개) 페이지
//   문구 정본: _workspace/03_mock/v5/about.html
//   언어정책: "직조"는 공생직조 전용, 그룹 언어는 "재배치·다시 발화"(feedback_nodetree_language_policy).
//   **굵게** = 목업의 <b>.
// ════════════════════════════════════════════════════════════════════════

export const ABOUT_LAB = 'ABOUT · SINCE 2016';
export const ABOUT_TITLE = '노드 트리';
export const ABOUT_TITLE_EN = 'NODE TREE';
export const ABOUT_NOTE =
  '충남 부여군 장암면. 도시기록 프로젝트팀이자 뉴미디어 아티스트 듀오 — 이화영 · 정강현.';

export const ABOUT_PARAS = [
  'NODE TREE는 무비판적으로 복사되듯 확장되는 한국의 풍경을 주목하여, 개인이 닿을 수 있는 시선을 여러 미디어 장치로 기록에 남긴다. 우연성과 직관적 감각을 우선하며 연결되는 사람·풍경·땅의 역사의 찰나를 포착해 구성하고, 수집된 사물·소리·이미지로 다시 짠다.',
  'NODE는 이야기와 소리가 교차하는 지점, TREE는 그 지점에서 확장되는 관계의 네트워크다. 우리가 하는 일을 한 문장으로 줄이면 ‘사라진 이야기의 사회적 복원’이다.',
  '2016년 서울에서 시작해 2018년 용인, 2020년 부여로 거처를 옮겼다. 이동은 물리적 환경의 변화만이 아니라 동료 예술가 집단에서 **동네 주민**으로 협력과 영감의 원천을 바꾸는 일이었다. 대도시 예술계와의 결별이자, 터전으로의 착지 — 우리는 이것을 ‘동네로의 전환’이라 부른다.',
  '우리는 말하지 않고 **재배치**한다. 내버려진 사물, 남의 구술, 사라진 지명은 우리의 소유가 아니므로 대신 말해 주지 않는다. 다만 자리를 옮겨 다시 발화하게 한다. 이 원칙 때문에 우리 문장에는 대상을 대변하는 목소리가 없고, 곁에 머무는 위치만 있다.',
];

export const ABOUT_SOURCE =
  '출처 · NODE TREE/About/NODE-TREE-개념-통합.md §1 근본 질문 · §2 거점 이동 · §3-1 위성악보 · NODE TREE/CV/NODE-TREE-프로필-CV.md 팀원·회원·협력';

export interface PersonRow {
  n: string;
  v: string;
  /** 바깥(매개) 항목 — 점선 계선 */
  out?: boolean;
}

export interface AboutBlock {
  label: string;
  out?: boolean;
  rows: PersonRow[];
}

export const ABOUT_BLOCKS: AboutBlock[] = [
  {
    label: '구성원 MEMBERS',
    rows: [
      { n: '이화영', v: '대표 · 기획, 리서치, 조형 — 한국예술종합학교 MFA / 한성대학교 BFA(회화). 충남창작스튜디오 2기 입주작가' },
      { n: '정강현', v: '사운드, 영상 — 한양대학교 뉴미디어 음악 작곡. 모듈러 신스·필드 레코딩' },
      { n: '회원 12', v: '김성훈(영상·설치) · 강영민(설치미술) · 김봉수(현대무용) · 박서우(모델·배우) · 김갑래(촬영감독) · 손종명(신문·방송) · 이해용(소방·향토지리) · 김정기(조형·농업) · 이상철(서각·농업) · 이헌철(목공)' },
      { n: '협력', v: '강정아 · 히스테리안(독립출판사) — 서문·비평 에세이, 상시 기획·출판 파트너' },
    ],
  },
  {
    label: '매개 MEDIATION — 본체는 각자의 도메인에 있다',
    out: true,
    rows: [
      { n: '생산소', v: 'saengsanso.com — 주식회사 생산소, 대안예술공간', out: true },
      { n: '이소예술랩', v: 'isoartlab.com — 지역 예술 교육·매개', out: true },
      { n: '디지털도화서', v: '아카이빙·조판 작업실', out: true },
    ],
  },
  {
    label: 'CONTACT',
    rows: [
      { n: 'Email', v: 'nodetreemedia@gmail.com' },
      { n: 'Studio', v: '충남 부여군 장암면 · 충남창작스튜디오(태안)' },
    ],
  },
];

export const SAMBE_LABEL = '삼베 대리 신체 SAMBE';
export const SAMBE_CAP = '옷이 몸보다 먼저 도착해 기다린다.';

export const FOOTER = {
  brand: { b: 'NODE TREE', lines: ['내버린 것들 곁에 머무는 뉴미디어 아티스트 듀오', 'Buyeo, Chungnam'] },
  contact: { b: 'Contact', text: 'nodetreemedia@gmail.com' },
  mediation: { b: 'Mediation', links: [{ href: 'https://saengsanso.com', text: 'saengsanso.com' }, { href: 'https://isoartlab.com', text: 'isoartlab.com' }] },
  beat: { b: '讀誦', text: '1명 = 1박 · 9.508 s · 3,029 / 日' },
};
