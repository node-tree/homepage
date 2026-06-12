import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { OVERVIEW, COLORS, ISO_MEANING } from './data';
import IntroChar from './IntroChar';
import { useKkumdarakAuth } from './KkumdarakAuthContext';
import { kkumdarakIntroAPI } from '../../services/api';
import { lsGet, lsSet } from '../../utils/lsCache';
import { ikUrl } from '../../utils/ikUrl';
import {
  mergeIntroContent,
  type IntroContent,
  type IntroOverride,
} from './introData';

// 편집국(에디터)은 공개 방문자 번들에서 분리 — authed 가 진입할 때만 청크 로드
// (마을소식 NewsEditor 선례와 동일 패턴).
const IntroEditor = lazy(() => import('./IntroEditor'));

// ── 캐시 우선 시드(이전 내용 플래시 제거) ─────────────────────────────
//   재방문 시 백엔드 override 도착 전에도 마지막으로 본 콘텐츠를 즉시 반영한다.
//   민감정보 없음(소개 텍스트·공개 이미지 URL 뿐).
const INTRO_LS_KEY = 'kkumdarakIntro_v1';

const STEPS: Array<{
  key: string; word: string; label: string;
  charD: string; charM: string;
}> = [
  { key: 'make',  word: '만들기',   label: '공간을 함께 짓기',    charD: 'char-11.svg', charM: 'char-11.svg' },
  { key: 'fill',  word: '채우기',   label: '프로그램으로 채우기', charD: 'char-12.svg', charM: 'char-09.svg' },
  { key: 'share', word: '나누기',   label: '축제로 나누기',        charD: 'char-14.svg', charM: 'char-17.svg' },
  { key: 'keep',  word: '지속하기', label: '마을이 스스로 잇기',  charD: 'char-15.svg', charM: 'char-18.svg' },
];

const Intro: React.FC = () => {
  const { authed } = useKkumdarakAuth();

  // 캐시 우선 시드 → 콜드스타트에도 마지막 콘텐츠로 낙관 렌더.
  const cachedOverride = lsGet<IntroOverride>(INTRO_LS_KEY) ?? undefined;
  const [content, setContent] = useState<IntroContent>(() =>
    mergeIntroContent(cachedOverride),
  );
  const [editing, setEditing] = useState(false);
  const fetchedRef = useRef(false);

  // ── 백엔드 override 로드 (마운트 1회) ───────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return; // StrictMode 이중 마운트 방지
    fetchedRef.current = true;
    let alive = true;
    kkumdarakIntroAPI
      .get()
      .then((override: IntroOverride) => {
        if (!alive) return;
        lsSet(INTRO_LS_KEY, override);
        setContent(mergeIntroContent(override));
      })
      .catch(() => {
        /* 콜드스타트/오프라인 — 정적+캐시 기본값 유지 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 저장 후 에디터가 넘겨준 새 override 를 반영(목록 화면 즉시 갱신 + 캐시 동기화).
  const handleSaved = useCallback((override: IntroOverride) => {
    lsSet(INTRO_LS_KEY, override);
    setContent(mergeIntroContent(override));
  }, []);

  // 로그아웃 시 편집 화면에 머무르지 않도록 닫기.
  useEffect(() => {
    if (!authed && editing) setEditing(false);
  }, [authed, editing]);

  if (editing) {
    return (
      <Suspense fallback={<div className="kd-section-loading" aria-busy="true" />}>
        <IntroEditor
          initialContent={content}
          onSaved={handleSaved}
          onClose={() => setEditing(false)}
        />
      </Suspense>
    );
  }

  const { motto, place, isoMeaning, isoOwlFirefly, isoGenerations, members, groupShot } = content;

  return (
    <section className="kd-figma-intro" data-name="소개">

      {/* ── 편집 진입 (로그인 시에만 노출) ── */}
      {authed && (
        <div className="intro-admin-bar">
          <button
            type="button"
            className="intro-edit-btn"
            onClick={() => setEditing(true)}
          >
            편집
          </button>
        </div>
      )}

      {/* ── Desktop ── */}
      <div className="kd-intro-desktop">
        <div className="kd-section-rule kd-section-rule--s1 kd-intro-rule" />

        {/* ① 이소 히어로 */}
        <div className="intro-hero">
          <p className="intro-tag">꿈다락 문화예술학교 · 2026 생활거점형</p>
          <h1 className="intro-iso">이소<span>異素</span></h1>
          <div className="intro-iso-rule" />
          <p className="intro-motto">{motto}</p>
          <p className="intro-place">{place}</p>
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
            <h3>{isoMeaning.title}</h3>
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
            <p className="intro-iso-body">{isoMeaning.body}</p>
          </div>

          {/* B — 듣고, 빛내며 (부엉이와 반딧불이) */}
          <div className="intro-iso-block">
            <h3>{isoOwlFirefly.title}</h3>
            <p className="intro-iso-body">{isoOwlFirefly.body}</p>
          </div>

          {/* C — 다섯 세대가 만나는 자리 */}
          <div className="intro-iso-block">
            <h3>{isoGenerations.title}</h3>
            <p className="intro-iso-body">{isoGenerations.body}</p>
          </div>
        </div>

        {/* ④ 멤버 소개 */}
        <div className="intro-members">
          <h3>멤버 소개</h3>

          {/* 단체컷 — 와이드 히어로 카드. groupShot URL 이 채워지면 노출, 없으면 placeholder. */}
          <div className="intro-group-shot" aria-hidden={!groupShot}>
            {groupShot ? (
              <img
                className="intro-group-shot-img"
                src={ikUrl(groupShot, { w: 1600 })}
                alt="멤버 단체컷"
              />
            ) : (
              <span className="intro-group-shot-label">단체컷 자리</span>
            )}
          </div>

          {/* 개별 멤버 — 캐릭터 이미지를 크게. 데스크톱 3열(마지막 행 2명 가운데 정렬). */}
          <div className="intro-members-grid">
            {members.map((m) => (
              <div
                className="intro-member"
                key={m.id}
                style={{ '--accent': COLORS[m.color] } as React.CSSProperties}
              >
                <div className="intro-member-slot">
                  {m.character ? (
                    <img className="intro-member-img" src={ikUrl(m.character, { w: 600 })} alt={m.name} />
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
          <p className="intro-motto">{motto}</p>
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
            <h3>{isoMeaning.title}</h3>
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
            <p className="mobile-iso-body">{isoMeaning.body}</p>
          </div>

          <div className="mobile-iso-block">
            <h3>{isoOwlFirefly.title}</h3>
            <p className="mobile-iso-body">{isoOwlFirefly.body}</p>
          </div>

          <div className="mobile-iso-block">
            <h3>{isoGenerations.title}</h3>
            <p className="mobile-iso-body">{isoGenerations.body}</p>
          </div>
        </div>

        <div className="mobile-members">
          <h3>멤버 소개</h3>

          {/* 단체컷 — 모바일에서도 상단 와이드 카드. */}
          <div className="mobile-group-shot" aria-hidden={!groupShot}>
            {groupShot ? (
              <img
                className="mobile-group-shot-img"
                src={ikUrl(groupShot, { w: 800 })}
                alt="멤버 단체컷"
              />
            ) : (
              <span className="mobile-group-shot-label">단체컷 자리</span>
            )}
          </div>

          {/* 개별 멤버 — 캐릭터 이미지를 크게. 모바일 2열 그리드. */}
          <div className="mobile-members-grid">
            {members.map((m) => (
              <div
                className="mobile-member"
                key={m.id}
                style={{ '--accent': COLORS[m.color] } as React.CSSProperties}
              >
                <div className="mobile-member-slot">
                  {m.character ? (
                    <img className="mobile-member-img" src={ikUrl(m.character, { w: 500 })} alt={m.name} />
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
      </div>
    </section>
  );
};

export default Intro;
