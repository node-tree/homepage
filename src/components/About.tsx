import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { aboutAPI } from '../services/api';
import PageLoader from './PageLoader';
import BlockEditor from './editor/BlockEditor';

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

  if (isLoading) {
    return (
      <div className="page-content">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        {isEditingHeader ? (
          <div className="header-edit-form">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="form-input"
              placeholder="제목 입력"
              autoFocus
            />
            <input
              type="text"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="form-input"
              placeholder="부제목 입력"
            />
            <div className="header-edit-buttons">
              <button onClick={() => setIsEditingHeader(false)} className="back-button">
                취소
              </button>
              <button onClick={handleSaveHeader} className="save-button">
                저장
              </button>
            </div>
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
        <div className="write-container">
          <div className="write-header">
            <button onClick={cancelEditing} className="back-button">
              ← 취소
            </button>
            <button onClick={saveContent} className="save-button">
              저장하기
            </button>
          </div>

          <div className="write-form">
            <div className="form-group">
              <label className="form-label">내용</label>
              <BlockEditor
                value={editContent}
                onChange={(html) => setEditContent(html)}
                placeholder="소개글을 입력하세요"
              />
            </div>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <>
          {isAuthenticated && (
            <div className="work-header">
              <button onClick={startEditing} className="write-button">
                글 편집
              </button>
            </div>
          )}

          <div className="about-content">
            {aboutData?.htmlContent ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aboutData.htmlContent, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src'] }) }} />
            ) : (
              <div style={{ color: '#aaa', fontStyle: 'italic' }}>아직 소개글이 없습니다.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default About;
