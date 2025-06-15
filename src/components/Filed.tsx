import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { filedAPI } from '../services/api';
import WritePost from './WritePost';
import { useAuth } from '../contexts/AuthContext';

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

  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      // 이미지 마크다운 처리: ![alt](url)
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const parts = line.split(imageRegex);
      
      return (
        <React.Fragment key={index}>
          {parts.map((part, partIndex) => {
            // 홀수 인덱스는 alt 텍스트, 짝수+1 인덱스는 URL
            if (partIndex % 3 === 2) {
              return (
                <img 
                  key={partIndex} 
                  src={part} 
                  alt={parts[partIndex - 1] || '이미지'} 
                />
              );
            } else if (partIndex % 3 === 1) {
              return null; // alt 텍스트는 img 태그에서 사용됨
            }
            return part;
          })}
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
      <h1 className="page-title">
        FIELD
        <div className="page-subtitle" style={{position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginTop: '0'}}>연구와 기록들을 정리합니다</div>
      </h1>
      
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