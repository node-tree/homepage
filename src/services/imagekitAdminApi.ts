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
    window.location.hostname === 'www.nodetree.kr' ||
    window.location.hostname === 'isoartlab.com' ||
    window.location.hostname === 'www.isoartlab.com');

const API_BASE_URL = isNodeTreeSite
  ? '/api'
  : process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const IK_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  // 사이트 admin 토큰 우선, 없으면 꿈다락 편집 토큰 폴백(aiApi.ts 와 동일 패턴).
  // 백엔드(imagekit)는 읽기·업로드서명·폴더생성에 한해 두 토큰을 모두 허용한다.
  const token =
    localStorage.getItem('auth_token') || localStorage.getItem('kkumdarak_token');
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

// ImageKit listFiles 응답 항목.
//   · 파일(type:'file'): fileId/url/size/fileType 등 보유.
//   · 폴더(type:'folder'): folderId/folderPath 만 있고 url/size/fileType 는 없다.
//   파일/폴더 공통으로 다루기 위해 폴더 전용 필드와 type 을 optional 로 둔다.
export interface IkFile {
  // 파일 전용 (폴더 항목엔 없을 수 있음)
  fileId: string;
  url: string;
  fileType: string;
  size: number;
  thumbnail?: string;
  height?: number;
  width?: number;
  // 공통
  name: string;
  filePath: string;
  createdAt: string;
  // 항목 종류 — 'file' | 'folder' (구버전/검색 응답엔 없을 수 있어 optional)
  type?: 'file' | 'folder';
  // 폴더 전용
  folderId?: string;
  folderPath?: string;
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

// 라이브러리 사용 용량 — 현재 버전 파일(type:'file') 합계 기준.
export interface IkUsage {
  totalBytes: number;
  fileCount: number;
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

  // 사용 용량 조회 (백엔드가 type:'file' 전체를 페이지네이션 합산)
  getUsage: async (signal?: AbortSignal): Promise<IkUsage> => {
    const res = await fetch(`${API_BASE_URL}/imagekit/usage`, {
      method: 'GET',
      headers: authHeaders(),
      signal,
    });
    await handleAuthErrors(res);
    if (!res.ok) throw new Error(`용량 조회 실패 (${res.status})`);
    const data = await res.json();
    if (!data.success) throw new Error('용량 응답이 올바르지 않습니다.');
    return {
      totalBytes: Number(data.totalBytes) || 0,
      fileCount: Number(data.fileCount) || 0,
    };
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

  // 폴더 삭제 (안의 파일/하위폴더까지 모두 재귀 삭제). folderPath 는 body 로 전달.
  deleteFolder: async (folderPath: string, signal?: AbortSignal): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/imagekit/folder`, {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ folderPath }),
      signal,
    });
    await handleAuthErrors(res);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || `폴더 삭제 실패 (${res.status})`);
    }
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

  // 현재 경로 아래에 새 폴더 생성 (백엔드 → ImageKit createFolder).
  createFolder: async (
    folderName: string,
    parentFolderPath: string = '/',
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/imagekit/folder`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ folderName, parentFolderPath }),
      signal,
    });
    await handleAuthErrors(res);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || `폴더 생성 실패 (${res.status})`);
    }
  },
};
