import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import api, { locationPostAPI } from '../services/api';

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
}

const WritePost: React.FC<WritePostProps> = ({ onSavePost, onBackToWork, postType = 'work', editPost = null }) => {
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailSize, setThumbnailSize] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const colors = [
    '#000000', '#333333', '#666666', '#999999',
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#e91e63'
  ];

  const fontSizes = [
    { label: '작게', value: '2' },
    { label: '보통', value: '3' },
    { label: '크게', value: '4' },
    { label: '매우 크게', value: '5' },
    { label: '제목', value: '6' },
  ];

  // 마크다운을 HTML로 변환 (기존 콘텐츠 로드용)
  const parseMarkdownMedia = (text: string): string => {
    let result = text;

    // 영상 마크다운 처리: !![alt](url)
    result = result.replace(/!!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (youtubeMatch) {
        return `<div class="media-block" draggable="true" contenteditable="false" data-type="video"><div class="video-container"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allowfullscreen></iframe></div></div>`;
      }
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return `<div class="media-block" draggable="true" contenteditable="false" data-type="video"><div class="video-container"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen></iframe></div></div>`;
      }
      return `<div class="media-block" draggable="true" contenteditable="false" data-type="video"><div class="video-container"><video controls><source src="${url}" /></video></div></div>`;
    });

    // 이미지 마크다운 처리: ![alt](url)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      return `<div class="media-block" draggable="true" contenteditable="false" data-type="image"><img src="${url}" alt="${alt}" draggable="false" /></div>`;
    });

    // 줄바꿈을 <div>로 변환 (contentEditable 방식과 일치)
    const lines = result.split('\n');
    result = lines.map(line => line ? `<div>${line}</div>` : '<div><br></div>').join('');

    return result;
  };

  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '');
      setThumbnailUrl(editPost.thumbnail || '');
      if (editorRef.current) {
        const content = editPost.content || '';
        if (content.includes('<') && content.includes('>')) {
          editorRef.current.innerHTML = content;
        } else {
          editorRef.current.innerHTML = parseMarkdownMedia(content);
        }
        // 콘텐츠 로드 후 미디어 블록에 컨트롤 추가
        setTimeout(() => {
          const mediaBlocks = editorRef.current?.querySelectorAll('.media-block');
          mediaBlocks?.forEach((block) => {
            addMediaControls(block as HTMLElement);
          });
        }, 50);
      }
    } else {
      setTitle('');
      setThumbnailUrl('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [editPost]);

  // 컬러 피커 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isEditMode = !!editPost;

  // 텍스트 서식 적용
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleFontSize = (size: string) => {
    execCommand('fontSize', size);
  };

  const handleTextColor = (color: string) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');

  const handleInsertImage = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url && editorRef.current) {
      const imgBlock = document.createElement('div');
      imgBlock.className = 'media-block';
      imgBlock.draggable = true;
      imgBlock.contentEditable = 'false';
      imgBlock.setAttribute('data-type', 'image');
      // 이미지에 draggable="false"를 추가하여 브라우저 기본 드래그 방지
      imgBlock.innerHTML = `<img src="${url}" alt="이미지" draggable="false" />`;

      insertMediaBlock(imgBlock);
    }
  };

  const handleInsertVideo = () => {
    const url = prompt('영상 URL (YouTube, Vimeo 또는 직접 링크)을 입력하세요:');
    if (url && editorRef.current) {
      const videoBlock = document.createElement('div');
      videoBlock.className = 'media-block';
      videoBlock.draggable = true;
      videoBlock.contentEditable = 'false';
      videoBlock.setAttribute('data-type', 'video');

      const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (youtubeMatch) {
        videoBlock.innerHTML = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
      } else {
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
          videoBlock.innerHTML = `<div class="video-container"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        } else {
          videoBlock.innerHTML = `<div class="video-container"><video controls><source src="${url}" /></video></div>`;
        }
      }

      insertMediaBlock(videoBlock);
    }
  };

  const insertMediaBlock = (block: HTMLElement) => {
    if (!editorRef.current) return;

    // 먼저 컨트롤 추가
    addMediaControls(block);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(block);
        // 미디어 블록 다음에 새 줄 추가
        const newLine = document.createElement('div');
        newLine.innerHTML = '<br>';
        block.after(newLine);
        range.setStartAfter(newLine);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }
    editorRef.current.appendChild(block);
    // 미디어 블록 다음에 새 줄 추가
    const newLine = document.createElement('div');
    newLine.innerHTML = '<br>';
    editorRef.current.appendChild(newLine);
  };

  // 미디어 블록에 컨트롤 버튼 추가
  const addMediaControls = (mediaBlock: HTMLElement) => {
    // 이미 컨트롤이 있으면 스킵
    if (mediaBlock.querySelector('.media-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'media-controls';
    controls.contentEditable = 'false';
    controls.style.cssText = 'position: absolute; top: 5px; right: 5px; display: flex; gap: 4px; z-index: 10; opacity: 1;';

    const btnStyle = 'padding: 4px 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';

    // 위로 이동 버튼
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.innerHTML = '↑';
    upBtn.title = '위로 이동';
    upBtn.style.cssText = btnStyle;
    upBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    upBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const prev = mediaBlock.previousElementSibling;
      if (prev && !prev.classList.contains('media-controls')) {
        mediaBlock.parentNode?.insertBefore(mediaBlock, prev);
      }
    };

    // 아래로 이동 버튼
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.innerHTML = '↓';
    downBtn.title = '아래로 이동';
    downBtn.style.cssText = btnStyle;
    downBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    downBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = mediaBlock.nextElementSibling;
      if (next) {
        mediaBlock.parentNode?.insertBefore(next, mediaBlock);
      }
    };

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = '삭제';
    deleteBtn.style.cssText = btnStyle + 'background: rgba(220,53,69,0.8);';
    deleteBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      mediaBlock.remove();
    };

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(deleteBtn);

    mediaBlock.style.position = 'relative';
    mediaBlock.insertBefore(controls, mediaBlock.firstChild);
  };


  const handleSubmit = async () => {
    const content = editorRef.current?.innerHTML || '';

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
        htmlContent: ''
      };

      let response;
      const apiEndpoint = postType === 'work' ? api.work : postType === 'location' ? locationPostAPI : api.filed;

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
          setThumbnailUrl('');
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
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

  const toolbarButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
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

          {/* 툴바 */}
          <div style={{
            marginBottom: '10px',
            padding: '10px',
            background: '#f8f8f8',
            borderRadius: '8px 8px 0 0',
            border: '1px solid #ddd',
            borderBottom: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}>
            {/* 텍스트 서식 */}
            <button onClick={handleBold} disabled={saving} style={toolbarButtonStyle} title="굵게">
              <strong>B</strong>
            </button>
            <button onClick={handleItalic} disabled={saving} style={toolbarButtonStyle} title="기울임">
              <em>I</em>
            </button>
            <button onClick={handleUnderline} disabled={saving} style={toolbarButtonStyle} title="밑줄">
              <u>U</u>
            </button>

            <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

            {/* 글자 크기 */}
            <select
              onChange={(e) => handleFontSize(e.target.value)}
              disabled={saving}
              style={{ ...toolbarButtonStyle, padding: '6px 8px' }}
              defaultValue=""
            >
              <option value="" disabled>크기</option>
              {fontSizes.map(size => (
                <option key={size.value} value={size.value}>{size.label}</option>
              ))}
            </select>

            {/* 글자 색상 */}
            <div style={{ position: 'relative' }} ref={colorPickerRef}>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                disabled={saving}
                style={{ ...toolbarButtonStyle, display: 'flex', alignItems: 'center', gap: '4px' }}
                title="글자 색상"
              >
                <span style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #e74c3c, #3498db, #2ecc71)', borderRadius: '2px' }} />
                색상
              </button>
              {showColorPicker && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  marginTop: '4px',
                  padding: '8px',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '4px',
                  zIndex: 100
                }}>
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => handleTextColor(color)}
                      style={{
                        width: '28px',
                        height: '28px',
                        background: color,
                        border: '2px solid #fff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        boxShadow: '0 0 0 1px #ddd'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

            {/* 미디어 삽입 */}
            <button onClick={handleInsertImage} disabled={saving} style={toolbarButtonStyle}>
              이미지
            </button>
            <button onClick={handleInsertVideo} disabled={saving} style={toolbarButtonStyle}>
              영상
            </button>

            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#999' }}>
              이미지/영상: ↑↓ 버튼으로 이동
            </span>
          </div>

          {/* WYSIWYG 에디터 */}
          <div
            ref={editorRef}
            contentEditable={!saving}
            className="form-textarea wysiwyg-editor"
            style={{
              minHeight: '400px',
              padding: '16px',
              border: '1px solid #ddd',
              borderRadius: '0 0 8px 8px',
              backgroundColor: '#fff',
              overflow: 'auto',
              outline: 'none',
              lineHeight: '1.8'
            }}
            data-placeholder="내용을 입력하세요. 이미지나 영상은 드래그하여 위치를 변경할 수 있습니다."
            onFocus={(e) => {
              if (e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
                e.currentTarget.innerHTML = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default WritePost;
