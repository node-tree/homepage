import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAuth } from '../contexts/AuthContext';
import { CityData } from './GeometricParticles';
import { locationAPI } from '../services/api';

// 기본 도시 목록
const ALL_CITIES: CityData[] = [
  { name: '서울', position: [0, 0.8, 0] },
  { name: '부여', position: [-1.2, -0.3, 0.8] },
  { name: '용인', position: [1.0, 0.2, 0.5] },
  { name: '서산', position: [-1.8, 0.5, -0.5] },
  { name: '태안', position: [-2.0, -0.2, 0.3] },
  { name: '서천', position: [-0.8, -0.8, 1.0] },
  { name: '강경', position: [-0.5, -0.5, 0.5] },
  { name: '전주', position: [0.3, -1.0, 0.8] },
  { name: '마인츠', position: [2.0, 1.0, -1.0] },
  { name: '울룰루', position: [1.5, -1.2, -1.5] },
  { name: '뉴욕', position: [-2.2, 0.8, 1.2] },
];

// 미니 네비게이터 파티클
function MiniNavigator({
  cities,
  currentCity,
  onCityClick,
  hoveredCity,
  onHover
}: {
  cities: CityData[];
  currentCity: string;
  onCityClick: (name: string) => void;
  hoveredCity: string | null;
  onHover: (name: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
    }
  });

  return (
    <group ref={groupRef} scale={0.6}>
      {cities.map((city) => {
        const isCurrent = city.name === currentCity;
        const isHovered = city.name === hoveredCity;

        return (
          <group key={city.name} position={city.position}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                if (!isCurrent) onCityClick(city.name);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!isCurrent) {
                  onHover(city.name);
                  document.body.style.cursor = 'pointer';
                }
              }}
              onPointerOut={() => {
                onHover(null);
                document.body.style.cursor = 'default';
              }}
              scale={isCurrent ? 0.15 : isHovered ? 0.1 : 0.06}
            >
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial
                color={isCurrent ? '#ff4444' : isHovered ? '#4444ff' : '#333333'}
              />
            </mesh>

            <Html
              position={[0, 0.3, 0]}
              center
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div style={{
                color: isCurrent ? '#ff4444' : isHovered ? '#000' : '#888',
                fontSize: isCurrent ? '10px' : '8px',
                fontWeight: isCurrent ? 600 : 400,
                whiteSpace: 'nowrap',
                textShadow: '0 0 8px rgba(255,255,255,0.9)',
                opacity: isCurrent || isHovered ? 1 : 0.7,
              }}>
                {city.name}
              </div>
            </Html>
          </group>
        );
      })}

      {/* 연결선 */}
      {cities.map((city, i) => {
        const nextCity = cities[(i + 1) % cities.length];
        return (
          <line key={`line-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  ...city.position,
                  ...nextCity.position
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ddd" transparent opacity={0.3} />
          </line>
        );
      })}
    </group>
  );
}

// 전환 오버레이
function TransitionOverlay({ isActive, targetCity }: { isActive: boolean; targetCity: string | null }) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 300,
              letterSpacing: '0.3em',
            }}
          >
            {targetCity}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 콘텐츠 블록 컴포넌트
interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video';
  content: string;
  caption?: string;
}

function ContentBlockEditor({
  block,
  onUpdate,
  onDelete
}: {
  block: ContentBlock;
  onUpdate: (block: ContentBlock) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block.content);
  const [editCaption, setEditCaption] = useState(block.caption || '');

  const handleSave = () => {
    onUpdate({ ...block, content: editContent, caption: editCaption });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{
        background: '#f8f8f8',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
      }}>
        <select
          value={block.type}
          onChange={(e) => onUpdate({ ...block, type: e.target.value as ContentBlock['type'] })}
          style={{ marginBottom: '0.5rem', padding: '0.5rem' }}
        >
          <option value="text">텍스트</option>
          <option value="image">이미지</option>
          <option value="video">비디오</option>
        </select>

        {block.type === 'text' ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        ) : (
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder={block.type === 'image' ? '이미지 URL' : '비디오 URL (YouTube)'}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        )}

        {block.type !== 'text' && (
          <input
            type="text"
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            placeholder="캡션 (선택)"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginTop: '0.5rem',
            }}
          />
        )}

        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSave} style={{ padding: '0.5rem 1rem', background: '#222', color: '#fff', border: 'none', borderRadius: '4px' }}>
            저장
          </button>
          <button onClick={() => setIsEditing(false)} style={{ padding: '0.5rem 1rem', background: '#ddd', border: 'none', borderRadius: '4px' }}>
            취소
          </button>
          <button onClick={onDelete} style={{ padding: '0.5rem 1rem', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', marginLeft: 'auto' }}>
            삭제
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{ cursor: 'pointer', marginBottom: '1.5rem' }}
    >
      {block.type === 'text' && (
        <p style={{
          fontSize: '1rem',
          lineHeight: 1.8,
          color: '#444',
          whiteSpace: 'pre-wrap',
        }}>
          {block.content || '텍스트를 입력하세요...'}
        </p>
      )}

      {block.type === 'image' && (
        <figure style={{ margin: 0 }}>
          <img
            src={block.content}
            alt={block.caption || ''}
            style={{
              width: '100%',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          {block.caption && (
            <figcaption style={{
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#888',
              marginTop: '0.5rem',
            }}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      )}

      {block.type === 'video' && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe
            src={block.content.replace('watch?v=', 'embed/')}
            title={block.caption || '비디오'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '8px',
            }}
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

// 메인 컴포넌트
const CityDetail: React.FC = () => {
  const { cityName } = useParams<{ cityName: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const decodedCityName = decodeURIComponent(cityName || '');

  const [isLoading, setIsLoading] = useState(true);
  const [cityData, setCityData] = useState<any>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const result = await locationAPI.getCityData(decodedCityName);

        if (result.success && result.data) {
          setCityData(result.data);

          // 기존 비디오 데이터를 콘텐츠 블록으로 변환
          const blocks: ContentBlock[] = [];
          if (result.data.videoDescription) {
            blocks.push({
              id: 'desc-1',
              type: 'text',
              content: result.data.videoDescription
            });
          }
          if (result.data.videoUrl) {
            blocks.push({
              id: 'video-1',
              type: 'video',
              content: result.data.videoUrl,
              caption: result.data.videoTitle
            });
          }
          setContentBlocks(blocks.length > 0 ? blocks : [
            { id: 'default-1', type: 'text', content: `${decodedCityName}에 대한 기록을 추가해주세요.` }
          ]);
        } else {
          // 데이터가 없으면 기본 블록 생성
          setContentBlocks([
            { id: 'default-1', type: 'text', content: `${decodedCityName}에 대한 기록을 추가해주세요.` }
          ]);
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setContentBlocks([
          { id: 'default-1', type: 'text', content: `${decodedCityName}에 대한 기록을 추가해주세요.` }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    if (decodedCityName) {
      loadData();
    }
  }, [decodedCityName]);

  // 다른 도시로 이동
  const handleCityClick = useCallback((targetCityName: string) => {
    setTransitionTarget(targetCityName);
    setIsTransitioning(true);

    setTimeout(() => {
      navigate(`/location/${encodeURIComponent(targetCityName)}`);
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionTarget(null);
      }, 500);
    }, 800);
  }, [navigate]);

  // 콘텐츠 블록 업데이트
  const handleBlockUpdate = (updatedBlock: ContentBlock) => {
    setContentBlocks(blocks =>
      blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
    );
  };

  // 콘텐츠 블록 삭제
  const handleBlockDelete = (blockId: string) => {
    setContentBlocks(blocks => blocks.filter(b => b.id !== blockId));
  };

  // 새 블록 추가
  const addNewBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      content: ''
    };
    setContentBlocks(blocks => [...blocks, newBlock]);
  };

  // 메인 페이지로 돌아가기
  const goBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 40,
            height: 40,
            border: '3px solid #eee',
            borderTopColor: '#333',
            borderRadius: '50%'
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      {/* 전환 오버레이 */}
      <TransitionOverlay isActive={isTransitioning} targetCity={transitionTarget} />

      {/* 헤더 */}
      <div className="page-header">
        <motion.button
          onClick={goBack}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem',
          }}
        >
          ←
        </motion.button>

        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {decodedCityName}
        </motion.h1>

        <motion.div
          className="page-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {cityData?.videoTitle || '리서치 기록'}
        </motion.div>

        {isAuthenticated && (
          <motion.button
            onClick={() => setIsEditMode(!isEditMode)}
            className="write-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            {isEditMode ? '완료' : '편집'}
          </motion.button>
        )}
      </div>

      {/* 미니 네비게이터 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        style={{
          width: '100%',
          height: isMobile ? '200px' : '250px',
          margin: '1rem 0 2rem 0',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#fafafa',
        }}
      >
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <MiniNavigator
            cities={ALL_CITIES}
            currentCity={decodedCityName}
            onCityClick={handleCityClick}
            hoveredCity={hoveredCity}
            onHover={setHoveredCity}
          />
        </Canvas>

        <div style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#aaa',
          marginTop: '-30px',
          position: 'relative',
          zIndex: 10,
        }}>
          {hoveredCity ? `${hoveredCity}로 이동` : '다른 도시를 클릭하여 이동'}
        </div>
      </motion.div>

      {/* 콘텐츠 영역 */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 1rem 3rem 1rem',
        }}
      >
        {isEditMode ? (
          <>
            {contentBlocks.map(block => (
              <ContentBlockEditor
                key={block.id}
                block={block}
                onUpdate={handleBlockUpdate}
                onDelete={() => handleBlockDelete(block.id)}
              />
            ))}

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              marginTop: '2rem',
            }}>
              <button
                onClick={() => addNewBlock('text')}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + 텍스트
              </button>
              <button
                onClick={() => addNewBlock('image')}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + 이미지
              </button>
              <button
                onClick={() => addNewBlock('video')}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + 비디오
              </button>
            </div>
          </>
        ) : (
          <>
            {contentBlocks.map(block => (
              <div key={block.id} style={{ marginBottom: '2rem' }}>
                {block.type === 'text' && (
                  <p style={{
                    fontSize: '1rem',
                    lineHeight: 1.9,
                    color: '#444',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {block.content}
                  </p>
                )}

                {block.type === 'image' && block.content && (
                  <figure style={{ margin: 0 }}>
                    <img
                      src={block.content}
                      alt={block.caption || ''}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      }}
                    />
                    {block.caption && (
                      <figcaption style={{
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: '#888',
                        marginTop: '0.75rem',
                      }}>
                        {block.caption}
                      </figcaption>
                    )}
                  </figure>
                )}

                {block.type === 'video' && block.content && (
                  <div>
                    <div style={{
                      position: 'relative',
                      paddingBottom: '56.25%',
                      height: 0,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    }}>
                      <iframe
                        src={block.content.includes('embed') ? block.content : block.content.replace('watch?v=', 'embed/')}
                        title={block.caption || '비디오'}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                        allowFullScreen
                      />
                    </div>
                    {block.caption && (
                      <p style={{
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: '#888',
                        marginTop: '0.75rem',
                      }}>
                        {block.caption}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default CityDetail;
