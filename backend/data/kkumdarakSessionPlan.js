// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 회차별 «기본 계획서» 주제 (고정 상수).
//   출처: Obsidian NODE TREE/문화예술교육/2026-꿈다락-생활거점형-장암면/03-프로그램.md
//        (2026-05-21 공식 홍보문구 PDF 기준 개정판) — 런타임 옵시디안 접근 불가라 baked.
//
//   ⚠️ 이 상수가 출강확인서 「교육주제」의 **기본 주제(앵커)** 다.
//   AI 초안은 이 주제를 바꾸지 못하고 뒤에 보강구만 덧붙일 수 있다(aiDraft.mergeTopic 가 코드로 강제).
//
//   두 가지 정밀도로 구분한다 — 계획서가 회차를 어디까지 특정했는지에 따라 다르다.
//     · exact : 계획서가 「회차: ① … ② …」 로 회차별 주제를 명시한 프로그램.
//               (소리일기 6회 / 풍경일기 8회 / 다시,안녕 1회)
//     · stage : 계획서가 단계(3단계·5단계)와 단계별 회차 수만 명시한 프로그램.
//               앵커는 계획서에 그대로 적힌 **단계명**이고, 회차→단계 배정만 이 파일의 매핑이다.
//               (장암 책정 5+4+3 / 기억순환 3+5+2 / 손의 기억 B형10+A형6 = 계획서 명시 회차 수)
//               단, 마을의 신호는 계획서가 "10회 5단계"라고만 해 2회씩 균등 배분으로 가정했다.
//     · none  : 근거 없음(회차 범위 밖 등) → 앵커 없이 기존 AI 추측 동작으로 폴백.
//
//   회차 번호는 «운영 시간순»을 가정한다. 손의 기억은 B형(7.6~7.17 10개 리 순회)이
//   A형(9.2~10.7 주민자치회 6회)보다 앞서므로 1~10=B형, 11~16=A형으로 본다.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require('assert');
const { PROGRAM_MAP } = require('./kkumdarakPrograms');

