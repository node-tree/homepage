const { chat, parseJsonContent } = require('./knuhChat');
const { PROGRAM_MAP } = require('../data/kkumdarakPrograms');

// ═══════════════════════════════════════════════════════════════
// AI 초안(KNUH) — 프롬프트 구성 + 호출 + 파싱. 라우트는 얇게 유지.
//   "이상한 글 방지" 가드를 system 메시지에 명시. grounding/주강사/주제/키워드를 user 로.
//   grounding 은 여기(백엔드)에서만 PROGRAM_MAP 으로 읽는다(클라이언트 미노출).
// ═══════════════════════════════════════════════════════════════

// 노드트리 문화예술교육 철학 — 글의 관점·톤에 반영(없는 사실을 만들라는 뜻은 아님).
const NODETREE_PHILOSOPHY =
  '【노드트리 문화예술교육 철학 — 글의 관점·톤에 녹여라】 ' +
  '문화예술교육은 프로그램 운영 자체가 목적이 아니라, 주민이 주도하는 생활문화 거점을 함께 만들어가는 과정이다. ' +
  '세대와 세대가 만나는 자리에서 주민과 예술가가 하나의 사건 안에서 공동으로 발화하며("마을 만들기가 곧 예술 만들기"), ' +
  '예술은 일상의 경험(존 듀이)에서 출발해 그 마을의 사라진 이야기를 사회적으로 복원한다. ' +
  '핵심 흐름은 "만들기 → 채우기 → 나누기 → 지속하기"이고, 사용자가 직접 만든 공간·프로그램은 다르게 작동한다. ' +
  '참여자의 주체성, 세대 간 협력, 일상·기억·관계의 가치를 담되 과장·홍보 수사는 피한다.';

// 제공된 정보에만 근거하도록 강하게 제약하는 시스템 가드.
const SYSTEM_GUARD =
  '너는 꿈다락 문화예술학교 문서 작성 도우미다. ' +
  NODETREE_PHILOSOPHY + ' ' +
  '아래 제공된 프로그램 정보·회차 맥락·키워드에만 근거해 사실적으로 쓴다. ' +
  '제공되지 않은 사실·수치·이름을 지어내지 마라. 한국어 공문 톤, 과장·홍보문구 금지, 각 항목 간결히. ' +
  '반드시 지정한 JSON 형식만 출력하고, 그 외 설명·코드펜스·머리말을 붙이지 마라.';

function programContext(program) {
  if (!program) return '';
  const ju = Array.isArray(program.주강사) ? program.주강사.join(', ') : '';
  return [
    `프로그램명: ${program.name}`,
    `대상: ${program.targetGroup} / 정원: ${program.quota}명 / 총회차: ${program.totalSessions}회 / 시수: ${program.totalHours}`,
    ju ? `주강사: ${ju}` : '',
    program.grounding ? `프로그램 정보:\n${program.grounding}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// chulgang: 6개 본문 항목 JSON 지시
function buildChulgangMessages({ program, 회차, 교육주제, 키워드 }) {
  const ctx = programContext(program);
  const user = [
    ctx,
    회차 ? `회차: ${회차}` : '',
    교육주제 ? `교육주제: ${교육주제}` : '',
    키워드 ? `키워드: ${키워드}` : '',
    '',
    '위 정보에만 근거해 출강확인서 본문을 작성하라. 아래 JSON 형식으로만 출력한다:',
    '{"교육목표":"…","세부내용":"…","교육재료":"…","평가_운영":"…","평가_반응":"…","평가_보완":"…"}',
    '각 항목은 1~3문장, 한국어 공문 톤. 제공되지 않은 사실은 쓰지 마라.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// hoeuirok: 안건 배열 JSON 지시(최대 5)
function buildHoeuirokMessages({ program, 회의주제, 키워드 }) {
  const ctx = programContext(program);
  const user = [
    ctx,
    회의주제 ? `회의주제: ${회의주제}` : '',
    키워드 ? `키워드: ${키워드}` : '',
    '',
    '위 정보에만 근거해 회의록의 논의안건을 작성하라(최대 5개). 아래 JSON 형식으로만 출력한다:',
    '{"안건":[{"제목":"…","결정1":"…","결정2":"…"}]}',
    '각 안건은 안건명과 결정사항 2줄. 한국어 공문 톤. 제공되지 않은 사실은 쓰지 마라.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// 서식6 결과보고서 — 세부내용 4항목(역할·과정·실행·평가) JSON
function buildGyeolgwaMessages({ program, 키워드 }) {
  const ctx = programContext(program);
  const user = [
    ctx,
    키워드 ? `키워드: ${키워드}` : '',
    '',
    '위 정보에만 근거해 프로그램 기획·개발 결과보고서의 세부내용을 작성하라. 아래 JSON 형식으로만 출력한다:',
    '{"내용_역할":"…","내용_과정":"…","내용_실행":"…","내용_평가":"…"}',
    '역할=기획개발 과정에서의 나의 역할, 과정=발상·개발·관리 과정, 실행=참여자 상호작용, 평가=피드백·성과·개선점.',
    '각 항목 2~4문장, 한국어 공문 톤. 제공되지 않은 사실은 쓰지 마라.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// 라우트 진입점. body 검증 + 프롬프트 + KNUH 호출 + 파싱.
//   반환: { parsed, raw } (parsed=null 이면 파싱 실패 — 라우트가 raw 동봉).
//   throw: KNUH_NO_KEY / KNUH_TIMEOUT / KNUH_HTTP_ERROR 등(라우트가 503 매핑).
async function runAiDraft(body) {
  const { docType, programKey } = body || {};
  if (docType !== 'chulgang' && docType !== 'hoeuirok' && docType !== 'gyeolgwa') {
    const err = new Error("docType 은 'chulgang'·'hoeuirok'·'gyeolgwa' 중 하나여야 합니다.");
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const program = programKey ? PROGRAM_MAP[programKey] : null;
  if (programKey && !program) {
    const err = new Error('존재하지 않는 프로그램입니다.');
    err.code = 'PROGRAM_NOT_FOUND';
    throw err;
  }

  let messages;
  if (docType === 'chulgang') {
    messages = buildChulgangMessages({
      program,
      회차: body.회차,
      교육주제: body.교육주제,
      키워드: body.키워드,
    });
  } else if (docType === 'hoeuirok') {
    messages = buildHoeuirokMessages({
      program,
      회의주제: body.회의주제,
      키워드: body.키워드,
    });
  } else {
    messages = buildGyeolgwaMessages({ program, 키워드: body.키워드 });
  }

  const content = await chat(messages, { maxTokens: 2000 });
  return parseJsonContent(content);
}

module.exports = {
  runAiDraft,
  buildChulgangMessages,
  buildHoeuirokMessages,
  SYSTEM_GUARD,
};
