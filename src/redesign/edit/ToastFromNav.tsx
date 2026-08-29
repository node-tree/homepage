import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from './ui/Toast';

// ════════════════════════════════════════════════════════════════════════
// ToastFromNav — 라우트를 옮기며 남긴 한 줄을 도착한 페이지에서 알린다.
//   (알림 제공자는 페이지마다 새로 서므로, 저장 후 상세로 넘어간 뒤에도
//    "등록했습니다"가 보이게 navigate state 로 실어 보낸 것을 여기서 받는다.)
//   한 번 읽고 history state 를 지운다 — 새로고침해도 다시 뜨지 않게.
// ════════════════════════════════════════════════════════════════════════

const ToastFromNav: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname, search, hash, state } = useLocation();

  useEffect(() => {
    const msg = (state as { ntToast?: string } | null)?.ntToast;
    if (!msg) return;
    toast.ok(msg);
    navigate(`${pathname}${search}${hash}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return null;
};

export default ToastFromNav;
