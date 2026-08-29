import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Kind } from '../db';
import ConfirmDialog from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { usePostAdmin } from './usePostAdmin';

// ════════════════════════════════════════════════════════════════════════
// PostDetailAdmin — 상세 화면(/work/:id · /commons/:id)의 수정·삭제 문.
//   편집 모드에서만 붙는다. 첨부 목록과 같은 인덱스 행 선질을 쓴다.
// ════════════════════════════════════════════════════════════════════════

export interface PostDetailAdminProps {
  kind: Kind;
  /** 목록 경로 — /work · /commons */
  base: string;
  id: string;
  title: string;
}

const PostDetailAdmin: React.FC<PostDetailAdminProps> = ({ kind, base, id, title }) => {
  const admin = usePostAdmin(kind);
  const toast = useToast();
  const navigate = useNavigate();
  const [ask, setAsk] = useState(false);

  const doDelete = async () => {
    try {
      await admin.remove(id);
      setAsk(false);
      navigate(base, { state: { ntToast: `삭제했습니다 · ${title}` } });
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="plist">
      <div className="grp" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.1em', color: 'var(--g3)', paddingBottom: 10 }}>
        편집 EDIT
      </div>
      <div className="nte-acts">
        <Link className="nte-btn pri" to={`${base}/${id}/edit`}>
          이 글 수정
        </Link>
        <button type="button" className="nte-btn warn" onClick={() => setAsk(true)}>
          이 글 삭제
        </button>
        <Link className="nte-btn" to={`${base}/new`}>
          새 글
        </Link>
      </div>

      <ConfirmDialog
        open={ask}
        title="이 글을 삭제합니다"
        message={<>「{title}」을(를) 삭제합니다. 되돌릴 수 없습니다.</>}
        busy={admin.busy}
        onCancel={() => setAsk(false)}
        onConfirm={doDelete}
      />
    </div>
  );
};

export default PostDetailAdmin;
