import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import GeometricParticles from './GeometricParticles';
import { homeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageLoader from './PageLoader';

interface HomeSettings {
  title: string;
  subtitle: string;
  titlePosition: 'center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  backgroundImage?: string | null;
}

const getPositionStyles = (isMobile: boolean): Record<string, React.CSSProperties> => ({
  'center': {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
  },
  'bottom-left': {
    bottom: isMobile ? '80px' : '80px',
    left: isMobile ? '15px' : '60px',
    right: isMobile ? '15px' : 'auto',
    textAlign: 'left',
  },
  'bottom-right': {
    bottom: isMobile ? '80px' : '80px',
    right: isMobile ? '15px' : '60px',
    left: isMobile ? '15px' : 'auto',
    textAlign: 'right',
  },
  'top-left': {
    top: isMobile ? '80px' : '140px',
    left: isMobile ? '15px' : '60px',
    right: isMobile ? '15px' : 'auto',
    textAlign: 'left',
  },
  'top-right': {
    top: isMobile ? '80px' : '140px',
    right: isMobile ? '15px' : '60px',
    left: isMobile ? '15px' : 'auto',
    textAlign: 'right',
  },
});

// 이미지를 Canvas로 압축하여 base64 반환 (최대 1920px, JPEG 80%)
const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<HomeSettings>({
    title: '',
    subtitle: '',
    titlePosition: 'bottom-left',
    backgroundImage: null,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<HomeSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 이미지 편집 상태
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 프레임 패닝
  const containerRef = useRef<HTMLDivElement>(null);
  const frameX = useMotionValue(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditing) return;

    const moveRandomly = () => {
      if (!isUserInteracting) {
        const randomX = (Math.random() - 0.5) * 2;
        frameX.set(randomX);
      }
    };

    moveRandomly();
    const interval = setInterval(() => {
      moveRandomly();
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [frameX, isUserInteracting, isEditing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current && !isEditing) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        frameX.set((x - 0.5) * 2);

        setIsUserInteracting(true);

        if (interactionTimeout.current) {
          clearTimeout(interactionTimeout.current);
        }
        interactionTimeout.current = setTimeout(() => {
          setIsUserInteracting(false);
        }, 2000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (interactionTimeout.current) {
        clearTimeout(interactionTimeout.current);
      }
    };
  }, [frameX, isEditing]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await homeAPI.getHome();
        if (response.success && response.data) {
          setSettings({
            title: response.data.title || 'Node Tree',
            subtitle: response.data.subtitle || '서사 교차점의 기록',
            titlePosition: response.data.titlePosition || 'bottom-left',
            backgroundImage: response.data.backgroundImage || null,
          });
        }
      } catch (error) {
        console.log('Home settings not found, using defaults');
        setSettings({
          title: 'Node Tree',
          subtitle: '서사 교차점의 기록',
          titlePosition: 'bottom-left',
          backgroundImage: null,
        });
      } finally {
        setIsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  const handleEdit = () => {
    setEditForm(settings);
    setImagePreview(settings.backgroundImage || null);
    setImageError('');
    setIsEditing(true);
  };

  // 파일 처리
  const handleImageFile = useCallback(async (file: File) => {
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImageError('파일 크기는 15MB 이하여야 합니다.');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      setEditForm(prev => ({ ...prev, backgroundImage: compressed }));
    } catch (err) {
      setImageError('이미지 처리에 실패했습니다.');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setEditForm(prev => ({ ...prev, backgroundImage: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await homeAPI.updateHome(editForm);
      if (response.success) {
        setSettings(editForm);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save home settings:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm(settings);
    setImagePreview(settings.backgroundImage || null);
    setImageError('');
    setIsEditing(false);
  };

  const POSITION_STYLES = getPositionStyles(isMobile);
  const positionStyle = POSITION_STYLES[settings.titlePosition] || POSITION_STYLES['bottom-left'];

  return (
    <div
      ref={containerRef}
      className="home-container"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      {/* 배경 이미지 레이어 */}
      <AnimatePresence>
        {settings.backgroundImage && (
          <motion.div
            key="bg-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 0,
            }}
          >
            <img
              src={settings.backgroundImage}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* 파티클이 잘 보이도록 반투명 오버레이 */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.15)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 미디어아트 캔버스 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        <GeometricParticles height="100%" />

        {/* 타이틀 오버레이 */}
        {isLoaded && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              ...positionStyle,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0) 100%)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              padding: isMobile ? '1.5rem 1.5rem' : '2.5rem 4rem',
              border: 'none',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
            }}>
              <h1 style={{
                fontSize: isMobile ? '1.2rem' : 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: 100,
                letterSpacing: isMobile ? '0.1em' : '0.2em',
                color: '#111',
                margin: 0,
                textTransform: 'uppercase',
                lineHeight: 1.2,
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                wordBreak: isMobile ? 'keep-all' : 'normal',
              }}>
                {settings.title}
              </h1>
              <p style={{
                fontSize: isMobile ? '0.7rem' : 'clamp(0.75rem, 1.2vw, 0.95rem)',
                fontWeight: 300,
                letterSpacing: '0.05em',
                color: '#555',
                marginTop: isMobile ? '0.5rem' : '1rem',
                lineHeight: 1.5,
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                wordBreak: isMobile ? 'keep-all' : 'normal',
              }}>
                {settings.subtitle}
              </p>
            </div>
          </motion.div>
        )}

        {/* 편집 버튼 */}
        {isAuthenticated && !isEditing && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
            onClick={handleEdit}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              padding: '10px 20px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 400,
              letterSpacing: '0.05em',
              zIndex: 20,
            }}
          >
            홈 편집
          </motion.button>
        )}
      </motion.div>

      {/* 편집 모달 */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              overflowY: 'auto',
              padding: '20px',
            }}
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '40px',
                width: '100%',
                maxWidth: '520px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
            >
              <h2 style={{
                margin: '0 0 30px 0',
                fontSize: '1.5rem',
                fontWeight: 400,
                color: '#111',
                letterSpacing: '0.05em',
              }}>
                홈 편집
              </h2>

              {/* 배경 이미지 섹션 */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '12px',
                  fontSize: '0.9rem',
                  color: '#666',
                  fontWeight: 500,
                }}>
                  배경 이미지
                </label>

                {/* 이미지 미리보기 */}
                {imagePreview ? (
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <img
                      src={imagePreview}
                      alt="배경 미리보기"
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #eee',
                        display: 'block',
                      }}
                    />
                    <button
                      onClick={handleRemoveImage}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                      title="이미지 삭제"
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                {/* 드래그&드롭 업로드 영역 */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#111' : '#ddd'}`,
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? 'rgba(0,0,0,0.03)' : '#fafafa',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#999' }}>↑</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
                    클릭하거나 파일을 드래그하세요
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#bbb' }}>
                    JPG, PNG, WEBP · 15MB 이하 · 자동 압축
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {imageError && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#e53' }}>
                    {imageError}
                  </p>
                )}
              </div>

              {/* 구분선 */}
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '0 0 28px' }} />

              {/* 텍스트 섹션 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  color: '#666',
                  fontWeight: 500,
                }}>
                  메인 타이틀
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#111'}
                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  color: '#666',
                  fontWeight: 500,
                }}>
                  서브타이틀
                </label>
                <input
                  type="text"
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#111'}
                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  color: '#666',
                  fontWeight: 500,
                }}>
                  텍스트 위치
                </label>
                <select
                  value={editForm.titlePosition}
                  onChange={(e) => setEditForm({ ...editForm, titlePosition: e.target.value as HomeSettings['titlePosition'] })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    background: '#fff',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="bottom-left">왼쪽 하단</option>
                  <option value="bottom-right">오른쪽 하단</option>
                  <option value="center">중앙</option>
                  <option value="top-left">왼쪽 상단</option>
                  <option value="top-right">오른쪽 상단</option>
                </select>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(100, 100, 100, 0.8)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 400,
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s ease',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    background: isSaving ? 'rgba(100, 100, 100, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 400,
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
