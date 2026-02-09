import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { locationPostAPI } from '../services/api';
import WritePost from './WritePost';
import { useAuth } from '../contexts/AuthContext';
import { playHoverSound, playClickSound } from '../utils/sound';

interface Post {
  id: string;
  title: string;
  content: string;
  date: string;
  images?: string[];
  thumbnail?: string | null;
  sortOrder?: number;
}

const Location3D: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWritePost, setShowWritePost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    setError(null);
    try {
      const response = await locationPostAPI.getAllPosts();
      if (response.success) {
        setPosts(response.data);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('글을 불러오는데 실패했습니다.');
      console.error('Location 로딩 오류:', err);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setError(null);
      setPostsLoading(true);

      // 1. 헤더 먼저 로드
      try {
        const headerResponse = await locationPostAPI.getHeader();
        if (isMounted) {
          if (headerResponse.success && headerResponse.data) {
            setTitle(headerResponse.data.title || 'CROSS CITY');
            setSubtitle(headerResponse.data.subtitle || '서사 교차점의 기록장소');
          } else {
            setTitle('CROSS CITY');
            setSubtitle('서사 교차점의 기록장소');
          }
        }
      } catch (err) {
        console.error('헤더 로딩 오류:', err);
        if (isMounted) {
          setTitle('CROSS CITY');
          setSubtitle('서사 교차점의 기록장소');
        }
      }
      if (isMounted) {
        setHeaderLoading(false);
      }

      // 2. 헤더 로드 완료 후 글 목록 로드
      try {
        const postsResponse = await locationPostAPI.getAllPosts();
        if (isMounted) {
          if (postsResponse.success) {
            setPosts(postsResponse.data);
          } else {
            setError(postsResponse.message);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('글을 불러오는데 실패했습니다.');
        }
        console.error('Location 로딩 오류:', err);
      } finally {
        if (isMounted) {
          setPostsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // URL 파라미터로 포스트 선택
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId && posts.length > 0 && !selectedPost) {
      const post = posts.find((p: Post) => p.id === postId);
      if (post) {
        setSelectedPost(post);
      }
    }
  }, [searchParams, posts, selectedPost]);

  const handleSavePost = () => {
    setShowWritePost(false);
    loadPosts();
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setSearchParams({ post: post.id });
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    setSearchParams({});
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setSelectedPost(null);
  };

  const handleDeletePost = async (post: Post) => {
    if (window.confirm(`"${post.title}" 기록을 정말 삭제하시겠습니까?`)) {
      try {
        const response = await locationPostAPI.deletePost(post.id);
        if (response.success) {
          alert(response.message);
          setSelectedPost(null);
          loadPosts();
        }
      } catch (err) {
        console.error('기록 삭제 오류:', err);
        alert(err instanceof Error ? err.message : '기록 삭제에 실패했습니다.');
      }
    }
  };

  // 미디어 컨트롤 버튼 제거 (표시용)
  const cleanMediaControls = (html: string): string => {
    let cleaned = html;
    // media-controls div 제거 (새 형식)
    cleaned = cleaned.replace(/<div class="media-controls"[^>]*>[\s\S]*?<\/div>/gi, '');
    // 컨트롤 버튼들 직접 제거 (위로/아래로/삭제 버튼)
    cleaned = cleaned.replace(/<button[^>]*title="위로 이동"[^>]*>[\s\S]*?<\/button>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*title="아래로 이동"[^>]*>[\s\S]*?<\/button>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*title="삭제"[^>]*>[\s\S]*?<\/button>/gi, '');
    // 빈 컨트롤 wrapper div 제거
    cleaned = cleaned.replace(/<div[^>]*contenteditable="false"[^>]*>\s*<\/div>/gi, '');
    // contenteditable 속성 제거
    cleaned = cleaned.replace(/\s*contenteditable="[^"]*"/gi, '');
    // draggable 속성 제거
    cleaned = cleaned.replace(/\s*draggable="[^"]*"/gi, '');
    return cleaned;
  };

  const formatContent = (content: string) => {
    // HTML 태그 감지 (더 포괄적인 패턴)
    const htmlTagPattern = /<[a-z][\s\S]*?>/i;
    if (htmlTagPattern.test(content)) {
      // 미디어 컨트롤 버튼 제거
      let htmlContent = cleanMediaControls(content);
      if (!htmlContent.includes('<br')) {
        htmlContent = htmlContent.replace(/\n/g, '<br />');
      }
      return <div className="html-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }

    return content.split('\n').map((line, index) => {
      const mediaRegex = /(!{1,2})\[([^\]]*)\]\(([^)]+)\)/g;
      let lastIndex = 0;
      const elements: (string | JSX.Element)[] = [];

      line.replace(mediaRegex, (match, type, alt, url, offset) => {
        elements.push(line.substring(lastIndex, offset));

        if (type === '!!') {
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
          } else {
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

        } else if (type === '!') {
          elements.push(
            <div key={`${index}-${offset}`} style={{ textAlign: 'center', margin: '20px 0' }}>
              <img src={url} alt={alt || '이미지'} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
            </div>
          );
        }

        lastIndex = offset + match.length;
        return match;
      });

      elements.push(line.substring(lastIndex));

      return (
        <React.Fragment key={index}>
          {elements.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
          {index < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const handleSaveHeader = async () => {
    try {
      await locationPostAPI.updateHeader({ title, subtitle });
      setIsEditingHeader(false);
    } catch (e) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newPosts = [...posts];
    [newPosts[index - 1], newPosts[index]] = [newPosts[index], newPosts[index - 1]];
    setPosts(newPosts);
  };

  const handleMoveDown = (index: number) => {
    if (index === posts.length - 1) return;
    const newPosts = [...posts];
    [newPosts[index], newPosts[index + 1]] = [newPosts[index + 1], newPosts[index]];
    setPosts(newPosts);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orders = posts.map((post, index) => ({
        id: post.id,
        sortOrder: index
      }));
      await locationPostAPI.reorderPosts(orders);
      setIsReorderMode(false);
      alert('순서가 저장되었습니다.');
    } catch (e) {
      alert('순서 저장에 실패했습니다.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCancelReorder = () => {
    setIsReorderMode(false);
    loadPosts();
  };

  if (showWritePost) {
    return (
      <WritePost
        onSavePost={handleSavePost}
        onBackToWork={() => setShowWritePost(false)}
        postType="location"
      />
    );
  }

  if (editingPost) {
    return (
      <WritePost
        onSavePost={(newPostData) => {
          const updatedPost: Post = {
            id: editingPost.id,
            title: newPostData.title,
            content: newPostData.content,
            date: editingPost.date,
            images: newPostData.images,
            thumbnail: editingPost.thumbnail
          };
          setEditingPost(null);
          setSelectedPost(updatedPost);
          loadPosts();
        }}
        onBackToWork={() => {
          setEditingPost(null);
          setSelectedPost(editingPost);
        }}
        postType="location"
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

          {/* 이전글/다음글 네비게이션 */}
          {posts.length > 1 && (() => {
            const currentIndex = posts.findIndex(p => p.id === selectedPost.id);
            const prevPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
            const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

            return (
              <div className="post-navigation">
                <div
                  className={`post-nav-item post-nav-prev ${!prevPost ? 'disabled' : ''}`}
                  onClick={() => prevPost && handlePostClick(prevPost)}
                >
                  {prevPost ? (
                    <>
                      <span className="post-nav-label">← 이전 글</span>
                      <span className="post-nav-title">{prevPost.title}</span>
                    </>
                  ) : (
                    <span className="post-nav-label">이전 글 없음</span>
                  )}
                </div>
                <div
                  className={`post-nav-item post-nav-next ${!nextPost ? 'disabled' : ''}`}
                  onClick={() => nextPost && handlePostClick(nextPost)}
                >
                  {nextPost ? (
                    <>
                      <span className="post-nav-label">다음 글 →</span>
                      <span className="post-nav-title">{nextPost.title}</span>
                    </>
                  ) : (
                    <span className="post-nav-label">다음 글 없음</span>
                  )}
                </div>
              </div>
            );
          })()}
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
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                border: 'none',
                borderRadius: '25px',
                padding: '10px 24px',
                fontWeight: 400,
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
                marginTop: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                alignSelf: 'center',
              }}
            >저장</button>
          </div>
        ) : (
          <>
            {headerLoading ? (
              <div style={{ minHeight: '80px' }} />
            ) : (
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

      <div className="work-container">
        <div className="work-header">
          {isAuthenticated && (
            <div className="work-header-buttons">
              {isReorderMode ? (
                <>
                  <motion.button
                    className="write-button reorder-save-button"
                    onClick={handleSaveOrder}
                    disabled={isSavingOrder}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isSavingOrder ? '저장 중...' : '순서 저장'}
                  </motion.button>
                  <motion.button
                    className="write-button reorder-cancel-button"
                    onClick={handleCancelReorder}
                    disabled={isSavingOrder}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    취소
                  </motion.button>
                </>
              ) : (
                <>
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
                  {posts.length > 1 && (
                    <motion.button
                      className="write-button reorder-button"
                      onClick={() => setIsReorderMode(true)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      순서 편집
                    </motion.button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {postsLoading && (
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

        {!postsLoading && !error && posts.length === 0 && (
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

        {!postsLoading && !error && posts.length > 0 && (
          <div className={`posts-grid ${isReorderMode ? 'reorder-mode' : ''}`}>
            {posts.map((post, index) => (
              <div
                key={post.id}
                className={`post-grid-item ${isReorderMode ? 'reorder-item' : ''}`}
                onMouseEnter={() => !isReorderMode && playHoverSound()}
                onClick={() => {
                  if (!isReorderMode) {
                    playClickSound();
                    handlePostClick(post);
                  }
                }}
              >
                <div className="post-grid-thumbnail">
                  {post.thumbnail ? (
                    <img src={post.thumbnail.startsWith('//') ? `https:${post.thumbnail}` : post.thumbnail} alt={post.title} />
                  ) : (
                    <div className="post-grid-no-image" />
                  )}
                  <div className="post-grid-overlay">
                    <span className="post-grid-overlay-title">{post.title}</span>
                  </div>
                </div>
                {isReorderMode && (
                  <div className="reorder-controls">
                    <button
                      className="reorder-btn reorder-up"
                      onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                      disabled={index === 0}
                      title="위로 이동"
                    >
                      ▲
                    </button>
                    <span className="reorder-index">{index + 1}</span>
                    <button
                      className="reorder-btn reorder-down"
                      onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                      disabled={index === posts.length - 1}
                      title="아래로 이동"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Location3D;
