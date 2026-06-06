const { chat, parseJsonContent } = require('./knuhChat');
const { PROGRAM_MAP } = require('../data/kkumdarakPrograms');

// ═══════════════════════════════════════════════════════════════
// AI 초안(KNUH) — 프롬프트 구성 + 호출 + 파싱. 라우트는 얇게 유지.
//   "이상한 글 방지" 가드를 system 메시지에 명시. grounding/주강사/주제/키워드를 user 로.
//   grounding 은 여기(백엔드)에서만 PROGRAM_MAP 으로 읽는다(클라이언트 미노출).
//
//   ── "자세하게" 강화(2026-06) ──
//   출력이 1~3문장으로 얇다는 불만 → 키워드/grounding 에서 정황·의의·성찰을 더 풀어 쓰도록
//   각 docType 프롬프트를 보강했다. 핵심 원칙(ENRICH_RULE): "자세하게 = 사실에서 출발해
//   정황·의의·아쉬움까지 다문장으로 푸는 것"이지, 없는 고유명사·수치·강사명·인용을 지어내는
//   게 아니다. 분량은 HWPX 셀 용량을 넘지 않게 항목별 글자수 가이드로 통제한다.
//   (셀 용량 근거: 서식6 결과보고서가 4셀 1,100~1,300자로 정상 렌더 → 작동셀당 ~300자 기준.)
// ═══════════════════════════════════════════════════════════════

// 노드트리 문화예술교육 철학 — 글의 관점·톤에 반영(없는 사실을 만들라는 뜻은 아님).
const NODETREE_PHILOSOPHY =
  '【노드트리 문화예술교육 철학 — 글의 관점·톤에 녹여라】 ' +
  '문화예술교육은 프로그램 운영 자체가 목적이 아니라, 주민이 주도하는 생활문화 거점을 함께 만들어가는 과정이다. ' +
  '세대와 세대가 만나는 자리에서 주민과 예술가가 하나의 사건 안에서 공동으로 발화하며("마을 만들기가 곧 예술 만들기"), ' +
  '예술은 일상의 경험(존 듀이)에서 출발해 그 마을의 사라진 이야기를 사회적으로 복원한다. ' +
  '핵심 흐름은 "만들기 → 채우기 → 나누기 → 지속하기"이고, 사용자가 직접 만든 공간·프로그램은 다르게 작동한다. ' +
  '참여자의 주체성, 세대 간 협력, 일상·기억·관계의 가치를 담되 과장·홍보 수사는 피한다.';

// "자세하게 쓰되 날조하지 마라" 공통 규칙 — 모든 docType user 프롬프트에 삽입.
//   참고 총평(출장 결과보고서) 톤: 사실(키워드)에서 출발해 3인칭 공문 톤으로 정황·의의·성찰을
//   다문장으로 풀되, 없는 고유명사·수치를 만들지 않는다.
const ENRICH_RULE =
  '【자세하게 쓰는 법 — 반드시 지켜라】 ' +
  '제공된 키워드·프로그램 정보를 단답으로 나열하지 말고, 각 키워드가 어떤 활동·정황으로 이어졌는지, ' +
  '그것이 참여자와 마을에 어떤 의의가 있었는지, 그리고 운영상 보완하면 좋았을 점(성찰)까지 ' +
  '3인칭 공문 톤의 여러 문장으로 풀어 서술하라. 예: 단순히 "오리엔테이션 진행"이 아니라 ' +
  '"오리엔테이션을 통해 …한 자리를 가졌다. …를 공유하는 과정에서 …라는 점에서 의미가 있었다. ' +
  '다만 …했다면 더 좋았을 것이다." 처럼 정황·의의·아쉬움을 담아 풍부하게 쓴다. ' +
  '【단, 절대 지킬 환각 금지】 "자세하게"는 정황·의의·성찰을 더 풀어 쓰는 것이지, ' +
  '근거(키워드·프로그램 정보)에 없는 새로운 고유명사·인명(특히 외부 특강 강사명)·기관명·수치·인용·' +
  '날짜를 지어내는 것이 절대 아니다. 근거에 명시된 이름·수치만 사용하고, 모르는 구체값은 ' +
  '일반적 서술로 대체하거나 비워 둔다. 성찰·평가성 서술은 허용하되 사실 날조는 금지한다.';

