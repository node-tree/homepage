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
// 피커 스타일(.ikp-*)은 BlockEditor.css 에 정의됨. BlockEditor 가 렌더되지 않는
// 화면(예: 꿈다락 마을일기)에서도 피커가 올바로 보이도록 직접 import 한다.
import './BlockEditor.css';

const PAGE_SIZE = 40;

// 마지막 사용 폴더 기억(같은 탭 세션 한정). 전역 단일 키 — 편집 세션 내 Work/마을일기 등에서 이어감.
const LAST_PATH_KEY = 'ikp:lastPath';
function readLastPath(): string {
  try {
    const v = sessionStorage.getItem(LAST_PATH_KEY);
    return v && typeof v === 'string' ? v : '/';
  } catch {
    return '/';
  }
}
function writeLastPath(path: string): void {
  try {
    sessionStorage.setItem(LAST_PATH_KEY, path || '/');
  } catch {
    /* sessionStorage 불가 환경 — 무시(기능만 비활성) */
  }
}

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
  const [browsePath, setBrowsePath] = useState<string>(() => readLastPath());
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
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
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
        // 복원한 폴더가 삭제됐거나 목록 실패 → 루트로 graceful 폴백(검색 중이 아닐 때, 비루트일 때).
        if (!search && browsePath && browsePath !== '/') {
          writeLastPath('/');
          setBrowsePath('/'); // browsePath 변경 → 위 effect 가 루트로 재로드
          setListError(null);
          return;
        }
        setListError(e?.message || '목록을 불러오지 못했습니다.');
      } finally {
        setListLoading(false);
      }
    },
    [browsePath, search, skip]
  );

  // 열릴 때마다 마지막 사용 폴더(sessionStorage)를 복원 — 다른 마운트/페이지에서도 이어진다.
  //   검색어는 복원하지 않는다. 저장값과 현재 경로가 같으면 그대로 둔다(불필요한 재로드 방지).
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const last = readLastPath();
      if (last !== browsePath) setBrowsePath(last);
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSkip(0);
    loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, browsePath, search]);

  useEffect(() => {
    if (!open) {
      // 닫힐 때 현재 폴더를 기억(검색어는 기억하지 않음 — 아래에서 초기화).
      writeLastPath(browsePath);
      setSelected(new Set());
      setUploads([]);
      setSearch('');
      setSearchInput('');
      setDirectUrl('');
      setNewFolderOpen(false);
      setNewFolderName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enterFolder = useCallback((target: string) => {
    setSearch('');
    setSearchInput('');
    const norm = normalizePath(target);
    setBrowsePath(norm);
    writeLastPath(norm);
  }, []);

  // 현재 경로 아래 새 폴더 생성 → 성공 시 해당 폴더로 진입.
  const submitNewFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    if (/[\\/]/.test(name) || name.includes('..')) {
      setListError('폴더 이름에 / \\ .. 는 사용할 수 없습니다.');
      return;
    }
    setCreatingFolder(true);
    setListError(null);
    try {
      await imagekitAdminAPI.createFolder(name, browsePath || '/');
      setNewFolderOpen(false);
      setNewFolderName('');
      // 생성한 폴더로 진입(목록 자동 갱신은 browsePath 변경 effect 가 처리).
      enterFolder(`${normalizePath(browsePath)}/${name}`);
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        setListError('인증이 만료되었습니다. 다시 로그인해주세요.');
      } else if (e?.code === 'FORBIDDEN') {
        setListError('관리자 권한이 필요합니다.');
      } else {
        setListError(e?.message || '폴더 생성에 실패했습니다.');
      }
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, creatingFolder, browsePath, enterFolder]);

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
          // 현재 보고 있는 폴더로 업로드(검색 중이거나 루트면 /uploads).
          const uploadFolder = !search && browsePath && browsePath !== '/' ? browsePath : '/uploads';
          const result: IkUploadResult = await imagekitAdminAPI.uploadFile(
            prepared.blob,
            prepared.fileName,
            { folder: uploadFolder, useUniqueFileName: true }
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
    [multiple, onSelect, onClose, search, browsePath]
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
          {!search &&
            (newFolderOpen ? (
              <span className="ikp-newfolder">
                <input
                  type="text"
                  autoFocus
                  placeholder="새 폴더 이름"
                  value={newFolderName}
                  disabled={creatingFolder}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitNewFolder();
                    } else if (e.key === "Escape") {
                      setNewFolderOpen(false);
                      setNewFolderName("");
                    }
                  }}
                />
                <button className="ikp-btn" type="button" disabled={creatingFolder} onClick={submitNewFolder}>
                  {creatingFolder ? "생성 중…" : "생성"}
                </button>
                <button
                  className="ikp-btn ghost"
                  type="button"
                  disabled={creatingFolder}
                  onClick={() => {
                    setNewFolderOpen(false);
                    setNewFolderName("");
                  }}
                >
                  취소
                </button>
              </span>
            ) : (
              <button className="ikp-btn ghost" type="button" onClick={() => setNewFolderOpen(true)}>
                + 새 폴더
              </button>
            ))}
        </div>

        {listError && <p className="ikp-error">{listError}</p>}

        <div className="ikp-body">
          {/* 폴더 — 파일 그리드와 분리된 자체 섹션(줄바꿈·ellipsis로 겹침 방지) */}
          {!search && folders.length > 0 && (
            <div className="ikp-folders" role="list" aria-label="폴더">
              {folders.map((f) => {
                const target = f.folderPath || `${normalizePath(browsePath)}/${f.name}`;
                return (
                  <button
                    key={f.folderId || f.folderPath || `fol-${f.name}`}
                    className="ikp-folder"
                    role="listitem"
                    onClick={() => enterFolder(target)}
                    title={`${f.name} 폴더 열기`}
                  >
                    <span className="ikp-folder-ic" aria-hidden="true">📁</span>
                    <span className="ikp-folder-name">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 파일(이미지) 그리드 */}
          {plainFiles.length > 0 && (
            <div className="ikp-grid">
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
          )}
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
