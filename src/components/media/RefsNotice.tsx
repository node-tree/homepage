// ═══════════════════════════════════════════════════════════════
// RefsNotice — 이동/이름변경 전 "이 경로를 참조하는 곳" 안내
//
//   ImageKit 은 경로 기반 URL 이라 이동하면 기존 URL 이 즉시 죽는다.
//   · 자체 DB 참조 → 백엔드가 이동 직후 자동 치환한다(컬렉션별 건수 표시).
//   · 소스코드 하드코딩 → 자동으로 못 고친다. 파일:줄 목록을 보여주고 수동 수정 안내.
//   · 외부(SNS·타 사이트)에 공유된 URL 은 어느 쪽으로도 못 고친다 → 항상 경고.
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { IkRefsResult } from '../../services/imagekitAdminApi';

export interface RefsNoticeProps {
  loading: boolean;
  data: IkRefsResult | null;
  error: string | null;
  /** 이동/이름변경 등 동작 이름(문구에 들어간다) */
  action?: string;
}

const RefsNotice: React.FC<RefsNoticeProps> = ({ loading, data, error, action = '이동' }) => {
  if (loading) {
    return (
      <p className="ma-refs ma-refs-loading" aria-live="polite">
        참조 위치를 확인하는 중…
      </p>
    );
  }
  if (error) {
    return (
      <p className="ma-refs ma-refs-warn" role="status">
        참조를 확인하지 못했습니다({error}). 그대로 진행하면 자동 갱신이 되지 않을 수 있습니다.
      </p>
    );
  }
  if (!data) return null;

  const { totalDb, totalCode } = data;
  const byCollection: Record<string, number> = {};
  data.items.forEach((i) =>
    Object.entries(i.db.byCollection).forEach(([k, v]) => {
      byCollection[k] = (byCollection[k] || 0) + v;
    })
  );
  const codeFiles: Record<string, number> = {};
  data.items.forEach((i) =>
    i.code.refs.forEach((r) => {
      codeFiles[r.file] = (codeFiles[r.file] || 0) + 1;
    })
  );

  const safe = totalDb === 0 && totalCode === 0;

  return (
    <div className={`ma-refs ${safe ? 'ma-refs-safe' : 'ma-refs-info'}`} aria-live="polite">
      {safe ? (
        <p className="ma-refs-line">
          <strong>참조 없음(안전)</strong> — 이 경로를 가리키는 게시물·코드가 없습니다.
        </p>
      ) : (
        <>
          {totalDb > 0 && (
            <p className="ma-refs-line">
              게시물 <strong>{totalDb}곳</strong>이 이 경로를 참조합니다 —{' '}
              <strong>{action} 후 자동으로 갱신</strong>됩니다.
              <span className="ma-refs-detail">
                {Object.entries(byCollection)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </span>
            </p>
          )}
          {totalCode > 0 && (
            <p className="ma-refs-line ma-refs-manual">
              소스코드 <strong>{totalCode}곳</strong>은 자동 갱신되지 않습니다 —{' '}
              <strong>직접 수정 후 배포</strong>해야 합니다.
              <span className="ma-refs-detail">
                {Object.entries(codeFiles)
                  .map(([f, v]) => `${f} (${v})`)
                  .join(' · ')}
              </span>
            </p>
          )}
        </>
      )}
      <p className="ma-refs-line ma-refs-external">
        단, <strong>외부(SNS·타 사이트)에 공유된 URL은 깨집니다.</strong> 확신이 없으면 {action}을(를)
        취소하세요.
      </p>
    </div>
  );
};

export default RefsNotice;
