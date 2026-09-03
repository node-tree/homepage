// ═══════════════════════════════════════════════════════════════
// FolderTree — ImageKit 폴더 트리 (지연 로드)
//   · 노드를 펼칠 때만 GET /imagekit/folders?path= 로 자식을 가져온다(전체 재귀 금지 —
//     폴더 수만큼 API 콜이 나가면 Render 콜드스타트와 겹쳐 체감이 무너진다).
//   · 조회 결과는 모듈 캐시에 남겨 재마운트/모달 재오픈 시 즉시 그린다(TTL 60초).
//   · 이동 대상 선택 모달(FolderPickerModal)에서도 그대로 재사용한다.
//   · 아이콘은 인라인 SVG(이모지 금지). 색은 MediaAdmin 팔레트만 사용.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { imagekitAdminAPI, IkFolder } from '../../services/imagekitAdminApi';
import { isInside, normalizePath, parentPath } from '../../utils/ikPath';

// ── 모듈 캐시: path → { at, folders } ──────────────────────────
const CACHE_TTL = 60_000;
const cache = new Map<string, { at: number; folders: IkFolder[] }>();

/** 캐시 무효화 — 폴더 생성/삭제/이동 후 호출한다. */
export function invalidateFolderCache(path?: string): void {
  if (!path) {
    cache.clear();
    return;
  }
  const norm = normalizePath(path);
  cache.delete(norm);
  const parent = parentPath(norm);
  if (parent) cache.delete(parent);
}

/** 캐시에 남아 있는 모든 폴더 경로(자동완성·폴더 검색 보조). */
export function cachedFolderPaths(): string[] {
  const out = new Set<string>();
  cache.forEach((v) => v.folders.forEach((f) => f.folderPath && out.add(normalizePath(f.folderPath))));
  return Array.from(out);
}

async function fetchChildren(path: string): Promise<IkFolder[]> {
  const norm = normalizePath(path);
  const hit = cache.get(norm);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.folders;
  const folders = await imagekitAdminAPI.listFolders({ path: norm === '/' ? undefined : norm });
  cache.set(norm, { at: Date.now(), folders });
  return folders;
}

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className={`mt-chev ${open ? 'open' : ''}`}>
    <path d="M4 2.5L8 6l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" className="mt-folder-ic">
    <path
      d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.2l1.2 1.4h5.6a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

interface NodeProps {
  path: string;
  label: string;
  depth: number;
  currentPath: string;
  expanded: Set<string>;
  childrenMap: Record<string, IkFolder[]>;
  loadingSet: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  /** 이 경로(및 하위)는 선택 불가 — 자기 자신으로 이동 방지 */
  disabledRoot?: string | null;
}

const TreeNode: React.FC<NodeProps> = ({
  path,
  label,
  depth,
  currentPath,
  expanded,
  childrenMap,
  loadingSet,
  onToggle,
  onSelect,
  disabledRoot,
}) => {
  const norm = normalizePath(path);
  const isOpen = expanded.has(norm);
  const kids = childrenMap[norm];
  const isCurrent = normalizePath(currentPath) === norm;
  const disabled = !!disabledRoot && isInside(norm, disabledRoot);
  const loading = loadingSet.has(norm);

  return (
    <li className="mt-node">
      <div className={`mt-row ${isCurrent ? 'current' : ''} ${disabled ? 'disabled' : ''}`} style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          type="button"
          className="mt-toggle"
          onClick={() => onToggle(norm)}
          aria-label={isOpen ? `${label} 접기` : `${label} 펼치기`}
          aria-expanded={isOpen}
        >
          <ChevronIcon open={isOpen} />
        </button>
        <button
          type="button"
          className="mt-label"
          onClick={() => !disabled && onSelect(norm)}
          disabled={disabled}
          title={disabled ? '자기 자신(또는 하위)으로는 이동할 수 없습니다' : norm}
        >
          <FolderIcon />
          <span className="mt-name">{label}</span>
        </button>
      </div>
      {isOpen && (
        <ul className="mt-children">
          {loading && <li className="mt-hint">불러오는 중…</li>}
          {!loading && kids && kids.length === 0 && <li className="mt-hint">하위 폴더 없음</li>}
          {!loading &&
            kids &&
            kids.map((f) => (
              <TreeNode
                key={f.folderPath || f.name}
                path={f.folderPath || `${norm}/${f.name}`}
                label={f.name}
                depth={depth + 1}
                currentPath={currentPath}
                expanded={expanded}
                childrenMap={childrenMap}
                loadingSet={loadingSet}
                onToggle={onToggle}
                onSelect={onSelect}
                disabledRoot={disabledRoot}
              />
            ))}
        </ul>
      )}
    </li>
  );
};

