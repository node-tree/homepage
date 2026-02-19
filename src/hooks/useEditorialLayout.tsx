import { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

/**
 * 에디토리얼 매거진 레이아웃 + 라이트박스 훅
 * - 연속 이미지를 자동으로 풀와이드 / 2컬럼 그리드로 배치
 * - cleanup으로 리렌더링 시 안정성 보장
 */
export function useEditorialLayout(contentKey?: string) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{
    src: string;
    images: string[];
    index: number;
  } | null>(null);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const htmlContent = container.querySelector('.html-content') || container;

    // === Cleanup: 이전 실행에서 추가된 요소/클래스 제거 ===
    // editorial-grid 를 해체하고 children을 원래 위치로 복원
    htmlContent.querySelectorAll('.editorial-grid').forEach(grid => {
      const parent = grid.parentNode;
      while (grid.firstChild) {
        parent?.insertBefore(grid.firstChild, grid);
      }
      parent?.removeChild(grid);
    });
    // editorial-img-wrap 해체
    htmlContent.querySelectorAll('.editorial-img-wrap').forEach(wrap => {
      const parent = wrap.parentNode;
      while (wrap.firstChild) {
        parent?.insertBefore(wrap.firstChild, wrap);
      }
      parent?.removeChild(wrap);
    });
    // 클래스 제거
    htmlContent.querySelectorAll('.editorial-full').forEach(el => {
      el.classList.remove('editorial-full');
    });
    // 숨겨진 spacer 복원
    htmlContent.querySelectorAll('[data-editorial-hidden]').forEach(el => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute('data-editorial-hidden');
    });

    // === 모든 이미지 src 수집 (라이트박스용) ===
    const allImgs = htmlContent.querySelectorAll<HTMLImageElement>('img');
    const srcs = Array.from(allImgs).map(img => img.src);

    // 이미지 클릭 이벤트
    allImgs.forEach((img, idx) => {
      img.style.cursor = 'zoom-in';
      img.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLightbox({ src: img.src, images: srcs, index: idx });
      };
    });

    // === 요소 분류 함수 ===
    const isDirectImage = (el: Element): boolean => {
      if (el.tagName === 'IMG') return true;
      // 이미지만 포함한 단순 wrapper (텍스트 없이)
      const hasImg = el.querySelector('img');
      const hasText = el.textContent?.trim();
      const hasMedia = el.querySelector('video, iframe, table, h1, h2, h3');
      if (hasImg && !hasMedia && (!hasText || hasText.length < 5)) return true;
      return false;
    };

    const isSkippable = (el: Element): boolean => {
      if (el.tagName === 'BR') return true;
      const text = el.textContent?.trim() || '';
      if (!text && !el.querySelector('img, video, iframe')) return true;
      return false;
    };

    const ensureWrapped = (el: Element): HTMLElement => {
      if (el.tagName === 'IMG') {
        const wrapper = document.createElement('div');
        wrapper.className = 'editorial-img-wrap';
        el.parentNode?.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        return wrapper;
      }
      return el as HTMLElement;
    };

    // === 컨테이너에 에디토리얼 그리드 적용 (재귀) ===
    const applyEditorialGrid = (target: Element) => {
      const children = Array.from(target.children);
      let i = 0;

      while (i < children.length) {
        const child = children[i];
        if (!isDirectImage(child)) {
          // 이미지가 아닌 컨테이너 안에 이미지가 있으면 재귀 처리
          if (child.querySelector('img') && child.children.length > 1) {
            applyEditorialGrid(child);
          }
          i++;
          continue;
        }

        // 연속된 이미지 수집 (사이의 skippable 요소도 기록)
        const consecutive: Element[] = [child];
        const skippables: Element[] = [];
        let j = i + 1;

        while (j < children.length) {
          const next = children[j];
          if (isSkippable(next)) {
            skippables.push(next);
            j++;
            continue;
          }
          if (isDirectImage(next)) {
            consecutive.push(next);
            j++;
          } else {
            break;
          }
        }

        // 이미지 사이의 빈 요소 숨기기
        if (consecutive.length >= 2) {
          skippables.forEach(el => {
            (el as HTMLElement).style.display = 'none';
            el.setAttribute('data-editorial-hidden', 'true');
          });
        }

        if (consecutive.length >= 2) {
          // 첫 번째: 풀 와이드
          const firstWrapped = ensureWrapped(consecutive[0]);
          firstWrapped.classList.add('editorial-full');

          // 나머지를 2개씩 그리드로 묶기
          let k = 1;
          while (k < consecutive.length) {
            if (k + 1 < consecutive.length) {
              const grid = document.createElement('div');
              grid.className = 'editorial-grid';
              const el1 = ensureWrapped(consecutive[k]);
              const el2 = ensureWrapped(consecutive[k + 1]);
              el1.parentNode?.insertBefore(grid, el1);
              grid.appendChild(el1);
              grid.appendChild(el2);
              k += 2;
            } else {
              // 홀수 마지막 이미지: 풀 와이드
              const lastWrapped = ensureWrapped(consecutive[k]);
              lastWrapped.classList.add('editorial-full');
              k++;
            }
          }
        } else {
          // 단일 이미지도 풀 와이드
          const wrapped = ensureWrapped(child);
          wrapped.classList.add('editorial-full');
        }

        i = j;
      }
    };

    applyEditorialGrid(htmlContent);
  }, [contentKey]);

  // 라이트박스 키보드
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!lightbox) return;
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight' && lightbox.index < lightbox.images.length - 1) {
        const newIdx = lightbox.index + 1;
        setLightbox({ ...lightbox, index: newIdx, src: lightbox.images[newIdx] });
      }
      if (e.key === 'ArrowLeft' && lightbox.index > 0) {
        const newIdx = lightbox.index - 1;
        setLightbox({ ...lightbox, index: newIdx, src: lightbox.images[newIdx] });
      }
    },
    [lightbox]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  // 라이트박스 컴포넌트
  const LightboxPortal = () => {
    if (!lightbox) return null;

    const goTo = (newIdx: number) => {
      setLightbox({ ...lightbox, index: newIdx, src: lightbox.images[newIdx] });
    };

    return ReactDOM.createPortal(
      <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
        <button className="lightbox-close" onClick={() => setLightbox(null)}>
          &times;
        </button>

        {lightbox.index > 0 && (
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => { e.stopPropagation(); goTo(lightbox.index - 1); }}
          >
            &#8249;
          </button>
        )}

        <img
          src={lightbox.src}
          alt=""
          className="lightbox-image"
          onClick={(e) => e.stopPropagation()}
        />

        {lightbox.index < lightbox.images.length - 1 && (
          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => { e.stopPropagation(); goTo(lightbox.index + 1); }}
          >
            &#8250;
          </button>
        )}

        <div className="lightbox-counter">
          {lightbox.index + 1} / {lightbox.images.length}
        </div>
      </div>,
      document.body
    );
  };

  return { contentRef, LightboxPortal };
}
