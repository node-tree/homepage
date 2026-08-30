import React, { Suspense, lazy, useCallback, useState } from 'react';
import DharaniClock from '../../components/DharaniClock/DharaniClock';
import NtPage from '../components/NtPage';

// 3D 원반은 three 를 끌고 오므로 홈에서만 lazy 로 내려받는다. WebGL2 불가 → 2D 시계 폴백.
const DharaniClock3D = lazy(() => import('../../components/DharaniClock3D/DharaniClock3D'));

/**
 * Current(홈) — 비주얼만(2026-08-30 사용자 "아래 글들을 없애고 비주얼만"). 피드 없음.
 *   히어로 = 陀羅尼 時計의 3차원 판(DharaniClock3D). 뷰포트를 채우고 그 아래는 푸터.
 */
const Home: React.FC = () => {
  const [fallback, setFallback] = useState(false);
  const onFallback = useCallback(() => setFallback(true), []);
  return (
    <NtPage
      path="/"
      title="NODE TREE · 사라진 것들이 돌아오는 방식"
      description="뉴미디어 아티스트 듀오 이화영·정강현. 내버려진 사물, 끊긴 이야기, 연고 없는 땅 곁에 머물며 재배치하고 다시 발화하게 한다. 충남 부여."
      keywords="NODE TREE, 노드트리, 이화영, 정강현, 공생직조, 이물, 위성악보, 미디어아트, 부여"
      hero={
        <section className="hero-slot hero-slot--full">
          {fallback ? (
            <DharaniClock theme="dark" />
          ) : (
            <Suspense fallback={<div className="dclock3d" aria-hidden />}>
              <DharaniClock3D onFallback={onFallback} />
            </Suspense>
          )}
        </section>
      }
    >
      {null}
    </NtPage>
  );
};

export default Home;
