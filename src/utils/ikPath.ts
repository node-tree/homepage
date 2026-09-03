// ═══════════════════════════════════════════════════════════════
// ImageKit 경로 유틸 — MediaAdmin / ImageKitPicker 공용
//   두 컴포넌트가 각자 복제하고 있던 normalizePath·parentPath·isFolder 를 한 곳으로 모은다.
//   (복제본이 서로 조금씩 달라지면 "폴더 진입은 되는데 삭제는 안 되는" 류의 버그가 난다.)
//   · IkFile 타입을 import 하지 않고 구조적 최소 타입만 받는다 → services ↔ utils 순환 방지.
// ═══════════════════════════════════════════════════════════════

/** 폴더/파일 판별에 필요한 최소 형태 */
export interface IkItemLike {
  url?: string;
  type?: string;
  folderId?: string;
  folderPath?: string;
  name?: string;
}

/** 경로 정규화: 항상 '/' 시작, 중복 슬래시 합치기, 끝 슬래시 제거(루트 제외). */
export function normalizePath(p: string | null | undefined): string {
  if (!p) return '/';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\/+/g, '/');
  if (out.length > 1) out = out.replace(/\/+$/, '');
  return out || '/';
}

/** 상위 폴더 경로. 루트면 null. */
export function parentPath(path: string): string | null {
  const norm = normalizePath(path);
  if (norm === '/') return null;
  const idx = norm.lastIndexOf('/');
  return idx <= 0 ? '/' : norm.slice(0, idx);
}

/** 경로의 마지막 세그먼트(폴더/파일 이름). 루트는 '루트'. */
export function baseName(path: string): string {
  const norm = normalizePath(path);
  if (norm === '/') return '루트';
  return norm.slice(norm.lastIndexOf('/') + 1);
}

/** 부모 경로 + 이름 결합(중복 슬래시 없이). */
export function joinPath(parent: string, name: string): string {
  return normalizePath(`${normalizePath(parent)}/${name}`);
}

/** 경로 깊이(루트=0). */
export function pathDepth(path: string): number {
  return normalizePath(path).split('/').filter(Boolean).length;
}

/**
 * 브레드크럼 세그먼트 목록. 루트는 항상 첫 항목.
 *   '/' → [{label:'루트', path:'/'}]
 *   '/mcwjd/work' → 루트, mcwjd(/mcwjd), work(/mcwjd/work)
 */
export function breadcrumbSegments(path: string): { label: string; path: string }[] {
  const norm = normalizePath(path);
  const segs: { label: string; path: string }[] = [{ label: '루트', path: '/' }];
  if (norm === '/') return segs;
  let acc = '';
  for (const part of norm.split('/').filter(Boolean)) {
    acc += `/${part}`;
    segs.push({ label: part, path: acc });
  }
  return segs;
}

/** 폴더 판별 — 백엔드가 type:'folder' 를 주거나, url 이 없고 folderPath/folderId 가 있으면 폴더. */
export function isFolder(f: IkItemLike): boolean {
  return f.type === 'folder' || (!f.url && !!(f.folderPath || f.folderId));
}

/** 목록 항목의 실제 폴더 경로(folderPath 우선, 없으면 현재 경로 + 이름). */
export function folderTargetPath(f: IkItemLike, browsePath: string): string {
  return normalizePath(f.folderPath || joinPath(browsePath, f.name || ''));
}

/** ImageKit searchQuery 용 name LIKE 식. 따옴표·%·백슬래시를 이스케이프한다. */
export function nameLikeQuery(term: string): string {
  return `name LIKE "%${term.replace(/["%\\]/g, '\\$&')}%"`;
}

/** a 가 b(자기 자신 포함)의 하위 경로인지 */
export function isInside(a: string, b: string): boolean {
  const x = normalizePath(a);
  const y = normalizePath(b);
  return x === y || x.startsWith(y === '/' ? '/' : `${y}/`);
}
