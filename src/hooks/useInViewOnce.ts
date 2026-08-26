import { useEffect, useRef, useState } from 'react';

/**
 * [perf] 요소가 뷰포트 근처(rootMargin)에 들어오면 단 한 번 true 로 전환한다.
 *
 * 무거운 라이브러리(p5 331 kB gz 등)를 실제로 볼 시점까지 미루는 데 쓴다.
 * - 한 번 true 가 되면 observer 를 즉시 disconnect (재관찰 없음)
 * - IntersectionObserver 미지원 환경(구형 브라우저·SSR 프리렌더)에서는 즉시 true 로 폴백
 */
export function useInViewOnce<T extends HTMLElement>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, inView]);

  return [ref, inView] as const;
}

export default useInViewOnce;
