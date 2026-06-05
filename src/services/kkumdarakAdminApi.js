// ═══════════════════════════════════════════════════════════════
// 꿈다락 사업관리(회계) API 클라이언트
//   · 백엔드 라우트가 router.use(requireKkumdarakAuth) 로 읽기까지 보호하므로,
//     공개 GET 가 아니라 villageDiaryAPI.save() 와 동일하게
//     Authorization: Bearer <kkumdarak_token> 을 직접 싣는다.
//   · 토큰 헬퍼(getKkumdarakToken/clearKkumdarakToken)와 API_BASE_URL 규칙은
//     기존 api.js 의 villageDiaryAPI 를 그대로 재사용(중복 구현 방지).
//   · 401/403(만료·무효) → clearKkumdarakToken() 후 code 'KKUM_AUTH_EXPIRED' 로 throw
//     (api.js villageDiaryAPI.save() 와 동일한 401 처리 방식).
// ═══════════════════════════════════════════════════════════════

import { villageDiaryAPI } from './api';

// API_BASE_URL 산정 규칙은 api.js 와 동일하게 유지(별도 import 노출이 없어 동일 로직 복제).
const isNodeTreeSite =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' ||
    window.location.hostname === 'www.nodetree.kr');

const API_BASE_URL = isNodeTreeSite
  ? '/api'
  : process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

