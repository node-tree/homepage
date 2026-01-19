import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { aboutAPI } from '../services/api';

// About 데이터 타입 정의
interface AboutData {
  _id: string;
  title: string;
  content: string;
  htmlContent: string;
  isActive: boolean;
}

const About: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('ABOUT');
  const [subtitle, setSubtitle] = useState('노드 트리(NODE TREE)');
  const [isEditingHeader, setIsEditingHeader] = useState(false);

  // About 데이터 가져오기
  const fetchAboutData = async () => {
    setIsLoading(true);
    try {
      const response = await aboutAPI.getAbout();
      if (response.success) {
        setAboutData(response.data);
        setEditContent(response.data.htmlContent || response.data.content || '');
        setTitle(response.data.title || 'ABOUT');
        setSubtitle(response.data.content || '노드 트리(NODE TREE)');
      } else {
        console.error('About 데이터 가져오기 실패:', response.message);
      }
    } catch (error) {
      console.error('About 데이터 가져오기 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAboutData();
  }, []);

  // 제목/부제목 저장
  const handleSaveHeader = async () => {
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      setIsLoading(true);
      const response = await aboutAPI.updateAbout({ title, content: subtitle });
      if (response.success) {
        setAboutData(response.data);
        setIsEditingHeader(false);
      } else {
        alert(response.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      alert('저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // About 내용 저장
  const saveContent = async () => {
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await aboutAPI.updateAbout({
        htmlContent: editContent
      });
      
      if (response.success) {
        alert('내용이 저장되었습니다.');
        setAboutData(response.data);
        setIsEditing(false);
      } else {
        alert(response.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('About 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 편집 시작
  const startEditing = () => {
    setIsEditing(true);
    setEditContent(aboutData?.htmlContent || aboutData?.content || '');
  };

  // 편집 취소
  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent(aboutData?.htmlContent || aboutData?.content || '');
  };

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
    setEditContent(editorRef.current.innerHTML);
    
    setTimeout(() => {
      restoreCursorPosition(cursorPosition);
      editorRef.current?.focus();
    }, 0);
  };

  // 이미지 삽입
  const insertImage = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url && editorRef.current) {
      const selection = window.getSelection();
      let range;
      
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
      
      // 이미지 요소 생성 (중앙정렬)
      const img = document.createElement('img');
      img.src = url;
      img.alt = '삽입된 이미지';
      img.style.cssText = 'max-width: 100%; height: auto; margin: 10px auto; border-radius: 8px; display: block;';
      
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
      setEditContent(editorRef.current.innerHTML);
      
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
        }
      }, 10);
    }
  };

  // 이미지 갤러리 삽입 (같은 행에 여러 이미지)
  const insertImageGallery = () => {
    const urls = prompt('이미지 URL들을 쉼표로 구분하여 입력하세요:');
    if (urls && editorRef.current) {
      const urlArray = urls.split(',').map(url => url.trim()).filter(url => url);
      
      const selection = window.getSelection();
      let range;
      
      if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
      
      // 갤러리 컨테이너 생성
      const galleryDiv = document.createElement('div');
      galleryDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin: 20px auto; justify-content: center; max-width: 100%;';
      
      // 갤러리를 중앙정렬하는 p 태그로 감싸기
      const galleryContainer = document.createElement('p');
      galleryContainer.style.textAlign = 'center';
      galleryContainer.appendChild(galleryDiv);
      
      // 각 이미지 추가
      urlArray.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '갤러리 이미지';
        img.style.cssText = 'flex: 1; min-width: 200px; max-width: 300px; height: auto; border-radius: 8px; object-fit: cover;';
        galleryDiv.appendChild(img);
      });
      
      // 갤러리 다음에 올 새로운 p 태그 생성
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      
      // 현재 위치에 갤러리 컨테이너와 새 p 태그 삽입
      range.deleteContents();
      range.insertNode(newP);
      range.insertNode(galleryContainer);
      
      // 커서를 새 p 태그 안으로 이동
      range.setStart(newP, 0);
      range.setEnd(newP, 0);
      
      // 선택 영역 업데이트
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // HTML 콘텐츠 업데이트
      setEditContent(editorRef.current.innerHTML);
      
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
        }
      }, 10);
    }
  };

  // 리치 에디터 초기화
  useEffect(() => {
    if (isEditing && editorRef.current) {
      const currentElement = editorRef.current;
      
      if (editContent !== currentElement.innerHTML) {
        currentElement.innerHTML = editContent || '<p>내용을 입력하세요...</p>';
      }
      
      // 플레이스홀더 스타일 적용
      const updatePlaceholder = () => {
        if (currentElement) {
          const isEmpty = !currentElement.textContent?.trim();
          if (isEmpty && !editContent) {
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
            
            // 커서를 새 p 태그 안으로 이동
            range.setStart(newP, 0);
            range.setEnd(newP, 0);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // HTML 콘텐츠 업데이트
            setEditContent(currentElement.innerHTML);
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
  }, [isEditing, editContent]);

  if (isLoading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">
            ABOUT
            <motion.div 
              className="page-subtitle-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 1 }}
            ></motion.div>
            <div className="page-subtitle" style={{position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginTop: '0'}}>노드 트리(NODE TREE)
              
            </div>
          </h1>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        {isEditingHeader ? (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            padding: '24px 20px 16px 20px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12,
            maxWidth: 480,
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            <textarea value={title} onChange={e => setTitle(e.target.value)}
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: '2px solid #eee',
                outline: 'none',
                padding: '8px 0',
                marginBottom: 4,
                background: 'transparent',
                textAlign: 'center',
                borderRadius: 0,
                transition: 'border-color 0.2s',
                resize: 'none',
                minHeight: 40,
                overflow: 'hidden',
              }}
              placeholder="제목 입력"
              autoFocus
              rows={1}
              onInput={e => {
                const ta = e.target as HTMLTextAreaElement;
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
              }}
            />
            <textarea value={subtitle} onChange={e => setSubtitle(e.target.value)}
              style={{
                fontSize: '1.1rem',
                border: 'none',
                borderBottom: '1.5px solid #eee',
                outline: 'none',
                padding: '6px 0',
                background: 'transparent',
                textAlign: 'center',
                borderRadius: 0,
                transition: 'border-color 0.2s',
                resize: 'none',
                minHeight: 32,
                overflow: 'hidden',
              }}
              placeholder="부제목 입력"
              rows={1}
              onInput={e => {
                const ta = e.target as HTMLTextAreaElement;
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
              }}
            />
            <button onClick={handleSaveHeader}
              style={{
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 0',
                fontWeight: 600,
                fontSize: '1rem',
                marginTop: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'background 0.2s',
                width: 120,
                alignSelf: 'center',
              }}
            >저장</button>
          </div>
        ) : (
          <>
            <motion.h1
              className="page-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {title}
            </motion.h1>
            <motion.div
              className="page-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {subtitle}
            </motion.div>
            {isAuthenticated && (
              <motion.button
                onClick={() => setIsEditingHeader(true)}
                className="write-button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                편집
              </motion.button>
            )}
          </>
        )}
      </div>
      
      {/* 편집 모드 */}
      {isEditing ? (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* 편집 도구 모음 */}
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
            <button onClick={() => formatText('bold')} style={toolbarButtonStyle}>
              <strong>B</strong>
            </button>
            <button onClick={() => formatText('italic')} style={toolbarButtonStyle}>
              <em>I</em>
            </button>
            <button onClick={() => formatText('underline')} style={toolbarButtonStyle}>
              <u>U</u>
            </button>
            
            <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 0.5rem' }} />
            
            {/* 정렬 */}
            <button onClick={() => formatText('justifyLeft')} style={toolbarButtonStyle}>
              왼쪽
            </button>
            <button onClick={() => formatText('justifyCenter')} style={toolbarButtonStyle}>
              중앙
            </button>
            <button onClick={() => formatText('justifyRight')} style={toolbarButtonStyle}>
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
            <button onClick={insertImage} style={toolbarButtonStyle}>
              🖼️ 이미지
            </button>
            <button onClick={insertImageGallery} style={toolbarButtonStyle}>
              🖼️ 갤러리
            </button>
          </div>
          
          {/* 편집 영역 */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              const target = e.target as HTMLDivElement;
              setEditContent(target.innerHTML);
            }}
            onBlur={(e) => {
              const target = e.target as HTMLDivElement;
              setEditContent(target.innerHTML);
            }}
            style={{
              minHeight: '400px',
              padding: '2rem',
              border: '1px solid #ddd',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              backgroundColor: '#fff',
              outline: 'none',
              lineHeight: '1.6',
              fontSize: '1rem',
              textAlign: 'center'
            }}
          />
          
          {/* 저장/취소 버튼 */}
          <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={cancelEditing}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              onClick={saveContent}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <div style={{ 
          maxWidth: '1000px', 
          margin: '0 auto', 
          textAlign: 'center',
          lineHeight: '1.8',
          fontSize: '1.1rem'
        }}>
          {/* 글 편집 버튼을 본문 위로 이동 */}
          {!isEditing && isAuthenticated && (
            <button
              onClick={startEditing}
              className="write-button"
              style={{ margin: '0 auto 2rem auto', display: 'block' }}
            >
              글 편집
            </button>
          )}
          {aboutData?.htmlContent ? (
            <div 
              dangerouslySetInnerHTML={{ __html: aboutData.htmlContent }}
              style={{ textAlign: 'center' }}
            />
          ) : (
            <div style={{ color: '#aaa', fontStyle: 'italic' }}>아직 소개글이 없습니다.</div>
          )}
        </div>
      )}
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

export default About; 