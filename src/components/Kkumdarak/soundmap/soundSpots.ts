// ═══════════════════════════════════════════════════════════════════════
// soundSpots.ts — 장암면 소리지도 지점 (정본: Figma 「2026 꿈다락 · 장암 책정 · 포스터」 소리지도 페이지)
//   좌표는 도판 이미지(public/sound-map-v2.png) 기준 정규화 비율(u,v 0~1) — 해상도 무관.
//   kind 는 도판 범례 그대로: 기조음 · 신호음 · 표식음 · 사라진 소리
//   audio: 확보된 음원 URL. 비어 있으면 카드에서 소리 슬롯을 감춘다(후입력).
//   ⚠️ 기존 사운드 폴더의 BBC RemArc 음원은 비상업·재배포 제한 — 웹 공개 전 확인 필요.
// ═══════════════════════════════════════════════════════════════════════
export interface SoundSpot {
  n: number;
  u: number;          // 가로 비율 0~1
  v: number;          // 세로 비율 0~1
  kind: 'bed' | 'sig' | 'mark' | 'gone';
  name: string;
  sub?: string;
  ono?: string;       // 의성어 — 도판 표기
  audio?: string;
}

export const KIND_LABEL: Record<SoundSpot['kind'], string> = {
  bed: '기조음', sig: '신호음', mark: '표식음', gone: '사라진 소리',
};

export const SOUND_SPOTS: SoundSpot[] = [
  { n: 1,  u: 0.279, v: 0.176, kind: 'bed',  name: '수박 비닐하우스', sub: '비닐 펄럭임과 환풍기 소리', ono: '파르르 우웅—' },
  { n: 2,  u: 0.536, v: 0.145, kind: 'mark', name: '마당바위 場岩', sub: '강물이 너른 바위를 치는 소리', ono: '촤아— 찰박' },
  { n: 3,  u: 0.671, v: 0.163, kind: 'gone', name: '월파정 터', sub: '정자는 사라지고 물결만 남았다' },
  { n: 4,  u: 0.721, v: 0.248, kind: 'mark', name: '정암리 와요지', sub: '기와 굽던 가마의 불기', ono: '타닥 타닥' },
  { n: 5,  u: 0.209, v: 0.304, kind: 'sig',  name: '장암면 주민자치센터', sub: '악기 놀이 여기 있다 · 아침 체조와 마을 방송', ono: '딩— 동— 댕—' },
  { n: 6,  u: 0.273, v: 0.431, kind: 'gone', name: '5일장 터 · 양조장', sub: '사라진 장날의 웅성거림', ono: '웅성 웅성' },
  { n: 7,  u: 0.472, v: 0.493, kind: 'sig',  name: '장암초등학교', sub: '운동장 아이들의 함성', ono: '우 와 아 야호' },
  { n: 8,  u: 0.596, v: 0.476, kind: 'bed',  name: '가림조씨의 묘', sub: '무덤가에 늘 우는 풀벌레', ono: '사르르, 찌르르' },
  { n: 9,  u: 0.736, v: 0.559, kind: 'bed',  name: '남산골 산울', sub: '산을 흘러내려 오는 물소리', ono: '졸— 졸— 부엉—' },
  { n: 10, u: 0.185, v: 0.575, kind: 'bed',  name: '논 · 물꼬', sub: '밤 논에서 우는 개구리', ono: '개골 개골' },
  { n: 11, u: 0.543, v: 0.627, kind: 'sig',  name: '마을회관', sub: '흥겨운 추임새와 장단', ono: '얼~쑤 토닥토닥' },
  { n: 12, u: 0.774, v: 0.701, kind: 'gone', name: '옛 나루터 · 통통배', sub: '사라진 통통배의 발동기', ono: '뚱— 뚱— 뚱—' },
  { n: 13, u: 0.313, v: 0.509, kind: 'gone', name: '지토리 금광 터', sub: '일본 자본이 파간 빈 굴', ono: '우웅— (빈 굴)' },
  { n: 14, u: 0.512, v: 0.267, kind: 'sig',  name: '생산소', sub: '악기 하나가 여기 있다', ono: '드르륵 치이—' },
];