function authHeaders(extra) {
  const token = villageDiaryAPI.getKkumdarakToken();
  const headers = { ...(extra || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleAuthExpiry() {
  villageDiaryAPI.clearKkumdarakToken();
  const err = new Error('꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.');
  err.code = 'KKUM_AUTH_EXPIRED';
  return err;
}

// 공통 응답 처리: 401/403 → 만료 throw, !ok → 메시지 throw, 그 외 파싱 후 success 확인.
async function parseJsonResponse(response, failMessage) {
  if (response.status === 401 || response.status === 403) {
    throw handleAuthExpiry();
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `${failMessage} (${response.status})`);
  }
  const data = await response.json();
  if (!data || !data.success) {
    throw new Error(`${failMessage}: 응답이 올바르지 않습니다.`);
  }
  return data;
}

export const kkumdarakAdminAPI = {
  // GET /api/kkumdarak/budget/summary
  //   비목별 {편성액·집행액·잔액·진척%} + 일반수용비 세세목 + 편성제한 검증결과.
  //   반환: 백엔드 응답의 data 객체(없으면 null).
  getBudgetSummary: async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/budget/summary`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    const data = await parseJsonResponse(response, '예산 요약 조회 실패');
    return data.data || null;
  },

  // GET /api/kkumdarak/transactions — 목록 + 필터.
  //   filters: { majorCode?, month?(YYYY-MM), paymentMethod?, status? } (빈 값은 제외)
  //   반환: 트랜잭션 배열(없으면 []).
  getTransactions: async (filters = {}, { signal } = {}) => {
    const qs = new URLSearchParams();
    ['majorCode', 'month', 'paymentMethod', 'status'].forEach((k) => {
      const v = filters[k];
      if (v) qs.append(k, v);
    });
    const query = qs.toString();
    const url = `${API_BASE_URL}/kkumdarak/transactions${query ? `?${query}` : ''}`;
    const response = await fetch(url, { method: 'GET', headers: authHeaders(), signal });
    const data = await parseJsonResponse(response, '집행 목록 조회 실패');
    return Array.isArray(data.data) ? data.data : [];
  },

  // POST /api/kkumdarak/transactions — 생성.
  //   반환: { data(저장된 건), warnings([]) } — warnings 는 차단 아닌 경고이므로 보존.
  createTransaction: async (payload) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, '집행 건 저장 실패');
    return { data: data.data || null, warnings: data.warnings || [] };
  },

  // PUT /api/kkumdarak/transactions/:id — 수정.
  //   반환: { data(수정된 건), warnings([]) }.
  updateTransaction: async (id, payload) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, '집행 건 수정 실패');
    return { data: data.data || null, warnings: data.warnings || [] };
  },

  // DELETE /api/kkumdarak/transactions/:id — 삭제.
  deleteTransaction: async (id) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, '집행 건 삭제 실패');
    return data.data || null;
  },

  // ── 프로그램·실적 ───────────────────────────────────────────────────────────

  // GET /api/kkumdarak/programs — 7개 프로그램 + 실적(실참여·등록회차·잔여·주강사 등). 배열 반환.
  getPrograms: async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/programs`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    const data = await parseJsonResponse(response, '프로그램 조회 실패');
    return Array.isArray(data.data) ? data.data : [];
  },

  // PUT /api/kkumdarak/programs/:key — 가변값 수정. 수정된 도큐먼트 반환.
  updateProgram: async (key, payload) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/programs/${key}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, '프로그램 수정 실패');
    return data.data || null;
  },

  // GET /api/kkumdarak/sessions?programKey= — 회차 목록. 배열 반환.
  getSessions: async (programKey, { signal } = {}) => {
    const qs = programKey ? `?programKey=${encodeURIComponent(programKey)}` : '';
    const response = await fetch(`${API_BASE_URL}/kkumdarak/sessions${qs}`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    const data = await parseJsonResponse(response, '회차 조회 실패');
    return Array.isArray(data.data) ? data.data : [];
  },

  // POST /api/kkumdarak/sessions — 회차 등록(attendance 포함). 저장된 도큐먼트 반환.
  createSession: async (payload) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/sessions`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, '회차 등록 실패');
    return data.data || null;
  },

  // DELETE /api/kkumdarak/sessions/:id — 회차 삭제.
  deleteSession: async (id) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, '회차 삭제 실패');
    return data.data || null;
  },

  // GET /api/kkumdarak/dashboard/summary — 대시보드 집계. data 객체 반환.
  getDashboardSummary: async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/dashboard/summary`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    const data = await parseJsonResponse(response, '대시보드 집계 조회 실패');
    return data.data || null;
  },

  // ── 문서/서식 ───────────────────────────────────────────────────────────────

  // POST /api/kkumdarak/forms/chulgang — 출강확인서(서식5) HWPX 다운로드.
  //   body = 클라이언트가 조립한 21개 플레이스홀더 값. binary(blob) 응답.
  //   401/403 은 동일 만료 처리, !ok 는 JSON 에러 메시지.
  downloadChulgangForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/chulgang`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `출강확인서 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // POST /api/kkumdarak/forms/hoeuirok — 회의록(서식7) HWPX 다운로드.
  //   body = 클라이언트가 조립한 21개 플레이스홀더 값. binary(blob) 응답.
  //   401/403 은 동일 만료 처리, !ok 는 JSON 에러 메시지.
  downloadHoeuirokForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/hoeuirok`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `회의록 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // POST /api/kkumdarak/forms/ai-draft — KNUH AI 초안.
  //   body { docType, programKey, 회차?, 교육주제?, 회의주제?, 키워드 }.
  //   반환: { data(파싱된 JSON|null), raw?(파싱 실패 원문), message? }.
  //   401/403 만료 처리. 503(키 미설정·타임아웃 등)은 서버 message 를 그대로 throw.
  aiDraftForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/ai-draft`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `AI 초안 생성 실패 (${response.status})`);
    }
    const data = await response.json();
    if (!data || !data.success) {
      throw new Error('AI 초안 응답이 올바르지 않습니다.');
    }
    return { data: data.data || null, raw: data.raw || '', message: data.message || '' };
  },

  // 서식6 결과보고서 HWPX (blob)
  downloadGyeolgwaForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/gyeolgwa`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `결과보고서 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // 서식 제4-1호 사례비 지급내역서 — { month, rows[] } → xlsx blob.
  downloadSarebiForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/sarebi`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `사례비 지급내역서 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // 서식11 지출결의서 — body → hwpx blob.
  downloadJichulForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/jichul`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `지출결의서 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // 검수조서(일반용역비) — body(+ photo1/photo2 base64) → hwpx blob.
  downloadGeomsuForm: async (body) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/forms/geomsu`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}),
    });
    if (response.status === 401 || response.status === 403) {
      throw handleAuthExpiry();
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `검수조서 생성 실패 (${response.status})`);
    }
    return response.blob();
  },

  // ── 체크리스트(인건비·정산 상태) ───────────────────────────────────────────
  getChecklist: async (key, { signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/checklist/${key}`, {
      method: 'GET', headers: authHeaders(), signal,
    });
    const data = await parseJsonResponse(response, '체크리스트 조회 실패');
    return data.data || { template: null, checked: {} };
  },
  saveChecklist: async (key, checked) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/checklist/${key}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ checked }),
    });
    const data = await parseJsonResponse(response, '체크리스트 저장 실패');
    return (data.data && data.data.checked) || {};
  },

  // ── 증빙(Google Drive) ──────────────────────────────────────────────────────
  // ── 증빙 라이브러리(독립 메뉴) ──────────────────────────────────────────────
  getEvidences: async (majorCode, { signal } = {}) => {
    const qs = majorCode ? `?majorCode=${encodeURIComponent(majorCode)}` : '';
    const response = await fetch(`${API_BASE_URL}/kkumdarak/evidences${qs}`, {
      method: 'GET', headers: authHeaders(), signal,
    });
    const data = await parseJsonResponse(response, '증빙 목록 조회 실패');
    return data.data || [];
  },
  uploadEvidenceFile: async (payload) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/evidences`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, '증빙 업로드 실패');
    return data.data || null;
  },
  downloadEvidenceFile: async (id) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/evidences/${id}/download`, {
      method: 'GET', headers: authHeaders(),
    });
    if (response.status === 401 || response.status === 403) throw handleAuthExpiry();
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      throw new Error(e.message || `다운로드 실패 (${response.status})`);
    }
    return response.blob();
  },
  deleteEvidenceFile: async (id) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/evidences/${id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, '증빙 삭제 실패');
    return data.data || null;
  },

  // 비목별 필수 증빙 체크리스트 { lineKey: [서식…] }
  getEvidenceChecklist: async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/evidence/checklist`, {
      method: 'GET', headers: authHeaders(), signal,
    });
    const data = await parseJsonResponse(response, '증빙 체크리스트 조회 실패');
    return data.data || {};
  },
  // 증빙 파일 업로드(base64) → Drive. 미설정 시 503 메시지 throw.
  uploadEvidence: async (txId, { file, filename, formCode }) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions/${txId}/evidence`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ file, filename, formCode }),
    });
    const data = await parseJsonResponse(response, '증빙 업로드 실패');
    return data.data || null;
  },
  deleteEvidence: async (txId, evId) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions/${txId}/evidence/${evId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, '증빙 삭제 실패');
    return data.data || null;
  },
  // GridFS 에서 증빙 파일 다운로드(blob)
  downloadEvidence: async (txId, evId) => {
    const response = await fetch(`${API_BASE_URL}/kkumdarak/transactions/${txId}/evidence/${evId}/download`, {
      method: 'GET', headers: authHeaders(),
    });
    if (response.status === 401 || response.status === 403) throw handleAuthExpiry();
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      throw new Error(e.message || `증빙 다운로드 실패 (${response.status})`);
    }
    return response.blob();
  },
};

export default kkumdarakAdminAPI;