const SESSION_PLAN = {
  // 계획서 「회차: ① 눈으로 걷기 → … → ⑧ 결과 정리·전시」
  'punggyeong-ilgi': {
    source: '03-프로그램.md · 기존 다 풍경일기 「회차」',
    sessions: [
      '눈으로 걷기',
      '백마강 — 물과 바람',
      '임천면 — 시간의 결',
      '부여읍 — 거리와 나무',
      '우리 동네 장암면 일대',
      '함종호 특강 「자연을 그리는 다른 눈」',
      '색의 문법 — 백제·부여 전통색',
      '풍경일기 결과 정리·전시',
    ],
  },

  // 계획서 「회차: ① 듣기의 기쁨 → … → ⑥ 결과 정리·전시」
  'sori-ilgi': {
    source: '03-프로그램.md · 기존 나 소리일기 「회차」',
    sessions: [
      '듣기의 기쁨',
      '자연의 소리',
      '사람의 소리',
      '사물의 소리 — 가축·옛 도구',
      '소리에 이름 붙이기와 Soundscape 매핑',
      '결과 정리·전시 — 작은도서관 청취 부스',
    ],
  },

  // 1회 6시수 통합축제 — 계획서 「운영 흐름」이 곧 이 회차의 내용.
  'dasi-annyeong': {
    source: '03-프로그램.md · 신규 특별 라 〈다시, 안녕〉 「운영 흐름」',
    sessions: ['다섯 세대 통합축제 〈다시, 안녕〉'],
  },

  // 계획서 「3단계 운영: 1. 진단·드로잉·설계(5–6월, 5회) / 2. 목공 제작·디자인(6–7월, 4회)
  //          / 3. 페인트·설치·미디어 결합(7–8월, 3회)」 = 5+4+3 = 12회.
  'jangam-chaekjeong': {
    source: '03-프로그램.md · 신규 가 장암 책정 「3단계 운영」',
    stages: [
      {
        from: 1,
        to: 5,
        name: '진단·드로잉·설계',
        주강사: '이화영',
        activities: [
          '주민자치회 월례회의 연계',
          '작은도서관 문제 진단',
          '다섯 세대 공간 드로잉',
          '모형 제작',
          '설계안 발표',
        ],
      },
      {
        from: 6,
        to: 9,
        name: '목공 제작·디자인',
        주강사: '이공희',
        activities: ['가구·진열대·전시판 제작', '사포·연마·코팅', '사인·라벨'],
      },
      {
        from: 10,
        to: 12,
        name: '페인트·설치·미디어 결합',
        주강사: '정강현',
        activities: [
          '아동·청소년 페인트',
          '작은도서관 가구·전시판 설치',
          '시(詩) 패널·사이니지',
          '부여군청 결과 공유 인수식',
        ],
      },
    ],
  },

  // 계획서 「5단계 커리큘럼: ① 도구 학습 → ② 신호 채집 → ③ 출력 설계 → ④ 작품 제작 → ⑤ 전시·환류」.
  //   단계별 회차 수가 계획서에 없어 10회를 2회씩 균등 배분(assumption).
  'maeul-signal': {
    source: '03-프로그램.md · 신규 나 마을의 신호 「5단계 커리큘럼」',
    assumption: '단계별 회차 수 미명시 — 10회를 5단계에 2회씩 균등 배분',
    stages: [
      {
        from: 1,
        to: 2,
        name: '도구 학습',
        activities: ['Arduino·ESP32·Raspberry Pi Pico', 'Makey Makey', '센서 기초'],
      },
      {
        from: 3,
        to: 4,
        name: '신호 채집',
        activities: [
          '마을의 소리·빛·움직임·온도 채집',
          '콘덴서 마이크·PIR 동작·CDS 조도·DHT 온습도',
        ],
      },
      { from: 5, to: 6, name: '출력 설계', activities: ['사운드·시각·움직임 출력 매핑 설계'] },
      { from: 7, to: 8, name: '작품 제작', activities: ['인터랙티브 미디어 작품 제작'] },
      { from: 9, to: 10, name: '전시·환류', activities: ['작품 전시', '〈다시, 안녕〉 체험부스 환류'] },
    ],
  },

  // 계획서 「3단계 운영: 1. 자료 듣기·발췌·매체 선택(6–7월, 3회) / 2. 매체별 재현 작업(8–9월, 5회)
  //          / 3. 통합·전시 설치(10월, 2회)」 = 3+5+2 = 10회.
  'gieok-sunhwan': {
    source: '03-프로그램.md · 신규 다 기억순환 정류장 「3단계 운영」',
    stages: [
      {
        from: 1,
        to: 3,
        name: '자료 듣기·발췌·매체 선택',
        주강사: '이화영',
        activities: [
          '『삶터의 기록』 어르신 생애사 인터뷰 청취',
          '핵심 이야기 12~15편 발췌',
          '재현 매체 선택',
          '함종호 특강',
        ],
      },
      {
        from: 4,
        to: 8,
        name: '매체별 재현 작업',
        주강사: '이화영·정강현',
        activities: ['드로잉·짧은글·사운드·영상·인터랙티브 5매체 재현'],
      },
      {
        from: 9,
        to: 10,
        name: '통합·전시 설치',
        주강사: '이화영·정강현',
        activities: ['작품 통합 편집', '〈장암 책정〉 작은도서관 전시 설치'],
      },
    ],
  },

  // 계획서 「A형 12명 6회(9.2~10.7) / B형 10개 리 순회 10회(7.6~7.17)」 = 16회.
  //   회차 번호는 운영 시간순 가정 → 1~10 B형(7월), 11~16 A형(9~10월).
  //   B형 릴레이 순서는 계획서에 명시(석동리 → … → 정암리).
  'son-gieok': {
    source: '03-프로그램.md · 기존 가 손의 기억 「A형·B형」',
    assumption: '회차 번호 = 운영 시간순 가정(1~10 B형 7월 순회, 11~16 A형 9~10월)',
    stages: [
      {
        from: 1,
        to: 10,
        name: 'B형 마을 순회 손그림·구술 채록',
        주강사: '이공희',
        activities: [
          '10개 리 릴레이(석동리·원문리·합곡리·점상리·지토리·하황리·상황리·장하리·북고리·정암리)',
          '"수리부엉이가 이 이야기를 들었는데요" 화자 구조로 회차 열기',
          '태어난 마을·논밭·집 마당의 기억을 드로잉과 구술로',
        ],
      },
      {
        from: 11,
        to: 16,
        name: 'A형 주민자치회 손그림·구술 채록',
        주강사: '이공희',
        activities: [
          '작은도서관 6주 연속 운영',
          '어르신 6장 드로잉',
          '단행본 《장암면 손의 기억》 편집용 원고 정리',
        ],
      },
    ],
  },
};

