import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { filedAPI } from '../services/api';
import WritePost from './WritePost';
import { useAuth } from '../contexts/AuthContext';

// Post interface
interface Post {
  id: string;
  title: string;
  content: string;
  date: string;
  images?: string[];
  thumbnail?: string | null;
}

interface FiledProps {
  onPostsLoaded?: (count: number) => void;
}

const Filed: React.FC<FiledProps> = ({ onPostsLoaded }) => {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWritePost, setShowWritePost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('FILED');
  const [subtitle, setSubtitle] = useState('기록/아카이브');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await filedAPI.getAllPosts();
      if (response.success) {
        setPosts(response.data);
        if (onPostsLoaded) {
          onPostsLoaded(response.data.length);
        }
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('글을 불러오는데 실패했습니다.');
      console.error('Filed 로딩 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [onPostsLoaded]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const fetchFiledHeader = async () => {
      try {
        setIsLoading(true);
        const res = await filedAPI.getFiledHeader();
        if (res.success && res.data) {
          setTitle(res.data.title || 'FILED');
          setSubtitle(res.data.subtitle || '기록/아카이브');
        }
      } catch (e) {
        // 에러 무시, 기본값 사용
      } finally {
        setIsLoading(false);
      }
    };
    fetchFiledHeader();
  }, []);

  const handleSavePost = (newPost: { title: string; content: string; date: string; images?: string[] }) => {
    setShowWritePost(false);
    // 새 데이터를 다시 로드하여 최신 상태 유지
    loadPosts();
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
  };

  const handleBackToList = () => {
    setSelectedPost(null);
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setSelectedPost(null);
  };

  const handleDeletePost = async (post: Post) => {
    if (window.confirm(`"${post.title}" 기록을 정말 삭제하시겠습니까?`)) {
      try {
        const response = await filedAPI.deletePost(post.id);
        if (response.success) {
          alert(response.message);
          setSelectedPost(null);
          loadPosts(); // 목록 새로고침
        }
      } catch (err) {
        console.error('기록 삭제 오류:', err);
        alert(err instanceof Error ? err.message : '기록 삭제에 실패했습니다.');
      }
    }
  };

  const handleSaveHeader = async () => {
    try {
      setIsLoading(true);
      await filedAPI.updateFiledHeader({ title, subtitle });
      setIsEditingHeader(false);
    } catch (e) {
      alert('저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      // 이미지 및 비디오 마크다운 처리를 위한 정규식
      const mediaRegex = /(!{1,2})\[([^\]]*)\]\(([^)]+)\)/g;
      let lastIndex = 0;
      const elements: (string | JSX.Element)[] = [];

      line.replace(mediaRegex, (match, type, alt, url, offset) => {
        // Add text before the match
        elements.push(line.substring(lastIndex, offset));

        if (type === '!!') { // 비디오: !![alt](url)
          let videoElement;
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoIdMatch = url.match(/(?:v=|vi\/|embed\/|\.be\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;
            if (videoId) {
              videoElement = (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%', background: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={alt || 'YouTube video player'}
                  ></iframe>
                </div>
              );
            }
          } else if (url.includes('vimeo.com')) {
            const videoIdMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;
            if(videoId) {
              videoElement = (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%', background: '#000' }}>
                   <iframe 
                     src={`https://player.vimeo.com/video/${videoId}`}
                     style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
                     frameBorder="0" 
                     allow="autoplay; fullscreen; picture-in-picture" 
                     allowFullScreen
                     title={alt || 'Vimeo video player'}>
                   </iframe>
                </div>
              );
            }
          } else { // 직접 링크
            videoElement = <video src={url} controls style={{ maxWidth: '100%', borderRadius: '8px' }} title={alt} />;
          }
          
          if(videoElement) {
              elements.push(
                <div key={`${index}-${offset}`} style={{ margin: '20px 0' }}>
                  {videoElement}
                </div>
              );
          } else {
             elements.push(match);
          }

        } else if (type === '!') { // 이미지: ![alt](url)
          elements.push(
            <div key={`${index}-${offset}`} style={{ textAlign: 'center', margin: '20px 0' }}>
              <img src={url} alt={alt || '이미지'} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
            </div>
          );
        }
        
        lastIndex = offset + match.length;
        return match;
      });

      // Add the rest of the line
      elements.push(line.substring(lastIndex));

      return (
        <React.Fragment key={index}>
          {elements.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
          {index < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  if (showWritePost) {
    return (
      <WritePost 
        onSavePost={handleSavePost}
        onBackToWork={() => setShowWritePost(false)}
        postType="filed"
      />
    );
  }

  if (editingPost) {
    return (
      <WritePost 
        onSavePost={(newPostData) => {
          setEditingPost(null);
          loadPosts();
        }}
        onBackToWork={() => setEditingPost(null)}
        postType="filed"
        editPost={editingPost}
      />
    );
  }

  // 상세페이지 표시
  if (selectedPost) {
    return (
      <div className="page-content">
        <div className="post-detail-container">
          <div className="post-detail-header">
            <motion.button 
              className="back-button"
              onClick={handleBackToList}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ← 목록으로
            </motion.button>
            
            {isAuthenticated && (
              <div className="post-actions">
                <motion.button 
                  className="edit-button"
                  onClick={() => handleEditPost(selectedPost)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  수정
                </motion.button>
                <motion.button 
                  className="delete-button"
                  onClick={() => handleDeletePost(selectedPost)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  삭제
                </motion.button>
              </div>
            )}
          </div>
          
          <article className="post-article">
            <header className="post-header">
              <h1 className="post-title">{selectedPost.title}</h1>
              <div className="post-meta">
                <span className="post-date">{selectedPost.date}</span>
              </div>
            </header>
            
            <div className="post-content">
              <div className="post-text">
                {formatContent(selectedPost.content)}
              </div>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
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
            <textarea value={title} onChange={e => setTitle(e.target.value)}
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
                resize: 'none',
                minHeight: 40,
                overflow: 'hidden',
              }}
              placeholder="제목 입력"
              autoFocus
              rows={1}
              onInput={e => {
                const ta = e.target as HTMLTextAreaElement;
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
              }}
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
            <h1 className="page-title">{title}</h1>
            <div className="page-subtitle">{subtitle}</div>
            {isAuthenticated && (
              <button onClick={() => setIsEditingHeader(true)} className="write-button">편집</button>
            )}
          </>
        )}
      </div>

      <div className="filed-container">
        <div className="work-header">
          {isAuthenticated && (
            <motion.button 
              className="write-button"
              onClick={() => setShowWritePost(true)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              새 글 작성
            </motion.button>
          )}
        </div>

        {loading && (
          <div className="loading-container">
            <motion.div 
              className="loading-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              ⟳
            </motion.div>
            <p>기록을 불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p className="error-message">오류: {error}</p>
            <motion.button 
              className="retry-button"
              onClick={loadPosts}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              다시 시도
            </motion.button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <motion.div 
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p>아직 기록된 내용이 없습니다.</p>
            <p>새 기록을 작성해보세요!</p>
          </motion.div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="posts-grid">
            {posts.map((post, index) => (
              <div 
                key={index} 
                className="post-grid-item"
              >
                <div 
                  className="post-grid-thumbnail"
                  onClick={() => handlePostClick(post)}
                >
                  {post.thumbnail ? (
                    <img src={post.thumbnail} alt={post.title} />
                  ) : (
                    <div className="post-grid-no-image">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="post-grid-content">
                  <h3 className="post-grid-title">{post.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Filed; 