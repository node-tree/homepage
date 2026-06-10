// ═══════════════════════════════════════════════════════════════
// ImageKitPicker — 에디터용 ImageKit 이미지 피커 모달
//   · MediaAdmin 의 브라우징/업로드 로직을 피커 형태로 재사용.
//   · 기존 이미지 검색·폴더 탐색 + 신규 업로드(장변 2400px 자동 리사이즈).
//   · 선택 시 onSelect(url) — 단일/다중 선택 지원.
//   · 삽입 URL 변환은 호출측(블록 직렬화)에서 ikUrl 규칙으로 처리.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  imagekitAdminAPI,
  IkFile,
  IkUploadResult,
} from '../../services/imagekitAdminApi';
import { prepareImageForUpload } from '../../utils/imageResize';
import { ikUrl } from '../../utils/ikUrl';

const PAGE_SIZE = 40;

function isFolder(f: IkFile): boolean {
  return f.type === 'folder' || (!f.url && !!(f.folderPath || f.folderId));
}
function normalizePath(p: string): string {
  if (!p) return '/';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\/+/g, '/');
  if (out.length > 1) out = out.replace(/\/+$/, '');
  return out || '/';
}
function parentPath(path: string): string | null {
  const norm = normalizePath(path);
  if (norm === '/') return null;
  const idx = norm.lastIndexOf('/');
  return idx <= 0 ? '/' : norm.slice(0, idx);
}

interface UploadRow {
  id: string;
  name: string;
  status: 'resizing' | 'uploading' | 'done' | 'error';
  url?: string;
  error?: string;
}

interface ImageKitPickerProps {
  open: boolean;
  onClose: () => void;
  // 선택 콜백. multiple 이면 여러 번 호출되거나 배열로 전달.
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
  title?: string;
}

