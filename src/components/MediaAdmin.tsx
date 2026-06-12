// ═══════════════════════════════════════════════════════════════
// 이미지호스팅 — ImageKit 관리자 미디어 페이지 (admin 전용)
//   · 업로드: 드래그앤드롭 + 파일선택. 업로드 전 브라우저 자동 리사이즈(긴 변 2400px,
//     JPEG 0.82, GIF 제외). ImageKit 으로 직접 multipart 업로드(백엔드 /auth 서명).
//   · 브라우징: /list 그리드. 폴더(상단)·파일을 구분해 표시. 폴더 클릭으로 진입,
//     브레드크럼/상위(..) 로 이동. 썸네일은 ikUrl 헬퍼(?tr=w-300,f-auto, GIF 제외).
//   · 자체 DB 저장 없음 — 반환 URL 표시 + 복사. 삭제는 확인 다이얼로그.
//   · 인증: 사이트 세션(auth_token). 비로그인 → /login 리다이렉트(isLoading 대기).
//   · 인가: role:'admin' 만 접근. 비admin(role:'user') 은 백엔드가 403 을 반환하므로
//     API 호출 전에 클라이언트에서 차단하고 안내 문구를 표시한다.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  imagekitAdminAPI,
  IkFile,
  IkUploadResult,
  IkUsage,
} from '../services/imagekitAdminApi';
import { prepareImageForUpload } from '../utils/imageResize';
import { ikUrl } from '../utils/ikUrl';
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

function formatBytes(n: number): string {
  if (!n && n !== 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatGB(n: number): string {
  return (n / (1024 * 1024 * 1024)).toFixed(2);
}

// 폴더 판별 — 백엔드가 type:'folder' 를 주거나, url 이 없고 folderPath 가 있으면 폴더.
function isFolder(f: IkFile): boolean {
  return f.type === 'folder' || (!f.url && !!(f.folderPath || f.folderId));
}

// 경로 정규화: 항상 '/' 시작, 중복 슬래시 합치기, 끝 슬래시 제거(루트 제외).
function normalizePath(p: string): string {
  if (!p) return '/';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\/+/g, '/'); // 중복 슬래시(//) 방지 — 루트('/') 하위 결합 시 안전
  if (out.length > 1) out = out.replace(/\/+$/, '');
  return out || '/';
}

// 브레드크럼 세그먼트 목록. 루트는 항상 첫 항목.
//   '/' → [{label:'루트', path:'/'}]
//   '/mcwjd/work' → 루트, mcwjd(/mcwjd), work(/mcwjd/work)
function breadcrumbSegments(path: string): { label: string; path: string }[] {
  const norm = normalizePath(path);
  const segs: { label: string; path: string }[] = [{ label: '루트', path: '/' }];
  if (norm === '/') return segs;
  const parts = norm.split('/').filter(Boolean);
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    segs.push({ label: part, path: acc });
  }
  return segs;
}

// 상위 폴더 경로. 루트면 null.
function parentPath(path: string): string | null {
  const norm = normalizePath(path);
  if (norm === '/') return null;
  const idx = norm.lastIndexOf('/');
  return idx <= 0 ? '/' : norm.slice(0, idx);
}

