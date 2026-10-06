import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import DharaniClock from '../../components/DharaniClock/DharaniClock';
import NtPage from '../components/NtPage';
import { useSearchParams } from 'react-router-dom';
import { circularSelection } from '../home/circular';
import HomePlate from '../home/HomePlate';
import CompPanel from '../home/CompPanel';
import { homeSelection, palettes } from '../home/scene';
import '../home/home.css';

// 3D 원반은 three 를 끌고 오므로 홈에서만 lazy 로 내려받는다. WebGL2 불가 → 2D 시계 폴백.
const CircularPlate = lazy(() => import('../home/CircularPlate'));
const DharaniClock3D = lazy(() => import('../../components/DharaniClock3D/DharaniClock3D'));

const Home: React.FC = () => {
  const [params] = useSearchParams();
  const { hero, pal } = homeSelection(params);
  const { mat, move } = circularSelection(params);
  const [fallback, setFallback] = useState(false);
  const onFallback = useCallback(() => setFallback(true), []);
  useEffect(() => {
    if (hero === 'current') document.body.classList.add('nt-stage');
    else document.body.dataset.homePalette = hero === 'c' ? mat : pal;
    return () => { document.body.classList.remove('nt-stage'); delete document.body.dataset.homePalette; };
  }, [hero, pal, mat]);
  return (
    <NtPage
      path="/"
      title="NODE TREE · 사라진 것들이 돌아오는 방식"
      description="뉴미디어 아티스트 듀오 이화영·정강현. 내버려진 사물, 끊긴 이야기, 연고 없는 땅 곁에 머물며 재배치하고 다시 발화하게 한다. 충남 부여."
      keywords="NODE TREE, 노드트리, 이화영, 정강현, 공생직조, 이물, 위성악보, 미디어아트, 부여"
      hero={
        <section className={`hero-slot hero-slot--full ${hero !== 'current' ? 'home-slot' : ''}`}>
          {hero === 'c' ? <Suspense fallback={<div className="home-plate" aria-hidden />}><CircularPlate key={`${mat}-${move}`} mat={mat} move={move} /></Suspense> : hero !== 'current' ? <HomePlate key={`${hero}-${pal}`} hero={hero} palette={palettes[pal]} /> : fallback ? (
            <DharaniClock theme="dark" homeUnits caption="다라니 조각 · 독송 계수 3,029박 · 8시간 순환 · 하루 세 번" />
          ) : (
            <Suspense fallback={<div className="dclock3d dclock3d--dark" aria-hidden />}>
              <DharaniClock3D theme="dark" onFallback={onFallback} />
            </Suspense>
          )}
          <CompPanel />
        </section>
      }
    >
      {null}
    </NtPage>
  );
};

export default Home;