// ── 무결성 검증 (require 시점) ───────────────────────────────────────────────
//   계획서 회차 수(PROGRAM_MAP.totalSessions)와 이 파일의 회차 커버리지가 어긋나면 즉시 실패.
for (const [key, plan] of Object.entries(SESSION_PLAN)) {
  const program = PROGRAM_MAP[key];
  assert.ok(program, `SESSION_PLAN 의 알 수 없는 programKey: ${key}`);
  if (plan.sessions) {
    assert.strictEqual(
      plan.sessions.length,
      program.totalSessions,
      `${key} 회차 주제 수 불일치: ${plan.sessions.length} ≠ ${program.totalSessions}`,
    );
  } else {
    // 단계 범위가 1..totalSessions 를 빈틈·중복 없이 덮는지
    let expected = 1;
    for (const st of plan.stages) {
      assert.strictEqual(st.from, expected, `${key} 단계 범위 불연속: ${st.name} from=${st.from}`);
      assert.ok(st.to >= st.from, `${key} 단계 범위 역전: ${st.name}`);
      expected = st.to + 1;
    }
    assert.strictEqual(
      expected - 1,
      program.totalSessions,
      `${key} 단계 회차 합 불일치: ${expected - 1} ≠ ${program.totalSessions}`,
    );
  }
}

// ── 회차 → 기본 주제 해석 ────────────────────────────────────────────────────
//   반환: { 기본주제, 정밀도('exact'|'stage'|'none'), 단계, 회차범위, 세부활동[], 근거, 가정, 총회차 }
//     · 단계    = 프롬프트용 전체 라벨("6~9회차 · 목공 제작·디자인 (주: 이공희)")
//     · 회차범위 = UI 힌트용 짧은 라벨("6~9회차") — 기본주제와 중복되지 않게 분리했다.
//   기본주제가 '' 이면 계획서 근거 없음 → 호출부는 기존(AI 추측) 동작으로 폴백한다.
function resolvePlanTopic(programKey, sessionNo) {
  const empty = {
    기본주제: '',
    정밀도: 'none',
    단계: '',
    회차범위: '',
    세부활동: [],
    근거: '',
    가정: '',
    총회차: 0,
  };
  const program = PROGRAM_MAP[programKey];
  if (!program) return empty;

  const plan = SESSION_PLAN[programKey];
  const base = { ...empty, 총회차: program.totalSessions };
  if (!plan) return base;

  const n = Number(sessionNo);
  if (!Number.isInteger(n) || n < 1 || n > program.totalSessions) {
    // 회차 미입력·범위 밖 → 앵커 없음(억지로 배정하지 않는다).
    return { ...base, 근거: plan.source, 가정: plan.assumption || '' };
  }

  if (plan.sessions) {
    return {
      기본주제: plan.sessions[n - 1],
      정밀도: 'exact',
      단계: '',
      회차범위: `${n}회차`,
      세부활동: [],
      근거: `${plan.source} — ${n}회차`,
      가정: plan.assumption || '',
      총회차: program.totalSessions,
    };
  }

  const stage = plan.stages.find((st) => n >= st.from && n <= st.to);
  if (!stage) return { ...base, 근거: plan.source, 가정: plan.assumption || '' };
  return {
    기본주제: stage.name,
    정밀도: 'stage',
    단계: `${stage.from}~${stage.to}회차 · ${stage.name}${stage.주강사 ? ` (주: ${stage.주강사})` : ''}`,
    회차범위: `${stage.from}~${stage.to}회차${stage.주강사 ? ` 주강사 ${stage.주강사}` : ''}`,
    세부활동: stage.activities || [],
    근거: `${plan.source} — ${stage.from}~${stage.to}회차 단계`,
    가정: plan.assumption || '',
    총회차: program.totalSessions,
  };
}

module.exports = {
  SESSION_PLAN,
  resolvePlanTopic,
};
