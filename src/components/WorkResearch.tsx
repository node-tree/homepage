import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { workAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './WorkResearch.css';

interface TocItem {
  level: number;
  text: string;
  anchor: string;
  file: string;
}

interface ResearchData {
  id: string;
  title: string;
  synced: boolean;
  html?: string;
  toc?: TocItem[];
  sourceFiles?: string[];
  obsidianPath?: string;
  syncedAt?: string;
  message?: string;
}

const WorkResearch: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string>('');

  // 인증 체크 — 로그인 안 되어있으면 /login으로
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !postId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    workAPI.getResearch(postId)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success) {
          setData(res.data);
        } else {
          setError(res?.message || '리서치를 불러올 수 없습니다.');
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || '리서치 조회 실패');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, postId]);

  // 스크롤 추적: 화면 상단에 가장 가까운 헤딩을 active로
  useEffect(() => {
    if (!data?.html) return;
    const handleScroll = () => {
      const headings = Array.from(document.querySelectorAll('.research-body h2[id], .research-body h3[id]')) as HTMLElement[];
      let current = '';
      for (const h of headings) {
        const rect = h.getBoundingClientRect();
        if (rect.top < 120) current = h.id;
        else break;
      }
      setActiveAnchor(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [data?.html]);

  // mermaid 렌더 — script가 로드되어 있으면 실행
  useEffect(() => {
    if (!data?.html) return;
    const w = window as any;
    if (w.mermaid && typeof w.mermaid.run === 'function') {
      w.mermaid.run({ querySelector: '.research-body pre.mermaid' }).catch(() => {});
    }
  }, [data?.html]);

  // TOC를 파일별로 그룹핑
  const tocByFile = useMemo(() => {
    if (!data?.toc) return [];
    const groups: { file: string; items: TocItem[] }[] = [];
    let currentFile = '';
    for (const item of data.toc) {
      if (item.file !== currentFile) {
        groups.push({ file: item.file, items: [] });
        currentFile = item.file;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [data?.toc]);

  const handleAnchorClick = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="research-page">
        <div className="research-loading">로딩 중…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="research-page">
        <div className="research-error">
          <h2>리서치를 불러올 수 없습니다</h2>
          <p>{error}</p>
          <Link to="/" className="research-back-link">← 홈으로</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.synced) {
    return (
      <div className="research-page">
        <div className="research-empty">
          <h1 className="research-title">{data.title}</h1>
          <p className="research-empty-msg">{data.message || '아직 동기화된 리서치가 없습니다.'}</p>
          <p className="research-hint">
            옵시디안에서 리서치를 작성하고 watcher를 실행하면 이 페이지에 자동으로 나타납니다.
          </p>
          <button onClick={() => navigate(-1)} className="research-back-link">← 돌아가기</button>
        </div>
      </div>
    );
  }

  const syncedDate = data.syncedAt ? new Date(data.syncedAt) : null;

  return (
    <div className="research-page">
      <header className="research-header">
        <button onClick={() => navigate(-1)} className="research-back-link">← 작품으로 돌아가기</button>
        <div className="research-title-block">
          <span className="research-label">RESEARCH ARCHIVE · 내부 작업 기록</span>
          <h1 className="research-title">{data.title}</h1>
          <div className="research-meta">
            {syncedDate && (
              <span className="research-synced">
                마지막 동기화: {syncedDate.toLocaleString('ko-KR')}
              </span>
            )}
            <span className="research-file-count">
              · {data.sourceFiles?.length || 0}개 노트 · TOC {data.toc?.length || 0}개
            </span>
          </div>
          {data.obsidianPath && (
            <code className="research-path">📂 {data.obsidianPath}</code>
          )}
        </div>
      </header>

      <div className="research-layout">
        <aside className={`research-toc ${tocCollapsed ? 'collapsed' : ''}`}>
          <div className="research-toc-header">
            <span className="research-toc-title">목차</span>
            <button
              className="research-toc-toggle"
              onClick={() => setTocCollapsed(v => !v)}
              aria-label="목차 토글"
            >
              {tocCollapsed ? '▸' : '▾'}
            </button>
          </div>
          {!tocCollapsed && (
            <nav className="research-toc-list">
              {tocByFile.map((group, gi) => (
                <div key={gi} className="research-toc-group">
                  <div className="research-toc-group-title">{group.file}</div>
                  <ul>
                    {group.items.map((item, i) => (
                      <li
                        key={i}
                        className={`research-toc-item level-${item.level} ${activeAnchor === item.anchor ? 'active' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleAnchorClick(item.anchor)}
                          title={item.text}
                        >
                          {item.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </aside>

        <motion.article
          className="research-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          dangerouslySetInnerHTML={{ __html: data.html || '' }}
        />
      </div>
    </div>
  );
};

export default WorkResearch;
