// ═══════════════════════════════════════════════════════════════
// useIkList — ImageKit 목록 페칭 공용 훅
//   MediaAdmin 과 ImageKitPicker 가 각자 들고 있던 동일 로직
//   (files/skip/hasMore/loading/error + 경로·검색 변경 시 재조회)을 하나로 합친다.
//   · skip 은 ref 로 관리한다 — state 로 두면 load 콜백 아이덴티티가 매 페이지마다 바뀌어
//     effect 재실행/중복 요청을 유발한다(기존 두 컴포넌트의 공통 결함).
//   · 요청 세대(reqId)를 검사해 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않게 한다.
//   · 오류는 handleError 로 위임할 수 있다(true 반환 = 처리 완료, 훅은 에러 표시 안 함).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { imagekitAdminAPI, IkFile } from '../services/imagekitAdminApi';
import { nameLikeQuery, normalizePath } from '../utils/ikPath';

export interface UseIkListOptions {
  /** 현재 폴더. globalSearch 가 true 이고 검색어가 있으면 무시된다. */
  path: string;
  /** 파일명 검색어(빈 문자열이면 폴더 브라우징). */
  search?: string;
  /** true 면 검색을 라이브러리 전체로 확장(path 미전송). */
  globalSearch?: boolean;
  /** ImageKit sort 값(ASC_NAME·DESC_CREATED·DESC_SIZE 등). */
  sort?: string;
  /** false 면 요청하지 않는다(모달 닫힘·비로그인 등). */
  enabled?: boolean;
  pageSize?: number;
  /** true 반환 시 훅은 에러 상태를 세팅하지 않는다(호출측이 처리). */
  handleError?: (e: any) => boolean;
}

export interface UseIkListResult {
  files: IkFile[];
  setFiles: React.Dispatch<React.SetStateAction<IkFile[]>>;
  loading: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  hasMore: boolean;
  /** 다음 페이지 추가 로드 */
  loadMore: () => void;
  /** 현재 조건으로 처음부터 다시 로드 */
  reload: () => void;
}

export function useIkList(options: UseIkListOptions): UseIkListResult {
  const {
    path,
    search = '',
    globalSearch = false,
    sort = 'DESC_CREATED',
    enabled = true,
    pageSize = 40,
    handleError,
  } = options;

  const [files, setFiles] = useState<IkFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const skipRef = useRef(0);
  const reqIdRef = useRef(0);
  // handleError 를 ref 로 고정 — 인라인 함수를 deps 에 넣으면 매 렌더마다 재조회된다.
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const load = useCallback(
    async (reset: boolean) => {
      const reqId = ++reqIdRef.current;
      if (reset) skipRef.current = 0;
      setLoading(true);
      setError(null);
      try {
        const scopePath = normalizePath(path || '/');
        const useGlobal = globalSearch && !!search;
        const result = await imagekitAdminAPI.listFiles({
          // 루트('/')는 path 미지정과 동치. 전역 검색이면 path 자체를 보내지 않는다.
          path: !useGlobal && scopePath !== '/' ? scopePath : undefined,
          searchQuery: search ? nameLikeQuery(search) : undefined,
          skip: skipRef.current,
          limit: pageSize,
          sort,
        });
        if (reqId !== reqIdRef.current) return; // 늦게 온 이전 응답 폐기
        setHasMore(result.length === pageSize);
        setFiles((prev) => (reset ? result : [...prev, ...result]));
        skipRef.current += result.length;
      } catch (e: any) {
        if (reqId !== reqIdRef.current) return;
        if (handleErrorRef.current && handleErrorRef.current(e)) return;
        setError(e?.message || '목록을 불러오지 못했습니다.');
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    [path, search, globalSearch, sort, pageSize]
  );

  // 조건(경로·검색·정렬·활성) 변경 시 처음부터 재조회.
  useEffect(() => {
    if (!enabled) return;
    load(true);
  }, [enabled, load]);

  const loadMore = useCallback(() => {
    if (loading) return;
    load(false);
  }, [load, loading]);

  const reload = useCallback(() => {
    load(true);
  }, [load]);

  return { files, setFiles, loading, error, setError, hasMore, loadMore, reload };
}

export default useIkList;
