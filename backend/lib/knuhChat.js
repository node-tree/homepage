// ═══════════════════════════════════════════════════════════════
// KNUH(factchat) chat 클라이언트 — 얇은 HTTP 래퍼.
//   · OpenAI 호환 chat/completions. 프롬프트 구성·파싱은 라우트가 담당(여기는 전송만).
//   · 모델 기본 gpt-5.4(chat 모델). codex 계열은 /responses 가 필요하므로 여기서 쓰지 않음.
//   · KNUH_API_KEY 미설정 시 code 'KNUH_NO_KEY' 로 throw → 라우트가 503 으로 안내.
//   · node18+ 전역 fetch 사용, 30s AbortController 타임아웃(성공/실패 모두 clearTimeout).
// ═══════════════════════════════════════════════════════════════

const KNUH_ENDPOINT = 'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions';
const DEFAULT_MODEL = process.env.KNUH_CHAT_MODEL || 'gpt-5.4';
const TIMEOUT_MS = 30000;

// messages: [{role, content}], options: { model?, maxTokens? } → content 문자열 반환.
async function chat(messages, { model, maxTokens } = {}) {
  const apiKey = process.env.KNUH_API_KEY;
  if (!apiKey) {
    const err = new Error('KNUH_API_KEY 환경변수가 설정되지 않았습니다.');
    err.code = 'KNUH_NO_KEY';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(KNUH_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: maxTokens || 2000, // OpenAI 호환: snake_case 필수
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`KNUH 호출 실패 (${response.status})${text ? `: ${text.slice(0, 300)}` : ''}`);
      err.code = 'KNUH_HTTP_ERROR';
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : undefined;
    if (typeof content !== 'string') {
      const err = new Error('KNUH 응답에서 본문(choices[0].message.content)을 찾지 못했습니다.');
      err.code = 'KNUH_BAD_RESPONSE';
      throw err;
    }
    return content;
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('KNUH 호출 시간 초과(30초).');
      err.code = 'KNUH_TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// content 문자열 → JSON 객체. 코드펜스(```json … ```) 제거 + 첫 '{'~마지막 '}' 폴백.
//   성공 → { parsed: obj, raw: content }, 실패 → { parsed: null, raw: content }.
//   (라우트·node-e 에서 단독 검증 가능한 순수 함수)
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

module.exports = { chat, parseJsonContent, KNUH_ENDPOINT, DEFAULT_MODEL };
