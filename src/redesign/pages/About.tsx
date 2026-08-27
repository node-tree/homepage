import React from 'react';
import NtPage from '../components/NtPage';
import { rich } from '../components/rich';
import {
  ABOUT_BLOCKS,
  ABOUT_LAB,
  ABOUT_NOTE,
  ABOUT_PARAS,
  ABOUT_SOURCE,
  ABOUT_TITLE,
  ABOUT_TITLE_EN,
  SAMBE_CAP,
  SAMBE_LABEL,
} from '../data/about';

/**
 * About — 좌 소개(왜 지역행·무엇을 말하나) / 우 구성원·매개·연락처·삼베(설계 §5.5).
 *   매개 블록은 점선 계선 = 「바깥」 표시. 본체는 각자의 도메인에 있다(§1.3).
 */
const About: React.FC = () => (
  <NtPage
    path="/about"
    title="NODE TREE | About — 소개"
    description="충남 부여군 장암면. 도시기록 프로젝트팀이자 뉴미디어 아티스트 듀오 — 이화영 · 정강현. 우리는 말하지 않고 재배치한다."
    keywords="NODE TREE 소개, 이화영, 정강현, 부여, 아티스트 듀오, 생산소, 이소예술랩"
  >
    <section className="pagehead">
      <div className="lab">{ABOUT_LAB}</div>
      <h1>
        {ABOUT_TITLE}
        <em>{ABOUT_TITLE_EN}</em>
      </h1>
      <div className="note">{ABOUT_NOTE}</div>
    </section>
    <div className="hair dae" />

    <section className="about" style={{ paddingTop: 56 }}>
      <div className="lft">
        {ABOUT_PARAS.map((p, i) => (
          <p key={i}>{rich(p)}</p>
        ))}
        <div className="src">{ABOUT_SOURCE}</div>
      </div>

      <div className="rgt">
        {ABOUT_BLOCKS.map((blk) => (
          <div className={`blk${blk.out ? ' out' : ''}`} key={blk.label}>
            <b>{blk.label}</b>
            {blk.rows.map((r) => (
              <div className={`prow${r.out ? ' out' : ''}`} key={r.n}>
                <span className="n">{r.n}</span>
                <span>{r.v}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="blk">
          <b>{SAMBE_LABEL}</b>
          <div className="sambe">
            <div className="cap">{SAMBE_CAP}</div>
            <img
              className="seedsym"
              src="/redesign/seed-plate_00.webp"
              width={48}
              height={56}
              alt="종자자 심볼"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  </NtPage>
);

export default About;
