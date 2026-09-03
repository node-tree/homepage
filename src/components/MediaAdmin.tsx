// ═══════════════════════════════════════════════════════════════
// 이미지호스팅 — ImageKit 관리자 미디어 페이지 (admin 전용)
//   · 업로드: 드래그앤드롭 + 파일선택. 업로드 전 브라우저 자동 리사이즈(긴 변 2400px,
//     JPEG 0.82, GIF 제외). ImageKit 으로 직접 multipart 업로드(백엔드 /auth 서명).
//   · 탐색: 폴더 트리(지연 로드) + 브레드크럼 + 경로 자동완성 + 최근 폴더 + 정렬.
//     검색은 현재 폴더 기준이 기본, 「전체 폴더」를 켜면 라이브러리 전역 검색.
//   · 정리: 다중 선택 → 일괄 이동/복사/삭제. 파일·폴더 이동, 파일·폴더 이름변경.
//     ⚠️ 이동·이름변경은 ImageKit URL(경로 기반)을 즉시 바꾼다 → UI 에 경고 상시 노출.
//   · 상세: 카드 클릭 → 상세 패널(해상도·용량·태그·경로·수정일 + URL 변환 프리셋 복사).
//   · 자체 DB 저장 없음 — ImageKit 미디어 라이브러리가 단일 소스.
//   · 인증: 사이트 세션(auth_token). 비로그인 → /login. 비admin 은 API 호출 전 차단.
//   · 목록 페칭/경로 유틸은 useIkList · utils/ikPath 로 분리해 ImageKitPicker 와 공유한다.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth, clearSiteAuthStorage } from '../contexts/AuthContext';
import {
  imagekitAdminAPI,
  IkFile,
  IkFileDetail,
  IkFolder,
  IkUploadResult,
  IkUsage,
} from '../services/imagekitAdminApi';
import { prepareImageForUpload } from '../utils/imageResize';
import { ikUrl } from '../utils/ikUrl';
import {
  baseName,
  breadcrumbSegments,
  folderTargetPath,
  isFolder,
  isInside,
  joinPath,
  normalizePath,
  parentPath,
} from '../utils/ikPath';
import { useIkList } from '../hooks/useIkList';
import FolderTree, { invalidateFolderCache, cachedFolderPaths } from './media/FolderTree';
import FolderPickerModal from './media/FolderPickerModal';
import ImageEditPanel from './media/ImageEditPanel';
import { withCacheBuster } from '../utils/ikTransform';
import './MediaAdmin.css';

interface UploadRow {
  id: string;
  name: string;
  status: 'pending' | 'resizing' | 'uploading' | 'done' | 'error';
  resized?: boolean;
  url?: string;
  error?: string;
}

const PAGE_SIZE = 40;

// ImageKit 무료 플랜 미디어 저장 한도 3GB.
const FREE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024;

// 최근 방문 폴더(localStorage). 세션을 넘어 유지 — 관리자가 늘 같은 폴더를 오간다.
const RECENT_KEY = 'ma:recentPaths';
const RECENT_MAX = 8;

// 정렬 옵션 — 백엔드 화이트리스트와 동일한 ImageKit sort 값.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'DESC_CREATED', label: '최신 업로드순' },
  { value: 'ASC_CREATED', label: '오래된 업로드순' },
  { value: 'DESC_UPDATED', label: '최근 수정순' },
  { value: 'ASC_NAME', label: '이름 오름차순' },
  { value: 'DESC_NAME', label: '이름 내림차순' },
  { value: 'DESC_SIZE', label: '용량 큰 순' },
  { value: 'ASC_SIZE', label: '용량 작은 순' },
];

// URL 복사 프리셋 — ikUrl 규칙(GIF 변환 금지)을 그대로 통과시킨다.
const URL_PRESETS: { label: string; w?: number }[] = [
  { label: '원본' },
  { label: 'w-1600', w: 1600 },
  { label: 'w-800', w: 800 },
  { label: 'w-300', w: 300 },
];

function formatBytes(n: number): string {
  if (!n && n !== 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatGB(n: number): string {
  return (n / (1024 * 1024 * 1024)).toFixed(2);
}

function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => typeof x === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* localStorage 불가 환경 — 기능만 비활성 */
  }
}

// 로그인 화면으로 보낸다.
//   · 죽은 세션을 먼저 지운다 — 남아 있으면 /login 이 "이미 로그인됨"으로 보고 홈(/)으로
//     되돌려 보내, 이미지호스팅을 눌러도 계속 본페이지로 튕기는 루프가 된다.
//   · next 로 복귀 경로를 넘겨 로그인 직후 이 페이지로 돌아온다.
function goLogin(): void {
  clearSiteAuthStorage();
  window.location.href = `/login?next=${encodeURIComponent('/admin/media')}`;
}

// ── 아이콘(인라인 SVG — 이모지 금지, 톤은 currentColor 상속) ─────────
const IconTrash: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2h5.8l.6-8.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFolder: React.FC = () => (
  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
    <path d="M6 12a2 2 0 0 1 2-2h10l4 5h18a2 2 0 0 1 2 2v21a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const IconUp: React.FC = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
    <path d="M8 12.5V4M4.5 7.5L8 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MediaAdmin: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canBrowse = isAuthenticated && isAdmin;

  // 업로드 설정. 업로드 대상 폴더는 별도 입력 없이 아래 「라이브러리」에서 현재 보고 있는
  // 폴더(browsePath)를 그대로 따라간다(루트면 기본 /uploads).
  const [useUnique, setUseUnique] = useState(true);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 브라우징 — 기본 진입 경로는 루트('/') 라 최상위 폴더들이 바로 보인다.
  const [browsePath, setBrowsePath] = useState('/');
  const [pathInput, setPathInput] = useState('/');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [globalSearch, setGlobalSearch] = useState(false);
  const [sort, setSort] = useState('DESC_CREATED');
  const [accessError, setAccessError] = useState<string | null>(null);

  // 사용 용량 (현재 버전 파일 합계 기준)
  const [usage, setUsage] = useState<IkUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // 삭제 2단계 확인 — 휴지통/삭제 클릭으로 무장(pendingDelete) 후 확인 클릭으로 실행.
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'file'; id: string; name: string }
    | { kind: 'folder'; path: string; name: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  // 다중 선택 · 일괄 작업
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 이동 모달 — 파일 다중 이동/복사 또는 폴더 이동
  const [moveState, setMoveState] = useState<
    | { kind: 'files'; mode: 'move' | 'copy'; paths: string[] }
    | { kind: 'folder'; path: string; name: string }
    | null
  >(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // 이름변경
  const [renameTarget, setRenameTarget] = useState<
    { kind: 'file'; filePath: string; name: string } | { kind: 'folder'; path: string; name: string } | null
  >(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // 상세 패널 (정보 / 편집 탭)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IkFileDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'edit'>('info');
  // 원본 교체(파괴 편집) 직후 썸네일 갱신용 스탬프. URL 이 그대로라 CDN/브라우저 캐시가
  // 옛 이미지를 계속 내주므로 화면에서만 캐시버스터를 붙인다(복사되는 URL 에는 붙지 않는다).
  const [cacheBust, setCacheBust] = useState(0);

  // 트리/자동완성
  const [treeOpen, setTreeOpen] = useState(false); // 모바일 접이식
  const [treeRefresh, setTreeRefresh] = useState(0);
  const [allFolders, setAllFolders] = useState<IkFolder[]>([]);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  // ── 목록 페칭(공용 훅) ───────────────────────────────────────
  const handleListError = useCallback((e: any) => {
    if (e?.code === 'FORBIDDEN') {
      setAccessError('관리자 권한이 필요합니다.');
      return true;
    }
    if (e?.code === 'AUTH_EXPIRED') {
      goLogin();
      return true;
    }
    return false;
  }, []);

  const {
    files,
    setFiles,
    loading: listLoading,
    error: listError,
    hasMore,
    loadMore,
    reload,
  } = useIkList({
    path: browsePath,
    search,
    globalSearch,
    sort,
    enabled: canBrowse,
    pageSize: PAGE_SIZE,
    handleError: handleListError,
  });

  // 문서 제목
  useEffect(() => {
    const prev = document.title;
    document.title = '이미지호스팅 · NODE TREE';
    return () => {
      document.title = prev;
    };
  }, []);

  // 비로그인 리다이렉트 (isLoading 끝난 뒤에만 판단). 로그인했으나 비admin 은
  // 리다이렉트하지 않고 안내 문구를 보여준다(아래 렌더 가드).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      goLogin();
    }
  }, [isLoading, isAuthenticated]);

  // 사용 용량 로드 (마운트 + 업로드/삭제 성공 후 갱신). 실패해도 페이지는 동작.
  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const u = await imagekitAdminAPI.getUsage();
      setUsage(u);
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        goLogin();
        return;
      }
      // 용량 조회 실패는 치명적이지 않음 — 표시만 생략한다.
    } finally {
      setUsageLoading(false);
    }
  }, []);

  // 마운트 시 용량 + 전체 폴더(자동완성/폴더 검색용) 1회 로드 (admin 만)
  useEffect(() => {
    if (!canBrowse) return;
    loadUsage();
    let alive = true;
    imagekitAdminAPI
      .listFolders({ all: true })
      .then((f) => {
        if (alive) setAllFolders(f);
      })
      .catch(() => {
        /* 자동완성 보조 기능 — 실패해도 트리 지연 로드로 대체된다. */
      });
    return () => {
      alive = false;
    };
  }, [canBrowse, loadUsage]);

  // 경로/검색이 바뀌면 선택·확인 상태를 초기화한다(다른 폴더의 선택이 남으면 오작동).
  useEffect(() => {
    setPendingDelete(null);
    setPendingBulkDelete(false);
    setSelected(new Set());
    setDetailId(null);
    setDetail(null);
  }, [browsePath, search, globalSearch]);

  // 상세 패널 로드 — 새 파일을 열면 항상 「정보」 탭부터.
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    setDetailTab('info');
    let alive = true;
    setDetailLoading(true);
    imagekitAdminAPI
      .getFileDetails(detailId)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e: any) => {
        if (e?.code === 'AUTH_EXPIRED') goLogin();
        if (alive) setDetail(null);
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [detailId]);

  // 폴더 진입 = 검색 스코프 변경. 활성 검색어는 유지해(Picker 와 동일) 새 폴더 기준으로
  // 검색이 재실행된다(훅이 browsePath 변경을 받아 같은 search 로 재조회).
  const enterFolder = useCallback((target: string) => {
    const norm = normalizePath(target);
    setBrowsePath(norm);
    setPathInput(norm);
    setRecent((prev) => {
      const next = [norm, ...prev.filter((p) => p !== norm)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, []);

  // 현재 경로 아래 새 폴더 생성 → 성공 시 진입.
  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    if (/[\\/]/.test(name) || name.includes('..')) {
      setNotice('폴더 이름에 / \\ .. 는 사용할 수 없습니다.');
      return;
    }
    setCreatingFolder(true);
    try {
      await imagekitAdminAPI.createFolder(name, browsePath || '/');
      setNewFolderName('');
      invalidateFolderCache(browsePath);
      setTreeRefresh((n) => n + 1);
      enterFolder(joinPath(browsePath, name));
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        goLogin();
        return;
      }
      setNotice(e?.message || '폴더 생성에 실패했습니다.');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, creatingFolder, browsePath, enterFolder]);

  // 화면 표시 전용 캐시버스터. 복사·저장되는 URL 에는 절대 붙이지 않는다.
  //   GIF 는 쿼리를 붙이지 않는다 — 변환 금지 규칙과 같은 이유로 손대지 않는 편이 안전하다
  //   (GIF 는 파괴 편집 대상도 아니라 버스터가 필요 없다).
  const bust = useCallback(
    (url: string) => (cacheBust && !/\.gif(\?|#|$)/i.test(url) ? withCacheBuster(url, cacheBust) : url),
    [cacheBust]
  );

  const copyUrl = useCallback((url: string) => {
    const finalUrl = url;
    const done = () => {
      setCopied(finalUrl);
      window.setTimeout(() => setCopied((c) => (c === finalUrl ? null : c)), 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(finalUrl).then(done).catch(() => {
        fallbackCopy(finalUrl);
        done();
      });
    } else {
      fallbackCopy(finalUrl);
      done();
    }
  }, []);

  // 휴지통/삭제 클릭 = 삭제 무장(아직 안 지움). 같은 항목 다시 클릭하면 해제(토글).
  const armDeleteFile = useCallback((file: IkFile) => {
    setPendingDelete((p) =>
      p && p.kind === 'file' && p.id === file.fileId
        ? null
        : { kind: 'file', id: file.fileId, name: file.name }
    );
  }, []);
  const armDeleteFolder = useCallback((path: string, name: string) => {
    const norm = normalizePath(path);
    setPendingDelete((p) =>
      p && p.kind === 'folder' && p.path === norm ? null : { kind: 'folder', path: norm, name }
    );
  }, []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  // 확인 클릭 = 실제 삭제. 파일은 목록에서 제거, 폴더는 현재(또는 하위) 폴더 삭제 시 상위로 이동.
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'file') {
        await imagekitAdminAPI.deleteFile(pendingDelete.id);
        setFiles((prev) => prev.filter((f) => f.fileId !== pendingDelete.id));
        if (detailId === pendingDelete.id) setDetailId(null);
        loadUsage(); // 삭제 후 용량 갱신
      } else {
        await imagekitAdminAPI.deleteFolder(pendingDelete.path);
        invalidateFolderCache(pendingDelete.path);
        setTreeRefresh((n) => n + 1);
        const cur = normalizePath(browsePath);
        if (isInside(cur, pendingDelete.path)) {
          enterFolder(parentPath(pendingDelete.path) || '/'); // 현재(또는 하위) 폴더를 지웠으면 상위로
        } else {
          reload(); // 목록 갱신
        }
        loadUsage();
      }
      setPendingDelete(null);
    } catch (e: any) {
      if (e?.code === 'FORBIDDEN') {
        setNotice('삭제 권한이 없습니다.');
      } else if (e?.code === 'AUTH_EXPIRED') {
        goLogin();
        return;
      } else {
        setNotice(e?.message || '삭제에 실패했습니다.');
      }
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, deleting, browsePath, detailId, loadUsage, reload, enterFolder, setFiles]);

  // ── 다중 선택 ────────────────────────────────────────────────
  const toggleSelect = useCallback((fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const { folders, plainFiles } = useMemo(() => {
    const fol: IkFile[] = [];
    const fil: IkFile[] = [];
    for (const f of files) {
      if (isFolder(f)) fol.push(f);
      else fil.push(f);
    }
    return { folders: fol, plainFiles: fil };
  }, [files]);

  const selectedFiles = useMemo(
    () => plainFiles.filter((f) => f.fileId && selected.has(f.fileId)),
    [plainFiles, selected]
  );

  const selectAllVisible = useCallback(() => {
    setSelected((prev) => {
      const allIds = plainFiles.map((f) => f.fileId).filter(Boolean) as string[];
      const everySelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      return everySelected ? new Set() : new Set(allIds);
    });
  }, [plainFiles]);

  // ── 일괄 삭제 ────────────────────────────────────────────────
  const confirmBulkDelete = useCallback(async () => {
    const ids = selectedFiles.map((f) => f.fileId).filter(Boolean) as string[];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(`${ids.length}개 삭제 중…`);
    try {
      const deletedIds = await imagekitAdminAPI.bulkDeleteFiles(ids);
      const gone = new Set(deletedIds);
      setFiles((prev) => prev.filter((f) => !gone.has(f.fileId)));
      setSelected(new Set());
      setPendingBulkDelete(false);
      setNotice(`${deletedIds.length}개를 삭제했습니다.`);
      loadUsage();
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        goLogin();
        return;
      }
      setNotice(e?.message || '일괄 삭제에 실패했습니다.');
    } finally {
      setBulkBusy(null);
    }
  }, [selectedFiles, bulkBusy, loadUsage, setFiles]);

  // ── 이동/복사 실행 ───────────────────────────────────────────
  const runMove = useCallback(
    async (destination: string) => {
      if (!moveState || moveBusy) return;
      setMoveBusy(true);
      setMoveError(null);
      try {
        if (moveState.kind === 'files') {
          if (moveState.mode === 'copy') {
            // 복사는 건별 API — 개별 실패는 건너뛰고 나머지를 계속 진행한 뒤 수치로 보고한다.
            let ok = 0;
            for (const p of moveState.paths) {
              try {
                // eslint-disable-next-line no-await-in-loop
                await imagekitAdminAPI.copyFile(p, destination);
                ok += 1;
              } catch {
                /* 개별 실패 — 아래 요약에 반영된다. */
              }
            }
            setNotice(`${ok}/${moveState.paths.length}개를 ${destination} 으로 복사했습니다.`);
          } else {
            const res = await imagekitAdminAPI.bulkMoveFiles(moveState.paths, destination);
            const failed = res.results.filter((r) => !r.ok);
            setNotice(
              failed.length === 0
                ? `${res.results.length}개를 ${destination} 으로 이동했습니다. 기존 URL은 더 이상 동작하지 않습니다.`
                : `${res.message} · 실패: ${failed.map((f) => baseName(f.sourceFilePath)).join(', ')}`
            );
          }
          setSelected(new Set());
          setMoveState(null);
          reload();
          loadUsage();
        } else {
          // 폴더 이동 — 비동기 작업(jobId) 완료까지 폴링.
          const { jobId } = await imagekitAdminAPI.moveFolder(moveState.path, destination);
          if (jobId) {
            setMoveBusy(true);
            const done = await imagekitAdminAPI.waitForJob(jobId);
            setNotice(
              done
                ? `${moveState.name} 폴더를 ${destination} 으로 이동했습니다. 기존 URL은 더 이상 동작하지 않습니다.`
                : `${moveState.name} 폴더 이동을 요청했습니다(진행 중). 잠시 후 새로고침해 확인해주세요.`
            );
          } else {
            setNotice(`${moveState.name} 폴더 이동을 요청했습니다.`);
          }
          invalidateFolderCache();
          setTreeRefresh((n) => n + 1);
          setMoveState(null);
          // 현재 보고 있는 폴더가 이동됐다면 새 위치로 따라간다.
          if (isInside(browsePath, moveState.path)) {
            enterFolder(joinPath(destination, moveState.name));
          } else {
            reload();
          }
        }
      } catch (e: any) {
        if (e?.code === 'AUTH_EXPIRED') {
          goLogin();
          return;
        }
        setMoveError(e?.message || '이동에 실패했습니다.');
      } finally {
        setMoveBusy(false);
      }
    },
    [moveState, moveBusy, browsePath, reload, loadUsage, enterFolder]
  );

  // ── 이름변경 실행 ────────────────────────────────────────────
  const runRename = useCallback(async () => {
    if (!renameTarget || renameBusy) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError('새 이름을 입력해주세요.');
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      if (renameTarget.kind === 'file') {
        await imagekitAdminAPI.renameFile(renameTarget.filePath, name);
        setNotice(`이름을 ${name} 으로 바꿨습니다. 기존 URL은 더 이상 동작하지 않습니다.`);
        setRenameTarget(null);
        setDetailId(null);
        reload();
      } else {
        const { jobId } = await imagekitAdminAPI.renameFolder(renameTarget.path, name);
        if (jobId) await imagekitAdminAPI.waitForJob(jobId);
        setNotice(`폴더 이름을 ${name} 으로 바꿨습니다. 폴더 안 파일의 기존 URL은 모두 바뀝니다.`);
        invalidateFolderCache();
        setTreeRefresh((n) => n + 1);
        const renamedTo = joinPath(parentPath(renameTarget.path) || '/', name);
        setRenameTarget(null);
        if (isInside(browsePath, renameTarget.path)) enterFolder(renamedTo);
        else reload();
      }
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        goLogin();
        return;
      }
      setRenameError(e?.message || '이름 변경에 실패했습니다.');
    } finally {
      setRenameBusy(false);
    }
  }, [renameTarget, renameValue, renameBusy, browsePath, reload, enterFolder]);

  const openRename = useCallback(
    (target: NonNullable<typeof renameTarget>) => {
      setRenameTarget(target);
      setRenameValue(target.name);
      setRenameError(null);
    },
    []
  );

  // ── 업로드 ───────────────────────────────────────────────────
  const uploadDest = useMemo(
    () => (normalizePath(browsePath || '/') !== '/' ? normalizePath(browsePath) : '/uploads'),
    [browsePath]
  );

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) return;

      let anyDone = false;
      for (const file of arr) {
        const rowId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setUploads((prev) => [{ id: rowId, name: file.name, status: 'resizing' }, ...prev]);
        try {
          const prepared = await prepareImageForUpload(file);
          setUploads((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, status: 'uploading', resized: prepared.resized } : r))
          );
          // 업로드 대상 = 라이브러리에서 현재 보고 있는 폴더(루트면 /uploads).
          const result: IkUploadResult = await imagekitAdminAPI.uploadFile(
            prepared.blob,
            prepared.fileName,
            { folder: uploadDest, useUniqueFileName: useUnique }
          );
          anyDone = true;
          setUploads((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, status: 'done', url: result.url, name: result.name } : r))
          );
        } catch (e: any) {
          if (e?.code === 'FORBIDDEN') {
            setUploads((prev) =>
              prev.map((r) => (r.id === rowId ? { ...r, status: 'error', error: '관리자 권한이 필요합니다.' } : r))
            );
            return;
          }
          if (e?.code === 'AUTH_EXPIRED') {
            goLogin();
            return;
          }
          setUploads((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, status: 'error', error: e?.message || '업로드 실패' } : r))
          );
        }
      }
      // 업로드 대상 = 현재 보고 있는 폴더 → 업로드 후 목록 갱신(검색 중이면 스코프 동일).
      reload();
      if (anyDone) loadUsage(); // 업로드 성공 시 용량 갱신
    },
    [useUnique, uploadDest, reload, loadUsage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const crumbs = useMemo(() => breadcrumbSegments(browsePath), [browsePath]);
  const parent = useMemo(() => parentPath(browsePath), [browsePath]);

  // 경로 자동완성 후보 — 서버 폴더 목록 ∪ 트리 캐시 ∪ 최근 방문.
  const pathSuggestions = useMemo(() => {
    const set = new Set<string>(['/']);
    allFolders.forEach((f) => f.folderPath && set.add(normalizePath(f.folderPath)));
    cachedFolderPaths().forEach((p) => set.add(p));
    recent.forEach((p) => set.add(p));
    return Array.from(set).sort();
  }, [allFolders, recent, treeRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // 전역 검색 중에는 폴더도 이름으로 찾아준다(서버 검색은 파일만 대상).
  const matchedFolders = useMemo(() => {
    if (!search || !globalSearch) return [];
    const q = search.toLowerCase();
    const set = new Map<string, string>();
    allFolders.forEach((f) => {
      if ((f.name || '').toLowerCase().includes(q)) set.set(normalizePath(f.folderPath), f.name);
    });
    cachedFolderPaths().forEach((p) => {
      const n = baseName(p);
      if (n.toLowerCase().includes(q)) set.set(p, n);
    });
    return Array.from(set.entries()).map(([path, name]) => ({ path, name }));
  }, [search, globalSearch, allFolders, treeRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <div className="media-admin-loading">불러오는 중…</div>;
  }
  if (!isAuthenticated) {
    return <div className="media-admin-loading">로그인이 필요합니다…</div>;
  }
  // 로그인했으나 admin 이 아닌 경우 — API 를 호출하지 않고 안내(403 방지).
  if (!isAdmin) {
    return (
      <div className="media-admin">
        <header className="ma-header">
          <div className="ma-header-top">
            <a href="/" className="ma-home-link">
              ← NODE TREE
            </a>
          </div>
          <h1>이미지호스팅</h1>
        </header>
        <section className="ma-section">
          <p className="ma-error">관리자 권한이 필요합니다.</p>
          <p className="ma-sub">
            이 페이지(이미지호스팅)는 관리자(admin) 계정만 접근할 수 있습니다. 권한이 필요한
            경우 사이트 관리자에게 문의해주세요.
          </p>
        </section>
      </div>
    );
  }

  // 사용량 퍼센트 (0~100 클램프)
  const usagePct = usage
    ? Math.min(100, Math.max(0, (usage.totalBytes / FREE_LIMIT_BYTES) * 100))
    : 0;

  const allVisibleSelected =
    plainFiles.length > 0 && plainFiles.every((f) => f.fileId && selected.has(f.fileId));

  return (
    <div className="media-admin">
      <header className="ma-header">
        <div className="ma-header-top">
          <a href="/" className="ma-home-link">
            ← NODE TREE
          </a>
        </div>
        <h1>이미지호스팅</h1>
        <p className="ma-sub">
          이미지는 ImageKit 라이브러리에만 저장됩니다(자체 DB 미저장). 무료 플랜 용량 3GB.
        </p>

        {/* 현재 용량 — 현재 버전 파일 합계 기준 */}
        <div className="ma-usage" aria-live="polite">
          {usage ? (
            <>
              <div className="ma-usage-text">
                현재 용량 <strong>{formatGB(usage.totalBytes)} GB</strong> / 3 GB
                {' '}
                ({usage.fileCount.toLocaleString()}개) · {usagePct.toFixed(1)}%
              </div>
              <div className="ma-usage-bar" role="presentation">
                <div className="ma-usage-fill" style={{ width: `${usagePct}%` }} />
              </div>
            </>
          ) : (
            <div className="ma-usage-text muted">
              {usageLoading ? '용량 계산 중…' : '용량 정보를 불러오지 못했습니다.'}
            </div>
          )}
        </div>
      </header>

      {/* 업로드 영역 */}
      <section className="ma-section">
        <h2>업로드</h2>
        <div className="ma-upload-options">
          <span className="ma-upload-dest">
            업로드 위치{' '}
            <strong>{uploadDest}</strong>
            <span className="ma-upload-dest-hint"> · 아래 「라이브러리」에서 보고 있는 폴더로 업로드됩니다</span>
          </span>
          <label className="ma-checkbox">
            <input
              type="checkbox"
              checked={useUnique}
              onChange={(e) => setUseUnique(e.target.checked)}
            />
            고유 파일명(충돌 방지)
          </label>
        </div>

        <div
          className={`ma-dropzone ${dragOver ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <p>이미지를 드래그하거나 클릭하여 선택</p>
          <p className="ma-hint">
            <strong>{uploadDest}</strong> 폴더로 업로드 · 업로드 전 자동 리사이즈(긴 변 2400px, JPEG). GIF는 원본 그대로.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) processFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {uploads.length > 0 && (
          <ul className="ma-upload-list">
            {uploads.map((u) => (
              <li key={u.id} className={`ma-upload-row ${u.status}`}>
                <span className="ma-up-name">{u.name}</span>
                <span className="ma-up-status">
                  {u.status === 'resizing' && '리사이즈 중…'}
                  {u.status === 'uploading' &&
                    `업로드 중…${u.resized ? ' (리사이즈됨)' : ''}`}
                  {u.status === 'done' && (u.resized ? '완료 (리사이즈됨)' : '완료')}
                  {u.status === 'error' && `오류: ${u.error}`}
                </span>
                {u.status === 'done' && u.url && (
                  <button className="ma-btn" onClick={() => copyUrl(u.url!)}>
                    {copied === u.url ? '복사됨' : 'URL 복사'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 브라우징 영역 */}
      <section className="ma-section">
        <div className="ma-section-head">
          <h2>라이브러리</h2>
          <button
            type="button"
            className="ma-btn ghost ma-tree-toggle"
            onClick={() => setTreeOpen((v) => !v)}
            aria-expanded={treeOpen}
          >
            {treeOpen ? '폴더 트리 닫기' : '폴더 트리'}
          </button>
        </div>

        <div className="ma-lib">
          {/* 폴더 트리 — 데스크톱 상시, 모바일은 토글 */}
          <aside className={`ma-lib-side ${treeOpen ? 'open' : ''}`} aria-label="폴더 탐색">
            <div className="ma-side-title">폴더</div>
            <FolderTree
              currentPath={browsePath}
              onSelect={(p) => {
                enterFolder(p);
                setTreeOpen(false);
              }}
              refreshKey={treeRefresh}
            />
            {recent.length > 0 && (
              <div className="ma-recent">
                <div className="ma-side-title">최근 방문</div>
                <ul>
                  {recent.map((p) => (
                    <li key={p}>
                      <button type="button" className="ma-recent-btn" onClick={() => enterFolder(p)} title={p}>
                        {p === '/' ? '루트' : p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <div className="ma-lib-main">
            {/* 브레드크럼 + 상위 폴더. 검색도 이 폴더 기준으로 스코프되므로 검색 중에도 표시한다. */}
            <nav className="ma-breadcrumb" aria-label="현재 경로">
              {crumbs.map((c, i) => (
                <React.Fragment key={c.path}>
                  {i > 0 && <span className="ma-crumb-sep">/</span>}
                  {i === crumbs.length - 1 ? (
                    <span className="ma-crumb current" aria-current="page">
                      {c.label}
                    </span>
                  ) : (
                    <button type="button" className="ma-crumb" onClick={() => enterFolder(c.path)}>
                      {c.label}
                    </button>
                  )}
                </React.Fragment>
              ))}
              {parent !== null && (
                <button
                  type="button"
                  className="ma-btn ghost ma-up-btn"
                  onClick={() => enterFolder(parent)}
                  title="상위 폴더로 이동"
                >
                  <IconUp /> 상위 폴더
                </button>
              )}
              <span className="ma-newfolder">
                <input
                  type="text"
                  placeholder="새 폴더 이름"
                  value={newFolderName}
                  disabled={creatingFolder}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateFolder();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ma-btn"
                  disabled={creatingFolder || !newFolderName.trim()}
                  onClick={handleCreateFolder}
                >
                  {creatingFolder ? '생성 중…' : '+ 새 폴더'}
                </button>
              </span>
            </nav>

            {search && (
              <p className="ma-scope-hint">
                {globalSearch ? (
                  <>
                    <strong>전체 폴더</strong>에서 “{search}” 검색 결과
                  </>
                ) : (
                  <>
                    <strong>{browsePath}</strong> 폴더에서 “{search}” 검색 결과
                  </>
                )}
              </p>
            )}

            <div className="ma-browse-controls">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enterFolder(pathInput || '/');
                }}
              >
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="폴더 경로 (예: /uploads)"
                  list="ma-path-suggest"
                  aria-label="폴더 경로"
                />
                <datalist id="ma-path-suggest">
                  {pathSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <button className="ma-btn" type="submit">
                  이동
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                }}
              >
                <input
                  type="text"
                  placeholder="파일명 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label="파일명 검색"
                />
                <button className="ma-btn" type="submit">
                  검색
                </button>
                {search && (
                  <button
                    type="button"
                    className="ma-btn ghost"
                    onClick={() => {
                      setSearch('');
                      setSearchInput('');
                    }}
                  >
                    검색 해제
                  </button>
                )}
                <label className="ma-checkbox ma-global-toggle">
                  <input
                    type="checkbox"
                    checked={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.checked)}
                  />
                  전체 폴더
                </label>
              </form>

              <label className="ma-sort">
                <span>정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬 기준">
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 선택 도구막대 — 파일이 있을 때만 노출 */}
            {plainFiles.length > 0 && (
              <div className={`ma-selbar ${selected.size > 0 ? 'active' : ''}`}>
                <button type="button" className="ma-btn ghost" onClick={selectAllVisible}>
                  {allVisibleSelected ? '전체 해제' : '전체 선택'}
                </button>
                <span className="ma-selbar-count">
                  {selected.size > 0 ? `${selected.size}개 선택됨` : '파일을 선택해 일괄 처리'}
                </span>
                <button
                  type="button"
                  className="ma-btn"
                  disabled={selected.size === 0 || !!bulkBusy}
                  onClick={() => {
                    setMoveError(null);
                    setMoveState({
                      kind: 'files',
                      mode: 'move',
                      paths: selectedFiles.map((f) => f.filePath),
                    });
                  }}
                >
                  이동
                </button>
                <button
                  type="button"
                  className="ma-btn"
                  disabled={selected.size === 0 || !!bulkBusy}
                  onClick={() => {
                    setMoveError(null);
                    setMoveState({
                      kind: 'files',
                      mode: 'copy',
                      paths: selectedFiles.map((f) => f.filePath),
                    });
                  }}
                >
                  복사
                </button>
                {pendingBulkDelete ? (
                  <>
                    <span className="ma-selbar-warn">{selected.size}개를 삭제할까요?</span>
                    <button
                      type="button"
                      className="ma-btn danger"
                      disabled={!!bulkBusy}
                      onClick={confirmBulkDelete}
                    >
                      {bulkBusy ? '삭제 중…' : '삭제 확인'}
                    </button>
                    <button
                      type="button"
                      className="ma-btn ghost"
                      disabled={!!bulkBusy}
                      onClick={() => setPendingBulkDelete(false)}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ma-btn danger"
                    disabled={selected.size === 0 || !!bulkBusy}
                    onClick={() => setPendingBulkDelete(true)}
                  >
                    삭제
                  </button>
                )}
              </div>
            )}

            {(notice || bulkBusy) && (
              <p className="ma-notice" aria-live="polite">
                {bulkBusy || notice}
                {!bulkBusy && notice && (
                  <button type="button" className="ma-notice-x" onClick={() => setNotice(null)} aria-label="알림 닫기">
                    ×
                  </button>
                )}
              </p>
            )}

            {(listError || accessError) && <p className="ma-error">{accessError || listError}</p>}

            <div className="ma-grid">
              {/* 전역 검색 시 이름이 일치하는 폴더로 바로 점프 */}
              {search &&
                globalSearch &&
                matchedFolders.map((f) => (
                  <div className="ma-card ma-folder-wrap" key={`match-${f.path}`}>
                    <button
                      type="button"
                      className="ma-folder-open"
                      onClick={() => enterFolder(f.path)}
                      title={`${f.path} 열기`}
                    >
                      <div className="ma-thumb ma-folder-thumb">
                        <IconFolder />
                      </div>
                      <div className="ma-card-meta">
                        <div className="ma-card-name" title={f.name}>
                          {f.name}
                        </div>
                        <div className="ma-card-info" title={f.path}>
                          {f.path}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}

              {/* 폴더 — 상단 먼저, 클릭 시 진입. 이동/이름변경/삭제 액션 제공. */}
              {!search &&
                folders.map((f) => {
                  const target = folderTargetPath(f, browsePath);
                  const armed = pendingDelete?.kind === 'folder' && pendingDelete.path === target;
                  return (
                    <div
                      className={`ma-card ma-folder-wrap ${armed ? 'armed' : ''}`}
                      // 경로는 정의상 유일하다 — folderId 보다 먼저 써서 키 충돌을 원천 차단.
                      key={target}
                    >
                      <button
                        type="button"
                        className="ma-folder-open"
                        onClick={() => enterFolder(target)}
                        title={`${f.name} 폴더 열기`}
                      >
                        <div className="ma-thumb ma-folder-thumb">
                          <IconFolder />
                        </div>
                        <div className="ma-card-meta">
                          <div className="ma-card-name" title={f.name}>
                            {f.name}
                          </div>
                          <div className="ma-card-info">폴더</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="ma-trash"
                        title={`${f.name} 폴더 삭제`}
                        aria-label={`${f.name} 폴더 삭제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          armDeleteFolder(target, f.name);
                        }}
                      >
                        <IconTrash />
                      </button>
                      <div className="ma-card-actions ma-folder-actions">
                        <button
                          type="button"
                          className="ma-btn"
                          onClick={() => {
                            setMoveError(null);
                            setMoveState({ kind: 'folder', path: target, name: f.name });
                          }}
                        >
                          이동
                        </button>
                        <button
                          type="button"
                          className="ma-btn"
                          onClick={() => openRename({ kind: 'folder', path: target, name: f.name })}
                        >
                          이름변경
                        </button>
                      </div>
                      {armed && (
                        <div className="ma-confirm" role="alertdialog" aria-label="폴더 삭제 확인">
                          <p className="ma-confirm-msg">
                            <strong>{f.name}</strong> 폴더를 삭제할까요?
                            <span className="ma-confirm-warn">폴더 안의 파일·하위 폴더까지 모두 삭제됩니다.</span>
                          </p>
                          <div className="ma-confirm-actions">
                            <button
                              type="button"
                              className="ma-btn danger"
                              disabled={deleting}
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete();
                              }}
                            >
                              {deleting ? '삭제 중…' : '삭제'}
                            </button>
                            <button
                              type="button"
                              className="ma-btn ghost"
                              disabled={deleting}
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelDelete();
                              }}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* 파일 — 선택 체크박스 + 썸네일(상세) + URL복사 / 삭제(확인 2단계) */}
              {plainFiles.map((f) => {
                const isImage = f.fileType === 'image' || f.fileType === 'IMAGE';
                const thumb = isImage && f.url ? bust(ikUrl(f.url, { w: 300 })) : null;
                const armed = pendingDelete?.kind === 'file' && pendingDelete.id === f.fileId;
                const checked = !!f.fileId && selected.has(f.fileId);
                return (
                  <div
                    className={`ma-card ${armed ? 'armed' : ''} ${checked ? 'selected' : ''}`}
                    // 전역 검색은 여러 폴더 결과를 한 그리드에 섞는다 → 경로를 키에 포함해 충돌 방지.
                    key={f.filePath || f.fileId || f.name}
                  >
                    <label className="ma-select" title="선택">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!f.fileId}
                        onChange={() => f.fileId && toggleSelect(f.fileId)}
                        aria-label={`${f.name} 선택`}
                      />
                    </label>
                    <button
                      type="button"
                      className="ma-thumb ma-thumb-btn"
                      onClick={() => f.fileId && setDetailId(f.fileId)}
                      title={`${f.name} 상세`}
                    >
                      {thumb ? (
                        <img src={thumb} alt={f.name} loading="lazy" />
                      ) : (
                        <div className="ma-noimg">{f.fileType || 'file'}</div>
                      )}
                    </button>
                    <div className="ma-card-meta">
                      <div className="ma-card-name" title={f.name}>
                        {f.name}
                      </div>
                      <div className="ma-card-info">
                        {formatBytes(f.size)}
                        {f.width && f.height ? ` · ${f.width}×${f.height}` : ''}
                      </div>
                      {globalSearch && search && f.filePath && (
                        <button
                          type="button"
                          className="ma-jump"
                          title={f.filePath}
                          onClick={() => enterFolder(parentPath(f.filePath) || '/')}
                        >
                          {parentPath(f.filePath) || '/'} 열기
                        </button>
                      )}
                    </div>
                    {armed ? (
                      <div className="ma-card-actions ma-confirm-inline" role="alertdialog" aria-label="파일 삭제 확인">
                        <span className="ma-confirm-msg-inline">
                          <strong title={f.name}>{f.name}</strong> 삭제할까요?
                        </span>
                        <button className="ma-btn danger" disabled={deleting} onClick={() => confirmDelete()}>
                          {deleting ? '삭제 중…' : '삭제'}
                        </button>
                        <button className="ma-btn ghost" disabled={deleting} onClick={() => cancelDelete()}>
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="ma-card-actions">
                        <button className="ma-btn" onClick={() => copyUrl(f.url)} disabled={!f.url}>
                          {copied === f.url ? '복사됨' : 'URL 복사'}
                        </button>
                        <button className="ma-btn danger" onClick={() => armDeleteFile(f)} disabled={!f.fileId}>
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!listLoading && files.length === 0 && !listError && !accessError && (
              <p className="ma-empty">
                {search
                  ? globalSearch
                    ? '전체 폴더에서 검색 결과가 없습니다.'
                    : `‘${browsePath}’ 폴더에서 검색 결과가 없습니다.`
                  : '이 폴더에 표시할 항목이 없습니다.'}
              </p>
            )}

            <div className="ma-list-footer">
              {listLoading && <span>불러오는 중…</span>}
              {!listLoading && hasMore && (
                <button className="ma-btn" onClick={loadMore}>
                  더 보기
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 이동/복사 대상 선택 모달 */}
      <FolderPickerModal
        open={!!moveState}
        title={
          moveState?.kind === 'folder'
            ? '폴더 이동'
            : moveState?.mode === 'copy'
            ? '파일 복사'
            : '파일 이동'
        }
        subject={
          moveState?.kind === 'folder'
            ? `${moveState.name} 폴더`
            : `파일 ${moveState?.paths.length ?? 0}개`
        }
        initialPath={browsePath}
        disabledRoot={moveState?.kind === 'folder' ? moveState.path : null}
        confirmLabel={moveState?.kind === 'files' && moveState.mode === 'copy' ? '복사' : '이동'}
        busy={moveBusy}
        error={moveError}
        onCancel={() => {
          if (!moveBusy) {
            setMoveState(null);
            setMoveError(null);
          }
        }}
        onConfirm={runMove}
      />

      {/* 이름변경 모달 */}
      {renameTarget && (
        <div className="ma-modal-overlay" onMouseDown={() => !renameBusy && setRenameTarget(null)}>
          <div
            className="ma-modal ma-modal-narrow"
            role="dialog"
            aria-modal="true"
            aria-label="이름 변경"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="ma-modal-head">
              <h3>{renameTarget.kind === 'folder' ? '폴더 이름 변경' : '파일 이름 변경'}</h3>
              <span className="ma-modal-subject">{renameTarget.name}</span>
            </div>
            <p className="ma-modal-warn">
              이름을 바꾸면 <strong>기존 URL이 즉시 바뀝니다.</strong>
              {renameTarget.kind === 'folder' && ' 폴더 안 모든 파일의 URL이 함께 바뀝니다.'} 이미
              게시된 글이 예전 URL을 참조하고 있으면 이미지가 깨질 수 있습니다.
            </p>
            <form
              className="ma-modal-manual"
              onSubmit={(e) => {
                e.preventDefault();
                runRename();
              }}
            >
              <label htmlFor="ma-rename-input">새 이름</label>
              <div className="ma-modal-manual-row">
                <input
                  id="ma-rename-input"
                  type="text"
                  autoFocus
                  value={renameValue}
                  disabled={renameBusy}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
              </div>
              <p className="ma-modal-hint">
                {renameTarget.kind === 'file'
                  ? '확장자를 포함한 전체 파일명을 입력하세요. 공백 등 허용되지 않는 문자는 _ 로 바뀝니다.'
                  : '/ \\ .. 는 사용할 수 없습니다.'}
              </p>
            </form>
            {renameError && <p className="ma-error">{renameError}</p>}
            <div className="ma-modal-actions">
              <button
                type="button"
                className="ma-btn ghost"
                onClick={() => setRenameTarget(null)}
                disabled={renameBusy}
              >
                취소
              </button>
              <button type="button" className="ma-btn primary" onClick={runRename} disabled={renameBusy}>
                {renameBusy ? '변경 중…' : '이름 변경'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 파일 상세 패널 — 데스크톱 우측 드로어 / 모바일 하단 시트 */}
      {detailId && (
        <div className="ma-drawer-overlay" onMouseDown={() => setDetailId(null)}>
          <aside
            className="ma-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="파일 상세"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="ma-drawer-head">
              <h3>파일 상세</h3>
              <button type="button" className="ma-drawer-x" onClick={() => setDetailId(null)} aria-label="닫기">
                ×
              </button>
            </div>
            {detailLoading && <p className="ma-sub">불러오는 중…</p>}
            {!detailLoading && !detail && <p className="ma-error">상세 정보를 불러오지 못했습니다.</p>}
            {detail && (
              <>
                {/* 정보 / 편집 탭 */}
                <div className="ma-edit-tabs ma-drawer-tabs" role="tablist" aria-label="상세 보기">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'info'}
                    className={`ma-edit-tab ${detailTab === 'info' ? 'on' : ''}`}
                    onClick={() => setDetailTab('info')}
                  >
                    정보
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'edit'}
                    className={`ma-edit-tab ${detailTab === 'edit' ? 'on' : ''}`}
                    onClick={() => setDetailTab('edit')}
                  >
                    편집
                  </button>
                </div>
              </>
            )}
            {detail && detailTab === 'edit' && (
              <ImageEditPanel
                file={detail}
                onCopy={copyUrl}
                copiedUrl={copied}
                onSaved={(msg) => {
                  setNotice(msg);
                  // 원본 교체 후: 목록 썸네일·상세를 캐시버스터로 강제 갱신하고 용량 재집계.
                  setCacheBust(Date.now());
                  reload();
                  loadUsage();
                  const id = detail.fileId;
                  setDetailId(null);
                  window.setTimeout(() => setDetailId(id), 0);
                }}
              />
            )}
            {detail && detailTab === 'info' && (
              <>
                {detail.url && (
                  <div className="ma-drawer-thumb">
                    <img src={bust(ikUrl(detail.url, { w: 600 }))} alt={detail.name} />
                  </div>
                )}
                <dl className="ma-detail">
                  <dt>이름</dt>
                  <dd title={detail.name}>{detail.name}</dd>
                  <dt>경로</dt>
                  <dd title={detail.filePath}>{detail.filePath}</dd>
                  <dt>용량</dt>
                  <dd>{formatBytes(detail.size)}</dd>
                  <dt>해상도</dt>
                  <dd>{detail.width && detail.height ? `${detail.width} × ${detail.height}` : '-'}</dd>
                  <dt>형식</dt>
                  <dd>{detail.mime || detail.fileType || '-'}</dd>
                  <dt>업로드</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                  <dt>수정</dt>
                  <dd>{formatDate(detail.updatedAt)}</dd>
                  <dt>태그</dt>
                  <dd>{detail.tags && detail.tags.length > 0 ? detail.tags.join(', ') : '-'}</dd>
                </dl>

                <div className="ma-detail-urls">
                  <div className="ma-side-title">URL 복사</div>
                  <div className="ma-detail-url-btns">
                    {URL_PRESETS.map((p) => {
                      const u = p.w ? ikUrl(detail.url, { w: p.w }) : detail.url;
                      return (
                        <button key={p.label} type="button" className="ma-btn" onClick={() => copyUrl(u)}>
                          {copied === u ? '복사됨' : p.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="ma-modal-hint">GIF는 변환 파라미터를 붙이지 않고 원본 URL을 그대로 복사합니다.</p>
                </div>

                <div className="ma-modal-actions">
                  <button
                    type="button"
                    className="ma-btn"
                    onClick={() => {
                      setMoveError(null);
                      setMoveState({ kind: 'files', mode: 'move', paths: [detail.filePath] });
                    }}
                  >
                    이동
                  </button>
                  <button
                    type="button"
                    className="ma-btn"
                    onClick={() => openRename({ kind: 'file', filePath: detail.filePath, name: detail.name })}
                  >
                    이름 변경
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    /* noop */
  }
}

export default MediaAdmin;
