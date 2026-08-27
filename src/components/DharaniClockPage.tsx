// ════════════════════════════════════════════════════════════════════════
// DharaniClockPage.tsx — 임시 검수 라우트 `/clock`
//   홈 히어로에 붙이기 전, 다크(홈 기본)·라이트(Work 상세 소형·About) 두 테마를
//   한 화면에서 실렌더로 관찰하기 위한 페이지. 기존 라우트·컴포넌트는 건드리지 않는다.
//   `?theme=light` 로 라이트만, 기본은 다크 → 라이트 순.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useLocation } from 'react-router-dom';
import DharaniClock from './DharaniClock/DharaniClock';
import { BEATS, beatAt, pad4 } from './DharaniClock/beat';

const HeaderClock: React.FC = () => {
  const [b, setB] = React.useState(() => beatAt());
  React.useEffect(() => {
    const id = window.setInterval(() => setB(beatAt()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="dclockpage__hdclock">
      <i />
      <span>讀誦</span>
      <b>{pad4(b.index)}</b>
      <span>/ {BEATS}</span>
    </div>
  );
};

const DharaniClockPage: React.FC = () => {
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  const only = q.get('theme');
  const bo = q.get('beat');
  const beatOverride = bo == null ? undefined : Number(bo);
  return (
    <main className="dclockpage">
      <style>{`
        .dclockpage{background:#0B0B0E;min-height:100vh;margin:0}
        .dclockpage__hd{position:relative;z-index:10;height:56px;display:grid;
          grid-template-columns:repeat(20,1fr);align-items:center;background:#0B0B0E;
          border-bottom:1px solid rgba(220,221,211,.14)}
        @media(max-width:767px){
          .dclockpage__hd{display:flex;justify-content:space-between;align-items:center;padding:0 16px;gap:12px}
          .dclockpage__brand{font-size:13px}
          .dclockpage__brand span{display:none}
          .dclockpage__hdclock{gap:8px;padding-right:0;font-size:10px;white-space:nowrap}
        }
        .dclockpage__brand{grid-column:2/8;white-space:nowrap;font-family:'IBM Plex Sans',sans-serif;font-weight:500;
          font-size:15px;letter-spacing:.02em;color:#DCDDD3}
        .dclockpage__brand span{font-family:'Noto Sans KR',sans-serif;font-weight:300;
          color:rgba(220,221,211,.55);margin-left:10px;font-size:13px}
        .dclockpage__hdclock{grid-column:16/21;white-space:nowrap;display:flex;justify-content:flex-end;align-items:center;
          gap:14px;padding-right:24px;font-family:'IBM Plex Mono',monospace;font-size:11px;
          letter-spacing:.06em;color:rgba(220,221,211,.6)}
        .dclockpage__hdclock b{font-weight:500;color:#DCDDD3}
        .dclockpage__hdclock i{display:inline-block;width:6px;height:6px;background:#BE3C28}
        .dclockpage__note{grid-column:2/20;font-family:'IBM Plex Mono',monospace;font-size:11px;
          letter-spacing:.1em;color:rgba(220,221,211,.4);padding:22px 0}
      `}</style>
      <header className="dclockpage__hd">
        <div className="dclockpage__brand">
          NODE TREE<span>노드 트리</span>
        </div>
        <HeaderClock />
      </header>

      {only !== 'light' && <DharaniClock theme="dark" beatOverride={beatOverride} />}
      {only !== 'dark' && <DharaniClock theme="light" beatOverride={beatOverride} />}
    </main>
  );
};

export default DharaniClockPage;
