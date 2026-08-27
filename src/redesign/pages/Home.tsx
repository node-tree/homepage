import React from 'react';
import DharaniClock from '../../components/DharaniClock/DharaniClock';
import FeedRow from '../components/FeedRow';
import NtPage from '../components/NtPage';
import { FEED } from '../data/feed';

/**
 * Current(홈) — 다크 다라니 시계 히어로 + 시간 역순 피드(설계 §5.1).
 *   시계는 별도 컴포넌트(src/components/DharaniClock)를 그대로 쓴다. 여기서는 자리만 준다.
 */
const Home: React.FC = () => (
  <NtPage
    path="/"
    title="NODE TREE — 내버린 것들 곁에 머무는 뉴미디어 아티스트 듀오"
    description="이화영+정강현. 부여에 착지한 도시기록 프로젝트팀. 지금 진행 중인 전시·상영·리서치를 시간 역순으로 둔다."
    keywords="NODE TREE, 노드트리, 이화영, 정강현, 공생직조, 이물, 위성악보, 미디어아트, 부여"
    hero={
      <section className="hero-slot">
        <DharaniClock theme="dark" />
      </section>
    }
  >
    <section className="feed">
      {FEED.map((item) => (
        <FeedRow key={item.id} item={item} />
      ))}
    </section>
  </NtPage>
);

export default Home;
