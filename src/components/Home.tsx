import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import GeometricParticles from './GeometricParticles';
import { homeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface HomeSettings {
  title: string;
  subtitle: string;
  titlePosition: 'center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
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

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<HomeSettings>({
    title: '',
    subtitle: '',
    titlePosition: 'bottom-left'
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<HomeSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 프레임 패닝 관련 (프레임이 움직이는 효과)
  const containerRef = useRef<HTMLDivElement>(null);
  const frameX = useMotionValue(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeout = useRef<NodeJS.Timeout | null>(null);

  // 랜덤 프레임 이동
  useEffect(() => {
    if (isEditing) return;

    const moveRandomly = () => {
      if (!isUserInteracting) {
        // -1 ~ 1 범위의 랜덤 값
        const randomX = (Math.random() - 0.5) * 2;
        frameX.set(randomX);
      }
    };

    // 초기 랜덤 위치
    moveRandomly();

    // 4~7초마다 랜덤 이동
    const interval = setInterval(() => {
      moveRandomly();
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [frameX, isUserInteracting, isEditing]);

  // 마우스 이동 시 사용자 인터랙션 감지
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current && !isEditing) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        // -1 ~ 1 범위로 변환 (중앙이 0)
        frameX.set((x - 0.5) * 2);

        // 사용자 인터랙션 중으로 표시
        setIsUserInteracting(true);

        // 2초 후 자동 모드로 복귀
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
            titlePosition: response.data.titlePosition || 'bottom-left'
          });
        }
      } catch (error) {
        console.log('Home settings not found, using defaults');
        setSettings({
          title: 'Node Tree',
          subtitle: '서사 교차점의 기록',
          titlePosition: 'bottom-left'
        });
      } finally {
        setIsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  const handleEdit = () => {
    setEditForm(settings);
    setIsEditing(true);
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
      {/* 미디어아트 캔버스 - 전체화면 */}
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
        }}
      >
        <GeometricParticles height="100%" />

        {/* 타이틀 오버레이 - 데이터 로드 후 표시 */}
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

        {/* 편집 버튼 (로그인 시) */}
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
            텍스트 편집
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
                width: '90%',
                maxWidth: '500px',
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
                홈 텍스트 편집
              </h2>

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
