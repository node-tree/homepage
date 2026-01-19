import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

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
  const [thumbnailSize, setThumbnailSize] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 마크다운 이미지/영상을 HTML로 변환하는 함수
  const parseMarkdownMedia = (text: string): string => {
    let result = text;

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
      return `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px;" />`;
    });

    // 줄바꿈을 <br>로 변환
    result = result.replace(/\n/g, '<br />');

    return result;
  };

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
          <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 8px 0' }}>
            권장 사이즈: <strong style={{ color: '#555' }}>400 × 250px</strong> (가로 × 세로)
          </p>
          <input
            type="url"
            value={thumbnailUrl}
            onChange={(e) => {
              setThumbnailUrl(e.target.value);
              setThumbnailSize(null);
            }}
            placeholder="썸네일로 사용할 이미지 URL을 입력하세요"
            className="form-input"
            disabled={saving}
          />
          {thumbnailUrl && (
            <div className="thumbnail-preview" style={{ marginTop: '12px' }}>
              <img
                src={thumbnailUrl}
                alt="썸네일 미리보기"
                style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', borderRadius: '8px', background: '#f5f5f5' }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setThumbnailSize({ width: img.naturalWidth, height: img.naturalHeight });
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  setThumbnailSize(null);
                }}
              />
              {thumbnailSize && (
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                  현재 이미지 크기: <strong>{thumbnailSize.width} × {thumbnailSize.height}px</strong>
                  {thumbnailSize.width !== 400 || thumbnailSize.height !== 250 ? (
                    <span style={{ color: '#e67700', marginLeft: '8px' }}>
                      (권장 사이즈와 다름)
                    </span>
                  ) : (
                    <span style={{ color: '#2e7d32', marginLeft: '8px' }}>
                      ✓ 최적 사이즈
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">내용</label>
          <div className="markdown-toolbar" style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={handleInsertImage} disabled={saving} className="toolbar-button">이미지 추가</button>
            <button onClick={handleInsertVideo} disabled={saving} className="toolbar-button">영상 추가</button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="toolbar-button"
              style={{ marginLeft: 'auto', backgroundColor: showPreview ? '#333' : undefined, color: showPreview ? '#fff' : undefined }}
            >
              {showPreview ? '편집' : '미리보기'}
            </button>
          </div>

          {showPreview ? (
            <div
              className="preview-content"
              style={{
                minHeight: '400px',
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: parseMarkdownMedia(content) }}
            />
          ) : (
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="글 내용을 입력하세요. 이미지나 영상은 위 버튼을 사용하거나 마크다운 형식( ![alt](url) 또는 !![alt](url) )으로 직접 입력할 수 있습니다."
              className="form-textarea"
              disabled={saving}
              rows={20}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WritePost; 