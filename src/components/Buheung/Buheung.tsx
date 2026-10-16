// ═══════════════════════════════════════════════════════════════════════
// Buheung.tsx — 부흥여지도 독립 페이지 (nodetree.kr/buheung, 포스터 QR이 여는 곳)
//   첫 화면 = 3D 지도(포스터 배치). 왼쪽 위 노랑 제목 판, 오른쪽 위 「이야기」「목록」, 오른쪽 아래 시점·나침반.
//   「이야기」는 지도 위에 겹치는 패널(휴대폰은 전체 화면) — 지도 드래그와 페이지 스크롤이 부딪치지 않게.
//   구조 의논: 작업 폴더 buheung-web-20261016/DEBATE.md(Claude·Codex). 공유 카드(OG)는 서버 api/buheung-index.js.
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react';
import SignalMap3D from '../Kkumdarak/signalmap/3d/SignalMap3D';
import { KkumdarakAuthProvider } from '../Kkumdarak/KkumdarakAuthContext';
import BuheungStory from './BuheungStory';
import './buheung.css';

const TITLE = '부흥여지도 · 청소년이 찾아낸 부여의 가능성';
// 본문 Noto Sans KR + 큰 한자(都市泗沘復興 등)만 Noto Serif KR 글자 묶음으로
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap';
const HANJA_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap&text=' + encodeURIComponent('扶餘復興輿地圖都市泗沘');

const useHead = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;
    const links = [FONT_HREF, HANJA_HREF].map((href) => {
      if (document.querySelector(`link[href="${href}"]`)) return null;
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
      return l;
    });
    return () => { document.title = prevTitle; links.forEach(l => l && l.remove()); };
  }, []);
};

const Buheung: React.FC = () => {
  useHead();
  const [story, setStory] = useState(false);
  const [listSignal, setListSignal] = useState(0);
  const closeStory = useCallback(() => setStory(false), []);
  const showList = useCallback(() => { setStory(false); setListSignal(n => n + 1); }, []);

  return (
    <KkumdarakAuthProvider>
      <main className="bh">
        <SignalMap3D
          title={(
            <div className="bh-plate bh-plate--map">
              <h1><img src="/buheung/lettering.svg" alt="부흥여지도" width={668} height={176} /></h1>
              <p>청소년이 찾아낸 부여의 가능성</p>
            </div>
          )}
          actions={(
            <button className={`s3d-act${story ? ' on' : ''}`} aria-expanded={story} onClick={() => setStory(s => !s)}>이야기</button>
          )}
          openListSignal={listSignal}
        />
        <BuheungStory open={story} onClose={closeStory} onShowList={showList} />
      </main>
    </KkumdarakAuthProvider>
  );
};

export default Buheung;
