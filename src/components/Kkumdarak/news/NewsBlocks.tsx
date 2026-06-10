import React from 'react';
import { ikUrl } from '../../../utils/ikUrl';
import type {
  NewsBlock,
  TopStoryBlock,
  ArticleBlock,
  VerseBlock,
  PhotoSpreadBlock,
  CollageBlock,
  ProgramBoardBlock,
  NoticeBoxBlock,
  CustomBlock,
  BlockSpan,
  BlockTone,
  RuleTop,
} from './newsData';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 블록 렌더러 — 신문 관용 블록 라이브러리
//   각 블록은 6단 신문 그리드 위에 흐르는 <article>/<section>.
//   조판 언어(span·tone·rotate·ruleTop)는 공통 클래스로 환산.
//   뉴스 전용 스타일은 villageNews.css 에 전부 있다(이 컴포넌트는 마크업만).
// ═══════════════════════════════════════════════════════════════

// ── 자작 부엉이·반딧불이 라인컷 (제호 컷) ────────────────────────
//   base64 PNG 캐릭터(chars-v2)는 콜라주 스크랩에 쓰고, 제호에는 명조 흑백
//   신문 톤에 맞는 우드컷 느낌의 라인 SVG 를 직접 그린다. currentColor 로
//   먹/신호색을 CSS 가 제어한다(임의 hex 산재 금지).

/** 부엉이 — 마을의 소리를 듣고 기억하는 자리 */
export const OwlCut: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 72" className={className} role="img" aria-label="마을의 소리를 듣는 부엉이"
    fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    {/* 귀깃 */}
    <path d="M16 16 L11 5 L22 13" />
    <path d="M48 16 L53 5 L42 13" />
    {/* 몸통 */}
    <path d="M12 30 C12 14 22 10 32 10 C42 10 52 14 52 30 C52 52 44 66 32 66 C20 66 12 52 12 30 Z" />
    {/* 얼굴 원반 */}
    <path d="M32 12 C24 12 19 18 19 28 C19 36 25 40 32 40 C39 40 45 36 45 28 C45 18 40 12 32 12 Z" />
    <path d="M32 12 L32 40" strokeWidth={1.4} />
    {/* 눈 */}
    <circle cx="25.5" cy="26" r="5" />
    <circle cx="38.5" cy="26" r="5" />
    <circle cx="25.5" cy="26" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="38.5" cy="26" r="1.6" fill="currentColor" stroke="none" />
    {/* 부리 */}
    <path d="M32 30 L29 35 L35 35 Z" fill="currentColor" stroke="none" />
    {/* 깃 결 */}
    <path d="M22 47 Q32 53 42 47" strokeWidth={1.4} />
    <path d="M24 55 Q32 60 40 55" strokeWidth={1.4} />
    {/* 발 */}
    <path d="M27 65 L27 70 M27 70 L24 70 M27 70 L30 70" strokeWidth={1.6} />
    <path d="M37 65 L37 70 M37 70 L34 70 M37 70 L40 70" strokeWidth={1.6} />
  </svg>
);

/** 반딧불이 — 빛을 내어 신호를 보내는 자리 */
export const FireflyCut: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 72" className={className} role="img" aria-label="빛을 내어 신호를 보내는 반딧불이"
    fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    {/* 더듬이 */}
    <path d="M27 16 Q22 8 17 6" />
    <path d="M37 16 Q42 8 47 6" />
    {/* 머리 */}
    <circle cx="32" cy="19" r="7" />
    <circle cx="29.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="34.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    {/* 가슴마디 */}
    <path d="M24 28 Q32 24 40 28 L38 38 Q32 35 26 38 Z" />
    {/* 날개 */}
    <path d="M24 30 Q8 30 12 48 Q22 44 28 38" strokeWidth={1.8} />
    <path d="M40 30 Q56 30 52 48 Q42 44 36 38" strokeWidth={1.8} />
    {/* 빛나는 배(꽁무니) — 신호색 면 */}
    <path d="M26 40 Q32 38 38 40 L35 58 Q32 64 29 58 Z"
      fill="var(--kd-news-spot)" stroke="currentColor" />
    {/* 발광 신호선 */}
    <path d="M32 64 L32 70" strokeWidth={1.6} stroke="var(--kd-news-spot)" />
    <path d="M22 60 L17 63 M42 60 L47 63" strokeWidth={1.4} stroke="var(--kd-news-spot)" />
  </svg>
);

