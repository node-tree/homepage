import { useEffect, useMemo, useState } from 'react';

/**
 * 플립북 프레임 2~6 지연 로드 스위치 (/iso 히어로·헤더 워커 공용)
 *
 * ── 왜 ────────────────────────────────────────────────────────────
 * /iso 첫 화면의 캐릭터·풍경은 전부 6프레임 플립북이다. 지금까지는 6장을 전부
 * 임계 경로에서 받아 히어로 이미지만 1.5MB 였다. 그런데 첫 페인트에 실제로
 * 보이는 건 언제나 **한 장**뿐이다 — kkumdarak.css `@keyframes kd-loop-6` 이
 * 6프레임 중 정확히 하나만 opacity:1 로 두기 때문이다.
 *
 * ── 어떻게 ────────────────────────────────────────────────────────
 * 프레임 2~6 의 `<img>` 를 **DOM 에서 빼지 않는다**. 빼면 나중에 붙일 때 각자의
 * 애니메이션 시작 시각이 달라져, `-1.25s ~ -0.25s` 음수 딜레이로 맞춰 둔 위상이
 * 어긋난다(=플립북이 깨진다). 대신 처음엔 **frame-01 의 src 를 물려 두고**
 * (같은 URL 이라 요청은 1건), 히어로가 다 그려진 뒤 진짜 src 로 갈아끼운다.
 *   · 지연 구간: 캐릭터가 '정지 그림'으로 보인다(빈칸·깜빡임 없음).
 *   · 교체 후: 원래대로 움직인다. DOM 순서·애니메이션 타이밍은 손대지 않았다.
 *   · 최종 화면·총 전송량은 동일하고, 임계 경로에서만 5/6 이 빠진다.
 *
 * ── 트리거를 무엇으로 잡나 (함정) ──────────────────────────────────
 * `window.load` 나 `requestIdleCallback` 은 여기서 쓸 수 없다. CRA 는 SPA 라
 * load 이벤트가 **React 마운트 전에** 떨어지고, 네트워크 대기 중 메인 스레드는
 * 놀고 있어서 idle 콜백도 즉시 불린다 → 지연이 사실상 무효가 된다(실측으로 확인).
 * 그래서 "현재 DOM 의 이미지가 전부 complete" = 히어로가 다 그려진 시점을
 * 직접 관찰해 트리거한다. 이 시점의 프레임 2~6 은 frame-01 을 물고 있으므로
 * "가시 프레임이 전부 도착했다" 와 같은 뜻이다.
 */

const POLL_MS = 150;
/** 이미지가 영영 안 끝나는 경우(실패·초장기 지연)에도 애니메이션은 반드시 살린다. */
const HARD_CAP_MS = 10000;

let settled = false;
let watching = false;
const waiters = new Set<() => void>();

function settle() {
  if (settled) return;
  settled = true;
  waiters.forEach((fn) => fn());
  waiters.clear();
}

/** 모든 인스턴스가 공유하는 감시자 1개 — 컴포넌트마다 폴링하지 않는다. */
function startWatch() {
  if (watching || settled) return;
  watching = true;
  const t0 = Date.now();
  const tick = () => {
    if (settled) return;
    if (Date.now() - t0 > HARD_CAP_MS) return settle();
    const imgs = Array.from(document.images);
    if (imgs.length > 0 && imgs.every((i) => i.complete)) return settle();
    window.setTimeout(tick, POLL_MS);
  };
  // 첫 페인트 이후부터 관찰 시작.
  requestAnimationFrame(() => window.setTimeout(tick, POLL_MS));
}

/** @returns true 가 되면 진짜 프레임 src 를 물려도 되는 시점. */
export function useDeferredFrames(): boolean {
  const [ready, setReady] = useState(settled);

  useEffect(() => {
    if (settled) {
      setReady(true);
      return;
    }
    const onSettle = () => setReady(true);
    waiters.add(onSettle);
    startWatch();
    return () => {
      waiters.delete(onSettle);
    };
  }, []);

  return ready;
}

/** 한 프레임이 화면에 물릴 때 필요한 것 전부(반응형 후보 포함). */
export type FlipFrame = { src: string; srcSet?: string };

/**
 * 플립북 6프레임의 실제 프레임 배열을 돌려준다 — 준비되기 전에는 전부 frame-01 로 채운다.
 *
 * `useDeferredFrames()` 만 쓰면 지연 해제 순간 아직 안 받은 프레임이 화면에 걸려
 * 깜빡임이 생긴다(실측: 스로틀 6초 지점에서 가시 프레임 미로딩 관측).
 * 그래서 교체를 **원자적으로** 만든다 — 프레임 2~6 을 백그라운드로 전부 디코드해
 * 캐시에 올려 둔 다음, 그때 한 번에 갈아끼운다.
 *   · 교체 전: 전 프레임이 frame-01 → 정지 그림(빈칸 없음).
 *   · 교체 후: 전 프레임이 캐시 히트 → 즉시 페인트, 깜빡임 없음.
 *
 * ⚠️ srcSet 을 쓸 때 프리로더도 **같은 srcset/sizes** 로 돌려야 한다.
 *    안 그러면 브라우저가 프리로드한 후보와 실제 <img> 가 고르는 후보가 달라져
 *    캐시가 빗나가고 교체 순간 깜빡인다(=원자적 교체가 깨진다).
 *
 * @param urls    프레임 1~6 의 실제 URL(순서 그대로)
 * @param srcSets 프레임 1~6 의 srcset 문자열(없으면 원본만 사용)
 * @param sizes   표시 박스 폭을 알려 주는 sizes 문자열(srcSets 와 짝)
 */
export function useFlipbookFrames(
  urls: string[],
  srcSets?: (string | undefined)[],
  sizes?: string,
): FlipFrame[] {
  const key = urls.join('|') + '#' + (srcSets || []).join('|') + '#' + (sizes || '');
  const deferReady = useDeferredFrames();
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    setSwapped(false);
  }, [key]);

  useEffect(() => {
    if (!deferReady || swapped) return;
    let cancelled = false;
    const rest = urls.slice(1);
    if (rest.length === 0) {
      setSwapped(true);
      return;
    }
    // 실패해도 resolve — 한 장이 404 라고 애니메이션 전체를 막지 않는다.
    Promise.all(
      rest.map(
        (u, idx) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.onload = () => resolve();
            im.onerror = () => resolve();
            // sizes → srcset → src 순서로 넣어야 후보 선택이 <img> 와 일치한다.
            const ss = srcSets && srcSets[idx + 1];
            if (ss) {
              if (sizes) im.sizes = sizes;
              im.srcset = ss;
            }
            im.src = u;
          }),
      ),
    ).then(() => {
      if (!cancelled) setSwapped(true);
    });
    return () => {
      cancelled = true;
    };
  }, [deferReady, swapped, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () =>
      urls.map((u, i) =>
        swapped
          ? { src: u, srcSet: srcSets && srcSets[i] }
          : { src: urls[0], srcSet: srcSets && srcSets[0] },
      ),
    // key 가 urls·srcSets·sizes 를 전부 직렬화한 값이라 배열 아이덴티티는 볼 필요가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapped, key],
  );
}
