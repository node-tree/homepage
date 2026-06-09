// ═══════════════════════════════════════════════════════════════
// 이소 異素 — ImageKit 관리자 API 클라이언트 (admin 전용)
//   · 사이트 세션 토큰('auth_token', Authorization: Bearer)으로 백엔드를 호출한다.
//   · 백엔드는 auth + adminOnly 로 보호된다 → 401(미인증/만료) / 403(비admin) 구분.
//   · 업로드는 백엔드 /auth 서명을 받아 ImageKit upload 엔드포인트로 직접 multipart POST.
//     (ImageKit upload 에는 Bearer 가 아니라 서명 triple + publicKey 를 보낸다.)
//   · 자체 DB 저장 없음 — 반환 URL 만 화면에서 사용.
// ═══════════════════════════════════════════════════════════════

const isNodeTreeSite =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' ||
    window.location.hostname === 'www.nodetree.kr');

const API_BASE_URL = isNodeTreeSite
  ? '/api'
  : process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const IK_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface IkAuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

export interface IkFile {
  fileId: string;
  name: string;
  filePath: string;
  url: string;
  thumbnail?: string;
  fileType: string;
  size: number;
  height?: number;
  width?: number;
  createdAt: string;
}

export interface IkUploadResult {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  thumbnailUrl?: string;
  height?: number;
  width?: number;
  size?: number;
}

// 401(미인증/만료) → AUTH_EXPIRED(로그인 유도), 403(비admin) → FORBIDDEN(안내).
// 두 경우를 구분해야 비admin 에게 잘못된 "다시 로그인" 안내를 피할 수 있다.
async function handleAuthErrors(response: Response): Promise<void> {
  if (response.status === 403) {
    const err = new Error('관리자 권한이 필요합니다.') as Error & { code?: string };
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (response.status === 401) {
    const err = new Error('인증이 만료되었습니다. 다시 로그인해주세요.') as Error & {
      code?: string;
    };
    err.code = 'AUTH_EXPIRED';
    throw err;
  }
}

export const imagekitAdminAPI = {
  // 업로드 서명 파라미터 + 공개값 조회 (백엔드 → ImageKit)
  getAuthParams: async (signal?: AbortSignal): Promise<IkAuthParams> => {
    const res = await fetch(`${API_BASE_URL}/imagekit/auth`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    await handleAuthErrors(res);
    if (!res.ok) throw new Error(`서명 파라미터 조회 실패 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error('서명 파라미터 응답이 올바르지 않습니다.');
    return data as IkAuthParams;
  },

  // 미디어 라이브러리 목록 조회
  listFiles: async (
    params: { path?: string; searchQuery?: string; skip?: number; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<IkFile[]> => {
    const qs = new URLSearchParams();
    if (params.path) qs.set('path', params.path);
    if (params.searchQuery) qs.set('searchQuery', params.searchQuery);
    if (typeof params.skip === 'number') qs.set('skip', String(params.skip));
    if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
    const res = await fetch(`${API_BASE_URL}/imagekit/list?${qs.toString()}`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    await handleAuthErrors(res);
    if (!res.ok) throw new Error(`목록 조회 실패 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error('목록 응답이 올바르지 않습니다.');
    return (data.files || []) as IkFile[];
  },

  // 파일 삭제
  deleteFile: async (fileId: string, signal?: AbortSignal): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/imagekit/file/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
      signal,
    });
    await handleAuthErrors(res);
    if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error('삭제 응답이 올바르지 않습니다.');
  },

  // ImageKit 업로드 엔드포인트로 직접 multipart POST.
  //   서명 파라미터는 매 업로드마다 새로 받아 만료를 피한다.
  uploadFile: async (
    blob: Blob,
    fileName: string,
    opts: { folder?: string; useUniqueFileName?: boolean } = {}
  ): Promise<IkUploadResult> => {
    const authParams = await imagekitAdminAPI.getAuthParams();

    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('fileName', fileName);
    form.append('publicKey', authParams.publicKey);
    form.append('signature', authParams.signature);
    form.append('expire', String(authParams.expire));
    form.append('token', authParams.token);
    form.append('useUniqueFileName', String(opts.useUniqueFileName !== false));
    if (opts.folder) form.append('folder', opts.folder);

    const res = await fetch(IK_UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
      let msg = `업로드 실패 (${res.status})`;
      try {
        const errData = await res.json();
        if (errData?.message) msg = errData.message;
      } catch {
        /* noop */
      }
      throw new Error(msg);
    }
    return (await res.json()) as IkUploadResult;
  },
};
