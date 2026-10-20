// ═══════════════════════════════════════════════════════════════
// 프로그램 색인 — 이름 · id · 기간을 한 곳에서
//   · name = Programs.tsx 카드 이름(= kkumdarak-settings DB 오버라이드 키). 바꾸면 저장된 편집이 끊긴다.
//   · id   = 마을일기 칩 · 마을기록 카드 · 해시 딥링크(#diary/<id> · #results/<id>)가 같이 쓰는 키.
//   · period = 일정 막대와 카드 상태(기간이 끝나면 「종료」)가 같이 읽는 기간. 2026년 기준.
//   ⚠️ 카드 기간을 편집(DB)해도 여기 값은 따라 바뀌지 않는다 — 기간이 바뀌면 이 표도 함께 고친다.
// ═══════════════════════════════════════════════════════════════

export type Period = { sm: number; sd: number; em: number; ed: number };

export interface ProgramIndexEntry {
  id: string;
  name: string;
  period: Period;
}

// 프로그램 카드 순서(Programs.tsx)와 같다. 축제는 아래 FESTIVAL 로 따로.
export const PROGRAM_INDEX: ProgramIndexEntry[] = [
  { id: 'jangam-chaekjeong', name: '장암 책정',        period: { sm: 5, sd: 23, em: 8, ed: 22 } },
  { id: 'maeul-signal',      name: '마을의 신호',      period: { sm: 7, sd: 1,  em: 9, ed: 2 } },
  { id: 'memory-station',    name: '기억순환 정류장',  period: { sm: 6, sd: 18, em: 7, ed: 31 } },
  { id: 'hand-memory',       name: '손의 기억',        period: { sm: 7, sd: 6,  em: 7, ed: 17 } },
  { id: 'land-song',         name: '땅을 달래는 노래', period: { sm: 9, sd: 28, em: 10, ed: 17 } },
  { id: 'sound-diary',       name: '소리일기',         period: { sm: 6, sd: 23, em: 7, ed: 28 } },
  { id: 'scape-diary',       name: '풍경일기',         period: { sm: 5, sd: 23, em: 7, ed: 18 } },
];

// 〈다시, 안녕〉 축제 — 11.7 하루.
export const FESTIVAL = { id: 'goodbye-again', name: '다시, 안녕', month: 11, day: 7 };

const YEAR = 2026;

export const programIdForName = (name: string): string | undefined =>
  name === FESTIVAL.name ? FESTIVAL.id : PROGRAM_INDEX.find((p) => p.name === name)?.id;

// 기간 마지막 날 자정이 지나면 끝난 것으로 본다(방문자 기기 시간 기준).
export const isProgramEnded = (name: string, now: Date = new Date()): boolean => {
  const p = PROGRAM_INDEX.find((e) => e.name === name);
  if (!p) return false;
  return now.getTime() > new Date(YEAR, p.period.em - 1, p.period.ed, 23, 59, 59).getTime();
};

// 축제까지 남은 날(당일 0, 지나면 음수).
export const daysUntilFestival = (now: Date = new Date()): number => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const fest = new Date(YEAR, FESTIVAL.month - 1, FESTIVAL.day).getTime();
  return Math.round((fest - today) / 86400000);
};
