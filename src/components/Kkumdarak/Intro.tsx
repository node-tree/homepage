import React from 'react';
import {
  OVERVIEW, MEMBERS, COLORS,
  ISO_MEANING, ISO_OWL_FIREFLY, ISO_GENERATIONS,
} from './data';
import IntroChar from './IntroChar';

const STEPS: Array<{
  key: string; word: string; label: string;
  charD: string; charM: string;
}> = [
  { key: 'make',  word: '만들기',   label: '공간을 함께 짓기',    charD: 'char-11.svg', charM: 'char-11.svg' },
  { key: 'fill',  word: '채우기',   label: '프로그램으로 채우기', charD: 'char-12.svg', charM: 'char-09.svg' },
  { key: 'share', word: '나누기',   label: '축제로 나누기',        charD: 'char-14.svg', charM: 'char-17.svg' },
  { key: 'keep',  word: '지속하기', label: '마을이 스스로 잇기',  charD: 'char-15.svg', charM: 'char-18.svg' },
];

const Intro: React.FC = () => (
  <section className="kd-figma-intro" data-name="소개">

    {/* ── Desktop ── */}
    <div className="kd-intro-desktop">
      <div className="kd-section-rule kd-section-rule--s1 kd-intro-rule" />

      {/* ① 이소 히어로 */}
      <div className="intro-hero">
        <p className="intro-tag">꿈다락 문화예술학교 · 2026 생활거점형</p>
        <h1 className="intro-iso">이소<span>異素</span></h1>
        <div className="intro-iso-rule" />
        <p className="intro-motto">
          꿈다락 문화예술학교 「이소」는, 동아시아 개인 서정시의 출발점인 한 편의 시가
          음률과 서정으로 2300년을 건너 오늘의 노래와 공동체의 자리가 되었듯,<br />
          삶-터를 살아가는 사람들의 감각과 문화가 다음 세대로 이어지는 자리입니다.
          마을이 곧 학교가 되는 자리입니다.
        </p>
        <p className="intro-place">충청남도 부여군 장암면 · 2026. 5 – 12</p>
      </div>

      {/* ② 사업 흐름 */}
      <div className="intro-flow">
        <h2 className="intro-flow-title">사업은 이렇게 이어집니다</h2>
        <div className="intro-step-row">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className="intro-step">
                <div className="intro-char-wrap">
                  <IntroChar src={step.charD} alt={step.word} />
                </div>
                <p>{step.label}</p>
              </div>
              {i < STEPS.length - 1 && <span className="intro-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ③ 사업 개요 */}
      <div className="intro-facts">
        <h3>사업 개요</h3>
        <div className="intro-facts-grid">
          {OVERVIEW.map((row) => (
            <div className="intro-fact" key={row.k}>
              <span>{row.k}</span>
              <b>{row.v}</b>
            </div>
          ))}
        </div>
      </div>

      {/* ③-b 「이소」 소개 */}
      <div className="intro-iso-blocks">
        {/* A — 「이소」란 (異素 한자 풀이) */}
        <div className="intro-iso-block intro-iso-meaning">
          <h3>{ISO_MEANING.title}</h3>
          <div className="intro-glyph-row">
            {ISO_MEANING.glyphs.map((g) => (
              <div
                className="intro-glyph-card"
                key={g.glyph}
                style={{ '--accent': COLORS[g.color] } as React.CSSProperties}
              >
                <span className="intro-glyph">{g.glyph}</span>
                <span className="intro-glyph-reading">{g.reading}</span>
                <p className="intro-glyph-desc">{g.desc}</p>
              </div>
            ))}
          </div>
          <p className="intro-iso-body">{ISO_MEANING.body}</p>
        </div>

        {/* B — 듣고, 빛내며 (부엉이와 반딧불이) */}
        <div className="intro-iso-block">
          <h3>{ISO_OWL_FIREFLY.title}</h3>
          <p className="intro-iso-body">{ISO_OWL_FIREFLY.body}</p>
        </div>

        {/* C — 다섯 세대가 만나는 자리 */}
        <div className="intro-iso-block">
          <h3>{ISO_GENERATIONS.title}</h3>
          <p className="intro-iso-body">{ISO_GENERATIONS.body}</p>
        </div>
      </div>

      {/* ④ 멤버 소개 */}
      <div className="intro-members">
        <h3>멤버 소개</h3>
        <div className="intro-members-grid">
          {MEMBERS.map((m) => (
            <div
              className="intro-member"
              key={m.id}
              style={{ '--accent': COLORS[m.color] } as React.CSSProperties}
            >
              <div className="intro-member-slot" aria-hidden="true">
                {m.character ? (
                  <img className="intro-member-img" src={m.character} alt="" />
                ) : (
                  <span className="intro-member-slot-label">캐릭터 자리</span>
                )}
              </div>
              <div className="intro-member-body">
                <strong className="intro-member-name">{m.name}</strong>
                <span className="intro-member-role">{m.role}</span>
                <p className="intro-member-desc">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Mobile ── */}
    <div className="kd-intro-mobile" data-name="소개 — Mobile">
      <div className="kd-section-rule kd-section-rule--s1 kd-intro-rule" />
      <div className="intro-hero-mobile">
        <p className="intro-tag">꿈다락 문화예술학교 · 2026</p>
        <h1 className="intro-iso">이소<span>異素</span></h1>
        <div className="intro-iso-rule" />
        <p className="intro-motto">
          꿈다락 문화예술학교 「이소」는, 동아시아 개인 서정시의 출발점인 한 편의 시가
          음률과 서정으로 2300년을 건너 오늘의 노래와 공동체의 자리가 되었듯,<br />
          삶-터를 살아가는 사람들의 감각과 문화가 다음 세대로 이어지는 자리입니다.
          마을이 곧 학교가 되는 자리입니다.
        </p>
      </div>

      <h3 className="intro-flow-title">사업은 이렇게 이어집니다</h3>
      <div className="mobile-step-list">
        {STEPS.map((step) => (
          <div className="mobile-step" key={step.key}>
            <div className="intro-char-wrap">
              <IntroChar src={step.charM} alt={step.word} />
            </div>
            <div>
              <strong>{step.word}</strong>
              <span>{step.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mobile-facts">
        <h3>사업 개요</h3>
        {OVERVIEW.map((row) => (
          <div className="mobile-fact" key={row.k}>
            <span>{row.k}</span>
            <b>{row.v}</b>
          </div>
        ))}
      </div>

      <div className="mobile-iso-blocks">
        <div className="mobile-iso-block mobile-iso-meaning">
          <h3>{ISO_MEANING.title}</h3>
          <div className="mobile-glyph-row">
            {ISO_MEANING.glyphs.map((g) => (
              <div
                className="mobile-glyph-card"
                key={g.glyph}
                style={{ '--accent': COLORS[g.color] } as React.CSSProperties}
              >
                <span className="mobile-glyph">{g.glyph}</span>
                <span className="mobile-glyph-reading">{g.reading}</span>
                <p className="mobile-glyph-desc">{g.desc}</p>
              </div>
            ))}
          </div>
          <p className="mobile-iso-body">{ISO_MEANING.body}</p>
        </div>

        <div className="mobile-iso-block">
          <h3>{ISO_OWL_FIREFLY.title}</h3>
          <p className="mobile-iso-body">{ISO_OWL_FIREFLY.body}</p>
        </div>

        <div className="mobile-iso-block">
          <h3>{ISO_GENERATIONS.title}</h3>
          <p className="mobile-iso-body">{ISO_GENERATIONS.body}</p>
        </div>
      </div>

      <div className="mobile-members">
        <h3>멤버 소개</h3>
        {MEMBERS.map((m) => (
          <div
            className="mobile-member"
            key={m.id}
            style={{ '--accent': COLORS[m.color] } as React.CSSProperties}
          >
            <div className="mobile-member-slot" aria-hidden="true">
              {m.character ? (
                <img className="mobile-member-img" src={m.character} alt="" />
              ) : (
                <span className="mobile-member-slot-label">캐릭터 자리</span>
              )}
            </div>
            <div className="mobile-member-body">
              <strong className="mobile-member-name">{m.name}</strong>
              <span className="mobile-member-role">{m.role}</span>
              <p className="mobile-member-desc">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Intro;