const MediaAdmin: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 업로드 설정. 업로드 대상 폴더는 별도 입력 없이 아래 「라이브러리」에서 현재 보고 있는
  // 폴더(browsePath)를 그대로 따라간다(루트면 기본 /uploads).
  const [useUnique, setUseUnique] = useState(true);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 브라우징 — 기본 진입 경로는 루트('/') 라 최상위 폴더들이 바로 보인다.
  const [files, setFiles] = useState<IkFile[]>([]);
  const [browsePath, setBrowsePath] = useState('/');
  const [pathInput, setPathInput] = useState('/');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

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
      window.location.href = '/login';
    }
  }, [isLoading, isAuthenticated]);

  const loadList = useCallback(
    async (reset: boolean) => {
      setListLoading(true);
      setListError(null);
      const nextSkip = reset ? 0 : skip;
      try {
        // 검색·목록 모두 현재 폴더(browsePath) 기준으로 스코프 — 폴더 한 곳에서만 다룬다.
        const scopePath = normalizePath(browsePath || '/');
        const result = await imagekitAdminAPI.listFiles({
          path: scopePath !== '/' ? scopePath : undefined,
          searchQuery: search
            ? `name LIKE "%${search.replace(/["%\\]/g, '\\$&')}%"`
            : undefined,
          skip: nextSkip,
          limit: PAGE_SIZE,
        });
        setHasMore(result.length === PAGE_SIZE);
        setFiles((prev) => (reset ? result : [...prev, ...result]));
        setSkip(nextSkip + result.length);
      } catch (e: any) {
        if (e?.code === 'FORBIDDEN') {
          setListError('관리자 권한이 필요합니다.');
          return;
        }
        if (e?.code === 'AUTH_EXPIRED') {
          window.location.href = '/login';
          return;
        }
        setListError(e?.message || '목록을 불러오지 못했습니다.');
      } finally {
        setListLoading(false);
      }
    },
    [browsePath, search, skip]
  );

  // 사용 용량 로드 (마운트 + 업로드/삭제 성공 후 갱신). 실패해도 페이지는 동작.
  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const u = await imagekitAdminAPI.getUsage();
      setUsage(u);
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        window.location.href = '/login';
        return;
      }
      // 용량 조회 실패는 치명적이지 않음 — 표시만 생략한다.
    } finally {
      setUsageLoading(false);
    }
  }, []);

  // 최초 + 경로/검색 변경 시 새로 로드 (admin 만)
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    setSkip(0);
    setPendingDelete(null);
    loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, browsePath, search]);

  // 마운트 시 용량 1회 로드 (admin 만)
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin]);

  // 폴더 진입 = 검색 스코프 변경. 활성 검색어는 유지해(Picker 와 동일) 새 폴더 기준으로
  // 검색이 재실행된다(목록 effect 가 browsePath 변경을 받아 같은 search 로 재조회).
  const enterFolder = useCallback((target: string) => {
    const norm = normalizePath(target);
    setBrowsePath(norm);
    setPathInput(norm);
  }, []);

  // 현재 경로 아래 새 폴더 생성 → 성공 시 진입.
  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    if (/[\\/]/.test(name) || name.includes('..')) {
      alert('폴더 이름에 / \\ .. 는 사용할 수 없습니다.');
      return;
    }
    setCreatingFolder(true);
    try {
      await imagekitAdminAPI.createFolder(name, browsePath || '/');
      setNewFolderName('');
      enterFolder(`${normalizePath(browsePath)}/${name}`);
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        window.location.href = '/login';
        return;
      }
      alert(e?.message || '폴더 생성에 실패했습니다.');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, creatingFolder, browsePath, enterFolder]);

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
        loadUsage(); // 삭제 후 용량 갱신
      } else {
        await imagekitAdminAPI.deleteFolder(pendingDelete.path);
        const cur = normalizePath(browsePath);
        if (cur === pendingDelete.path || cur.startsWith(pendingDelete.path + '/')) {
          const up = parentPath(pendingDelete.path) || '/';
          enterFolder(up); // 현재(또는 하위) 폴더를 지웠으면 상위로
        } else {
          loadList(true); // 목록 갱신
        }
        loadUsage();
      }
      setPendingDelete(null);
    } catch (e: any) {
      if (e?.code === 'FORBIDDEN') {
        alert('삭제 권한이 없습니다.');
      } else if (e?.code === 'AUTH_EXPIRED') {
        window.location.href = '/login';
        return;
      } else {
        alert(e?.message || '삭제에 실패했습니다.');
      }
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, deleting, browsePath, loadUsage, loadList, enterFolder]);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) return;

      let anyDone = false;
      for (const file of arr) {
        const rowId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setUploads((prev) => [
          { id: rowId, name: file.name, status: 'resizing' },
          ...prev,
        ]);
        try {
          const prepared = await prepareImageForUpload(file);
          setUploads((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, status: 'uploading', resized: prepared.resized }
                : r
            )
          );
          // 업로드 대상 = 라이브러리에서 현재 보고 있는 폴더(루트면 /uploads).
          const uploadFolder =
            normalizePath(browsePath || '/') !== '/' ? normalizePath(browsePath) : '/uploads';
          const result: IkUploadResult = await imagekitAdminAPI.uploadFile(
            prepared.blob,
            prepared.fileName,
            { folder: uploadFolder, useUniqueFileName: useUnique }
          );
          anyDone = true;
          setUploads((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, status: 'done', url: result.url, name: result.name }
                : r
            )
          );
        } catch (e: any) {
          if (e?.code === 'FORBIDDEN') {
            setUploads((prev) =>
              prev.map((r) =>
                r.id === rowId
                  ? { ...r, status: 'error', error: '관리자 권한이 필요합니다.' }
                  : r
              )
            );
            return;
          }
          if (e?.code === 'AUTH_EXPIRED') {
            window.location.href = '/login';
            return;
          }
          setUploads((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, status: 'error', error: e?.message || '업로드 실패' }
                : r
            )
          );
        }
      }
      // 업로드 대상 = 현재 보고 있는 폴더 → 업로드 후 목록 갱신(검색 중이면 스코프 동일).
      loadList(true);
      if (anyDone) loadUsage(); // 업로드 성공 시 용량 갱신
    },
    [useUnique, browsePath, loadList, loadUsage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  // 폴더 먼저, 그 다음 파일. (검색 중에는 보통 파일만 오지만 동일 규칙 적용.)
  const { folders, plainFiles } = useMemo(() => {
    const fol: IkFile[] = [];
    const fil: IkFile[] = [];
    for (const f of files) {
      if (isFolder(f)) fol.push(f);
      else fil.push(f);
    }
    return { folders: fol, plainFiles: fil };
  }, [files]);

  const crumbs = useMemo(() => breadcrumbSegments(browsePath), [browsePath]);
  const parent = useMemo(() => parentPath(browsePath), [browsePath]);
  // 업로드 대상 표시 — 라이브러리에서 보고 있는 폴더(루트면 기본 /uploads).
  const uploadDest = useMemo(
    () => (normalizePath(browsePath || '/') !== '/' ? normalizePath(browsePath) : '/uploads'),
    [browsePath]
  );

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
        <h2>라이브러리</h2>

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
                  <button
                    type="button"
                    className="ma-crumb"
                    onClick={() => enterFolder(c.path)}
                  >
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
                ↑ 상위 폴더
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
                  if (e.key === "Enter") {
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
                {creatingFolder ? "생성 중…" : "+ 새 폴더"}
              </button>
            </span>
        </nav>

        {search && (
          <p className="ma-scope-hint">
            <strong>{browsePath}</strong> 폴더에서 “{search}” 검색 결과
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
            />
            <button className="ma-btn" type="submit">
              이동
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch((document.getElementById('ma-search') as HTMLInputElement)?.value || '');
            }}
          >
            <input id="ma-search" type="text" placeholder="파일명 검색" defaultValue={search} />
            <button className="ma-btn" type="submit">
              검색
            </button>
            {search && (
              <button
                type="button"
                className="ma-btn ghost"
                onClick={() => {
                  setSearch('');
                  const el = document.getElementById('ma-search') as HTMLInputElement;
                  if (el) el.value = '';
                }}
              >
                검색 해제
              </button>
            )}
          </form>
        </div>

        {listError && <p className="ma-error">{listError}</p>}

        <div className="ma-grid">
          {/* 폴더 — 상단 먼저, 클릭 시 진입. 우상단 휴지통 → 확인 2단계 삭제. */}
          {!search &&
            folders.map((f) => {
              const target = f.folderPath || `${normalizePath(browsePath)}/${f.name}`;
              const norm = normalizePath(target);
              const armed = pendingDelete?.kind === 'folder' && pendingDelete.path === norm;
              return (
                <div
                  className={`ma-card ma-folder-wrap ${armed ? 'armed' : ''}`}
                  key={f.folderId || f.folderPath || `folder-${f.name}`}
                >
                  <button
                    type="button"
                    className="ma-folder-open"
                    onClick={() => enterFolder(target)}
                    title={`${f.name} 폴더 열기`}
                  >
                    <div className="ma-thumb ma-folder-thumb">
                      <span className="ma-folder-icon" aria-hidden="true">
                        📁
                      </span>
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
                    🗑
                  </button>
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

          {/* 파일 — 썸네일 + URL복사 / 삭제(확인 2단계) */}
          {plainFiles.map((f) => {
            const isImage = f.fileType === 'image' || f.fileType === 'IMAGE';
            const thumb = isImage && f.url ? ikUrl(f.url, { w: 300 }) : null;
            const armed = pendingDelete?.kind === 'file' && pendingDelete.id === f.fileId;
            return (
              <div
                className={`ma-card ${armed ? 'armed' : ''}`}
                key={f.fileId || f.filePath || f.name}
              >
                <div className="ma-thumb">
                  {thumb ? (
                    <img src={thumb} alt={f.name} loading="lazy" />
                  ) : (
                    <div className="ma-noimg">{f.fileType || 'file'}</div>
                  )}
                </div>
                <div className="ma-card-meta">
                  <div className="ma-card-name" title={f.name}>
                    {f.name}
                  </div>
                  <div className="ma-card-info">
                    {formatBytes(f.size)}
                    {f.width && f.height ? ` · ${f.width}×${f.height}` : ''}
                  </div>
                </div>
                {armed ? (
                  <div className="ma-card-actions ma-confirm-inline" role="alertdialog" aria-label="파일 삭제 확인">
                    <span className="ma-confirm-msg-inline">
                      <strong title={f.name}>{f.name}</strong> 삭제할까요?
                    </span>
                    <button
                      className="ma-btn danger"
                      disabled={deleting}
                      onClick={() => confirmDelete()}
                    >
                      {deleting ? '삭제 중…' : '삭제'}
                    </button>
                    <button
                      className="ma-btn ghost"
                      disabled={deleting}
                      onClick={() => cancelDelete()}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="ma-card-actions">
                    <button
                      className="ma-btn"
                      onClick={() => copyUrl(f.url)}
                      disabled={!f.url}
                    >
                      {copied === f.url ? '복사됨' : 'URL 복사'}
                    </button>
                    <button
                      className="ma-btn danger"
                      onClick={() => armDeleteFile(f)}
                      disabled={!f.fileId}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!listLoading && files.length === 0 && !listError && (
          <p className="ma-empty">
            {search
              ? `‘${browsePath}’ 폴더에서 검색 결과가 없습니다.`
              : '이 폴더에 표시할 항목이 없습니다.'}
          </p>
        )}

        <div className="ma-list-footer">
          {listLoading && <span>불러오는 중…</span>}
          {!listLoading && hasMore && (
            <button className="ma-btn" onClick={() => loadList(false)}>
              더 보기
            </button>
          )}
        </div>
      </section>
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
