import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import NtPage from '../components/NtPage';
import VerticalSeal from '../components/VerticalSeal';

// ════════════════════════════════════════════════════════════════════════
// 404 — 없는 자리(不在).
//   2026-08-31 레거시 판식 제거 전까지 미등록 경로는 레거시 홈(AppContent)으로
//   떨어졌다. 이제는 v5 판식 그대로 「없는 자리」를 말하고 홈으로 돌려보낸다.
//   · 판식은 다른 v5 페이지와 같다(표제 · 계선 · 매개의 문).
//   · noindex — 검색엔진이 없는 자리를 색인하지 않도록.
//   · 새 클래스를 만들지 않는다. 기존 nt.css 조각(.pagehead · .hair · .state · .gate)만 쓴다.
// ════════════════════════════════════════════════════════════════════════

const NotFound: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <NtPage
      path={pathname}
      title="NODE TREE | 404 — 없는 자리"
      description="요청한 주소에 해당하는 자리가 없습니다."
      noindex
    >
      <section className="pagehead">
        <VerticalSeal place="head" mark="不在" roman="404" />
        <div className="lab">404 · NOT FOUND</div>
        <h1>
          NOT FOUND
          <em>없는 자리</em>
        </h1>
      </section>
      <div className="hair dae" />

      <section className="state">
        <div>{`요청한 주소 ${pathname} 에는 아무것도 놓여 있지 않습니다.`}</div>
      </section>

      <section className="gate">
        <Link to="/">
          <div className="l">
            <div className="kick">돌아가기 RETURN</div>
            <div className="nm">
              NODE TREE<span className="dom">nodetree.kr</span>
            </div>
            <p className="desc">
              주소를 다시 확인하시거나 처음 자리에서 다시 시작해 주세요. 소개 · 작품 · 공유지 · 이력 · 연락처는 모두 위
              내비게이션에 있습니다.
            </p>
            <div className="in">ABOUT · ART WORK · COMMONS · CV · CONTACT</div>
          </div>
          <span className="go">홈으로 →</span>
        </Link>
      </section>
    </NtPage>
  );
};

export default NotFound;
