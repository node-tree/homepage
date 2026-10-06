import React, { Suspense, lazy, useEffect } from 'react';
import NtPage from '../components/NtPage';
import '../home/home.css';

// 3D 원반은 three 를 끌고 오므로 홈에서만 lazy 로 내려받는다. WebGL2 불가 → 2D 시계 폴백.
const CircularPlate = lazy(() => import('../home/CircularPlate'));

const Home: React.FC = () => {
  useEffect(() => {
    document.body.dataset.homePalette = 'geumni';
    return () => { delete document.body.dataset.homePalette; };
  }, []);
  return (
    <NtPage
      path="/"
      title="NODE TREE · 사라진 것들이 돌아오는 방식"
      description="뉴미디어 아티스트 듀오 이화영·정강현. 내버려진 사물, 끊긴 이야기, 연고 없는 땅 곁에 머물며 재배치하고 다시 발화하게 한다. 충남 부여."
      keywords="NODE TREE, 노드트리, 이화영, 정강현, 공생직조, 이물, 위성악보, 미디어아트, 부여"
      hero={
        <section className="hero-slot hero-slot--full home-slot">
          <Suspense fallback={<div className="home-plate" aria-hidden />}>
            <CircularPlate />
          </Suspense>
        </section>
      }
    >
      {null}
    </NtPage>
  );
};

export default Home;
