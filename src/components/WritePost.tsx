import React, { useState, useRef, useEffect } from 'react';
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
  htmlContent?: string;
}

const WritePost: React.FC<WritePostProps> = ({ onSavePost, onBackToWork, postType = 'work', editPost = null }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '');
      setContent(editPost.content || '');
      setThumbnailUrl(editPost.thumbnail || '');
    } else {
      setTitle('');
      setContent('');
      setThumbnailUrl('');
    }
  }, [editPost]);

  const isEditMode = !!editPost;

  const insertMarkdown = (markdown: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = `${content.substring(0, start)}${markdown}${content.substring(end)}`;
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
      }, 0);
    }
  };

  const handleInsertImage = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url) {
      insertMarkdown(`![이미지](${url})`);
    }
  };

  const handleInsertVideo = () => {
    const url = prompt('영상 URL (YouTube, Vimeo 또는 직접 링크)을 입력하세요:');
    if (url) {
      insertMarkdown(`!![영상](${url})`);
    }
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
        thumbnail: thumbnailUrl.trim() || undefined,
        htmlContent: '' // htmlContent는 더 이상 사용하지 않음
      };

      let response;
      const apiEndpoint = postType === 'work' ? api.work : api.filed;

      if (isEditMode && editPost) {
        response = await apiEndpoint.updatePost(editPost.id, postData);
      } else {
        response = await apiEndpoint.createPost(postData);
      }

      if (response.success) {
        alert(response.message);
        onSavePost(response.data);
        if (!isEditMode) {
          setTitle('');
          setContent('');
          setThumbnailUrl('');
        }
      } else {
        throw new Error(response.message || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('글 저장 오류:', err);
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
              <img
                src={thumbnailUrl}
                alt="썸네일 미리보기"
                style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">내용</label>
          <div className="markdown-toolbar" style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
            <button onClick={handleInsertImage} disabled={saving} className="toolbar-button">이미지 추가</button>
            <button onClick={handleInsertVideo} disabled={saving} className="toolbar-button">영상 추가</button>
          </div>
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="글 내용을 입력하세요. 이미지나 영상은 위 버튼을 사용하거나 마크다운 형식( ![alt](url) 또는 !![alt](url) )으로 직접 입력할 수 있습니다."
            className="form-textarea"
            disabled={saving}
            rows={20}
          />
        </div>
      </div>
    </div>
  );
};

export default WritePost; 