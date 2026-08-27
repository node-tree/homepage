import React, { lazy, Suspense } from 'react';
import NtPage from '../components/NtPage';

// 원래 nodetree.kr 페이지(About·Work·Commons·CV·Contact)를 **내용 그대로** v5 판식(헤더·푸터·타이포)에 싣는다.
// 2026-08-27 사용자 지시: 구조·메뉴·내용은 원래대로, 바꾸는 것은 디자인뿐.
const About = lazy(() => import('../../components/About'));
const Work = lazy(() => import('../../components/Work'));
const Commons = lazy(() => import('../../components/Commons'));
const CV = lazy(() => import('../../components/CV'));
const Contact = lazy(() => import('../../components/Contact'));

const wrap = (path: string, title: string, description: string, El: React.LazyExoticComponent<React.FC<any>>) => {
  const P: React.FC = () => (
    <NtPage path={path} title={title} description={description}>
      <div className="nt-legacy-wrap">
        <Suspense fallback={null}>
          <El />
        </Suspense>
      </div>
    </NtPage>
  );
  return P;
};

export const LegacyAbout = wrap('/about', 'NODE TREE | 노드 트리', '노드 트리 소개.', About);
export const LegacyWork = wrap('/work', 'NODE TREE | Art Work', '노드 트리 작품.', Work);
export const LegacyCommons = wrap('/commons', 'NODE TREE | Commons — 공유지', '노드 트리 공유지.', Commons);
export const LegacyCV = wrap('/cv', 'NODE TREE | CV', '노드 트리 이력.', CV);
export const LegacyContact = wrap('/contact', 'NODE TREE | Contact', '노드 트리 연락처.', Contact);
