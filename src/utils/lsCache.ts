// ── 작은 localStorage 캐시 헬퍼 (꿈다락 "이전 내용 플래시" 제거용) ──────────────
//   목적: 마이크로사이트 재방문 시 마지막으로 본 '현재' 내용을 첫 페인트부터 즉시 렌더해
//   백엔드(Render) 콜드스타트 동안 옛(하드코딩/이전) 값이 떴다 바뀌는 플래시를 없앤다.
//
//   · 민감정보 없음(프로그램 텍스트·공개상태만) — 캐시 OK.
//   · 키는 버전 접미사(_v1 등)로 운영. 손상/구버전 파싱 실패 시 안전 폴백(없는 것처럼 null).
//   · SSR/비브라우저 환경에서는 항상 no-op(null / 무동작).

// JSON 안전 파싱으로 캐시에서 읽기. 없거나 손상되면 null.
export function lsGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// 캐시에 쓰기(실패는 조용히 무시 — 캐시는 '표시 가속'일 뿐 신뢰원이 아님).
export function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 쿼터 초과/프라이빗 모드 등 — 무시(캐시 없이 동작).
  }
}