// ── 조판 옵션 → 클래스 ──────────────────────────────────────────
function spanClass(span?: BlockSpan): string {
  return `kdn-span-${span || 'full'}`;
}
function toneClass(tone?: BlockTone): string {
  return tone && tone !== 'paper' ? ` kdn-tone-${tone}` : '';
}
function ruleClass(rule?: RuleTop): string {
  return rule && rule !== 'none' ? ` kdn-rule-${rule}` : '';
}

// 블록 래퍼 — 공통 조판 속성(폭·먹면·기울임·상단 괘선)을 한곳에서 환산.
const BlockShell: React.FC<{
  block: NewsBlock;
  as?: 'article' | 'section' | 'aside' | 'figure';
  className?: string;
  children: React.ReactNode;
}> = ({ block, as = 'article', className = '', children }) => {
  const Tag = as as React.ElementType;
  const style = block.rotate ? ({ ['--kdn-rotate' as string]: `${block.rotate}deg` } as React.CSSProperties) : undefined;
  return (
    <Tag
      className={`kdn-block ${spanClass(block.span)}${toneClass(block.tone)}${ruleClass(block.ruleTop)}${block.rotate ? ' kdn-rotated' : ''} ${className}`.trim()}
      style={style}
    >
      {children}
    </Tag>
  );
};

// ── TopStory ─────────────────────────────────────────────────────
const TopStory: React.FC<{ b: TopStoryBlock }> = ({ b }) => (
  <BlockShell block={b} as="article" className="kdn-topstory">
    <p className="kdn-kicker">{b.kicker}</p>
    <h2 className="kdn-cut">{b.headline}</h2>
    {b.deck && <p className="kdn-deck">{b.deck}</p>}
    <div className="kdn-topstory-body">
      <p className="kdn-lead">{b.lead}</p>
      {b.body.map((p, i) => (
        <p key={i} className="kdn-para">{p}</p>
      ))}
    </div>
    {b.byline && <p className="kdn-byline">{b.byline}</p>}
  </BlockShell>
);

// ── Article (멀티컬럼 + 드롭캡) ──────────────────────────────────
const Article: React.FC<{ b: ArticleBlock }> = ({ b }) => {
  const cols = b.columns || 2;
  return (
    <BlockShell block={b} as="article" className={`kdn-article kdn-cols-${cols}`}>
      <header className="kdn-article-head">
        <p className="kdn-kicker">{b.kicker}</p>
        <h3 className="kdn-headline">{b.headline}</h3>
        {b.deck && <p className="kdn-deck">{b.deck}</p>}
        {b.byline && <p className="kdn-byline">{b.byline}</p>}
      </header>
      <div className={`kdn-article-body${b.dropCap ? ' kdn-dropcap' : ''}`}>
        {b.body.map((p, i) => (
          <p key={i} className="kdn-para">{p}</p>
        ))}
      </div>
      {b.pullQuote && <blockquote className="kdn-pullquote">{b.pullQuote}</blockquote>}
    </BlockShell>
  );
};

// ── Verse (세로쓰기) ─────────────────────────────────────────────
const Verse: React.FC<{ b: VerseBlock }> = ({ b }) => (
  <BlockShell block={b} as="aside" className="kdn-verse">
    {b.kicker && <p className="kdn-kicker">{b.kicker}</p>}
    {b.title && <h3 className="kdn-verse-title">{b.title}</h3>}
    <div className="kdn-verse-body" lang="ko">
      {b.lines.map((line, i) => (
        <p key={i} className="kdn-verse-line">{line}</p>
      ))}
    </div>
    {b.attribution && <p className="kdn-verse-attr">{b.attribution}</p>}
  </BlockShell>
);