// 제공된 정보에만 근거하도록 강하게 제약하는 시스템 가드.
const SYSTEM_GUARD =
  '너는 꿈다락 문화예술학교 문서 작성 도우미다. ' +
  NODETREE_PHILOSOPHY + ' ' +
  '아래 제공된 프로그램 정보·회차 맥락·키워드에만 근거해 사실적으로 쓴다. ' +
  '제공되지 않은 사실·수치·이름을 지어내지 마라. 한국어 공문 톤, 과장·홍보문구 금지. ' +
  '단, 각 항목은 단답이 아니라 정황·의의·성찰을 담은 풍부한 다문장으로 쓰되 지정한 분량 가이드를 지킨다. ' +
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
//   세부내용·평가 3종을 풍부하게(차시 활동 흐름 단계적 / 운영·반응·보완 정황 있게).
//   교육목표·교육재료는 간결 유지(셀 용량·균형). 셀 용량 고려한 항목별 글자수 가이드.
function buildChulgangMessages({ program, 회차, 교육주제, 키워드 }) {
  const ctx = programContext(program);
  const user = [
    ctx,
    회차 ? `회차: ${회차}` : '',
    교육주제 ? `교육주제: ${교육주제}` : '',
    키워드 ? `키워드: ${키워드}` : '',
    '',
    ENRICH_RULE,
    '',
    '위 정보에만 근거해 출강확인서 본문을 작성하라. 아래 JSON 형식으로만 출력한다:',
    '{"교육목표":"…","세부내용":"…","교육재료":"…","평가_운영":"…","평가_반응":"…","평가_보완":"…"}',
    '항목별 작성 가이드(분량은 한글 셀 용량을 넘지 않도록 지킬 것):',
    '· 교육목표 = 이 회차에서 참여자가 달성할 목표를 1~2문장으로 간결히(60~120자).',
    '· 세부내용 = 이 회차 활동을 시작→전개→마무리의 흐름으로 단계적으로 서술하라. ' +
      '무엇을 어떻게 진행했고 참여자가 어떤 과정을 거쳤는지 구체적으로(3~5문장, 200~350자).',
    '· 교육재료 = 사용한 재료·도구를 쉼표로 나열(짧게, 40~100자). 근거에 없으면 일반적 재료로.',
    '· 평가_운영 = 운영 측면(진행·시간·안전·준비 등)을 정황 있게(2~3문장, 120~200자).',
    '· 평가_반응 = 참여자의 태도·몰입·세대 간 교류 등 반응을 구체적으로(2~3문장, 120~200자).',
    '· 평가_보완 = 다음 회차를 위해 보완하면 좋을 점을 성찰적으로(2~3문장, 120~200자). ' +
      '날조 없이 운영상 일반적으로 개선 가능한 지점을 제안형으로.',
    '한국어 공문 톤, 3인칭 평서체. 근거에 없는 강사명·수치·고유명사를 지어내지 마라.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// hoeuirok: 안건 배열 JSON 지시(최대 5)
//   각 결정사항을 단답→"논의 맥락 한 문장 + 결정" 으로 풍부하게.
//   결정1/결정2 는 회의록 셀(짧은 셀)이라 각 한두 문장(40~90자)로 통제.
function buildHoeuirokMessages({ program, 회의주제, 키워드 }) {
  const ctx = programContext(program);
  const user = [
    ctx,
    회의주제 ? `회의주제: ${회의주제}` : '',
    키워드 ? `키워드: ${키워드}` : '',
    '',
    ENRICH_RULE,
    '',
    '위 정보에만 근거해 회의록의 논의안건을 작성하라(최대 5개). 아래 JSON 형식으로만 출력한다:',
    '{"안건":[{"제목":"…","결정1":"…","결정2":"…"}]}',
    '작성 가이드:',
    '· 제목 = 안건명을 명사구로 간결히(15~40자).',
    '· 결정1, 결정2 = 단순 단답이 아니라 "논의 맥락 한 문장 + 결정사항"을 한 줄에 담아 ' +
      '서술하라. 예: "참여자 출결 편차가 논의되었고, 차시별 사전 안내 문자를 발송하기로 함." ' +
      '각 줄 40~90자, 한국어 공문 톤. 줄바꿈은 넣지 말 것(셀에서 렌더 안 됨).',
    '안건이 적으면 무리하게 늘리지 말고 실제 논의될 만한 것만(2~5개). ' +
      '근거에 없는 강사명·수치·고유명사를 지어내지 마라.',
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
//   이미 가장 풍부함 → 유지하되 키워드 적극 반영 + 상한 소폭 상향(1,100~1,400자).
function buildGyeolgwaMessages({ program, 키워드, reportMonth }) {
  const ctx = programContext(program);
  const tense = reportMonth
    ? `보고 기준 시점: ${reportMonth}. 이 시점에 아직 시작하지 않았거나 진행 예정인 활동은 계획·예정형(\"~할 예정이다/~한다\")으로, 이미 끝난 회차는 과거형(\"~하였다\")으로 시제를 구분해 서술하라.`
    : '아직 시작 전인 활동은 계획·예정형으로, 끝난 활동은 과거형으로 시제를 구분하라.';
  const user = [
    ctx,
    키워드 ? `키워드: ${키워드}` : '',
    '',
    ENRICH_RULE,
    '',
    '위 「프로그램 정보」 grounding 본문에만 근거해 서식6 결과보고서의 「기획·개발 세부내용」을 작성하라.',
    '입력된 키워드가 있으면 각 키워드를 본문 곳곳에 적극적으로 녹여 구체적 정황으로 풀어 쓰라.',
    '세부내용은 5개 번호 소제목으로 구성되며, 이를 아래 4개 JSON 키에 다음과 같이 나눠 담는다:',
    '{"내용_역할":"…","내용_과정":"…","내용_실행":"…","내용_평가":"…"}',
    '· 내용_역할 = [소제목1] 기획·개발 참여인력 역할 — 참여인력(주강사) 1인당 1~2문장으로 역할을 구체적으로 기술.',
    '· 내용_과정 = [소제목2] 대상 분석(2~3문장)을 먼저 쓰고, 이어 [소제목3] 기획개발 과정을 ' +
      '○발상 / ○개발 / ○관리 세 부분으로 가장 길고 구체적으로(이 키 전체 600~780자) 작성. ' +
      '세 부분은 같은 줄에 \"○발상: … ○개발: … ○관리: …\" 형태로 ○ 머리표를 구분자로 이어 쓴다. ' +
      '줄바꿈(개행)은 셀에서 렌더되지 않으니 사용하지 말고, ○ 머리표로만 단락을 구분하라.',
    '· 내용_실행 = [소제목4] 프로그램 실행 계획 — 정황 있게 3~5문장(180~280자).',
    '· 내용_평가 = [소제목5] 평가 및 성과 계획 — 같은 줄에 \"○피드백: … ○학습성과: …\" 형태로 ○ 머리표를 구분자로 이어 쓴다(줄바꿈 금지). 각 머리표 2~3문장으로 의의·성찰까지.',
    '',
    '제약: ① 4개 키 합산 분량 1,100~1,400자 수준의 연구보고서 톤. ② ' + tense,
    '③ grounding 본문에 없는 고유명사·수치·인용·강사명(특히 외부 특강 강사명)을 절대 지어내지 마라. ' +
      'grounding에 명시된 이름·수치만 사용하고, 근거가 없으면 그 부분은 일반적 서술로 비워 둔다. ' +
      '④ 평가·성찰성 서술은 풀어 쓰되(의의·아쉬운 점) 그것이 "사실 날조"가 되어선 안 된다. ' +
      '⑤ 3인칭 평서체. ⑥ 과장·홍보 수사 금지. ⑦ 각 값 내부에 줄바꿈 금지 — ○ 머리표로만 구분. ⑧ JSON 외 텍스트·코드펜스 금지.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_GUARD },
    { role: 'user', content: user },
  ];
}

// 검수조서(일반용역비) — 검수의견 2~4문장(프로그램명·산출물·검수결과 grounding).
//   근거(산출물·과정·증빙) 있는 다문장으로 강화. 결과 라벨(합격/보완 후 합격/불합격)에 맞춰 톤.
//   환각가드: grounding/입력에 없는 사실 금지.
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
    ENRICH_RULE,
    '',
    '위 정보에만 근거해 일반용역비 검수조서의 「검수의견」을 작성하라. 아래 JSON 형식으로만 출력한다:',
    '{"검수의견":"…"}',
    '작성 가이드: 1~2문장 단답이 아니라 2~4문장(140~260자)으로, ' +
      '① 계약·과업 내용대로 수행되었는지 ② 산출물의 품질·규격·완성도 ③ 과정·증빙의 충실성을 ' +
      '근거 있게 서술한다. 예: \"기획·개발 과업이 계약 내용대로 성실히 수행되었음을 확인하였다. ' +
      '산출물의 품질과 규격이 사업 목적에 부합하며 완성도가 적정한 수준이다. 수행 과정과 결과 ' +
      '증빙이 충실히 갖추어져 있어 검수에 이상이 없음을 확인하였다.\"',
    '검수결과가 \"보완 후 합격\"이면 합격 사유와 함께 보완 필요사항을, ' +
      '\"불합격\"이면 미흡 사유를 구체적으로 덧붙인다. ' +
      '근거에 없는 구체 수치·인명·기관명은 지어내지 말고 일반적 서술로 대체하라. 3인칭 평서체, 한국어 공문 톤.',
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
//   maxTokens: 한국어는 토큰 밀도가 높아 풍부한 출력은 truncation 위험 → docType 별 상향.
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
    // 6칸(세부내용·평가 3종 풍부) → 한국어 토큰 밀도 고려 상향(truncation 방지).
    messages = buildChulgangMessages({
      program,
      회차: body.회차,
      교육주제: body.교육주제,
      키워드: body.키워드,
    });
    maxTokens = 3500;
  } else if (docType === 'hoeuirok') {
    // 안건 최대 5개 × (제목+결정2) 풍부 → 상향.
    messages = buildHoeuirokMessages({
      program,
      회의주제: body.회의주제,
      키워드: body.키워드,
    });
    maxTokens = 3000;
  } else if (docType === 'inspection') {
    // 검수의견 2~4문장 → 기본 2000 충분하나 여유.
    messages = buildInspectionMessages({
      program,
      용역명: body.용역명,
      산출물: body.산출물,
      검수결과: body.검수결과,
      키워드: body.키워드,
    });
    maxTokens = 2000;
  } else {
    // gyeolgwa: 1,100~1,400자 narrative + JSON 래핑 → 토큰 여유 확대(truncation 방지).
    messages = buildGyeolgwaMessages({
      program,
      키워드: body.키워드,
      reportMonth: body.reportMonth,
    });
    maxTokens = 4500;
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
