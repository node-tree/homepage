import React from 'react';
import { FOOTER } from '../data/about';
import VerticalSeal from './VerticalSeal';

/** Footer — 목업 공통 푸터(4열). 문구 정본 = v5 목업. */
const Footer: React.FC = () => (
  <footer>
    <div>
      <b>{FOOTER.brand.b}</b>
      {FOOTER.brand.lines.map((l, i) => (
        <React.Fragment key={l}>
          {i > 0 && <br />}
          {l}
        </React.Fragment>
      ))}
    </div>
    <div>
      <b>{FOOTER.contact.b}</b>
      {FOOTER.contact.texts.map((t, i) => (
        <React.Fragment key={t}>
          {i > 0 && <br />}
          <a href={`mailto:${t}`}>{t}</a>
        </React.Fragment>
      ))}
    </div>
    <div>
      <b>{FOOTER.mediation.b}</b>
      {FOOTER.mediation.links.map((l, i) => (
        <React.Fragment key={l.href}>
          {i > 0 && ' · '}
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            {l.text}
          </a>
        </React.Fragment>
      ))}
    </div>
    <div>
      <b>{FOOTER.beat.b}</b>
      {FOOTER.beat.text}
    </div>
    {/* 간기(刊記) — 판을 닫는 자리. 머리의 讀誦 카운터와 짝이다. */}
    <VerticalSeal place="foot" mark="扶餘" roman="BUYEO" />
  </footer>
);

export default Footer;
