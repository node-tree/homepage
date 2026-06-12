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
  // 삭제 2단계 확인 — 휴지통 클릭으로 무장(pendingDelete) 후 확인 클릭으로 실행.
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'file'; id: string; name: string } | { kind: 'folder'; path: string; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(
    async (reset: boolean) => {
      setListLoading(true);
      setListError(null);
      const nextSkip = reset ? 0 : skip;
      try {
        // 폴더 설정과 검색을 연동: 현재 폴더(browsePath)를 항상 path 로 보내 검색·목록을
        // 같은 폴더로 스코프한다. 폴더를 바꾸면 검색 결과도 그 폴더 기준으로 갱신된다.
        const scopePath = normalizePath(browsePath || '/');
        const result = await imagekitAdminAPI.listFiles({
          // 루트('/')는 path 미지정과 동치 → 전체. 하위 폴더면 그 폴더로 스코프.
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
        if (e?.code === 'AUTH_EXPIRED') {
          setListError('인증이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }
        if (e?.code === 'FORBIDDEN') {
          setListError('관리자 권한이 필요합니다.');
          return;
        }
        // 복원/설정한 폴더가 삭제됐거나 목록 실패 → 루트로 graceful 폴백(비루트일 때).
        // 검색도 폴더 스코프이므로 검색 중에도 동일하게 폴백한다.
        if (browsePath && browsePath !== '/') {
          writeLastPath('/');
          setBrowsePath('/'); // browsePath 변경 → effect 가 루트로 재로드(검색어는 유지)
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
    setPendingDelete(null);
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
      setPendingDelete(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 폴더 진입 = 검색 스코프 변경. 활성 검색어는 유지해 새 폴더 기준으로 검색이 재실행된다.
  const enterFolder = useCallback((target: string) => {
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

  // 휴지통 클릭 = 삭제 무장(아직 안 지움). 같은 항목 다시 클릭하면 해제(토글).
  const armDeleteFile = useCallback((f: IkFile) => {
    setPendingDelete((p) =>
      p && p.kind === 'file' && p.id === f.fileId ? null : { kind: 'file', id: f.fileId, name: f.name }
    );
  }, []);
  const armDeleteFolder = useCallback((path: string, name: string) => {
    const norm = normalizePath(path);
    setPendingDelete((p) =>
      p && p.kind === 'folder' && p.path === norm ? null : { kind: 'folder', path: norm, name }
    );
  }, []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  // 확인 클릭 = 실제 삭제. 파일은 목록에서 제거, 폴더는 (현재 폴더 삭제 시) 상위로 이동.
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setListError(null);
    try {
      if (pendingDelete.kind === 'file') {
        await imagekitAdminAPI.deleteFile(pendingDelete.id);
        setFiles((prev) => prev.filter((f) => f.fileId !== pendingDelete.id));
        setSelected((prev) => {
          // 삭제된 파일이 선택돼 있었다면 선택 해제(url 기준).
          const target = files.find((f) => f.fileId === pendingDelete.id);
          if (!target) return prev;
          const next = new Set(prev);
          next.delete(target.url);
          return next;
        });
      } else {
        await imagekitAdminAPI.deleteFolder(pendingDelete.path);
        const cur = normalizePath(browsePath);
        if (cur === pendingDelete.path || cur.startsWith(pendingDelete.path + '/')) {
          // 현재 보고 있는(또는 그 하위) 폴더를 지웠으면 상위로 이동.
          const up = parentPath(pendingDelete.path) || '/';
          enterFolder(up);
        } else {
          loadList(true); // 목록에서만 제거 — 재조회로 갱신.
        }
      }
      setPendingDelete(null);
    } catch (e: any) {
      if (e?.code === 'AUTH_EXPIRED') {
        setListError('인증이 만료되었습니다. 다시 로그인해주세요.');
      } else if (e?.code === 'FORBIDDEN') {
        setListError('삭제 권한이 없습니다.');
      } else {
        setListError(e?.message || '삭제에 실패했습니다.');
      }
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, deleting, files, browsePath, enterFolder, loadList]);

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
          // 업로드 폴더 = 현재 설정한 폴더(browsePath). 검색 중에도 같은 폴더로 스코프되므로
          // 업로드도 그 폴더에 들어간다. 루트(폴더 미설정)일 때만 기본 /uploads.
          const scopeFolder = normalizePath(browsePath || '/');
          const uploadFolder = scopeFolder !== '/' ? scopeFolder : '/uploads';
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
          {parent !== null && (
            <button className="ikp-btn ghost" onClick={() => enterFolder(parent)}>
              ↑ 상위 폴더
            </button>
          )}
          <span className="ikp-path" title={search ? '검색은 이 폴더 기준으로 조회됩니다' : undefined}>
            {browsePath}
            {search && <em className="ikp-path-scope"> · 이 폴더에서 검색</em>}
          </span>
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
                const norm = normalizePath(target);
                const armed = pendingDelete?.kind === 'folder' && pendingDelete.path === norm;
                return (
                  <div
                    key={f.folderId || f.folderPath || `fol-${f.name}`}
                    className={`ikp-folder-wrap ${armed ? 'armed' : ''}`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="ikp-folder"
                      onClick={() => enterFolder(target)}
                      title={`${f.name} 폴더 열기`}
                    >
                      <span className="ikp-folder-ic" aria-hidden="true">📁</span>
                      <span className="ikp-folder-name">{f.name}</span>
                    </button>
                    <button
                      type="button"
                      className="ikp-trash"
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
                      <div className="ikp-confirm" role="alertdialog" aria-label="폴더 삭제 확인">
                        <p className="ikp-confirm-msg">
                          <strong>{f.name}</strong> 폴더를 삭제할까요?
                          <span className="ikp-confirm-warn">폴더 안의 파일·하위 폴더까지 모두 삭제됩니다.</span>
                        </p>
                        <div className="ikp-confirm-actions">
                          <button
                            type="button"
                            className="ikp-btn danger"
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
                            className="ikp-btn ghost"
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
            </div>
          )}

          {/* 파일(이미지) 그리드 */}
          {plainFiles.length > 0 && (
            <div className="ikp-grid">
              {plainFiles.map((f) => {
                const isImage = f.fileType === 'image' || f.fileType === 'IMAGE';
                const thumb = isImage && f.url ? ikUrl(f.url, { w: 300 }) : null;
                const isSel = selected.has(f.url);
                const armed = pendingDelete?.kind === 'file' && pendingDelete.id === f.fileId;
                return (
                  <div
                    key={f.fileId || f.filePath || f.name}
                    className={`ikp-card-wrap ${armed ? 'armed' : ''}`}
                  >
                    <button
                      type="button"
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
                    {f.fileId && (
                      <button
                        type="button"
                        className="ikp-trash"
                        title={`${f.name} 삭제`}
                        aria-label={`${f.name} 삭제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          armDeleteFile(f);
                        }}
                      >
                        🗑
                      </button>
                    )}
                    {armed && (
                      <div className="ikp-confirm" role="alertdialog" aria-label="파일 삭제 확인">
                        <p className="ikp-confirm-msg">
                          <strong>{f.name}</strong> 을(를) 삭제할까요?
                        </p>
                        <div className="ikp-confirm-actions">
                          <button
                            type="button"
                            className="ikp-btn danger"
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
                            className="ikp-btn ghost"
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
            </div>
          )}
        </div>

        {!listLoading && files.length === 0 && !listError && (
          <p className="ikp-empty">
            {search
              ? `‘${browsePath}’ 폴더에서 검색 결과가 없습니다.`
              : '항목이 없습니다.'}
          </p>
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