const ImageKitPicker: React.FC<ImageKitPickerProps> = ({
  open,
  onClose,
  onSelect,
  multiple = false,
  title = '이미지 선택',
}) => {
  const [files, setFiles] = useState<IkFile[]>([]);
  const [browsePath, setBrowsePath] = useState('/');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [skip, setSkip] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [directUrl, setDirectUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(
    async (reset: boolean) => {
      setListLoading(true);
      setListError(null);
      const nextSkip = reset ? 0 : skip;
      try {
        const result = await imagekitAdminAPI.listFiles({
          path: search ? undefined : browsePath || undefined,
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
        if (e?.code === 'AUTH_EXPIRED') {
          setListError('인증이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }
        if (e?.code === 'FORBIDDEN') {
          setListError('관리자 권한이 필요합니다.');
          return;
        }
        setListError(e?.message || '목록을 불러오지 못했습니다.');
      } finally {
        setListLoading(false);
      }
    },
    [browsePath, search, skip]
  );

  useEffect(() => {
    if (!open) return;
    setSkip(0);
    loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, browsePath, search]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setUploads([]);
      setSearch('');
      setSearchInput('');
      setDirectUrl('');
    }
  }, [open]);

  const enterFolder = useCallback((target: string) => {
    setSearch('');
    setSearchInput('');
    setBrowsePath(normalizePath(target));
  }, []);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) return;
      for (const file of arr) {
        const rowId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setUploads((prev) => [{ id: rowId, name: file.name, status: 'resizing' }, ...prev]);
        try {
          const prepared = await prepareImageForUpload(file);
          setUploads((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, status: 'uploading' } : r))
          );
          const result: IkUploadResult = await imagekitAdminAPI.uploadFile(
            prepared.blob,
            prepared.fileName,
            { folder: '/uploads', useUniqueFileName: true }
          );
          setUploads((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, status: 'done', url: result.url, name: result.name } : r
            )
          );
          // 업로드 직후 자동 선택(단일이면 바로 삽입)
          if (!multiple) {
            onSelect([result.url]);
            onClose();
            return;
          }
          setSelected((prev) => new Set(prev).add(result.url));
        } catch (e: any) {
          setUploads((prev) =>
            prev.map((r) =>
              r.id === rowId ? { ...r, status: 'error', error: e?.message || '업로드 실패' } : r
            )
          );
        }
      }
    },
    [multiple, onSelect, onClose]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const { folders, plainFiles } = useMemo(() => {
    const fol: IkFile[] = [];
    const fil: IkFile[] = [];
    for (const f of files) {
      if (isFolder(f)) fol.push(f);
      else fil.push(f);
    }
    return { folders: fol, plainFiles: fil };
  }, [files]);

  const parent = useMemo(() => parentPath(browsePath), [browsePath]);

  const toggleSelect = (url: string) => {
    if (!multiple) {
      onSelect([url]);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const confirmMulti = () => {
    if (selected.size > 0) {
      onSelect(Array.from(selected));
    }
    onClose();
  };

  const submitDirect = () => {
    const u = directUrl.trim();
    if (!u) return;
    onSelect([u]);
    if (!multiple) onClose();
    setDirectUrl('');
  };

  if (!open) return null;

  return (
    <div className="ikp-overlay" onMouseDown={onClose}>
      <div className="ikp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ikp-head">
          <h3>{title}</h3>
          <button className="ikp-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        {/* 직접 URL 입력 */}
        <div className="ikp-direct">
          <input
            type="url"
            placeholder="이미지 URL 직접 붙여넣기"
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitDirect();
            }}
          />
          <button className="ikp-btn" onClick={submitDirect} disabled={!directUrl.trim()}>
            추가
          </button>
        </div>

        {/* 업로드 드롭존 */}
        <div
          className={`ikp-drop ${dragOver ? 'over' : ''}`}
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
          이미지를 드래그하거나 클릭해 업로드 (장변 2400px 자동 리사이즈 · GIF 원본)
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

        {uploads.some((u) => u.status !== 'done') && (
          <ul className="ikp-uploads">
            {uploads.map((u) => (
              <li key={u.id} className={u.status}>
                {u.name} —{' '}
                {u.status === 'resizing'
                  ? '리사이즈 중…'
                  : u.status === 'uploading'
                  ? '업로드 중…'
                  : u.status === 'error'
                  ? `오류: ${u.error}`
                  : '완료'}
              </li>
            ))}
          </ul>
        )}

        {/* 검색 / 경로 */}
        <div className="ikp-controls">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
          >
            <input
              type="text"
              placeholder="파일명 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button className="ikp-btn" type="submit">
              검색
            </button>
            {search && (
              <button
                type="button"
                className="ikp-btn ghost"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                }}
              >
                해제
              </button>
            )}
          </form>
          {!search && parent !== null && (
            <button className="ikp-btn ghost" onClick={() => enterFolder(parent)}>
              ↑ 상위 폴더
            </button>
          )}
          {!search && <span className="ikp-path">{browsePath}</span>}
        </div>

        {listError && <p className="ikp-error">{listError}</p>}

        <div className="ikp-grid">
          {!search &&
            folders.map((f) => {
              const target = f.folderPath || `${normalizePath(browsePath)}/${f.name}`;
              return (
                <button
                  key={f.folderId || f.folderPath || `fol-${f.name}`}
                  className="ikp-card ikp-folder"
                  onClick={() => enterFolder(target)}
                  title={`${f.name} 폴더 열기`}
                >
                  <span className="ikp-folder-ic">📁</span>
                  <span className="ikp-name">{f.name}</span>
                </button>
              );
            })}
          {plainFiles.map((f) => {
            const isImage = f.fileType === 'image' || f.fileType === 'IMAGE';
            const thumb = isImage && f.url ? ikUrl(f.url, { w: 300 }) : null;
            const isSel = selected.has(f.url);
            return (
              <button
                key={f.fileId || f.filePath || f.name}
                className={`ikp-card ${isSel ? 'sel' : ''}`}
                onClick={() => toggleSelect(f.url)}
                title={f.name}
              >
                {thumb ? (
                  <img src={thumb} alt={f.name} loading="lazy" />
                ) : (
                  <span className="ikp-noimg">{f.fileType || 'file'}</span>
                )}
                <span className="ikp-name">{f.name}</span>
                {isSel && <span className="ikp-check">✓</span>}
              </button>
            );
          })}
        </div>

        {!listLoading && files.length === 0 && !listError && (
          <p className="ikp-empty">{search ? '검색 결과가 없습니다.' : '항목이 없습니다.'}</p>
        )}

        <div className="ikp-foot">
          {listLoading && <span className="ikp-muted">불러오는 중…</span>}
          {!listLoading && hasMore && (
            <button className="ikp-btn ghost" onClick={() => loadList(false)}>
              더 보기
            </button>
          )}
          {multiple && (
            <button className="ikp-btn primary" onClick={confirmMulti} disabled={selected.size === 0}>
              {selected.size > 0 ? `${selected.size}개 추가` : '선택'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageKitPicker;
