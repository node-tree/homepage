// ═══════════════════════════════════════════════════════════════
// 이소 異素 — ImageKit 관리자 API 클라이언트 (admin 전용)
//   · 사이트 세션 토큰('auth_token', Authorization: Bearer)으로 백엔드를 호출한다.
//   · 백엔드는 auth + adminOnly 로 보호된다 → 401(미인증/만료) / 403(비admin) 구분.
//   · 업로드는 백엔드 /auth 서명을 받아 ImageKit upload 엔드포인트로 직접 multipart POST.
//     (ImageKit upload 에는 Bearer 가 아니라 서명 triple + publicKey 를 보낸다.)
//   · 자체 DB 저장 없음 — 반환 URL 만 화면에서 사용.
// ═══════════════════════════════════════════════════════════════

import { clearSiteAuthStorage } from '../contexts/AuthContext';

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

// 폴더 트리/자동완성용 경량 항목 (GET /imagekit/folders)
export interface IkFolder {
  folderId?: string;
  name: string;
  folderPath: string;
  type: 'folder';
}

// 파일 상세 (GET /imagekit/file/:fileId) — 목록에 없는 tags/updatedAt/mime 포함.
export interface IkFileDetail extends IkFile {
  tags?: string[] | null;
  AITags?: { name: string; confidence: number; source: string }[] | null;
  mime?: string;
  updatedAt?: string;
  hasAlpha?: boolean;
  versionInfo?: { id: string; name: string };
}

// 일괄 이동 결과 — 부분 성공을 허용하므로 항목별 결과를 그대로 돌려받는다.
export interface IkBulkMoveResult {
  message: string;
  destinationPath: string;
  results: { sourceFilePath: string; ok: boolean; error?: string }[];
  refs?: IkRefsUpdate;
}

// 이동/이름변경 대상 경로를 참조하는 곳 — 자체 DB(자동 치환) + 소스코드(수동).
export interface IkRefItem {
  path: string;
  kind: string;
  db: { count: number; byCollection: Record<string, number>; refs: { collection: string; _id: string; field: string }[] };
  code: { count: number; refs: { file: string; line: number; path: string }[] };
}

export interface IkRefsResult {
  items: IkRefItem[];
  totalDb: number;
  totalCode: number;
  codeRefsGeneratedAt: string | null;
}

// 이동/이름변경 응답에 실린 DB 참조 갱신 결과.
export interface IkRefsUpdate {
  updated: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  batchId?: string;
  documents?: number;
  refsUpdated?: Record<string, number>;
  failures?: { collection: string; _id: string; error: string }[];
}

// moveFolder/renameFolder 는 비동기 작업(jobId) — 상태를 폴링해 완료를 확인한다.
export interface IkBulkJob {
  jobId: string;
  status?: string;
  type?: string;
  [k: string]: unknown;
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
    // 서버가 거부한 토큰(만료·서명 무효)은 즉시 정리한다. 남겨두면 isAuthenticated 가 true 로
    // 유지돼 /login 이 "이미 로그인됨"으로 홈에 튕겨내는 무한 루프가 된다(kkumdarak 토큰은
    // 자체 API 가 따로 정리하므로 여기서는 사이트 세션만 건드린다).
    clearSiteAuthStorage();
    const err = new Error('인증이 만료되었습니다. 다시 로그인해주세요.') as Error & {
      code?: string;
    };
    err.code = 'AUTH_EXPIRED';
    throw err;
  }
}

// 공통 JSON 호출 — 인증 헤더 + 401/403 처리 + 백엔드 message 그대로 전달.
//   백엔드는 ImageKit 원문 메시지를 내려주므로(키는 서버에서 마스킹) 사용자에게 그대로 보인다.
async function requestJson<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  fallbackMsg = '요청 실패'
): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method || 'GET',
    headers: authHeaders(hasBody ? { 'Content-Type': 'application/json' } : undefined),
    body: hasBody ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  await handleAuthErrors(res);
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data.success) {
    throw new Error(data?.message || `${fallbackMsg} (${res.status})`);
  }
  return data as T;
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
  //   · path 를 생략하면 라이브러리 전체(전역 검색). sort 는 백엔드 화이트리스트로 검증된다.
  listFiles: async (
    params: {
      path?: string;
      searchQuery?: string;
      skip?: number;
      limit?: number;
      sort?: string;
    } = {},
    signal?: AbortSignal
  ): Promise<IkFile[]> => {
    const qs = new URLSearchParams();
    if (params.path) qs.set('path', params.path);
    if (params.searchQuery) qs.set('searchQuery', params.searchQuery);
    if (typeof params.skip === 'number') qs.set('skip', String(params.skip));
    if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
    if (params.sort) qs.set('sort', params.sort);
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

  // 폴더 전용 목록 — 사이드 트리 지연 로드 / 경로 자동완성 소스.
  //   all:true 면 path 없이 조회(라이브러리 폴더 일괄).
  listFolders: async (
    params: { path?: string; all?: boolean } = {},
    signal?: AbortSignal
  ): Promise<IkFolder[]> => {
    const qs = new URLSearchParams();
    if (params.all) qs.set('all', '1');
    else if (params.path) qs.set('path', params.path);
    const data = await requestJson<{ folders: IkFolder[] }>(
      `/imagekit/folders?${qs.toString()}`,
      { signal },
      '폴더 목록 조회 실패'
    );
    return data.folders || [];
  },

  // 파일 상세 — 상세 패널(태그·해상도·수정일·버전) 용.
  getFileDetails: async (fileId: string, signal?: AbortSignal): Promise<IkFileDetail> => {
    const data = await requestJson<{ file: IkFileDetail }>(
      `/imagekit/file/${encodeURIComponent(fileId)}`,
      { signal },
      '파일 상세 조회 실패'
    );
    return data.file;
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
  //   · overwriteFile:true + useUniqueFileName:false + 같은 folder/fileName 이면
  //     기존 파일을 "같은 경로에 새 버전"으로 교체한다 → URL 이 유지돼 게시물이 깨지지 않는다.
  //     (이미지 편집 저장이 이 조합을 쓴다. 교체 후에는 반드시 purgeCache 로 CDN 을 비운다.)
  uploadFile: async (
    blob: Blob,
    fileName: string,
    opts: { folder?: string; useUniqueFileName?: boolean; overwriteFile?: boolean } = {}
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
    if (opts.overwriteFile !== undefined) {
      form.append('overwriteFile', String(opts.overwriteFile));
    }
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

  // ── 이동 · 이름변경 · 일괄 작업 ─────────────────────────────
  //   ⚠️ 모두 ImageKit URL(경로 기반)을 즉시 바꾼다 → 기존 URL 참조는 깨진다.
  //      호출측 UI 에서 반드시 경고를 노출할 것.

  // 파일 1건 이동 (destinationPath 는 "폴더" 경로)
  moveFile: async (
    sourceFilePath: string,
    destinationPath: string,
    signal?: AbortSignal
  ): Promise<{ refs?: IkRefsUpdate }> => {
    return await requestJson<{ refs?: IkRefsUpdate }>(
      '/imagekit/file/move',
      { method: 'POST', body: { sourceFilePath, destinationPath }, signal },
      '파일 이동 실패'
    );
  },

  // 파일 1건 복사 (원본 유지 — 용량 증가)
  copyFile: async (sourceFilePath: string, destinationPath: string, signal?: AbortSignal): Promise<void> => {
    await requestJson(
      '/imagekit/file/copy',
      { method: 'POST', body: { sourceFilePath, destinationPath }, signal },
      '파일 복사 실패'
    );
  },

  // 파일 이름변경. purgeCache:true 면 CDN 캐시 퍼지까지 요청한다.
  renameFile: async (
    filePath: string,
    newFileName: string,
    opts: { purgeCache?: boolean } = {},
    signal?: AbortSignal
  ): Promise<{ purgeRequestId?: string; refs?: IkRefsUpdate }> => {
    return await requestJson<{ purgeRequestId?: string; refs?: IkRefsUpdate }>(
      '/imagekit/file/rename',
      {
        method: 'PUT',
        body: { filePath, newFileName, purgeCache: opts.purgeCache === true },
        signal,
      },
      '파일 이름 변경 실패'
    );
  },

  // 일괄 삭제 (최대 100개) — ImageKit batch/deleteByFileIds
  bulkDeleteFiles: async (fileIds: string[], signal?: AbortSignal): Promise<string[]> => {
    const data = await requestJson<{ successfullyDeletedFileIds?: string[] }>(
      '/imagekit/files/bulk-delete',
      { method: 'POST', body: { fileIds }, signal },
      '일괄 삭제 실패'
    );
    return data.successfullyDeletedFileIds || fileIds;
  },

  // 일괄 이동 — 백엔드가 순차 처리하고 항목별 결과를 한 번에 돌려준다(부분 성공 허용).
  bulkMoveFiles: async (
    sourceFilePaths: string[],
    destinationPath: string,
    signal?: AbortSignal
  ): Promise<IkBulkMoveResult> => {
    return await requestJson<IkBulkMoveResult>(
      '/imagekit/files/bulk-move',
      { method: 'POST', body: { sourceFilePaths, destinationPath }, signal },
      '일괄 이동 실패'
    );
  },

  // 폴더 이동 — 비동기(jobId). waitForJob 으로 완료를 확인한다.
  moveFolder: async (
    sourceFolderPath: string,
    destinationPath: string,
    signal?: AbortSignal
  ): Promise<{ jobId: string | null; jobCompleted?: boolean; refs?: IkRefsUpdate }> => {
    return await requestJson<{ jobId: string | null; jobCompleted?: boolean; refs?: IkRefsUpdate }>(
      '/imagekit/folder/move',
      { method: 'POST', body: { sourceFolderPath, destinationPath }, signal },
      '폴더 이동 실패'
    );
  },

  // 폴더 이름변경 — 비동기(jobId). ImageKit bulkJobs/renameFolder.
  renameFolder: async (
    folderPath: string,
    newFolderName: string,
    opts: { purgeCache?: boolean } = {},
    signal?: AbortSignal
  ): Promise<{ jobId: string | null; jobCompleted?: boolean; refs?: IkRefsUpdate }> => {
    return await requestJson<{ jobId: string | null; jobCompleted?: boolean; refs?: IkRefsUpdate }>(
      '/imagekit/folder/rename',
      {
        method: 'POST',
        body: { folderPath, newFolderName, purgeCache: opts.purgeCache === true },
        signal,
      },
      '폴더 이름 변경 실패'
    );
  },

  // 경로를 참조하는 곳 조회(이동 전 미리보기). 폴더면 하위까지 합산된다.
  //   ImageKit 키가 없어도 동작한다(자체 DB 만 읽는다).
  getRefs: async (
    paths: string[],
    kinds: Record<string, 'file' | 'folder'> = {},
    signal?: AbortSignal
  ): Promise<IkRefsResult> => {
    return await requestJson<IkRefsResult>(
      '/imagekit/refs',
      { method: 'POST', body: { paths, kinds }, signal },
      '참조 조회 실패'
    );
  },

  // 치환 로그 되돌리기(문서 단위 또는 배치 단위)
  rollbackRefs: async (
    target: { logId?: string; batchId?: string },
    signal?: AbortSignal
  ): Promise<{ entries: number; restored: Record<string, number> }> => {
    return await requestJson<{ entries: number; restored: Record<string, number> }>(
      '/imagekit/refs/rollback',
      { method: 'POST', body: target, signal },
      '롤백 실패'
    );
  },

  // CDN 캐시 퍼지 — 원본을 덮어쓴 뒤 URL 이 그대로일 때 필수.
  //   퍼지는 비동기(수 분)라 requestId 만 받고 즉시 반환한다.
  purgeCache: async (url: string, signal?: AbortSignal): Promise<{ requestId: string | null }> => {
    return await requestJson<{ requestId: string | null }>(
      '/imagekit/purge',
      { method: 'POST', body: { url }, signal },
      'CDN 캐시 퍼지 실패'
    );
  },

  // 벌크 작업 상태 1회 조회
  getBulkJob: async (jobId: string, signal?: AbortSignal): Promise<IkBulkJob> => {
    const data = await requestJson<{ job: IkBulkJob }>(
      `/imagekit/bulk-job/${encodeURIComponent(jobId)}`,
      { signal },
      '작업 상태 조회 실패'
    );
    return data.job;
  },

  // 벌크 작업 완료 대기 — 1.2초 간격 폴링, 최대 timeoutMs.
  //   ImageKit 은 status:'Completed' 로 완료를 알린다. 타임아웃이어도 실패로 보지 않고
  //   false 를 돌려주어 호출측이 "진행 중" 으로 안내할 수 있게 한다.
  waitForJob: async (jobId: string, timeoutMs = 30000): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const job = await imagekitAdminAPI.getBulkJob(jobId);
        const status = String((job as any)?.status || '').toLowerCase();
        if (status === 'completed') return true;
      } catch {
        // 폴링 실패는 무시하고 재시도 — 작업 자체는 서버에서 계속 진행된다.
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return false;
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
