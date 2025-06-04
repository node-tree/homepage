import React, { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

interface ImageData {
  url: string;
  caption: string;
}

interface WritePostProps {
  onSavePost: (postData: { title: string; content: string; date: string; images?: string[]; thumbnail?: string }) => void;
  onBackToWork: () => void;
  postType?: 'work' | 'workshop' | 'filed';
  editPost?: Post | null;
}

interface Post {
  id: string;
  title: string;
  content: string;
  date: string;
  images?: string[];
  thumbnail?: string | null;
}

const WritePost: React.FC<WritePostProps> = ({ onSavePost, onBackToWork, postType = 'work', editPost = null }) => {
  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(editPost?.thumbnail || '');
  const [images, setImages] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editPost;

  // 이미지 추가
  const addImage = () => {
    setImages([...images, { url: '', caption: '' }]);
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // 이미지 URL 업데이트
  const updateImageUrl = (index: number, url: string) => {
    const newImages = [...images];
    newImages[index].url = url;
    setImages(newImages);
  };

  // 이미지 캡션 업데이트
  const updateImageCaption = (index: number, caption: string) => {
    const newImages = [...images];
    newImages[index].caption = caption;
    setImages(newImages);
  };

  // 커서 위치에 이미지 태그 삽입
  const insertImageToContent = (imageUrl: string) => {
    const textarea = document.getElementById('content') as HTMLTextAreaElement;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const imageTag = `![이미지](${imageUrl})`;
      const newContent = content.slice(0, cursorPos) + imageTag + content.slice(cursorPos);
      setContent(newContent);
      
      // 커서를 삽입된 텍스트 뒤로 이동
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos + imageTag.length, cursorPos + imageTag.length);
      }, 0);
    }
  };

  // 이미지 태그 복사
  const copyImageTag = (imageUrl: string) => {
    const imageTag = `![이미지](${imageUrl})`;
    navigator.clipboard.writeText(imageTag).then(() => {
      alert('이미지 태그가 클립보드에 복사되었습니다!');
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const postData = {
        title: title.trim(),
        content: content.trim(),
        thumbnail: thumbnailUrl.trim() || undefined
      };

      console.log('API 호출 시작:', postType, postData, isEditMode ? `수정 ID: ${editPost?.id}` : '새 글');

      let response;
      if (isEditMode && editPost) {
        // 수정 모드
        response = postType === 'work' 
          ? await api.work.updatePost(editPost.id, postData)
          : await api.filed.updatePost(editPost.id, postData);
      } else {
        // 생성 모드
        response = postType === 'work' 
          ? await api.work.createPost(postData)
          : await api.filed.createPost(postData);
      }

      console.log('API 응답:', response);

      if (response.success) {
        // 성공 시 부모 컴포넌트에 알림
        onSavePost({
          title: response.data.title,
          content: response.data.content,
          date: response.data.date,
          images: images.map(img => img.url).filter(url => url.trim() !== ''),
          thumbnail: thumbnailUrl.trim() || undefined
        });

        // 성공 메시지
        alert(response.message);
        
        // 수정 모드가 아닐 때만 폼 초기화
        if (!isEditMode) {
          setTitle('');
          setContent('');
          setThumbnailUrl('');
          setImages([]);
        }
      }
    } catch (err) {
      console.error('글 저장 오류 상세:', err);
      setError(err instanceof Error ? err.message : '서버 연결에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="write-container">
      <div className="write-header">
        <motion.button 
          className="back-button"
          onClick={onBackToWork}
          disabled={saving}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ← 돌아가기
        </motion.button>
        
        <button 
          onClick={handleSubmit}
          className="save-button"
          disabled={saving}
        >
          {saving ? (isEditMode ? '수정 중...' : '저장 중...') : (isEditMode ? '수정하기' : '저장하기')}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="write-form">
        <div className="form-group">
          <label className="form-label">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="글 제목을 입력하세요"
            className="form-input"
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label className="form-label">썸네일 이미지 URL</label>
          <input
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="썸네일로 사용할 이미지 URL을 입력하세요"
            className="form-input"
            disabled={saving}
          />
          {thumbnailUrl && (
            <div className="thumbnail-preview">
              <img src={thumbnailUrl} alt="썸네일 미리보기" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }} />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">내용</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요. 이미지는 ![이미지](URL) 형식으로 삽입할 수 있습니다."
            className="form-textarea"
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <div className="images-header">
            <label className="form-label">이미지</label>
            <button 
              type="button" 
              onClick={addImage}
              className="add-image-button"
              disabled={saving}
            >
              + 이미지 추가
            </button>
          </div>
          
          <div className="images-container">
            {images.map((image, index) => (
              <div key={index} className="image-input-group">
                <div className="image-input-header">
                  <span className="image-number">이미지 {index + 1}</span>
                  <div>
                    <button 
                      type="button"
                      onClick={() => insertImageToContent(image.url)}
                      className="insert-image-button"
                      disabled={!image.url || saving}
                    >
                      내용에 삽입
                    </button>
                    <button 
                      type="button"
                      onClick={() => copyImageTag(image.url)}
                      className="copy-tag-button"
                      disabled={!image.url || saving}
                    >
                      태그 복사
                    </button>
                    <button 
                      type="button"
                      onClick={() => removeImage(index)}
                      className="remove-image-button"
                      disabled={saving}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                
                <input
                  type="url"
                  value={image.url}
                  onChange={(e) => updateImageUrl(index, e.target.value)}
                  placeholder="이미지 URL을 입력하세요"
                  className="form-input image-url-input"
                  disabled={saving}
                />
                
                <input
                  type="text"
                  value={image.caption}
                  onChange={(e) => updateImageCaption(index, e.target.value)}
                  placeholder="이미지 설명 (선택사항)"
                  className="form-input"
                  disabled={saving}
                />
                
                {image.url && (
                  <div className="image-preview">
                    <img 
                      src={image.url} 
                      alt={`이미지 ${index + 1}`}
                      onError={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'image-error';
                        errorDiv.textContent = '이미지를 불러올 수 없습니다.';
                        target.parentNode?.appendChild(errorDiv);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WritePost; 