import React from 'react';

interface Post {
  id: number;
  title: string;
  content: string;
  date: string;
  images?: string[];
  thumbnail?: string;
  author?: string;
  htmlContent?: string;
}

interface PostDetailProps {
  post?: Post;
  onBackToWork?: () => void;
  onEditPost?: (postId: number) => void;
  onDeletePost?: (postId: number) => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ 
  post, 
  onBackToWork, 
  onEditPost, 
  onDeletePost 
}) => {
  // 안전한 HTML 렌더링을 위한 함수
  const renderSafeContent = (content: string) => {
    // 줄바꿈을 <br>로 변환하고, img 태그는 허용하되 다른 위험한 태그는 제거
    const safeContent = content
      .replace(/\n/g, '<br />')
      .replace(/<(?!img\s|\/img>|br\s*\/?>)[^>]*>/g, ''); // img와 br 태그 외의 모든 HTML 태그 제거
    
    return { __html: safeContent };
  };

  const handleDelete = () => {
    if (!post) return;
    
    if (window.confirm('정말로 이 글을 삭제하시겠습니까?')) {
      if (onDeletePost) {
        onDeletePost(post.id);
      }
      if (onBackToWork) {
        onBackToWork();
      }
    }
  };

  if (!post) {
    return (
      <div className="page-content">
        <div className="cornervery-post-container">
          <div className="cornervery-post-actions">
            <button className="cornervery-back-button" onClick={onBackToWork}>
              Return To List
            </button>
          </div>
          <div className="cornervery-post-content">
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
      <div className="cornervery-post-container">
        {/* 상단 액션 버튼들 */}
        <div className="cornervery-post-actions">
          <div className="cornervery-action-buttons">
            <button 
              className="cornervery-edit-button"
              onClick={() => onEditPost && onEditPost(post.id)}
            >
              Edit
            </button>
            <button 
              className="cornervery-delete-button"
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        </div>

        {/* 글 제목 */}
        <div className="cornervery-post-header">
          <h1 className="cornervery-post-title">{post.title}</h1>
        </div>

        {/* 글 내용 */}
        <div className="cornervery-post-body">
          {post.htmlContent ? (
            <div 
              className="cornervery-content-section"
              dangerouslySetInnerHTML={{ __html: post.htmlContent }}
            />
          ) : (
            <div 
              className="cornervery-content-section"
              dangerouslySetInnerHTML={renderSafeContent(post.content)}
            />
          )}
        </div>

        {/* 첨부 이미지 (있는 경우) */}
        {post.images && post.images.length > 0 && (
          <div className="cornervery-images-section">
            {post.images.map((imageUrl, index) => (
              <div key={index} className="cornervery-image-item">
                <img 
                  src={imageUrl} 
                  alt={`첨부 이미지 ${index + 1}`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="cornervery-bottom-actions">
          <button className="cornervery-back-button" onClick={onBackToWork}>
            Return To List
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostDetail; 