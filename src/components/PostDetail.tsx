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
  // 마크다운 이미지/영상을 HTML로 변환하는 함수
  const parseMarkdownMedia = (content: string): string => {
    let result = content;

    // 영상 마크다운 처리: !![alt](url)
    result = result.replace(/!!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      // YouTube URL 처리
      const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (youtubeMatch) {
        return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
      }

      // Vimeo URL 처리
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return `<div class="video-container"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
      }

      // 일반 비디오 URL
      return `<div class="video-container"><video controls><source src="${url}" /></video></div>`;
    });

    // 이미지 마크다운 처리: ![alt](url)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      return `<img src="${url}" alt="${alt}" class="content-image" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" />`;
    });

    // 줄바꿈을 <br>로 변환
    result = result.replace(/\n/g, '<br />');

    return result;
  };

  // 안전한 HTML 렌더링을 위한 함수
  const renderSafeContent = (content: string) => {
    const parsedContent = parseMarkdownMedia(content);
    return { __html: parsedContent };
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