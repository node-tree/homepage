import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [category, setCategory] = useState<string>('문화예술교육');
  const [isToolbarFixed, setIsToolbarFixed] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarPlaceholderRef = useRef<HTMLDivElement>(null);

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

  // 에디터 로드 시 기존 버튼 HTML 제거 (이벤트 핸들러 없는 정적 버튼)
  const cleanExistingButtons = (html: string): string => {
    let cleaned = html;
    // media-controls div 제거
    cleaned = cleaned.replace(/<div class="media-controls"[^>]*>[\s\S]*?<\/div>/gi, '');
    // 개별 버튼들 제거
    cleaned = cleaned.replace(/<button[^>]*title="위로 이동"[^>]*>[\s\S]*?<\/button>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*title="아래로 이동"[^>]*>[\s\S]*?<\/button>/gi, '');
    cleaned = cleaned.replace(/<button[^>]*title="삭제"[^>]*>[\s\S]*?<\/button>/gi, '');
    // 빈 wrapper div 제거
    cleaned = cleaned.replace(/<div[^>]*contenteditable="false"[^>]*>\s*<\/div>/gi, '');
    return cleaned;
  };

  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '');
      setThumbnailUrl(editPost.thumbnail || '');
      setCategory(editPost.category || '문화예술교육');
      if (editorRef.current) {
        let content = editPost.content || '';
        // 기존 버튼 HTML 제거 (새로 추가할 것이므로)
        content = cleanExistingButtons(content);
        if (content.includes('<') && content.includes('>')) {
          editorRef.current.innerHTML = content;
        } else {
          editorRef.current.innerHTML = parseMarkdownMedia(content);
        }
        // 콘텐츠 로드 후 미디어 블록에 컨트롤 추가
        setTimeout(() => {
          if (!editorRef.current) return;

          // 1. 기존 .media-block에 컨트롤 추가
          const mediaBlocks = editorRef.current.querySelectorAll('.media-block');
          mediaBlocks.forEach((block) => {
            addMediaControls(block as HTMLElement);
          });

          // 2. .media-block이 아닌 독립적인 이미지들 처리
          const standaloneImages = editorRef.current.querySelectorAll('img:not(.media-block img)');
          standaloneImages.forEach((img) => {
            const parent = img.parentElement;
            // 이미 media-block 안에 있으면 스킵
            if (parent?.classList.contains('media-block')) return;

            // 새 media-block wrapper 생성
            const wrapper = document.createElement('div');
            wrapper.className = 'media-block';
            wrapper.draggable = true;
            wrapper.contentEditable = 'false';
            wrapper.setAttribute('data-type', 'image');
            wrapper.style.cssText = 'position: relative; margin: 10px 0;';

            // 이미지를 wrapper로 감싸기
            img.parentNode?.insertBefore(wrapper, img);
            wrapper.appendChild(img);

            addMediaControls(wrapper);
          });

          // 3. .media-block이 아닌 독립적인 비디오/iframe 처리
          const standaloneVideos = editorRef.current.querySelectorAll('iframe:not(.media-block iframe):not(.video-container iframe), video:not(.media-block video):not(.video-container video)');
          standaloneVideos.forEach((video) => {
            const parent = video.parentElement;
            // 이미 media-block 안에 있거나 video-container 안에 있으면 스킵
            if (parent?.classList.contains('media-block') || parent?.classList.contains('video-container')) return;

            // 새 media-block wrapper 생성
            const wrapper = document.createElement('div');
            wrapper.className = 'media-block';
            wrapper.draggable = true;
            wrapper.contentEditable = 'false';
            wrapper.setAttribute('data-type', 'video');
            wrapper.style.cssText = 'position: relative; margin: 10px 0;';

            // video-container 생성
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';

            // 비디오를 video-container로 감싸고, 그걸 media-block으로 감싸기
            video.parentNode?.insertBefore(wrapper, video);
            videoContainer.appendChild(video);
            wrapper.appendChild(videoContainer);

            addMediaControls(wrapper);
          });

          // 4. video-container가 media-block 없이 있는 경우 처리
          const standaloneVideoContainers = editorRef.current.querySelectorAll('.video-container:not(.media-block .video-container)');
          standaloneVideoContainers.forEach((container) => {
            const parent = container.parentElement;
            if (parent?.classList.contains('media-block')) return;

            // 새 media-block wrapper 생성
            const wrapper = document.createElement('div');
            wrapper.className = 'media-block';
            wrapper.draggable = true;
            wrapper.contentEditable = 'false';
            wrapper.setAttribute('data-type', 'video');
            wrapper.style.cssText = 'position: relative; margin: 10px 0;';

            container.parentNode?.insertBefore(wrapper, container);
            wrapper.appendChild(container);

            addMediaControls(wrapper);
          });

          // 5. 이미지 번호 뱃지 업데이트
          updateMediaIndices();
        }, 100);
      }
    } else {
      setTitle('');
      setThumbnailUrl('');
      setCategory('문화예술교육');
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

  // 툴바 스크롤 고정 처리 - requestAnimationFrame 사용
  useEffect(() => {
    let animationFrameId: number;
    let isFixedRef = false;

    const checkPosition = () => {
      if (toolbarPlaceholderRef.current) {
        const rect = toolbarPlaceholderRef.current.getBoundingClientRect();
        const navHeight = 120; // 상단 네비게이션 높이
        const shouldBeFixed = rect.top < navHeight;

        // 상태가 변경될 때만 업데이트
        if (shouldBeFixed !== isFixedRef) {
          isFixedRef = shouldBeFixed;
          setIsToolbarFixed(shouldBeFixed);
        }
      }
      animationFrameId = requestAnimationFrame(checkPosition);
    };

    animationFrameId = requestAnimationFrame(checkPosition);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Word/Office에서 복사한 HTML 정리 함수
  const cleanWordHTML = (html: string): string => {
    let cleaned = html;

    // Microsoft Office 전용 태그 제거
    cleaned = cleaned.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
    cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
    cleaned = cleaned.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '');
    cleaned = cleaned.replace(/<!\[if[^>]*>[\s\S]*?<!\[endif\]>/gi, '');
    cleaned = cleaned.replace(/<!--\[if[^>]*>[\s\S]*?<!\[endif\]-->/gi, '');
    cleaned = cleaned.replace(/<xml>[\s\S]*?<\/xml>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // meta, link 태그 제거 (Word에서 추가하는 메타데이터)
    cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
    cleaned = cleaned.replace(/<link[^>]*>/gi, '');

    // Word Fragment 주석 제거
    cleaned = cleaned.replace(/<!--StartFragment-->/gi, '');
    cleaned = cleaned.replace(/<!--EndFragment-->/gi, '');

    // class 속성 제거
    cleaned = cleaned.replace(/\s*class="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*class='[^']*'/gi, '');

    // style 속성에서 유지할 스타일만 추출 (색상, 배경색, 테두리, 크기, 여백, 정렬 등)
    const preserveStyles = ['color', 'background-color', 'background', 'border', 'border-color', 'border-width', 'border-style', 'width', 'height', 'text-align', 'vertical-align', 'font-weight', 'font-size', 'font-family', 'margin', 'padding'];

    cleaned = cleaned.replace(/\s*style="([^"]*)"/gi, (match, styleContent) => {
      const styles = styleContent.split(';').filter((s: string) => s.trim());
      const keepStyles: string[] = [];

      styles.forEach((style: string) => {
        const [prop] = style.split(':').map((s: string) => s.trim().toLowerCase());
        // mso- 로 시작하는 Microsoft 전용 스타일은 제외
        if (prop && !prop.startsWith('mso-') && preserveStyles.some(p => prop.startsWith(p))) {
          keepStyles.push(style.trim());
        }
      });

      return keepStyles.length > 0 ? ` style="${keepStyles.join('; ')}"` : '';
    });

    // Microsoft 전용 속성 제거
    cleaned = cleaned.replace(/\s*lang="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*data-[^=]*="[^"]*"/gi, '');

    // 빈 span 태그 정리 (스타일 없는 것만)
    cleaned = cleaned.replace(/<span\s*>([^<]*)<\/span>/gi, '$1');
    cleaned = cleaned.replace(/<span\s*\/>/gi, '');

    // 불필요한 font 태그 제거
    cleaned = cleaned.replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1');

    // 연속된 공백과 줄바꿈 정리
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/>\s+</g, '><');

    // 빈 태그 제거 (스타일 없는 것만)
    cleaned = cleaned.replace(/<(\w+)>\s*<\/\1>/gi, '');

    // &nbsp; 처리
    cleaned = cleaned.replace(/&nbsp;/gi, ' ');

    return cleaned.trim();
  };

  // 붙여넣기 이벤트 핸들러
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const clipboardData = e.clipboardData;
    let pastedContent = '';

    // HTML 데이터가 있으면 정리해서 사용
    if (clipboardData.types.includes('text/html')) {
      const html = clipboardData.getData('text/html');
      pastedContent = cleanWordHTML(html);
    } else {
      // 일반 텍스트만 있으면 그대로 사용
      pastedContent = clipboardData.getData('text/plain');
      // 줄바꿈을 <br>로 변환
      pastedContent = pastedContent.replace(/\n/g, '<br>');
    }

    // 커서 위치에 삽입
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const fragment = document.createRange().createContextualFragment(pastedContent);
      range.insertNode(fragment);

      // 커서를 삽입된 내용 뒤로 이동
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

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
    // 이미지 번호 업데이트
    updateMediaIndices();
  };

  // 이미지 번호 뱃지 업데이트
  const updateMediaIndices = () => {
    if (!editorRef.current) return;
    const blocks = editorRef.current.querySelectorAll('.media-block[data-type="image"]');
    blocks.forEach((block, idx) => {
      let badge = block.querySelector('.media-index') as HTMLElement;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'media-index';
        badge.contentEditable = 'false';
        block.appendChild(badge);
      }
      badge.textContent = `${idx + 1}`;
    });
  };

  // 미디어 블록에 컨트롤 버튼 추가
  const addMediaControls = (mediaBlock: HTMLElement) => {
    // 이미 컨트롤이 있으면 스킵
    if (mediaBlock.querySelector('.media-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'media-controls';
    controls.contentEditable = 'false';
    controls.style.cssText = 'position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; opacity: 1;';

    const btnStyle = 'padding: 6px 10px; background: rgba(0,0,0,0.55); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);';

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
        updateMediaIndices();
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
        updateMediaIndices();
      }
    };

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = '삭제';
    deleteBtn.style.cssText = btnStyle + 'background: rgba(220,53,69,0.75);';
    deleteBtn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      mediaBlock.remove();
      updateMediaIndices();
    };

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(deleteBtn);

    mediaBlock.style.position = 'relative';
    mediaBlock.insertBefore(controls, mediaBlock.firstChild);
  };


  // 저장 전 미디어 컨트롤 버튼 제거
  const removeMediaControls = (html: string): string => {
    // media-controls div 제거
    let cleaned = html.replace(/<div class="media-controls"[^>]*>[\s\S]*?<\/div>/gi, '');
    // media-index 뱃지 제거
    cleaned = cleaned.replace(/<span class="media-index"[^>]*>[^<]*<\/span>/gi, '');
    // contenteditable 속성 제거
    cleaned = cleaned.replace(/\s*contenteditable="[^"]*"/gi, '');
    // draggable 속성 제거 (media-block에서)
    cleaned = cleaned.replace(/\s*draggable="[^"]*"/gi, '');
    return cleaned;
  };

  const handleSubmit = async () => {
    let content = editorRef.current?.innerHTML || '';

    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    // 저장 전 미디어 컨트롤 버튼 제거
    content = removeMediaControls(content);

    // 저장 전 Word HTML 정리 (안전장치)
    content = cleanWordHTML(content);

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

      // filed 타입인 경우 카테고리 추가
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

        {postType === 'filed' && (
          <div className="form-group">
            <label className="form-label">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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

          {/* 툴바 위치 기준점 */}
          <div
            ref={toolbarPlaceholderRef}
            style={isToolbarFixed && toolbarRef.current ? { height: `${toolbarRef.current.offsetHeight}px` } : { height: '1px' }}
          />

          {/* 툴바 */}
          <div
            ref={toolbarRef}
            className={`editor-toolbar ${isToolbarFixed ? 'editor-toolbar-fixed' : ''}`}
          >
            {/* 텍스트 서식 */}
            <button type="button" onClick={handleBold} disabled={saving} className="toolbar-btn" title="굵게">
              <strong>B</strong>
            </button>
            <button type="button" onClick={handleItalic} disabled={saving} className="toolbar-btn" title="기울임">
              <em>I</em>
            </button>
            <button type="button" onClick={handleUnderline} disabled={saving} className="toolbar-btn" title="밑줄">
              <u>U</u>
            </button>

            <div className="toolbar-divider" />

            {/* 글자 크기 */}
            <select
              onChange={(e) => handleFontSize(e.target.value)}
              disabled={saving}
              className="toolbar-btn"
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
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                disabled={saving}
                className="toolbar-btn"
                title="글자 색상"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ width: '14px', height: '14px', background: 'linear-gradient(135deg, #e74c3c, #3498db, #2ecc71)', borderRadius: '3px' }} />
                색상
              </button>
              {showColorPicker && (
                <div className="color-picker-popup">
                  {colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleTextColor(color)}
                      className="color-btn"
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            {/* 미디어 삽입 */}
            <button type="button" onClick={handleInsertImage} disabled={saving} className="toolbar-btn">
              이미지
            </button>
            <button type="button" onClick={handleInsertVideo} disabled={saving} className="toolbar-btn">
              영상
            </button>

            <div className="toolbar-divider" />

            {/* 정렬 */}
            <button type="button" onClick={() => execCommand('justifyLeft')} disabled={saving} className="toolbar-btn" title="좌측 정렬">
              좌측
            </button>
            <button type="button" onClick={() => execCommand('justifyCenter')} disabled={saving} className="toolbar-btn" title="중앙 정렬">
              중앙
            </button>
            <button type="button" onClick={() => execCommand('justifyRight')} disabled={saving} className="toolbar-btn" title="우측 정렬">
              우측
            </button>

            <span className="toolbar-hint">
              이미지/영상: ↑↓ 버튼으로 이동
            </span>
          </div>

          {/* WYSIWYG 에디터 */}
          <div
            ref={editorRef}
            contentEditable={!saving}
            className="form-textarea wysiwyg-editor"
            data-placeholder="내용을 입력하세요. 이미지나 영상은 드래그하여 위치를 변경할 수 있습니다."
            onPaste={handlePaste}
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
