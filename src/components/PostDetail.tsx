import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Post {
  id: string; // id 타입을 string으로 변경
  title: string;
  content:string;
  date: string;
  images?: string[];
  thumbnail?: string;
  author?: string;
  htmlContent?: string;
}

interface PostDetailProps {
  post?: Post;
  onClose?: () => void; // onClose로 통일
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ 
  post, 
  onClose,
  onEdit,
  onDelete
}) => {
  const { isAuthenticated } = useAuth();
  // 안전한 HTML 렌더링을 위한 함수
  const renderSafeContent = (content: string) => {
    // 줄바꿈을 <br>로 변환
    const safeContent = content.replace(/\n/g, '<br />');
    return { __html: safeContent };
  };

  const handleDelete = () => {
    if (!post) return;
    if (window.confirm('정말로 이 글을 삭제하시겠습니까?')) {
      if (onDelete) {
        onDelete(post.id);
      }
    }
  };
  
  const handleEdit = () => {
    if(post && onEdit) {
      onEdit(post);
    }
  };

  if (!post) {
    return (
      <div className="page-content">
        <div className="post-detail-container">
          <div className="post-detail-actions">
            <button className="back-button" onClick={onClose}>
              Return To List
            </button>
          </div>
          <div className="post-detail-content">
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
      <div className="post-detail-container">
        <div className="post-detail-header">
            <h1 className="post-detail-title">{post.title}</h1>
            <div className="post-detail-actions">
                {isAuthenticated && (
                  <>
                    <button className="edit-button" onClick={handleEdit}>Edit</button>
                    <button className="delete-button" onClick={handleDelete}>Delete</button>
                  </>
                )}
                <button className="back-button" onClick={onClose}>List</button>
            </div>
        </div>
        
        <div className="post-detail-body">
          {post.htmlContent ? (
            <div 
              className="content-section"
              dangerouslySetInnerHTML={{ __html: post.htmlContent }}
            />
          ) : (
            <div 
              className="content-section"
              dangerouslySetInnerHTML={renderSafeContent(post.content)}
            />
          )}
        </div>

        {post.images && post.images.length > 0 && (
          <div className="images-section">
            {post.images.map((imageUrl, index) => (
              <div key={index} className="image-item">
                <img 
                  src={imageUrl} 
                  alt={`첨부 이미지 ${index + 1}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetail;