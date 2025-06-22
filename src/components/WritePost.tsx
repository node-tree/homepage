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
  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [htmlContent, setHtmlContent] = useState(editPost?.htmlContent || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(editPost?.thumbnail || '');
  const [images, setImages] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRichEditor, setUseRichEditor] = useState(!!editPost?.htmlContent);
  const editorRef = useRef<HTMLDivElement>(null);

  // 편집 모드에서 데이터 초기화
  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title || '');
      setContent(editPost.content || '');
      setHtmlContent(editPost.htmlContent || '');
      setThumbnailUrl(editPost.thumbnail || '');
      
      // htmlContent가 있으면 리치에디터 모드로, 없으면 일반 모드로
      const shouldUseRichEditor = !!(editPost.htmlContent && editPost.htmlContent.trim());
      setUseRichEditor(shouldUseRichEditor);
      
      // 이미지 데이터 초기화
      if (editPost.images && editPost.images.length > 0) {
        const imageData = editPost.images.map(url => ({ url, caption: '' }));
        setImages(imageData);
      } else {
        setImages([]);
      }
    } else {
      // 새 글 작성 모드일 때 초기화
      setTitle('');
      setContent('');
      setHtmlContent('');
      setThumbnailUrl('');
      setUseRichEditor(false);
      setImages([]);
    }
  }, [editPost]);

  const isEditMode = !!editPost;

  // 에디터 모드 변경 시 데이터 동기화
  useEffect(() => {
    if (useRichEditor) {
      // 일반 텍스트에서 리치 에디터로 전환
      if (content && !htmlContent) {
        const lines = content.split('\n').filter(line => line.trim());
        const convertedHtml = lines.length > 0 
          ? lines.map(line => `<p>${line.replace(/\n/g, '<br>')}</p>`).join('')
          : '<p><br></p>';
        setHtmlContent(convertedHtml);
      }
    } else {
      // 리치 에디터에서 일반 텍스트로 전환
      if (htmlContent && !content) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        setContent(textContent);
      }
    }
  }, [useRichEditor, content, htmlContent]);

  // 리치 에디터 초기화
  useEffect(() => {
    if (useRichEditor && editorRef.current) {
      const currentElement = editorRef.current;
      
      // 편집 모드에서 htmlContent 결정
      let initialContent = '<p>내용을 입력하세요...</p>';
      
      if (isEditMode && editPost?.htmlContent) {
        // 편집 모드에서 기존 htmlContent가 있는 경우
        initialContent = editPost.htmlContent;
      } else if (htmlContent && htmlContent !== '<p>내용을 입력하세요...</p>') {
        // 현재 htmlContent가 있는 경우
        initialContent = htmlContent;
      }
      
      // DOM 업데이트
      if (initialContent !== currentElement.innerHTML) {
        currentElement.innerHTML = initialContent;
        // htmlContent 상태 동기화
        if (initialContent !== htmlContent) {
          setHtmlContent(initialContent);
        }
      }
      
      // 플레이스홀더 스타일 적용
      const updatePlaceholder = () => {
        if (currentElement) {
          const isEmpty = !currentElement.textContent?.trim() || currentElement.innerHTML === '<p><br></p>';
          const hasRealContent = htmlContent && htmlContent !== '<p>내용을 입력하세요...</p>' && htmlContent.trim();
          
          if (isEmpty && !hasRealContent) {
            currentElement.innerHTML = '<p style="color: #999; font-style: italic;">내용을 입력하세요...</p>';
          }
        }
      };

      // 포커스 이벤트 처리
      const handleFocus = () => {
        if (currentElement && currentElement.innerHTML.includes('내용을 입력하세요...')) {
          currentElement.innerHTML = '<p><br></p>';
          // 커서를 첫 번째 p 태그 안으로 이동
          const range = document.createRange();
          const selection = window.getSelection();
          range.setStart(currentElement.firstChild!, 0);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      };

      const handleBlur = () => {
        updatePlaceholder();
      };

      // 엔터키 처리
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // 새로운 p 태그 생성
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            
            // 현재 위치에 새 p 태그 삽입
            range.deleteContents();
            range.insertNode(newP);
            
            // 커서를 새 p 태그의 끝으로 이동
            const newRange = document.createRange();
            newRange.setStartAfter(newP.firstChild || newP);
            newRange.collapse(true);
            
            // 선택 영역 업데이트
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // HTML 콘텐츠 업데이트
            setHtmlContent(currentElement.innerHTML);
          }
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // 먼저 선택된 이미지가 있는지 확인
            let selectedImg = currentElement.querySelector('img[data-selected="true"]') as HTMLImageElement;
            
            if (selectedImg) {
              // 선택된 이미지가 있으면 삭제
              e.preventDefault();
              const imgContainer = selectedImg.closest('p');
              if (imgContainer) {
                imgContainer.remove();
                setHtmlContent(currentElement.innerHTML);
                
                // 포커스 유지
                setTimeout(() => {
                  if (currentElement) {
                    currentElement.focus();
                  }
                }, 0);
              }
              return;
            }
            
            // 선택된 이미지가 없으면 커서 근처의 이미지 확인
            const selectedElement = range.commonAncestorContainer;
            let imgElement: HTMLImageElement | null = null;
            
            if (selectedElement.nodeType === Node.ELEMENT_NODE) {
              const element = selectedElement as Element;
              imgElement = element.querySelector('img') || (element.tagName === 'IMG' ? element as HTMLImageElement : null);
            } else if (selectedElement.parentElement) {
              imgElement = selectedElement.parentElement.querySelector('img');
              
              // 부모 요소에서도 찾지 못하면 더 상위로 올라가서 찾기
              if (!imgElement && selectedElement.parentElement.parentElement) {
                imgElement = selectedElement.parentElement.parentElement.querySelector('img');
              }
            }
            
            // 이미지가 발견되면 삭제
            if (imgElement) {
              e.preventDefault();
              
              // 이미지를 포함한 p 태그 찾기
              let imgContainer = imgElement.closest('p');
              if (imgContainer) {
                imgContainer.remove();
                
                // HTML 콘텐츠 업데이트
                setHtmlContent(currentElement.innerHTML);
                
                // 포커스 유지
                setTimeout(() => {
                  if (currentElement) {
                    currentElement.focus();
                  }
                }, 0);
              }
            }
          }
        }
      };

      currentElement.addEventListener('focus', handleFocus);
      currentElement.addEventListener('blur', handleBlur);
      currentElement.addEventListener('keydown', handleKeyDown);
      
      updatePlaceholder();

      return () => {
        const element = currentElement; // 클린업 함수에서 사용할 변수로 복사
        element.removeEventListener('focus', handleFocus);
        element.removeEventListener('blur', handleBlur);
        element.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [useRichEditor, htmlContent, isEditMode, editPost?.htmlContent]);

  // 커서 위치 저장 및 복원
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    }
    return 0;
  };

  const restoreCursorPosition = (position: number) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    let charIndex = 0;
    let nodeStack: Node[] = [editorRef.current];
    let node: Node | undefined;
    let foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + (node.textContent?.length || 0);
        if (position >= charIndex && position <= nextCharIndex) {
          range.setStart(node, position - charIndex);
          range.setEnd(node, position - charIndex);
          foundStart = true;
        }
        charIndex = nextCharIndex;
      } else {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    if (foundStart) {
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  // 텍스트 포맷팅 함수들
  const formatText = (command: string, value?: string) => {
    if (!editorRef.current) return;
    
    const cursorPosition = saveCursorPosition();
    document.execCommand(command, false, value);
    setHtmlContent(editorRef.current.innerHTML);
    
    setTimeout(() => {
      restoreCursorPosition(cursorPosition);
      editorRef.current?.focus();
    }, 0);
  };

  // 이미지 삽입
  const insertImage = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url && url.trim() && editorRef.current) {
      const trimmedUrl = url.trim();
      
      // 현재 선택 영역 가져오기
      const selection = window.getSelection();
      let range;
      
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        // 선택 영역이 없으면 에디터 끝에 삽입
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
      
      // 이미지 요소 생성
      const img = document.createElement('img');
      img.src = trimmedUrl;
      img.alt = '삽입된 이미지';
      img.style.cssText = 'max-width: 100%; height: auto; margin: 10px auto; border-radius: 8px; display: block; cursor: pointer;';
      img.contentEditable = 'false'; // 이미지 자체는 편집 불가
      
      // 이미지 클릭 시 선택 처리
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 기존 선택 해제
        const prevSelected = editorRef.current?.querySelector('img[data-selected="true"]');
        if (prevSelected) {
          prevSelected.removeAttribute('data-selected');
          (prevSelected as HTMLImageElement).style.outline = '';
        }
        
        // 현재 이미지 선택
        img.setAttribute('data-selected', 'true');
        img.style.outline = '2px solid #007bff';
        
        // 이미지를 선택 영역으로 설정
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNode(img);
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
      
      // 이미지를 중앙정렬하는 p 태그로 감싸기
      const imgContainer = document.createElement('p');
      imgContainer.style.textAlign = 'center';
      imgContainer.appendChild(img);
      
      // 이미지 다음에 올 새로운 p 태그 생성
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      
      // 현재 위치에 이미지 컨테이너와 새 p 태그 삽입
      range.deleteContents();
      range.insertNode(newP);
      range.insertNode(imgContainer);
      
      // 커서를 새 p 태그 안으로 이동
      range.setStart(newP, 0);
      range.setEnd(newP, 0);
      
      // 선택 영역 업데이트
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // HTML 콘텐츠 업데이트
      setHtmlContent(editorRef.current.innerHTML);
      
      // onInput 이벤트를 수동으로 트리거하여 상태 업데이트 보장
      const inputEvent = new Event('input', { bubbles: true });
      editorRef.current.dispatchEvent(inputEvent);
      
      // 포커스 유지 및 커서 위치 재설정
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          // 커서를 새 p 태그로 다시 이동
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          newRange.setStart(newP, 0);
          newRange.setEnd(newP, 0);
          newSelection?.removeAllRanges();
          newSelection?.addRange(newRange);
          
          // HTML 콘텐츠 다시 업데이트
          setHtmlContent(editorRef.current.innerHTML);
        }
      }, 50);
      
    } else if (url !== null) {
      alert('올바른 이미지 URL을 입력해주세요.');
    }
  };

  // 이미지 갤러리 삽입 (같은 행에 여러 이미지)
  const insertImageGallery = () => {
    if (!useRichEditor || !editorRef.current) return;

    const videoUrl = prompt("영상 URL을 입력하세요 (YouTube, Vimeo, 또는 직접 비디오 파일):");
    if (!videoUrl || !videoUrl.trim()) return;

    const cleanUrl = videoUrl.trim();
    let videoElement = '';

    // YouTube URL 처리
    if (cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('youtu.be/')) {
      let videoId = '';
      if (cleanUrl.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(cleanUrl.split('?')[1]);
        videoId = urlParams.get('v') || '';
      } else if (cleanUrl.includes('youtu.be/')) {
        videoId = cleanUrl.split('youtu.be/')[1].split('?')[0];
      }
      
      if (videoId) {
        videoElement = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
          <iframe 
            src="https://www.youtube.com/embed/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
            frameborder="0" 
            allowfullscreen>
          </iframe>
        </div>`;
      }
    }
    // Vimeo URL 처리
    else if (cleanUrl.includes('vimeo.com/')) {
      const videoId = cleanUrl.split('vimeo.com/')[1].split('?')[0];
      if (videoId) {
        videoElement = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
          <iframe 
            src="https://player.vimeo.com/video/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
            frameborder="0" 
            allowfullscreen>
          </iframe>
        </div>`;
      }
    }
    // 직접 비디오 파일 (.mp4, .webm, .ogg)
    else if (cleanUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      videoElement = `<div style="margin: 1rem 0;">
        <video 
          controls 
          style="width: 100%; max-width: 100%; height: auto;"
          src="${cleanUrl}">
          브라우저가 비디오 태그를 지원하지 않습니다.
        </video>
      </div>`;
    }
    else {
      alert('지원되는 영상 형식이 아닙니다.\n\n지원 형식:\n- YouTube (youtube.com, youtu.be)\n- Vimeo (vimeo.com)\n- 직접 비디오 파일 (.mp4, .webm, .ogg)');
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // 현재 위치에 비디오 삽입
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = videoElement;
      const videoNode = tempDiv.firstChild;
      
      if (videoNode) {
        range.deleteContents();
        range.insertNode(videoNode);
        
        // 커서를 비디오 다음으로 이동
        range.setStartAfter(videoNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // HTML 콘텐츠 업데이트
        setHtmlContent(editorRef.current.innerHTML);
      }
    }
  };

  // 영상 삽입 함수
  const insertVideo = () => {
    if (!useRichEditor || !editorRef.current) return;

    const videoUrl = prompt("영상 URL을 입력하세요 (YouTube, Vimeo, 또는 직접 비디오 파일):");
    if (!videoUrl || !videoUrl.trim()) return;

    const cleanUrl = videoUrl.trim();
    let videoElement = '';

    // YouTube URL 처리
    if (cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('youtu.be/')) {
      let videoId = '';
      if (cleanUrl.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(cleanUrl.split('?')[1]);
        videoId = urlParams.get('v') || '';
      } else if (cleanUrl.includes('youtu.be/')) {
        videoId = cleanUrl.split('youtu.be/')[1].split('?')[0];
      }
      
      if (videoId) {
        videoElement = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
          <iframe 
            src="https://www.youtube.com/embed/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
            frameborder="0" 
            allowfullscreen>
          </iframe>
        </div>`;
      }
    }
    // Vimeo URL 처리
    else if (cleanUrl.includes('vimeo.com/')) {
      const videoId = cleanUrl.split('vimeo.com/')[1].split('?')[0];
      if (videoId) {
        videoElement = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
          <iframe 
            src="https://player.vimeo.com/video/${videoId}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
            frameborder="0" 
            allowfullscreen>
          </iframe>
        </div>`;
      }
    }
    // 직접 비디오 파일 (.mp4, .webm, .ogg)
    else if (cleanUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      videoElement = `<div style="margin: 1rem 0;">
        <video 
          controls 
          style="width: 100%; max-width: 100%; height: auto;"
          src="${cleanUrl}">
          브라우저가 비디오 태그를 지원하지 않습니다.
        </video>
      </div>`;
    }
    else {
      alert('지원되는 영상 형식이 아닙니다.\n\n지원 형식:\n- YouTube (youtube.com, youtu.be)\n- Vimeo (vimeo.com)\n- 직접 비디오 파일 (.mp4, .webm, .ogg)');
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // 현재 위치에 비디오 삽입
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = videoElement;
      const videoNode = tempDiv.firstChild;
      
      if (videoNode) {
        range.deleteContents();
        range.insertNode(videoNode);
        
        // 커서를 비디오 다음으로 이동
        range.setStartAfter(videoNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // HTML 콘텐츠 업데이트
        setHtmlContent(editorRef.current.innerHTML);
      }
    }
  };

  // 이미지 추가 (기존 방식)
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
    // 저장 전 데이터 동기화
    let finalContent = '';
    let finalHtmlContent = '';
    
    if (useRichEditor) {
      finalHtmlContent = htmlContent;
      // 리치 에디터 내용을 일반 텍스트로 변환
      if (htmlContent) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        finalContent = tempDiv.textContent || tempDiv.innerText || '';
      }
    } else {
      finalContent = content;
      // 일반 텍스트를 HTML로 변환
      if (content) {
        const lines = content.split('\n').filter(line => line.trim());
        finalHtmlContent = lines.length > 0 
          ? lines.map(line => `<p>${line}</p>`).join('')
          : '';
      }
    }

    if (!title.trim() || (!finalContent.trim() && !finalHtmlContent.trim())) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const postData = {
        title: title.trim(),
        content: finalContent.trim(),
        htmlContent: finalHtmlContent,
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
        // 저장된 데이터로 상태 업데이트
        setContent(finalContent);
        setHtmlContent(finalHtmlContent);
        
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
          setHtmlContent('');
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
              <img 
                src={thumbnailUrl} 
                alt="썸네일 미리보기" 
                style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* 에디터 모드 선택 */}
        <div className="form-group">
          <label className="form-label">편집 모드</label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                checked={!useRichEditor}
                onChange={() => setUseRichEditor(false)}
                disabled={saving}
              />
              일반 텍스트
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                checked={useRichEditor}
                onChange={() => setUseRichEditor(true)}
                disabled={saving}
              />
              리치 에디터
            </label>
          </div>
        </div>

        {/* 내용 입력 */}
        <div className="form-group">
          <label className="form-label">내용</label>
          
          {useRichEditor ? (
            <div>
              {/* 리치 에디터 도구 모음 */}
              <div style={{
                backgroundColor: '#f5f5f5',
                padding: '1rem',
                borderRadius: '8px 8px 0 0',
                border: '1px solid #ddd',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                {/* 텍스트 포맷팅 */}
                <button type="button" onClick={() => formatText('bold')} style={{
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => formatText('italic')} style={toolbarButtonStyle}>
                  <em>I</em>
                </button>
                <button type="button" onClick={() => formatText('underline')} style={toolbarButtonStyle}>
                  <u>U</u>
                </button>
                
                <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 0.5rem' }} />
                
                {/* 정렬 */}
                <button type="button" onClick={() => formatText('justifyLeft')} style={toolbarButtonStyle}>
                  왼쪽
                </button>
                <button type="button" onClick={() => formatText('justifyCenter')} style={toolbarButtonStyle}>
                  중앙
                </button>
                <button type="button" onClick={() => formatText('justifyRight')} style={toolbarButtonStyle}>
                  오른쪽
                </button>
                
                <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 0.5rem' }} />
                
                {/* 제목 크기 */}
                <select 
                  onChange={(e) => formatText('formatBlock', e.target.value)}
                  style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">텍스트 크기</option>
                  <option value="h1">제목 1</option>
                  <option value="h2">제목 2</option>
                  <option value="h3">제목 3</option>
                  <option value="p">본문</option>
                </select>
                
                {/* 글꼴 크기 */}
                <select 
                  onChange={(e) => formatText('fontSize', e.target.value)}
                  style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">글꼴 크기</option>
                  <option value="1">매우 작게</option>
                  <option value="2">작게</option>
                  <option value="3">보통</option>
                  <option value="4">크게</option>
                  <option value="5">매우 크게</option>
                  <option value="6">거대하게</option>
                  <option value="7">최대</option>
                </select>
                
                <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 0.5rem' }} />
                
                {/* 이미지 */}
                <button type="button" onClick={insertImage} style={toolbarButtonStyle}>
                  🖼️ 이미지
                </button>
                <button type="button" onClick={insertImageGallery} style={{padding: "0.5rem", backgroundColor: "#f8f9fa", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer"}}>
                  🖼️ 갤러리
                </button>
                <button type="button" onClick={insertVideo} style={{padding: "0.5rem", backgroundColor: "#f8f9fa", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer"}}>
                  🎬 영상
                </button>
              </div>
              
              {/* 리치 에디터 영역 */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onClick={(e) => {
                  // 이미지가 아닌 곳을 클릭했을 때 이미지 선택 해제
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'IMG' && editorRef.current) {
                    const selectedImg = editorRef.current.querySelector('img[data-selected="true"]') as HTMLImageElement;
                    if (selectedImg) {
                      selectedImg.removeAttribute('data-selected');
                      selectedImg.style.outline = '';
                    }
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLDivElement;
                  const content = target.innerHTML;
                  
                  console.log('onInput 이벤트 발생:', content); // 디버깅용
                  
                  // 플레이스홀더 감지
                  const isPlaceholder = content.includes('내용을 입력하세요...') && content.includes('font-style: italic');
                  const isEmpty = content === '<p><br></p>' || content === '<br>' || content.trim() === '';
                  
                  // 이미지나 실제 콘텐츠가 있는지 확인
                  const hasImage = content.includes('<img');
                  const hasRealContent = !isEmpty && !isPlaceholder;
                  
                  // 이미지가 있거나 실제 콘텐츠가 있으면 업데이트
                  if (hasImage || hasRealContent) {
                    console.log('HTML 콘텐츠 업데이트:', content); // 디버깅용
                    setHtmlContent(content);
                  } else if (isEmpty) {
                    // 완전히 비어있으면 빈 문자열로 설정
                    setHtmlContent('');
                  }
                }}
                onBlur={(e) => {
                  const target = e.target as HTMLDivElement;
                  const content = target.innerHTML;
                  
                  console.log('onBlur 이벤트 발생:', content); // 디버깅용
                  
                  // 플레이스홀더 감지
                  const isPlaceholder = content.includes('내용을 입력하세요...') && content.includes('font-style: italic');
                  const isEmpty = content === '<p><br></p>' || content === '<br>' || content.trim() === '';
                  
                  // 이미지나 실제 콘텐츠가 있는지 확인
                  const hasImage = content.includes('<img');
                  const hasRealContent = !isEmpty && !isPlaceholder;
                  
                  // 이미지가 있거나 실제 콘텐츠가 있으면 업데이트
                  if (hasImage || hasRealContent) {
                    console.log('HTML 콘텐츠 업데이트 (blur):', content); // 디버깅용
                    setHtmlContent(content);
                  } else if (isEmpty) {
                    // 완전히 비어있으면 빈 문자열로 설정
                    setHtmlContent('');
                  }
                }}
                style={{
                  minHeight: '300px',
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  backgroundColor: '#fff',
                  outline: 'none',
                  lineHeight: '1.6',
                  fontSize: '1rem'
                }}
              />
            </div>
          ) : (
            /* 일반 텍스트 에디터 */
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
              placeholder="글 내용을 입력하세요"
            className="form-textarea"
            disabled={saving}
              rows={15}
          />
          )}
        </div>

        {/* 기존 이미지 관리 (일반 모드에서만) */}
        {!useRichEditor && (
        <div className="form-group">
          <div className="images-header">
              <label className="form-label">이미지 관리</label>
            <button 
              type="button" 
              onClick={addImage}
              className="add-image-button"
              disabled={saving}
            >
              + 이미지 추가
            </button>
          </div>
          
            {images.map((image, index) => (
              <div key={index} className="image-item">
                <div className="image-inputs">
                  <input
                    type="url"
                    value={image.url}
                    onChange={(e) => updateImageUrl(index, e.target.value)}
                    placeholder="이미지 URL"
                    className="form-input"
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
                </div>
                
                <div className="image-actions">
                    <button 
                      type="button"
                      onClick={() => insertImageToContent(image.url)}
                    className="insert-button"
                      disabled={!image.url || saving}
                    >
                    본문에 삽입
                    </button>
                    <button 
                      type="button"
                      onClick={() => copyImageTag(image.url)}
                    className="copy-button"
                      disabled={!image.url || saving}
                    >
                      태그 복사
                    </button>
                    <button 
                      type="button"
                      onClick={() => removeImage(index)}
                    className="remove-button"
                      disabled={saving}
                    >
                      삭제
                    </button>
                  </div>
                
                {image.url && (
                  <div className="image-preview">
                    <img 
                      src={image.url} 
                      alt={image.caption || '미리보기'} 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
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

// 도구 모음 버튼 스타일
const toolbarButtonStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  minWidth: '40px'
};

export default WritePost; 