// ── PhotoSpread ──────────────────────────────────────────────────
const PhotoSpread: React.FC<{ b: PhotoSpreadBlock }> = ({ b }) => (
  <BlockShell block={b} as="figure" className="kdn-photospread">
    <div className="kdn-photospread-grid">
      {b.images.map((img, i) => (
        <img
          key={i}
          src={ikUrl(img.src)}
          alt={img.alt}
          loading="lazy"
          decoding="async"
          style={img.rotate ? { transform: `rotate(${img.rotate}deg)` } : undefined}
          className="kdn-photo"
        />
      ))}
    </div>
    {(b.caption || b.credit) && (
      <figcaption className="kdn-caption">
        {b.caption}
        {b.credit && <span className="kdn-credit"> {b.credit}</span>}
      </figcaption>
    )}
  </BlockShell>
);

// ── Collage (스크랩 모드) ────────────────────────────────────────
const Collage: React.FC<{ b: CollageBlock }> = ({ b }) => (
  <BlockShell block={b} as="figure" className="kdn-collage">
    {b.title && <p className="kdn-collage-title">{b.title}</p>}
    <div className="kdn-collage-stage">
      {b.items.map((it, i) => (
        <span
          key={i}
          className="kdn-scrap"
          style={{
            transform: `rotate(${it.rotate ?? 0}deg) scale(${it.scale ?? 1})`,
          }}
        >
          <img src={ikUrl(it.src)} alt={it.alt} loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
    {b.caption && <figcaption className="kdn-caption">{b.caption}</figcaption>}
  </BlockShell>
);

// ── ProgramBoard (공고란) ────────────────────────────────────────
const ProgramBoard: React.FC<{ b: ProgramBoardBlock }> = ({ b }) => (
  <BlockShell block={b} as="section" className="kdn-board">
    <h3 className="kdn-board-title">{b.title}</h3>
    <ul className="kdn-board-list">
      {b.notes.map((n, i) => (
        <li key={i} className="kdn-board-item">
          <span className="kdn-board-no" aria-hidden="true">{n.no}</span>
          <div className="kdn-board-text">
            <p className="kdn-board-name">
              {n.name} <span className="kdn-board-field">{n.field}</span>
            </p>
            <p className="kdn-board-meta">
              {n.target} · {n.period}
            </p>
            {n.extra && <p className="kdn-board-extra">{n.extra}</p>}
          </div>
        </li>
      ))}
    </ul>
    {b.footer && <p className="kdn-board-footer">{b.footer}</p>}
  </BlockShell>
);

// ── NoticeBox (사고) ─────────────────────────────────────────────
const NoticeBox: React.FC<{ b: NoticeBoxBlock }> = ({ b }) => (
  <BlockShell block={b} as="aside" className="kdn-notice">
    {b.label && <p className="kdn-notice-label">{b.label}</p>}
    <p className="kdn-notice-body">{b.body}</p>
  </BlockShell>
);

// ── Custom (자유 탈출구) ─────────────────────────────────────────
const Custom: React.FC<{ b: CustomBlock }> = ({ b }) => (
  <BlockShell block={b} as="section" className="kdn-custom">
    {b.render()}
  </BlockShell>
);

// ── 디스패처 ─────────────────────────────────────────────────────
export const NewsBlockView: React.FC<{ block: NewsBlock }> = ({ block }) => {
  switch (block.kind) {
    case 'topStory': return <TopStory b={block} />;
    case 'article': return <Article b={block} />;
    case 'verse': return <Verse b={block} />;
    case 'photoSpread': return <PhotoSpread b={block} />;
    case 'collage': return <Collage b={block} />;
    case 'programBoard': return <ProgramBoard b={block} />;
    case 'noticeBox': return <NoticeBox b={block} />;
    case 'custom': return <Custom b={block} />;
    default: {
      // discriminated union 누락 방지(컴파일 타임 보장)
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
};
