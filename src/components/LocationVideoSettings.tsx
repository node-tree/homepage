import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

// 영상 데이터 타입 정의
interface LocationVideo {
  _id: string;
  cityName: string;
  videoUrl: string;
  videoTitle?: string;
  videoDescription?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 도시 목록 (Location 컴포넌트와 동일)
const CITIES = [
  '서울', '용인', '부여', '서산', '태안', '서천', '강경', '전주',
  '칸타요프스', '마인츠', '야따마우까', '울룰루', '뉴욕'
];

const LocationVideoSettings: React.FC = () => {
  const { token, isAuthenticated } = useAuth();
  const [videos, setVideos] = useState<LocationVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingVideo, setEditingVideo] = useState<LocationVideo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    cityName: '',
    videoUrl: '',
    videoTitle: '',
    videoDescription: ''
  });



  // 영상 목록 가져오기
  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/location-video');
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.data);
      } else {
        alert('영상 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('영상 목록 가져오기 오류:', error);
      alert('영상 목록을 가져오는데 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 영상 저장 (생성/수정)
  const saveVideo = async () => {
    if (!formData.cityName || !formData.videoUrl) {
      alert('도시명과 영상 URL은 필수입니다.');
      return;
    }

    if (!isAuthenticated || !token) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const url = editingVideo 
        ? `/api/location-video/${encodeURIComponent(editingVideo.cityName)}`
        : '/api/location-video';
      
      const method = editingVideo ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      console.log('API 응답:', data);
      console.log('응답 상태:', response.status);
      
      if (data.success) {
        alert(editingVideo ? '영상이 수정되었습니다.' : '영상이 등록되었습니다.');
        setIsModalOpen(false);
        setEditingVideo(null);
        setFormData({ cityName: '', videoUrl: '', videoTitle: '', videoDescription: '' });
        fetchVideos();
      } else {
        console.error('API 오류 응답:', data);
        alert(`저장 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('영상 저장 오류:', error);
      alert(`저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 영상 삭제
  const deleteVideo = async (cityName: string) => {
    if (!window.confirm(`${cityName}의 영상을 삭제하시겠습니까?`)) {
      return;
    }

    if (!isAuthenticated || !token) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/location-video/${encodeURIComponent(cityName)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        alert('영상이 삭제되었습니다.');
        fetchVideos();
      } else {
        alert(data.message || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('영상 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 편집 모달 열기
  const openEditModal = (video?: LocationVideo) => {
    if (video) {
      setEditingVideo(video);
      setFormData({
        cityName: video.cityName,
        videoUrl: video.videoUrl,
        videoTitle: video.videoTitle || '',
        videoDescription: video.videoDescription || ''
      });
    } else {
      setEditingVideo(null);
      setFormData({ cityName: '', videoUrl: '', videoTitle: '', videoDescription: '' });
    }
    setIsModalOpen(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVideo(null);
    setFormData({ cityName: '', videoUrl: '', videoTitle: '', videoDescription: '' });
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchVideos();
  }, []);

  return (
    <div className="page-content">
      <h1 className="page-title">
        위치별 영상 설정
        <div className="page-subtitle">Location Video Settings</div>
      </h1>

      {/* 새 영상 추가 버튼 */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <motion.button
          className="location-move-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openEditModal()}
          style={{ 
            backgroundColor: '#000', 
            color: '#fff',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem'
          }}
        >
          새 영상 추가
        </motion.button>
      </div>

      {/* 영상 목록 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>로딩 중...</p>
        </div>
      ) : (
        <div className="video-list" style={{ 
          display: 'grid', 
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
        }}>
          {videos.map((video) => (
            <motion.div
              key={video._id}
              className="video-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: '#fff'
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                {video.cityName}
              </h3>
              
              {video.videoTitle && (
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                  {video.videoTitle}
                </p>
              )}
              
              {video.videoDescription && (
                <p style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '0.9rem', 
                  color: '#666',
                  lineHeight: '1.4'
                }}>
                  {video.videoDescription}
                </p>
              )}
              
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#999', 
                marginBottom: '1rem',
                wordBreak: 'break-all'
              }}>
                URL: {video.videoUrl}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => openEditModal(video)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  수정
                </button>
                <button
                  onClick={() => deleteVideo(video.cityName)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ff4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  삭제
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 편집 모달 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <h2 style={{ margin: '0 0 1.5rem 0' }}>
              {editingVideo ? '영상 수정' : '새 영상 추가'}
            </h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                도시명 *
              </label>
              {editingVideo ? (
                <input
                  type="text"
                  value={formData.cityName}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5'
                  }}
                />
              ) : (
                <select
                  value={formData.cityName}
                  onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">도시를 선택하세요</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                영상 URL *
              </label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID 또는 https://youtu.be/VIDEO_ID"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#666', 
                marginTop: '0.5rem',
                lineHeight: '1.4'
              }}>
                💡 <strong>YouTube URL 사용법:</strong><br/>
                • 일반 YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID<br/>
                • 짧은 URL: https://youtu.be/VIDEO_ID<br/>
                • 시스템이 자동으로 임베드 형식으로 변환합니다
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                영상 제목
              </label>
              <input
                type="text"
                value={formData.videoTitle}
                onChange={(e) => setFormData({ ...formData, videoTitle: e.target.value })}
                placeholder="영상 제목을 입력하세요"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                영상 설명
              </label>
              <textarea
                value={formData.videoDescription}
                onChange={(e) => setFormData({ ...formData, videoDescription: e.target.value })}
                placeholder="영상에 대한 설명을 입력하세요"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={saveVideo}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LocationVideoSettings; 