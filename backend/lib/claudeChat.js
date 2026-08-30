// ═══════════════════════════════════════════════════════════════
// Claude(Anthropic) chat 클라이언트 — 공식 SDK(@anthropic-ai/sdk) 얇은 래퍼.
//   · 2026-08-28 KNUH(factchat) 게이트웨이에서 이관. 게이트웨이 크레딧 소진으로 죽어 있던
//     AI 초안 기능을 Anthropic API 로 직결한다. 호출부(aiDraft.js·routes/ai.js)가 그대로
//     쓰도록 chat(messages, opts) 시그니처와 parseJsonContent 를 동일하게 유지했다.
//   · messages 는 OpenAI 스타일 [{role:'system'|'user'|'assistant', content}] 를 그대로 받아
//     Anthropic 형식(system 은 별도 파라미터)으로 여기서 변환한다.
//   · ANTHROPIC_API_KEY 미설정 시 code 'AI_NO_KEY' 로 throw → 라우트가 503 으로 안내.
//   · temperature 는 Opus 5 계열에서 제거된 파라미터라 보내지 않는다(400 사유).
//     대신 output_config.effort 로 사고 깊이·토큰 지출을 조절한다.
//   · max_tokens 는 사고(thinking) 토큰까지 함께 소진하므로 호출부가 준 출력 목표치의
//     2배(최소 8000)를 여유로 잡는다. 실제 과금은 쓴 만큼만.
// ═══════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || 'claude-opus-5';
// 서식 초안은 정형 문서라 low 로 충분하고, 서버리스 함수 시간·비용에 유리하다.
const DEFAULT_EFFORT = process.env.ANTHROPIC_CHAT_EFFORT || 'low';
const TIMEOUT_MS = 50000; // Vercel 함수 상한(60s) 안쪽
const THINKING_HEADROOM_MIN = 8000;
const MAX_TOKENS_CAP = 32000;

let client = null;
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    err.code = 'AI_NO_KEY';
    throw err;
  }
  if (!client) {
    // identity 연동 키(사용자 계정에 묶인 키)는 어느 워크스페이스에서 쓰는지 헤더로 밝혀야 한다.
    //   SDK 는 OAuth·페더레이션 경로에서만 ANTHROPIC_WORKSPACE_ID 를 읽으므로,
    //   API 키 인증에서는 여기서 직접 붙인다. 워크스페이스 전용 키면 생략해도 된다.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    client = new Anthropic({
      apiKey,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
      ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
    });
  }
  return client;
}

// [{role,content}] → { system, messages } 로 분리.
//   system 은 여러 개여도 줄바꿈으로 합쳐 한 덩어리로 만든다(캐시 프리픽스 안정).
//   Anthropic 은 첫 메시지가 user 여야 하므로 user 가 없으면 오류로 잡는다.
function splitMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const system = list
    .filter((m) => m && m.role === 'system')
    .map((m) => String(m.content || ''))
    .filter(Boolean)
    .join('\n\n');
  const rest = list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.content || '') }));
  if (!rest.length || rest[0].role !== 'user') {
    const err = new Error('대화 메시지에 user 역할이 없습니다.');
    err.code = 'AI_BAD_REQUEST';
    throw err;
  }
  return { system, messages: rest };
}

// messages: [{role, content}], options: { model?, maxTokens?, effort? } → content 문자열 반환.
async function chat(messages, { model, maxTokens, effort } = {}) {
  const anthropic = getClient();
  const { system, messages: turns } = splitMessages(messages);
  const budget = Number(maxTokens) || 2000;
  const max_tokens = Math.min(Math.max(budget * 2, THINKING_HEADROOM_MIN), MAX_TOKENS_CAP);

  let response;
  try {
    response = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens,
      output_config: { effort: effort || DEFAULT_EFFORT },
      ...(system ? { system } : {}),
      messages: turns,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      const err = new Error('Claude 호출 시간 초과(50초).');
      err.code = 'AI_TIMEOUT';
      throw err;
    }
    if (error instanceof Anthropic.AuthenticationError) {
      const err = new Error('Claude API 키가 유효하지 않습니다.');
      err.code = 'AI_AUTH_ERROR';
      throw err;
    }
    if (error instanceof Anthropic.RateLimitError) {
      const err = new Error('Claude API 호출 한도에 걸렸습니다. 잠시 후 다시 시도하세요.');
      err.code = 'AI_RATE_LIMIT';
      throw err;
    }
    if (error instanceof Anthropic.APIError) {
      const err = new Error(`Claude 호출 실패 (${error.status || '?'}): ${String(error.message).slice(0, 300)}`);
      err.code = 'AI_HTTP_ERROR';
      err.status = error.status;
      throw err;
    }
    throw error;
  }

  // 안전 정책상 거절 — 본문이 비므로 별도 코드로 올려 라우트가 안내하게 한다.
  if (response.stop_reason === 'refusal') {
    const err = new Error('Claude 가 이 요청에 대한 생성을 거절했습니다.');
    err.code = 'AI_REFUSAL';
    throw err;
  }

  const content = (response.content || [])
    .filter((block) => block && block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!content) {
    const err = new Error('Claude 응답에서 본문(text 블록)을 찾지 못했습니다.');
    err.code = 'AI_BAD_RESPONSE';
    throw err;
  }
  // 실사용 토큰 로그 — Vercel 로그에서 건당 실제 비용을 검산할 수 있게 남긴다.
  //   과금은 입력(사고 제외) + 출력(사고 포함) 기준.
  const u = response.usage || {};
  console.log(
    '[Claude]',
    response.model,
    '| in', u.input_tokens,
    '| out', u.output_tokens,
    '| stop', response.stop_reason
  );
  if (response.stop_reason === 'max_tokens') {
    console.warn('Claude 응답이 max_tokens 에서 잘렸습니다 — max_tokens:', max_tokens);
  }
  return content;
}

// content 문자열 → JSON 객체. 코드펜스(```json … ```) 제거 + 첫 '{'~마지막 '}' 폴백.
//   성공 → { parsed: obj, raw: content }, 실패 → { parsed: null, raw: content }.
//   (라우트·node -e 에서 단독 검증 가능한 순수 함수)
function parseJsonContent(content) {
  const raw = typeof content === 'string' ? content : String(content ?? '');
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch (e) {
      return undefined;
    }
  };

  // 1) 코드펜스 제거 후 시도
  let body = raw.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) body = fence[1].trim();

  let obj = tryParse(body);
  if (obj !== undefined) return { parsed: obj, raw };

  // 2) 첫 '{' ~ 마지막 '}' substring 폴백
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    obj = tryParse(body.slice(first, last + 1));
    if (obj !== undefined) return { parsed: obj, raw };
  }

  return { parsed: null, raw };
}

module.exports = { chat, parseJsonContent, DEFAULT_MODEL, DEFAULT_EFFORT };
