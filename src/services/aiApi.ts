// ═══════════════════════════════════════════════════════════════
// AI 글쓰기 API 클라이언트 — POST /api/ai/write
//   · 인증: 사이트 세션(auth_token) 우선, 없으면 꿈다락 편집 토큰(kkumdarak_token).
//     백엔드가 둘 중 하나면 통과시키므로, 가진 토큰을 그대로 보낸다.
//   · KNUH 유료 크레딧 → 백엔드가 인증 게이팅. 비로그인 호출은 401.
// ═══════════════════════════════════════════════════════════════

const isNodeTreeSite =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr');

const API_BASE_URL = isNodeTreeSite
  ? '/api'
  : process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

function aiToken(): string | null {
  try {
    return localStorage.getItem('auth_token') || localStorage.getItem('kkumdarak_token');
  } catch {
    return null;
  }
}

export type AiContext = 'village-diary' | 'artwork' | 'general';

export interface AiWriteParams {
  mode: 'write' | 'refine';
  topic?: string;
  keywords?: string;
  originalText?: string;
  context?: AiContext;
  format?: 'plain' | 'html';
  // 마을일기: 프로그램 맥락 주입용(백엔드가 kkumdarakPrograms.js 에서 조회).
  programId?: string;
  programName?: string;
}

export const aiAPI = {
  hasAuth: (): boolean => !!aiToken(),

  // 입력 길이 한도(백엔드와 동일) — 서버 도달 전 한국어 안내로 사전 차단.
  MAX_REFINE: 8000,
  MAX_SUBJECT: 2000,

  write: async (params: AiWriteParams): Promise<string> => {
    // 사전 길이 캡(백엔드와 동일 한도). 크레딧 보호 + 즉시 안내.
    if (params.mode === 'refine' && (params.originalText || '').trim().length > 8000) {
      throw new Error('원문이 너무 깁니다(최대 8000자).');
    }
    if (params.mode === 'write') {
      const subject = [params.topic, params.keywords].filter(Boolean).join(' / ').trim();
      if (subject.length > 2000) {
        throw new Error('주제가 너무 깁니다(최대 2000자).');
      }
    }
    const token = aiToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/ai/write`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const msg =
        res.status === 401
          ? '로그인이 필요합니다.'
          : data.message || `AI 글 생성에 실패했습니다 (${res.status}).`;
      throw new Error(msg);
    }
    return (data.text || '').trim();
  },
};

export default aiAPI;
