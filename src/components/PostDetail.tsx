import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Post {
  id: string; // id 타입을 string으로 변경
  title: string;
  content:string;
  date: string;
  images?: string[];
  thumbnail?: string;
  author?: string;
  htmlContent?: string;
}

interface PostDetailProps {
  post?: Post;
  onClose?: () => void; // onClose로 통일
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

const PostDetail: React.FC<PostDetailProps> = ({
  post,
  onClose,
  onEdit,
  onDelete
}) => {
  const { isAuthenticated } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 에디토리얼 레이아웃: 연속 이미지 media-block들을 그리드로 묶기
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    // 모든 이미지 src 수집 (라이트박스용)
    const allImgs = container.querySelectorAll<HTMLImageElement>('.media-block[data-type="image"] img, .media-block:not([data-type]) img');
    const srcs = Array.from(allImgs).map(img => img.src);
    setLightboxImages(srcs);

    // 이미지 클릭 이벤트 추가
    allImgs.forEach((img, idx) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        setLightboxIndex(idx);
        setLightboxSrc(img.src);
      });
    });

    // 연속된 이미지 media-block들을 찾아 그리드로 묶기
    const children = Array.from(container.children);
    let i = 0;
    while (i < children.length) {
      const child = children[i] as HTMLElement;
      const isImageBlock = child.classList?.contains('media-block') &&
        (child.getAttribute('data-type') === 'image' || (!child.getAttribute('data-type') && child.querySelector('img')));

      if (!isImageBlock) { i++; continue; }

      // 연속된 이미지 블록 수집
      const consecutive: HTMLElement[] = [child];
      let j = i + 1;
      while (j < children.length) {
        const next = children[j] as HTMLElement;
        // 빈 텍스트 노드나 <br> 건너뛰기
        if (next.nodeType === 3 && !next.textContent?.trim()) { j++; continue; }
        if (next.tagName === 'BR' || (next.tagName === 'DIV' && !next.textContent?.trim() && !next.querySelector('img, video, iframe'))) { j++; continue; }

        const isNextImage = next.classList?.contains('media-block') &&
          (next.getAttribute('data-type') === 'image' || (!next.getAttribute('data-type') && next.querySelector('img')));
        if (isNextImage) {
          consecutive.push(next);
          j++;
        } else {
          break;
        }
      }

      if (consecutive.length >= 2) {
        // 첫 번째 이미지는 풀 와이드로 유지
        consecutive[0].classList.add('editorial-full');

        // 나머지를 2개씩 그리드로 묶기
        let k = 1;
        while (k < consecutive.length) {
          if (k + 1 < consecutive.length) {
            // 2개를 그리드로 묶기
            const grid = document.createElement('div');
            grid.className = 'editorial-grid';
            consecutive[k].parentNode?.insertBefore(grid, consecutive[k]);
            grid.appendChild(consecutive[k]);
            grid.appendChild(consecutive[k + 1]);
            k += 2;
          } else {
            // 홀수 남은 1개는 풀 와이드
            consecutive[k].classList.add('editorial-full');
            k++;
          }
        }
      } else {
        // 단일 이미지는 풀 와이드
        child.classList.add('editorial-full');
      }
      i = j;
    }
  }, [post?.htmlContent, post?.content]);

  // 라이트박스 키보드 네비게이션
  const handleLightboxKeydown = useCallback((e: KeyboardEvent) => {
    if (!lightboxSrc) return;
    if (e.key === 'Escape') setLightboxSrc(null);
    if (e.key === 'ArrowRight' && lightboxIndex < lightboxImages.length - 1) {
      setLightboxIndex(prev => prev + 1);
      setLightboxSrc(lightboxImages[lightboxIndex + 1]);
    }
    if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
      setLightboxIndex(prev => prev - 1);
      setLightboxSrc(lightboxImages[lightboxIndex - 1]);
    }
  }, [lightboxSrc, lightboxIndex, lightboxImages]);

  useEffect(() => {
    window.addEventListener('keydown', handleLightboxKeydown);
    return () => window.removeEventListener('keydown', handleLightboxKeydown);
  }, [handleLightboxKeydown]);
  // 마크다운 이미지/영상을 HTML로 변환하는 함수
  const parseMarkdownMedia = (content: string): string => {
    let result = content;

    // 영상 마크다운 처리: !![alt](url)
    result = result.replace(/!!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      // YouTube URL 처리
      const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (youtubeMatch) {
        return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
      }

      // Vimeo URL 처리
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return `<div class="video-container"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
      }

      // 일반 비디오 URL
      return `<div class="video-container"><video controls><source src="${url}" /></video></div>`;
    });

    // 이미지 마크다운 처리: ![alt](url)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      return `<img src="${url}" alt="${alt}" class="content-image" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" />`;
    });

    // 줄바꿈을 <br>로 변환
    result = result.replace(/\n/g, '<br />');

    return result;
  };

  // 안전한 HTML 렌더링을 위한 함수
  const renderSafeContent = (content: string) => {
    const parsedContent = parseMarkdownMedia(content);
    return { __html: parsedContent };
  };

  const handleDelete = () => {
    if (!post) return;
    if (window.confirm('정말로 이 글을 삭제하시겠습니까?')) {
      if (onDelete) {
        onDelete(post.id);
      }
    }
  };
  
  const handleEdit = () => {
    if(post && onEdit) {
      onEdit(post);
    }
  };

  if (!post) {
    return (
      <div className="page-content">
        <div className="post-detail-container">
          <div className="post-detail-actions">
            <button className="back-button" onClick={onClose}>
              Return To List
            </button>
          </div>
          <div className="post-detail-content">
            <p style={{ textAlign: 'center', color: '#666666', fontSize: '1.1rem' }}>
              글을 찾을 수 없습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="post-detail-container">
        <div className="post-detail-header">
            <h1 className="post-detail-title">{post.title}</h1>
            <div className="post-detail-actions">
                {isAuthenticated && (
                  <>
                    <button className="edit-button" onClick={handleEdit}>Edit</button>
                    <button className="delete-button" onClick={handleDelete}>Delete</button>
                  </>
                )}
                <button className="back-button" onClick={onClose}>List</button>
            </div>
        </div>
        
        <div className="post-detail-body editorial-layout">
          {post.htmlContent ? (
            <div
              ref={contentRef}
              className="content-section"
              dangerouslySetInnerHTML={{ __html: post.htmlContent }}
            />
          ) : (
            <div
              ref={contentRef}
              className="content-section"
              dangerouslySetInnerHTML={renderSafeContent(post.content)}
            />
          )}
        </div>

        {post.images && post.images.length > 0 && (
          <div className="images-section">
            {post.images.map((imageUrl, index) => (
              <div key={index} className="image-item">
                <img
                  src={imageUrl}
                  alt={`첨부 이미지 ${index + 1}`}
                  style={{ cursor: 'zoom-in' }}
                  onClick={() => {
                    setLightboxSrc(imageUrl);
                    setLightboxIndex(index);
                    setLightboxImages(post.images || []);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 라이트박스 */}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>&times;</button>
          {lightboxIndex > 0 && (
            <button
              className="lightbox-nav lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightboxIndex - 1;
                setLightboxIndex(newIdx);
                setLightboxSrc(lightboxImages[newIdx]);
              }}
            >&#8249;</button>
          )}
          <img
            src={lightboxSrc}
            alt=""
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < lightboxImages.length - 1 && (
            <button
              className="lightbox-nav lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightboxIndex + 1;
                setLightboxIndex(newIdx);
                setLightboxSrc(lightboxImages[newIdx]);
              }}
            >&#8250;</button>
          )}
          <div className="lightbox-counter">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostDetail;