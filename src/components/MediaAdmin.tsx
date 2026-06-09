// ═══════════════════════════════════════════════════════════════
// 이미지호스팅 — ImageKit 관리자 미디어 페이지 (admin 전용)
//   · 업로드: 드래그앤드롭 + 파일선택. 업로드 전 브라우저 자동 리사이즈(긴 변 2400px,
//     JPEG 0.82, GIF 제외). ImageKit 으로 직접 multipart 업로드(백엔드 /auth 서명).
//   · 브라우징: /list 그리드. 썸네일은 ikUrl 헬퍼(?tr=w-300,f-auto, GIF 제외).
//   · 자체 DB 저장 없음 — 반환 URL 표시 + 복사. 삭제는 확인 다이얼로그.
//   · 인증: 사이트 세션(auth_token). 비로그인 → /login 리다이렉트(isLoading 대기).
//   · 인가: role:'admin' 만 접근. 비admin(role:'user') 은 백엔드가 403 을 반환하므로
//     API 호출 전에 클라이언트에서 차단하고 안내 문구를 표시한다.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  imagekitAdminAPI,
  IkFile,
  IkUploadResult,
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

function formatBytes(n: number): string {
  if (!n && n !== 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const MediaAdmin: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // 업로드 설정
  const [folder, setFolder] = useState('/uploads');
  const [useUnique, setUseUnique] = useState(true);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 브라우징
  const [files, setFiles] = useState<IkFile[]>([]);
  const [browsePath, setBrowsePath] = useState('/uploads');
  const [pathInput, setPathInput] = useState('/uploads');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

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
        const result = await imagekitAdminAPI.listFiles({
          path: search ? undefined : browsePath || undefined,
          searchQuery: search
            ? `name LIKE "%${search.replace(/["%\\]/g, "\\$&")}%"`
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

  // 최초 + 경로/검색 변경 시 새로 로드 (admin 만)
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    setSkip(0);
    loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, browsePath, search]);

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

  const handleDelete = useCallback(async (file: IkFile) => {
    if (!window.confirm(`"${file.name}" 을(를) 영구 삭제합니다. 계속하시겠습니까?`)) return;
    try {
      await imagekitAdminAPI.deleteFile(file.fileId);
      setFiles((prev) => prev.filter((f) => f.fileId !== file.fileId));
    } catch (e: any) {
      if (e?.code === 'FORBIDDEN') {
        alert('관리자 권한이 필요합니다.');
        return;
      }
      if (e?.code === 'AUTH_EXPIRED') {
        window.location.href = '/login';
        return;
      }
      alert(e?.message || '삭제에 실패했습니다.');
    }
  }, []);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) return;

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
          const result: IkUploadResult = await imagekitAdminAPI.uploadFile(
            prepared.blob,
            prepared.fileName,
            { folder: folder || '/uploads', useUniqueFileName: useUnique }
          );
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
      // 업로드 후 현재 폴더를 보고 있으면 목록 갱신
      if (!search && (folder || '/uploads') === browsePath) {
        loadList(true);
      }
    },
    [folder, useUnique, search, browsePath, loadList]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
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

  return (
    <div className="media-admin">
      <header className="ma-header">
        <h1>이미지호스팅</h1>
        <p className="ma-sub">
          이미지는 ImageKit 라이브러리에만 저장됩니다(자체 DB 미저장). 무료 플랜 용량 3GB.
        </p>
      </header>

      {/* 업로드 영역 */}
      <section className="ma-section">
        <h2>업로드</h2>
        <div className="ma-upload-options">
          <label>
            폴더
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="/uploads"
            />
          </label>
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
            업로드 전 자동 리사이즈(긴 변 2400px, JPEG). GIF는 원본 그대로.
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
        <div className="ma-browse-controls">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch('');
              setBrowsePath(pathInput || '/');
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
          {files.map((f) => {
            const isImage = f.fileType === 'image' || f.fileType === 'IMAGE';
            const thumb = isImage ? ikUrl(f.url, { w: 300 }) : null;
            return (
              <div className="ma-card" key={f.fileId}>
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
                <div className="ma-card-actions">
                  <button className="ma-btn" onClick={() => copyUrl(f.url)}>
                    {copied === f.url ? '복사됨' : 'URL 복사'}
                  </button>
                  <button className="ma-btn danger" onClick={() => handleDelete(f)}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!listLoading && files.length === 0 && !listError && (
          <p className="ma-empty">표시할 파일이 없습니다.</p>
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
