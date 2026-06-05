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

// 서식6 결과보고서 — 「기획·개발 세부내용」(5개 번호 소제목 narrative)을 템플릿의 4개 셀
//   (내용_역할/내용_과정/내용_실행/내용_평가)에 매핑해 채운다. 템플릿 무수정(셀 4개 그대로).
//   소제목 1=역할, 2=대상 분석(셀 부족 → 3 과정 셀 첫 단락으로 흡수), 3=발상/개발/관리(가장 길게),
//   4=실행 계획, 5=평가·성과. reportMonth 로 시제(계획/예정형 ↔ 과거형) 제어.
function buildGyeolgwaMessages({ program, 키워드, reportMonth }) {
  const ctx = programContext(program);
  const tense = reportMonth
    ? `보고 기준 시점: ${reportMonth}. 이 시점에 아직 시작하지 않았거나 진행 예정인 활동은 계획·예정형(\"~할 예정이다/~한다\")으로, 이미 끝난 회차는 과거형(\"~하였다\")으로 시제를 구분해 서술하라.`
    : '아직 시작 전인 활동은 계획·예정형으로, 끝난 활동은 과거형으로 시제를 구분하라.';
  const user = [
    ctx,
    키워드 ? `키워드: ${키워드}` : '',
    '',
    '위 「프로그램 정보」 grounding 본문에만 근거해 서식6 결과보고서의 「기획·개발 세부내용」을 작성하라.',
    '세부내용은 5개 번호 소제목으로 구성되며, 이를 아래 4개 JSON 키에 다음과 같이 나눠 담는다:',
    '{"내용_역할":"…","내용_과정":"…","내용_실행":"…","내용_평가":"…"}',
    '· 내용_역할 = [소제목1] 기획·개발 참여인력 역할 — 참여인력(주강사) 1인당 1문장으로 역할을 기술.',
    '· 내용_과정 = [소제목2] 대상 분석(2~3문장)을 먼저 쓰고, 이어 [소제목3] 기획개발 과정을 ' +
      '○발상 / ○개발 / ○관리 세 부분으로 가장 길고 구체적으로(이 키 전체 600~750자) 작성. ' +
      '세 부분은 같은 줄에 \"○발상: … ○개발: … ○관리: …\" 형태로 ○ 머리표를 구분자로 이어 쓴다. ' +
      '줄바꿈(개행)은 셀에서 렌더되지 않으니 사용하지 말고, ○ 머리표로만 단락을 구분하라.',
    '· 내용_실행 = [소제목4] 프로그램 실행 계획 — 2~4문장.',
    '· 내용_평가 = [소제목5] 평가 및 성과 계획 — 같은 줄에 \"○피드백: … ○학습성과: …\" 형태로 ○ 머리표를 구분자로 이어 쓴다(줄바꿈 금지).',
    '',
    '제약: ① 4개 키 합산 분량 1,100~1,300자 수준의 연구보고서 톤. ② ' + tense,
    '③ grounding 본문에 없는 고유명사·수치·인용·강사명(특히 외부 특강 강사명)을 절대 지어내지 마라. ' +
      'grounding에 명시된 이름·수치만 사용하고, 근거가 없으면 그 부분은 일반적 서술로 비워 둔다. ' +
      '④ 3인칭 평서체. ⑤ 과장·홍보 수사 금지. ⑥ 각 값 내부에 줄바꿈 금지 — ○ 머리표로만 구분. ⑦ JSON 외 텍스트·코드펜스 금지.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// 검수조서(일반용역비) — 검수의견 1~2문장(프로그램명·산출물·검수결과 grounding). AI 비중 낮음.
//   환각가드: grounding/입력에 없는 사실 금지. 결과 라벨(합격/보완 후 합격/불합격)에 맞춰 톤 조정.
function buildInspectionMessages({ program, 용역명, 산출물, 검수결과, 키워드 }) {
  const ctx = programContext(program);
  const resultLabel =
    검수결과 === 'fail' ? '불합격' : 검수결과 === 'conditional' ? '보완 후 합격' : '합격';
  const user = [
    ctx,
    용역명 ? `용역명: ${용역명}` : '',
    산출물 ? `산출물(링크/설명): ${산출물}` : '',
    `검수결과: ${resultLabel}`,
    키워드 ? `키워드: ${키워드}` : '',
    '',
    '위 정보에만 근거해 일반용역비 검수조서의 「검수의견」을 1~2문장으로 작성하라. 아래 JSON 형식으로만 출력한다:',
    '{"검수의견":"…"}',
    '예: \"기획·개발 결과물이 계약 내용대로 수행되었으며, 산출물의 품질·규격이 적정하고 증빙이 충실함을 확인함.\"',
    '검수결과가 \"보완 후 합격\"이면 보완 필요사항을, \"불합격\"이면 사유를 간결히 덧붙인다. ' +
      '제공되지 않은 사실·수치는 쓰지 마라. 3인칭 평서체, 한국어 공문 톤.',
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
const VALID_DOCTYPES = ['chulgang', 'hoeuirok', 'gyeolgwa', 'inspection'];

async function runAiDraft(body) {
  const { docType, programKey } = body || {};
  if (!VALID_DOCTYPES.includes(docType)) {
    const err = new Error("docType 은 'chulgang'·'hoeuirok'·'gyeolgwa'·'inspection' 중 하나여야 합니다.");
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
  let maxTokens = 2000;
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
  } else if (docType === 'inspection') {
    messages = buildInspectionMessages({
      program,
      용역명: body.용역명,
      산출물: body.산출물,
      검수결과: body.검수결과,
      키워드: body.키워드,
    });
  } else {
    // gyeolgwa: 1,100~1,300자 narrative + JSON 래핑 → 토큰 여유 확대(truncation 방지).
    messages = buildGyeolgwaMessages({
      program,
      키워드: body.키워드,
      reportMonth: body.reportMonth,
    });
    maxTokens = 4000;
  }

  const content = await chat(messages, { maxTokens });
  return parseJsonContent(content);
}

module.exports = {
  runAiDraft,
  buildChulgangMessages,
  buildHoeuirokMessages,
  buildGyeolgwaMessages,
  buildInspectionMessages,
  SYSTEM_GUARD,
};