export interface FolderTreeProps {
  currentPath: string;
  onSelect: (path: string) => void;
  /** 이 경로와 하위는 선택 불가(폴더 이동 시 자기 자신 방지) */
  disabledRoot?: string | null;
  /** 캐시 무효화 트리거 — 값이 바뀌면 열려 있는 노드를 다시 가져온다. */
  refreshKey?: number;
  className?: string;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  currentPath,
  onSelect,
  disabledRoot = null,
  refreshKey = 0,
  className = '',
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['/']));
  const [childrenMap, setChildrenMap] = useState<Record<string, IkFolder[]>>({});
  const [loadingSet, setLoadingSet] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const ensureChildren = useCallback(async (path: string, force = false) => {
    const norm = normalizePath(path);
    if (!force) {
      const hit = cache.get(norm);
      if (hit && Date.now() - hit.at < CACHE_TTL) {
        setChildrenMap((m) => ({ ...m, [norm]: hit.folders }));
        return;
      }
    } else {
      cache.delete(norm);
    }
    setLoadingSet((s) => new Set(s).add(norm));
    try {
      const folders = await fetchChildren(norm);
      setChildrenMap((m) => ({ ...m, [norm]: folders }));
      setError(null);
    } catch (e: any) {
      setError(e?.message || '폴더를 불러오지 못했습니다.');
    } finally {
      setLoadingSet((s) => {
        const next = new Set(s);
        next.delete(norm);
        return next;
      });
    }
  }, []);

  // 현재 경로의 조상들을 자동으로 펼쳐 위치를 드러낸다.
  useEffect(() => {
    const norm = normalizePath(currentPath);
    const chain: string[] = ['/'];
    let acc = '';
    for (const seg of norm.split('/').filter(Boolean)) {
      acc += `/${seg}`;
      chain.push(acc);
    }
    // 현재 노드 자신은 펼치지 않아도 되지만, 조상은 모두 펼친다.
    setExpanded((prev) => {
      const next = new Set(prev);
      chain.forEach((p) => next.add(p));
      return next;
    });
    chain.forEach((p) => {
      ensureChildren(p);
    });
  }, [currentPath, ensureChildren]);

  // 외부에서 폴더가 바뀌면(생성·삭제·이동) 펼쳐진 노드를 강제 재조회.
  useEffect(() => {
    if (!refreshKey) return;
    expanded.forEach((p) => ensureChildren(p, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const onToggle = useCallback(
    (path: string) => {
      const norm = normalizePath(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(norm)) next.delete(norm);
        else {
          next.add(norm);
          ensureChildren(norm);
        }
        return next;
      });
    },
    [ensureChildren]
  );

  const isRootCurrent = normalizePath(currentPath) === '/';
  const rootDisabled = !!disabledRoot && isInside('/', disabledRoot);

  const body = useMemo(() => {
    // 파생값은 memo 안에서 계산한다 — 밖에서 `|| []` 를 쓰면 매 렌더 새 배열이 되어
    // deps 가 항상 달라지고 memo 가 무력화된다.
    const rootChildren = childrenMap['/'] || [];
    const rootLoading = loadingSet.has('/');
    return (
      <ul className="mt-children">
        {rootLoading && <li className="mt-hint">불러오는 중…</li>}
        {!rootLoading && rootChildren.length === 0 && <li className="mt-hint">폴더 없음</li>}
        {rootChildren.map((f) => (
          <TreeNode
            key={f.folderPath || f.name}
            path={f.folderPath || `/${f.name}`}
            label={f.name}
            depth={1}
            currentPath={currentPath}
            expanded={expanded}
            childrenMap={childrenMap}
            loadingSet={loadingSet}
            onToggle={onToggle}
            onSelect={onSelect}
            disabledRoot={disabledRoot}
          />
        ))}
      </ul>
    );
  }, [currentPath, expanded, childrenMap, loadingSet, onToggle, onSelect, disabledRoot]);

  return (
    <div className={`ma-tree ${className}`}>
      <ul className="mt-root" role="tree" aria-label="폴더 트리">
        <li className="mt-node">
          <div className={`mt-row ${isRootCurrent ? 'current' : ''} ${rootDisabled ? 'disabled' : ''}`}>
            <span className="mt-toggle mt-toggle-static" aria-hidden="true" />
            <button
              type="button"
              className="mt-label"
              onClick={() => !rootDisabled && onSelect('/')}
              disabled={rootDisabled}
              title="/"
            >
              <FolderIcon />
              <span className="mt-name">루트</span>
            </button>
          </div>
          {body}
        </li>
      </ul>
      {error && <p className="mt-error">{error}</p>}
    </div>
  );
};

export default FolderTree;
