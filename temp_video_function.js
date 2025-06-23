  // 영상 삽입 함수
  const insertVideo = () => {
    const videoUrl = prompt('영상 URL을 입력하세요 (YouTube, Vimeo, 또는 직접 비디오 파일):');
    if (videoUrl && videoUrl.trim() && editorRef.current) {
      const url = videoUrl.trim();
      
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
      
      let videoElement: HTMLElement;
      
      // YouTube URL 처리
      if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
          videoId = url.split('v=')[1]?.split('&')[0] || '';
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
        }
        
        if (videoId) {
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${videoId}`;
          iframe.width = '560';
          iframe.height = '315';
          iframe.setAttribute('frameborder', '0');
          iframe.setAttribute('allowfullscreen', 'true');
          iframe.style.cssText = 'max-width: 100%; height: auto; aspect-ratio: 16/9; border-radius: 8px; cursor: pointer;';
          iframe.contentEditable = 'false';
          videoElement = iframe;
        } else {
          alert('올바른 YouTube URL을 입력해주세요.');
          return;
        }
      }
      // Vimeo URL 처리
      else if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0] || '';
        if (videoId) {
          const iframe = document.createElement('iframe');
          iframe.src = `https://player.vimeo.com/video/${videoId}`;
          iframe.width = '560';
          iframe.height = '315';
          iframe.setAttribute('frameborder', '0');
          iframe.setAttribute('allowfullscreen', 'true');
          iframe.style.cssText = 'max-width: 100%; height: auto; aspect-ratio: 16/9; border-radius: 8px; cursor: pointer;';
          iframe.contentEditable = 'false';
          videoElement = iframe;
        } else {
          alert('올바른 Vimeo URL을 입력해주세요.');
          return;
        }
      }
      // 직접 비디오 파일 처리
      else if (url.match(/\.(mp4|webm|ogg)$/i)) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;';
        video.contentEditable = 'false';
        videoElement = video;
      }
      // 기타 URL (iframe으로 시도)
      else {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.width = '560';
        iframe.height = '315';
        iframe.setAttribute('frameborder', '0');
        iframe.style.cssText = 'max-width: 100%; height: auto; aspect-ratio: 16/9; border-radius: 8px; cursor: pointer;';
        iframe.contentEditable = 'false';
        videoElement = iframe;
      }
      
      // 비디오 클릭 이벤트 추가
      videoElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 기존 선택 해제
        const prevSelected = editorRef.current?.querySelector('[data-selected="true"]');
        if (prevSelected) {
          prevSelected.removeAttribute('data-selected');
          (prevSelected as HTMLElement).style.outline = '';
        }
        
        // 현재 비디오 선택
        videoElement.setAttribute('data-selected', 'true');
        videoElement.style.outline = '2px solid #007bff';
        
        // 비디오를 선택 영역으로 설정
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNode(videoElement);
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
      
      // 비디오를 중앙정렬하는 p 태그로 감싸기
      const videoContainer = document.createElement('p');
      videoContainer.style.textAlign = 'center';
      videoContainer.appendChild(videoElement);
      
      // 비디오 다음에 올 새로운 p 태그 생성
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      
      // 현재 위치에 비디오 컨테이너와 새 p 태그 삽입
      range.deleteContents();
      range.insertNode(newP);
      range.insertNode(videoContainer);
      
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
      
    } else if (videoUrl !== null) {
      alert('올바른 영상 URL을 입력해주세요.');
    }
  };

