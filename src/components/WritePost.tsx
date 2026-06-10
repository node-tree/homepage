import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import BlockEditor from './editor/BlockEditor';
import ImageKitPicker from './editor/ImageKitPicker';
import { ikUrl } from '../utils/ikUrl';

interface WritePostProps {
  onSavePost: (postData: { title: string; content: string; date: string; images?: string[]; thumbnail?: string }) => void;
  onBackToWork: () => void;
  postType?: 'work' | 'workshop' | 'filed' | 'location';
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
  category?: string;
}

const WritePost: React.FC<WritePostProps> = ({ onSavePost, onBackToWork, postType = 'work', editPost = null }) => {
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailSize, setThumbnailSize] = useState<{ width: number; height: number } | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('문화예술교육');
  const dirtyRef = useRef(false);
  const [thumbPickerOpen, setThumbPickerOpen] = useState(false);

  const isEditMode = !!editPost;

  // 편집 대상 로드
  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '');
      setThumbnailUrl(editPost.thumbnail || '');
      setCategory(editPost.category || '문화예술교육');
      setContent(editPost.content || '');
    } else {
      setTitle('');
      setThumbnailUrl('');
      setCategory('문화예술교육');
      setContent('');
    }
    dirtyRef.current = false;
  }, [editPost]);

  // 저장 전 이탈 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleBack = () => {
    if (dirtyRef.current && !window.confirm('저장하지 않은 변경 사항이 있습니다. 나가시겠습니까?')) {
      return;
    }
    onBackToWork();
  };

  // 내용이 비었는지 판단: 텍스트도 없고 미디어(img/iframe/video/hr)도 없으면 빈 것.
  const isContentEmpty = (html: string): boolean => {
    const textOnly = html.replace(/<[^>]+>/g, '').trim();
    const hasMedia = /<(img|iframe|video|hr)/i.test(html);
    return !textOnly && !hasMedia;
  };

  const handleSubmit = async () => {
    if (!title.trim() || isContentEmpty(content)) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const postData: {
        title: string;
        content: string;
        thumbnail?: string;
        htmlContent: string;
        category?: string;
      } = {
        title: title.trim(),
        content: content.trim(),
        thumbnail: thumbnailUrl.trim() || undefined,
        htmlContent: ''
      };

      if (postType === 'filed') {
        postData.category = category;
      }

      let response;
      const apiEndpoint = postType === 'work' ? api.work : api.filed;

      if (isEditMode && editPost) {
        response = await apiEndpoint.updatePost(editPost.id, postData);
      } else {
        response = await apiEndpoint.createPost(postData);
      }

      if (response.success) {
        dirtyRef.current = false;
        alert(response.message);
        onSavePost(response.data);
        if (!isEditMode) {
          setTitle('');
          setThumbnailUrl('');
          setContent('');
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
          onClick={handleBack}
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
            onChange={(e) => { setTitle(e.target.value); dirtyRef.current = true; }}
            placeholder="글 제목을 입력하세요"
            className="form-input"
            disabled={saving}
          />
        </div>

        {postType === 'filed' && (
          <div className="form-group">
            <label className="form-label">카테고리</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); dirtyRef.current = true; }}
              className="form-input"
              disabled={saving}
              style={{ cursor: 'pointer' }}
            >
              <option value="문화예술교육">문화예술교육</option>
              <option value="커뮤니티">커뮤니티</option>
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">썸네일 이미지 URL</label>
          <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 8px 0' }}>
            권장 사이즈: <strong style={{ color: '#555' }}>400 × 250px</strong> (가로 × 세로)
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => {
                setThumbnailUrl(e.target.value);
                setThumbnailSize(null);
                dirtyRef.current = true;
              }}
              placeholder="썸네일로 사용할 이미지 URL을 입력하거나 이미지를 선택하세요"
              className="form-input"
              disabled={saving}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setThumbPickerOpen(true)}
              disabled={saving}
              style={{ whiteSpace: 'nowrap', padding: '10px 16px' }}
            >
              이미지 선택
            </button>
          </div>
          {thumbnailUrl && (
            <div className="thumbnail-preview" style={{ marginTop: '12px' }}>
              <img
                src={ikUrl(thumbnailUrl, { w: 400 })}
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

        <ImageKitPicker
          open={thumbPickerOpen}
          onClose={() => setThumbPickerOpen(false)}
          onSelect={(urls) => {
            if (urls[0]) {
              setThumbnailUrl(urls[0]);
              setThumbnailSize(null);
              dirtyRef.current = true;
            }
          }}
          title="썸네일 이미지 선택"
        />

        <div className="form-group">
          <label className="form-label">내용</label>
          <BlockEditor
            value={content}
            onChange={(html) => { setContent(html); dirtyRef.current = true; }}
            placeholder="내용을 입력하세요"
          />
        </div>
      </div>
    </div>
  );
};

export default WritePost;
