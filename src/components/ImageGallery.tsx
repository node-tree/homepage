import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface ImageLayoutItem {
  src: string;
  alt?: string;
  size: 'full' | 'half' | 'third';
  order: number;
}

interface ImageGalleryProps {
  images: { src: string; alt?: string }[];
  imageLayout?: ImageLayoutItem[];
  isAdmin?: boolean;
  onLayoutChange?: (layout: ImageLayoutItem[]) => void;
}

const SIZE_CYCLE: ('full' | 'half' | 'third')[] = ['full', 'half', 'third'];
const SIZE_LABELS: Record<string, string> = {
  full: '1/1',
  half: '1/2',
  third: '1/3',
};

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  imageLayout,
  isAdmin = false,
  onLayoutChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<ImageLayoutItem[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    src: string;
    images: string[];
    index: number;
  } | null>(null);

  // Intersection Observer for fade-in
  const galleryRef = useRef<HTMLDivElement>(null);

  // Build layout from imageLayout or default from images
  useEffect(() => {
    if (imageLayout && imageLayout.length > 0) {
      const sorted = [...imageLayout].sort((a, b) => a.order - b.order);
      setLayout(sorted);
    } else {
      // Default: first image full, rest auto-sized
      const defaultLayout = images.map((img, i) => ({
        src: img.src,
        alt: img.alt || '',
        size: (i === 0 ? 'full' : images.length <= 3 ? 'half' : 'third') as 'full' | 'half' | 'third',
        order: i,
      }));
      setLayout(defaultLayout);
    }
  }, [images, imageLayout]);

  // Intersection Observer for scroll fade-in
  useEffect(() => {
    const container = galleryRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('gallery-fade-in--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    const items = container.querySelectorAll('.gallery-item');
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [layout, isEditing]);

  // Lightbox keyboard
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

  // Image click → lightbox
  const handleImageClick = (idx: number) => {
    if (isEditing) return;
    const allSrcs = layout.map((item) => item.src);
    setLightbox({ src: allSrcs[idx], images: allSrcs, index: idx });
  };

  // Toggle image size
  const handleToggleSize = (idx: number) => {
    const newLayout = [...layout];
    const currentSize = newLayout[idx].size;
    const nextIdx = (SIZE_CYCLE.indexOf(currentSize) + 1) % SIZE_CYCLE.length;
    newLayout[idx] = { ...newLayout[idx], size: SIZE_CYCLE[nextIdx] };
    setLayout(newLayout);
  };

  // Drag handlers
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newLayout = [...layout];
    const [moved] = newLayout.splice(dragIdx, 1);
    newLayout.splice(idx, 0, moved);
    // Recompute order
    const reordered = newLayout.map((item, i) => ({ ...item, order: i }));
    setLayout(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Save layout
  const handleSave = () => {
    const ordered = layout.map((item, i) => ({ ...item, order: i }));
    onLayoutChange?.(ordered);
    setIsEditing(false);
  };

  // Cancel editing
  const handleCancel = () => {
    // Reset to original
    if (imageLayout && imageLayout.length > 0) {
      setLayout([...imageLayout].sort((a, b) => a.order - b.order));
    } else {
      const defaultLayout = images.map((img, i) => ({
        src: img.src,
        alt: img.alt || '',
        size: (i === 0 ? 'full' : 'half') as 'full' | 'half',
        order: i,
      }));
      setLayout(defaultLayout);
    }
    setIsEditing(false);
  };

  if (layout.length === 0) return null;

  // Get column span class
  const getSizeClass = (size: string) => {
    switch (size) {
      case 'full': return 'gallery-item--full';
      case 'half': return 'gallery-item--half';
      case 'third': return 'gallery-item--third';
      default: return 'gallery-item--full';
    }
  };

  return (
    <>
      {/* Admin edit button */}
      {isAdmin && !isEditing && (
        <div className="gallery-admin-bar">
          <button
            className="gallery-edit-btn"
            onClick={() => setIsEditing(true)}
          >
            이미지 배치
          </button>
        </div>
      )}

      {/* Editing toolbar */}
      {isEditing && (
        <div className="gallery-edit-toolbar">
          <span className="gallery-edit-label">이미지 배치 편집</span>
          <div className="gallery-edit-actions">
            <button className="gallery-save-btn" onClick={handleSave}>저장</button>
            <button className="gallery-cancel-btn" onClick={handleCancel}>취소</button>
          </div>
        </div>
      )}

      {/* Gallery grid */}
      <div
        ref={galleryRef}
        className={`image-gallery ${isEditing ? 'image-gallery--editing' : ''}`}
      >
        {layout.map((item, idx) => (
          <div
            key={`${item.src}-${idx}`}
            className={`gallery-item ${getSizeClass(item.size)} gallery-fade-in ${
              isEditing ? 'gallery-item--editing' : ''
            } ${dragOverIdx === idx ? 'gallery-item--drag-over' : ''} ${
              dragIdx === idx ? 'gallery-item--dragging' : ''
            }`}
            draggable={isEditing}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            onClick={() => handleImageClick(idx)}
          >
            <img
              src={item.src}
              alt={item.alt || ''}
              loading="lazy"
            />
            {isEditing && (
              <div className="gallery-item-controls">
                <button
                  className="gallery-size-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSize(idx);
                  }}
                  title="크기 변경"
                >
                  {SIZE_LABELS[item.size]}
                </button>
                <span className="gallery-drag-handle" title="드래그하여 순서 변경">
                  ⠿
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Portal */}
      {lightbox && ReactDOM.createPortal(
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>
            &times;
          </button>

          {lightbox.index > 0 && (
            <button
              className="lightbox-nav lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightbox.index - 1;
                setLightbox({ ...lightbox, index: newIdx, src: lightbox.images[newIdx] });
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightbox.index + 1;
                setLightbox({ ...lightbox, index: newIdx, src: lightbox.images[newIdx] });
              }}
            >
              &#8250;
            </button>
          )}

          <div className="lightbox-counter">
            {lightbox.index + 1} / {lightbox.images.length}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ImageGallery;
