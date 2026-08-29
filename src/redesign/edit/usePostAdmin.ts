import { useCallback, useState } from 'react';
import { filedAPI, workAPI } from '../../services/api';
import { Kind } from '../db';

// ════════════════════════════════════════════════════════════════════════
// usePostAdmin — ART WORK(/api/work) 와 COMMONS(/api/filed) 의 쓰기 경로를 하나로.
//   두 API 는 메서드 이름이 같고(createPost·updatePost·deletePost·reorderPosts)
//   헤더 수정만 이름이 다르다(updateWorkHeader · updateFiledHeader).
//   저장 포맷은 레거시 WritePost 와 동일하다 — content=본문 HTML, htmlContent=''.
//   (2단계에서 초안/발행을 넣을 때까지 스키마는 그대로 둔다.)
// ════════════════════════════════════════════════════════════════════════

export interface PostPayload {
  title: string;
  /** 본문 HTML(BlockEditor 출력) */
  content: string;
  thumbnail?: string;
  /** COMMONS 전용 */
  category?: string;
}

export interface SavedPost {
  id: string;
  title: string;
}

interface ApiResult {
  success?: boolean;
  message?: string;
  data?: any;
}

/** api.js 응답 규약: { success, message, data }. 실패는 예외로 올린다. */
function unwrap(res: ApiResult | undefined, fallback: string): any {
  if (!res || res.success === false) throw new Error(res?.message || fallback);
  return res.data;
}

export interface PostAdminApi {
  busy: boolean;
  create: (payload: PostPayload) => Promise<SavedPost>;
  update: (id: string, payload: PostPayload) => Promise<SavedPost>;
  remove: (id: string) => Promise<void>;
  /** 화면에 보이는 순서대로의 id 배열 → sortOrder 0..n-1 로 일괄 저장 */
  reorder: (ids: string[]) => Promise<void>;
  saveHeader: (header: { title: string; subtitle: string }) => Promise<void>;
}

export function usePostAdmin(kind: Kind): PostAdminApi {
  const [busy, setBusy] = useState(false);
  const api: any = kind === 'work' ? workAPI : filedAPI;

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    (payload: PostPayload) =>
      run(async () => {
        const data = unwrap(await api.createPost({ ...payload, htmlContent: '' }), '저장에 실패했습니다.');
        return { id: String(data?.id ?? ''), title: String(data?.title ?? payload.title) };
      }),
    [api, run],
  );

  const update = useCallback(
    (id: string, payload: PostPayload) =>
      run(async () => {
        const data = unwrap(await api.updatePost(id, { ...payload, htmlContent: '' }), '수정에 실패했습니다.');
        return { id: String(data?.id ?? id), title: String(data?.title ?? payload.title) };
      }),
    [api, run],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        unwrap(await api.deletePost(id), '삭제에 실패했습니다.');
      }),
    [api, run],
  );

  // 서버에 /reorder 가 이미 있다(work.js:64 · filed.js:51) — 개별 PUT 대신 한 번에 보낸다.
  const reorder = useCallback(
    (ids: string[]) =>
      run(async () => {
        const orders = ids.map((id, i) => ({ id, sortOrder: i }));
        unwrap(await api.reorderPosts(orders), '순서 저장에 실패했습니다.');
      }),
    [api, run],
  );

  const saveHeader = useCallback(
    (header: { title: string; subtitle: string }) =>
      run(async () => {
        const call = kind === 'work' ? workAPI.updateWorkHeader : filedAPI.updateFiledHeader;
        unwrap(await call(header), '표제 저장에 실패했습니다.');
      }),
    [kind, run],
  );

  return { busy, create, update, remove, reorder, saveHeader };
}

export default usePostAdmin;
