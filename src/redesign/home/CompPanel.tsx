import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { circularSelection } from './circular';
import { homeSelection } from './scene';

export default function CompPanel() {
  const [params, setParams] = useSearchParams();
  const { hero, pal } = homeSelection(params);
  const { mat, move } = circularSelection(params);
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); if (key === 'hero') next.delete('pal'); setParams(next); };
  return <details className="home-comps"><summary>시안 비교</summary><div>
    <label htmlFor="home-hero">구성</label><select id="home-hero" value={hero} onChange={e => set('hero', e.target.value)}><option value="c">C · 다라니 원형</option><option value="a">A · 원형 판</option><option value="b">B · 펼친 판</option><option value="current">기존</option></select>
    {(hero === 'a' || hero === 'b') && <><label htmlFor="home-palette">색 체계</label><select id="home-palette" value={pal} onChange={e => set('pal', e.target.value)}><option value="celadon">청록의 밤</option><option value="paper">회백 판면</option><option value="mineral">옅은 광물색</option></select></>}
    {hero === 'c' && <><label htmlFor="home-material">재질</label><select id="home-material" value={mat} onChange={e => set('mat', e.target.value)}><option value="geumni">감지금니</option><option value="relief">판목 양각</option><option value="silk">반투명 비단</option></select><label htmlFor="home-move">움직임</label><select id="home-move" value={move} onChange={e => set('move', e.target.value)}><option value="still">정지 · 한 자리 읽기</option><option value="step">한 고리 넘기기</option></select></>}
  </div></details>;
}
