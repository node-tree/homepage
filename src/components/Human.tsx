import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Human.css';
import { useAuth } from '../contexts/AuthContext';
import { humanAPI } from '../services/api';

const Human: React.FC = () => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchHeader = async () => {
      try {
        const res = await humanAPI.getHumanHeader();
        if (res.success && res.data) {
          setTitle(res.data.title || 'ART NETWORK');
          setSubtitle(res.data.subtitle || "예술의 장을 구성하는 여러 지점들-'누구와 함께', '무엇이 연결되는가'");
        } else {
          setTitle('ART NETWORK');
          setSubtitle("예술의 장을 구성하는 여러 지점들-'누구와 함께', '무엇이 연결되는가'");
        }
      } catch (e) {
        // 에러 시 기본값 사용
        setTitle('ART NETWORK');
        setSubtitle("예술의 장을 구성하는 여러 지점들-'누구와 함께', '무엇이 연결되는가'");
      } finally {
        setIsLoading(false);
      }
    };
    fetchHeader();
  }, []);

  const handleSaveHeader = async () => {
    try {
      await humanAPI.updateHumanHeader({ title, subtitle });
      setIsEditingHeader(false);
    } catch (e) {
      const msg = (e instanceof Error && e.message) ? e.message : '';
      alert('저장에 실패했습니다. ' + msg);
    }
  };

  return (
    <div className="human-container">
      <div className="page-header">
        {isEditingHeader ? (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            padding: '24px 20px 16px 20px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12,
            maxWidth: 480,
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: '2px solid #eee',
                outline: 'none',
                padding: '8px 0',
                marginBottom: 4,
                background: 'transparent',
                textAlign: 'center',
                borderRadius: 0,
                transition: 'border-color 0.2s',
              }}
              placeholder="제목 입력"
              autoFocus
            />
            <textarea value={subtitle} onChange={e => setSubtitle(e.target.value)}
              style={{
                fontSize: '1.1rem',
                border: 'none',
                borderBottom: '1.5px solid #eee',
                outline: 'none',
                padding: '6px 0',
                background: 'transparent',
                textAlign: 'center',
                borderRadius: 0,
                transition: 'border-color 0.2s',
                resize: 'none',
                minHeight: 32,
                overflow: 'hidden',
              }}
              placeholder="부제목 입력"
              rows={1}
              onInput={e => {
                const ta = e.target as HTMLTextAreaElement;
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
              }}
            />
            <button onClick={handleSaveHeader}
              style={{
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 0',
                fontWeight: 600,
                fontSize: '1rem',
                marginTop: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'background 0.2s',
                width: 120,
                alignSelf: 'center',
              }}
            >저장</button>
          </div>
        ) : (
          <>
            {!isLoading && (
              <>
                <motion.h1
                  className="page-title"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {title}
                </motion.h1>
                <motion.div
                  className="page-subtitle"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {subtitle}
                </motion.div>
                {isAuthenticated && (
                  <motion.button
                    onClick={() => setIsEditingHeader(true)}
                    className="write-button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                  >
                    편집
                  </motion.button>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="human-content">
        {/* 3D 컨텐츠가 여기에 렌더링될 것입니다. */}
      </div>
      
      {/* 캐릭터 프로필 컨테이너 */}
      <div className="character-profile-container">
        {/* 캐릭터 이미지 */}
        <div className="character-image-container">
          <div className="character-image-placeholder">
            <span className="page-body-text-small">캐릭터 이미지</span>
          </div>
        </div>
        
        {/* 캐릭터 정보 */}
        <div className="character-info-container">
          <div className="character-name">내용 수정중</div>
          
        
          <div className="character-abilities">
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Human; 