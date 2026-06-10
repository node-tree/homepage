import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IntroChar from './IntroChar';
import ProgramCharacterPng, { characterPngForName } from './programCharacters';
import { villageDiaryAPI } from '../../services/api';
import { ikUrl } from '../../utils/ikUrl';
import ImageKitPicker from '../editor/ImageKitPicker';
import aiAPI from '../../services/aiApi';
import { useKkumdarakAuth } from './KkumdarakAuthContext';

// 마을일기 캐릭터 — 프로그램명이 새 PNG 매핑에 있으면 PNG, 아니면 기존 SVG 리그(IntroChar) 폴백.
//   프로그램 카드(Programs.tsx)와 동일한 PNG 를 같은 프로그램에 사용해 일관성 유지.
const DiaryCharacter: React.FC<{ src: string; name: string }> = ({ src, name }) => (
  characterPngForName(name)
    ? <ProgramCharacterPng name={name} alt={name} className="intro-char-svg intro-char-rig" />
    : <IntroChar src={src} alt={name} />
);

type DiaryCardData = { side: 'left' | 'right'; title: string; date: string; dot: string; imageUrl?: string };
type ProgramDiary = {
  id: string;
  name: string;
  accent: string;
  character: string;
  cards: DiaryCardData[];
};

// ── 데스크톱 마을일기 카드: 모바일 "스탬프"형으로 정돈 (후속 작업, 데스크톱 전용) ──
// 기존 데스크톱은 가로로 길쭉(440px)하고, 사진 없는 카드의 상단 빨강 밴드가
// 점만 우상단 구석에 박힌 채 "비어 보여" 미완성처럼 읽혔다.
// 모바일 카드(좋음 — 기준)는: 빨강 밴드 안에 색 점(dot)이 가운데 크게 박힌 스탬프 +
// 그 아래 흰 영역에 제목/날짜. 컴팩트하고 균형 잡힌 모습.
// → 데스크톱도 모바일 톤으로:
//   · 카드 폭 440 → 320 (가로 늘어짐 완화, 균형). 척추 쪽 모서리는 고정하고
//     바깥쪽으로만 줄여 커넥터(560/880 접점) 위치를 건드리지 않는다.
//       - 오른쪽 카드: left 880 유지(왼쪽 모서리 = 커넥터 끝 880)
//       - 왼쪽 카드: 오른쪽 모서리 560 고정 → left 560-320 = 240
//   · 사진 없는 카드: 빨강 밴드를 "의도적"으로 — 흰 베일/구석 렌즈 제거하고
//     색 점을 밴드 안에 크게(52px) 박아 모바일과 같은 스탬프로. 커넥터가 점을 가리키도록
//     점 중심을 카드 상단 기준 115px(커넥터 라인)에 정렬.
//   · 사진 있는 카드: 기존처럼 이미지가 슬롯을 가득 채우는 이미지 위주 유지.
//   · 본문 아래 중복 사진(.diary-card-image)은 데스크톱에서 숨김(사진은 위 슬롯에서 큼).
// 모바일(@media max-width:900px)에는 영향 없도록 min-width:901px 로 한정.
// ※ 카드 등장(캐릭터 도달 기준) 로직은 JS 상수만 사용 → 이 CSS 변경과 무관, 유지됨.
const DIARY_DESKTOP_CSS = `
@media (min-width: 901px) {
  /* 카드 폭 축소 + 척추쪽 모서리 고정(바깥쪽으로만 축소) — 가로 늘어짐 완화 */
  .kd-diary-desktop .diary-card { width: 320px; transition: width 0.2s ease, left 0.2s ease; }
  .kd-diary-desktop .diary-card.left { left: 240px; }   /* 오른쪽 모서리 560 유지 */
  .kd-diary-desktop .diary-card.right { left: 880px; }  /* 왼쪽 모서리 880 유지 */

  /* ── 사진 있는 카드만 데스크톱에서 가로로 넓힘 — 폭 확장(양옆 여백 축소) ──
     사용자 요청: "높이말고 폭을 늘려라, 양 사이드 여백이 많이 남는다".
     스탬프(사진 없는) 카드는 320px 유지(정돈된 균형 보존),
     사진 카드만 320 → 470px 로 넓혀 풀블리드 커버 이미지가 가로로 시원하게.
     커넥터 접점(왼쪽 카드 오른쪽 모서리 560, 오른쪽 카드 왼쪽 모서리 880)은
     반드시 고정 → 바깥쪽으로만 확장해 척추/커넥터 정렬을 건드리지 않는다.
     1440 고정 캔버스는 overflow:hidden 로 가운데 정렬·클리핑되며, 풀 가시성의
     최저 뷰포트(1280px)에서 보이는 창은 [80, 1360]. 접점 고정 시 가능한 최대 폭은
     좌우 480px → 여유 두고 470px 로 확장.
       · 오른쪽 카드: left 880 고정, width 470 → 오른쪽 모서리 880+470=1350
         (1280px 가시창 우측 1360 안쪽 — 10px 여유)
       · 왼쪽 카드: 오른쪽 모서리 560 고정 → left = 560-470 = 90
         (1280px 가시창 좌측 80 바깥 — 10px 여유, 외곽 여백 140→90 으로 축소)
     모바일(max-width:900px)에는 무영향 — 이 블록은 min-width:901px 한정. */
  .kd-diary-desktop .diary-card.left:has(.diary-photo-img) {
    width: 470px;
    left: 90px;                   /* 오른쪽 모서리 560 유지 (560-470) */
  }
  .kd-diary-desktop .diary-card.right:has(.diary-photo-img) {
    width: 470px;
    left: 880px;                  /* 왼쪽 모서리 880 유지, 오른쪽 모서리 1350 */
  }

  /* 사진 없는(빨강) 카드: 모바일 스탬프형 밴드 (의도적인 빨강 + 가운데 큰 점) */
  .kd-diary-desktop .diary-photo {
    height: 150px;
    transition: height 0.2s ease;
  }
  .kd-diary-desktop .diary-photo:has(.diary-photo-img) {
    height: 290px;                /* 가로(470) 확장 위주 — 세로는 290으로, 470/290≈1.62:1 와이드 비율 */
  }
  /* 색 점을 밴드 안에 크게 박은 스탬프 — 모바일과 동일 톤.
     커넥터(카드 상단 기준 115px)가 점을 향하도록 점 중심을 115px에 정렬. */
  .kd-diary-desktop .diary-photo i {
    left: 50%;
    right: auto;
    top: 115px;
    transform: translate(-50%, -50%);
    width: 52px;
    height: 52px;
    border: 2px solid #1a1a1a;
    z-index: 2;
    opacity: 1;
  }
  /* 사진이 있으면 점(스탬프)은 숨기고 이미지가 주연 */
  .kd-diary-desktop .diary-photo:has(.diary-photo-img) i {
    display: none;
  }
  /* 사진을 슬롯 전체에 채움 (모바일과 동일 동작) */
  .kd-diary-desktop .diary-photo-img {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
  }
  /* 본문 아래 중복 사진 제거: 사진은 위 슬롯에서 이미 크게 보임 */
  .kd-diary-desktop .diary-card-image {
    display: none;
  }

  /* ── 편집 모드: 절대배치 타임라인 해제 → 일반 세로 플로우(겹침·하단잘림 방지) ──
     보기 모드는 위 절대배치 그대로. is-editing-flow 일 때만 카드를 정적 흐름으로. */
  .kd-diary-desktop.is-editing-flow {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .kd-diary-desktop.is-editing-flow .diary-card,
  .kd-diary-desktop.is-editing-flow .diary-card.left,
  .kd-diary-desktop.is-editing-flow .diary-card.right,
  .kd-diary-desktop.is-editing-flow .diary-card.left:has(.diary-photo-img),
  .kd-diary-desktop.is-editing-flow .diary-card.right:has(.diary-photo-img) {
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: min(560px, 92%) !important;
    margin: 0 auto 28px !important;
  }
  /* 사진 슬롯은 편집 중 적당한 높이로 고정(이미지 유무와 무관하게 안정) */
  .kd-diary-desktop.is-editing-flow .diary-photo,
  .kd-diary-desktop.is-editing-flow .diary-photo:has(.diary-photo-img) {
    height: 200px !important;
  }
  /* + 기록 추가 버튼: 흐름 배치 */
  .kd-diary-desktop.is-editing-flow .diary-add-card-btn {
    position: static !important;
    top: auto !important;
    left: auto !important;
    transform: none !important;
    margin: 8px auto 40px !important;
  }
}
`;

// ── 7개 프로그램 — 장암책정만 콘텐츠, 나머지는 추후 제공(빈 배열) ──
const PROGRAMS_DEFAULT: ProgramDiary[] = [
  {
    id: 'jangam-chaekjeong',
    name: '장암 책정',
    accent: '#E4352B',
    character: 'char-18.svg',
    cards: [
      { side: 'left', title: '도서관 자리를 함께 측량했어요.', date: '05.24', dot: '#259f3e' },
      { side: 'right', title: '옛 도서실을 비우고 다 같이 청소했다.', date: '06.07', dot: '#f18bb1' },
      { side: 'left', title: '목공 — 책장의 뼈대를 세우다.', date: '07.05', dot: '#ffc90e' },
      { side: 'right', title: '주민들이 책을 채우기 시작했다.', date: '08.20', dot: '#1b55e2' },
      { side: 'left', title: '〈장암 책정〉 드디어 문을 열다!', date: '09.15', dot: '#ec251f' },
    ],
  },
  {
    id: 'maeul-signal',
    name: '마을의 신호',
    accent: '#2D5BE3',
    character: 'char-09.svg',
    cards: [],
  },
  {
    id: 'memory-station',
    name: '기억순환 정류장',
    accent: '#3CA03C',
    character: 'char-14.svg',
    cards: [],
  },
  {
    id: 'hand-memory',
    name: '손의 기억',
    accent: '#F2A0C0',
    character: 'char-12.svg',
    cards: [],
  },
  {
    id: 'sound-diary',
    name: '소리일기',
    accent: '#F5C518',
    character: 'char-17.svg',
    cards: [],
  },
  {
    id: 'scape-diary',
    name: '풍경일기',
    accent: '#2D5BE3',
    character: 'char-15.svg',
    cards: [],
  },
  {
    id: 'goodbye-again',
    name: '다시, 안녕',
    accent: '#E4352B',
    character: 'char-11.svg',
    cards: [],
  },
];

// localStorage 는 백엔드가 단일 진실 소스로 승격된 후에는 *오프라인 캐시*로만 사용한다.
//   마운트 시 먼저 캐시로 즉시 렌더 후, 백엔드 GET 성공 시 교체. 저장 base 는 항상 백엔드 오버라이드(serverOverrideRef).
// ── 모바일 전용: 프로그램별 콘텐츠 박스 정렬 방향 ──────────────────
// 모바일에서만 마을일기 카드(콘텐츠 박스)를 척추(세로 path) 기준으로 좌/우 어디에 둘지
// program.id 로 매핑한다. 데스크톱은 card.side 로 카드별 좌우가 정해지므로 전혀 영향 없음.
// 기본값은 'right'(현재 동작: 카드가 척추 오른쪽). 명시 매핑된 프로그램만 거울상(left)으로 뒤집힌다.
// mergePrograms 는 .cards 만 오버라이드하므로 이 맵은 백엔드 병합과 무관하게 항상 유지된다.
type MobileSide = 'left' | 'right';
const MOBILE_SIDE_MAP: Record<string, MobileSide> = {
  'jangam-chaekjeong': 'right', // 장암 책정 — 현행 유지(오른쪽)
  'maeul-signal': 'left',      // 마을의 신호 — 왼쪽
};

const LS_KEY = 'villageDiary_v1';

// localStorage 오프라인 캐시에서 카드 오버라이드 불러오기(빠른 초기 렌더용)
function loadSavedCards(): Record<string, DiaryCardData[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DiaryCardData[]>) : {};
  } catch {
    return {};
  }
}

// PROGRAMS_DEFAULT + saved override 병합
function mergePrograms(saved: Record<string, DiaryCardData[]>): ProgramDiary[] {
  return PROGRAMS_DEFAULT.map((p) =>
    saved[p.id] !== undefined ? { ...p, cards: saved[p.id] } : p,
  );
}

// ── 레이아웃 상수(데스크톱) ──────────────────────────────────────
const PATH_TOP = 320;
const FIRST_CARD_Y = 482;
const CARD_GAP = 280;
const PATH_TAIL = 120;
const AVATAR_TRAVEL_PAD = 40;

// ── 레이아웃 상수(모바일) — kkumdarak-diary-mobile-patch.css와 동기 ──
// 카드 디자인: 사진은 거의 유지(108), 텍스트 영역만 축소(8/12/10 padding, h2 14/1.15, time 11)
//   → 한 줄 카드 ≈ 171px, 두 줄 카드 ≈ 187px (border 포함)
// 카드 간 gap 210 → 두 줄 카드도 ≈ 23px 여백, 1줄 카드는 ≈ 39px 여백 — 폰트 라운딩 안전 마진 확보
// path top 260, height 1010 (CSS와 동기)
//   마지막 dot y = 333 + 4*210 + 43 = 1216, +22 = 1238 → path end 1270
const MOBILE_FIRST_CARD_Y = 333;
const MOBILE_CARD_GAP = 210;
// path 시각 중심 = .diary-path { left: 42 } + border-left-width 12 / 2 = 48
// dot width 22 → dot 중심을 48에 맞추려면 left = 48 - 11 = 37 → JSX: lx - 11, lx = 48
const MOBILE_PATH_CENTER_X = 48;
// dot/connector를 카드 내 photo 영역(높이 108) 가운데에 위치
//   dot top = y + (108 - 22) / 2 = y + 43
//   connector top = y + 54 (dot 중심) - 2.5(connector 두께 5/2) ≈ y + 51
const MOBILE_DOT_Y_OFFSET = 43;
const MOBILE_CONNECTOR_Y_OFFSET = 51;
const MOBILE_AVATAR_START = 236;
const MOBILE_PATH_TOP = 260;
const MOBILE_PATH_HEIGHT = 1010; // CSS와 동기화
const MOBILE_AVATAR_END = MOBILE_PATH_TOP + MOBILE_PATH_HEIGHT - 87 - 20; // ≈ 1163

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
};

// ── 편집 가능한 DiaryCard ─────────────────────────────────────────
const DiaryCard: React.FC<{
  title: string;
  date: string;
  dot: string;
  accent: string;
  imageUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  cardRef?: (el: HTMLElement | null) => void;
  isEditing?: boolean;
  onUpdate?: (field: 'title' | 'date' | 'dot' | 'side' | 'imageUrl', value: string) => void;
  onDelete?: () => void;
  side?: 'left' | 'right';
  programId?: string;
  programName?: string;
}> = ({ title, date, dot, accent, imageUrl, className = '', style, cardRef, isEditing, onUpdate, onDelete, side, programId, programName }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPrev, setAiPrev] = useState<string | null>(null); // 직전 title(되돌리기용)

  const aiWrite = async () => {
    const topic = aiTopic.trim();
    if (!topic || aiBusy || !onUpdate) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const text = await aiAPI.write({ mode: 'write', topic, context: 'village-diary', format: 'plain', programId, programName });
      setAiPrev(title);
      onUpdate('title', text);
      setAiOpen(false);
      setAiTopic('');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 생성에 실패했습니다.');
    } finally {
      setAiBusy(false);
    }
  };

  const aiRefine = async () => {
    if (aiBusy || !onUpdate) return;
    const src = (title || '').trim();
    if (!src) {
      setAiOpen(true);
      setAiError('다듬을 내용이 없습니다. 먼저 제목을 입력하거나 “AI 작성”을 이용하세요.');
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const text = await aiAPI.write({ mode: 'refine', originalText: src, context: 'village-diary', format: 'plain', programId, programName });
      setAiPrev(title);
      onUpdate('title', text);
    } catch (e) {
      setAiOpen(true);
      setAiError(e instanceof Error ? e.message : 'AI 다듬기에 실패했습니다.');
    } finally {
      setAiBusy(false);
    }
  };

  const aiUndo = () => {
    if (aiPrev !== null && onUpdate) {
      onUpdate('title', aiPrev);
      setAiPrev(null);
    }
  };

  return (
    <>
    <article
    ref={cardRef as React.Ref<HTMLElement>}
    className={`diary-card ${className}${isEditing ? ' is-editing-card' : ''}`}
    style={{ ...style, position: isEditing ? 'static' : 'absolute' }}
  >
    {isEditing && onDelete && (
      <button className="diary-card-delete" onClick={onDelete} title="삭제">×</button>
    )}
    <div className="diary-photo" style={{ background: accent }}>
      <i style={{ background: dot }} />
      {imageUrl && (
        <img
          src={ikUrl(imageUrl, { w: 1200 })}
          alt=""
          className="diary-photo-img"
        />
      )}
    </div>
    <div className="diary-copy">
      {isEditing && onUpdate ? (
        <>
          <textarea
            className="diary-edit-textarea"
            value={title}
            rows={2}
            onChange={(e) => onUpdate('title', e.target.value)}
            style={{ fontSize: '22px', fontWeight: 800, marginBottom: 4 }}
          />
          <div className="diary-ai-bar">
            <button
              type="button"
              className="diary-ai-btn"
              disabled={aiBusy}
              onClick={() => { setAiError(null); setAiTopic(''); setAiOpen((v) => !v); }}
            >
              ✦ AI 작성
            </button>
            <button
              type="button"
              className="diary-ai-btn"
              disabled={aiBusy}
              onClick={aiRefine}
              title="현재 내용을 서정적으로 다듬기"
            >
              ✦ 다듬기
            </button>
            {aiPrev !== null && (
              <button type="button" className="diary-ai-btn diary-ai-undo" disabled={aiBusy} onClick={aiUndo} title="AI 적용 직전으로 되돌리기">
                ↩ 되돌리기
              </button>
            )}
          </div>
          {aiOpen && (
            <div className="diary-ai-panel">
              <input
                className="diary-edit-input diary-ai-input"
                placeholder="주제·키워드 (예: 도서관 측량, 5월 마당)"
                value={aiTopic}
                autoFocus
                disabled={aiBusy}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); aiWrite(); }
                  else if (e.key === 'Escape') { setAiOpen(false); }
                }}
              />
              <div className="diary-ai-panel-actions">
                <button type="button" className="diary-ai-btn" disabled={aiBusy} onClick={aiWrite}>
                  {aiBusy ? '생성 중…' : '서정적으로 쓰기'}
                </button>
                <button type="button" className="diary-ai-btn diary-ai-close" disabled={aiBusy} onClick={() => { setAiOpen(false); setAiError(null); }}>
                  닫기
                </button>
              </div>
            </div>
          )}
          {aiBusy && <div className="diary-ai-status">서정적으로 쓰는 중…</div>}
          {aiError && <div className="diary-ai-error">{aiError}</div>}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input
              className="diary-edit-input"
              value={date}
              onChange={(e) => onUpdate('date', e.target.value)}
              style={{ fontSize: '15px', width: 70 }}
              placeholder="MM.DD"
            />
          </div>
          <div className="diary-dot-picker">
            <label>도트</label>
            <input
              type="color"
              value={dot}
              onChange={(e) => onUpdate('dot', e.target.value)}
            />
          </div>
          <div className="diary-side-toggle">
            <button className={side === 'left' ? 'active' : ''} onClick={() => onUpdate('side', 'left')}>left</button>
            <button className={side === 'right' ? 'active' : ''} onClick={() => onUpdate('side', 'right')}>right</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              type="url"
              className="diary-edit-input diary-image-url-input"
              value={imageUrl ?? ''}
              onChange={(e) => onUpdate('imageUrl', e.target.value)}
              placeholder="이미지 링크 붙여넣기 또는 이미지 선택"
              style={{ fontSize: '12px', flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="diary-image-pick-btn"
              onClick={() => setPickerOpen(true)}
              style={{ fontSize: '12px', whiteSpace: 'nowrap', padding: '6px 10px', cursor: 'pointer' }}
            >
              이미지 선택
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <time>{date}</time>
          {imageUrl && (
            <img
              src={ikUrl(imageUrl, { w: 1200 })}
              alt=""
              className="diary-card-image"
            />
          )}
        </>
      )}
    </div>
    </article>
    {isEditing && onUpdate && (
      <ImageKitPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) => { if (urls[0]) onUpdate('imageUrl', urls[0]); }}
        title="마을일기 이미지 선택"
      />
    )}
    </>
  );
};

const VillageDiary: React.FC = () => {
  // ── 꿈다락 편집 인증 — 최상위 공유 컨텍스트에서 소비 ──────────────
  //   로그인 진입 버튼/모달은 nav 의 도형 버튼 + Provider 가 담당.
  //   여기서는 authed 로 편집/완료 게이팅, 401 시 logout()+requestLogin() 만 호출.
  const { authed, logout, requestLogin } = useKkumdarakAuth();

  // ── 편집 상태 ──────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);

  // programs를 state로 관리 (lazy initializer로 localStorage 반영)
  const [programs, setPrograms] = useState<ProgramDiary[]>(() => {
    const saved = loadSavedCards();
    return mergePrograms(saved);
  });

  // 편집 중 임시 카드 데이터 (완료 버튼 클릭 시 저장)
  const [draftCards, setDraftCards] = useState<Record<string, DiaryCardData[]>>({});

  const [selected, setSelected] = useState<string>(PROGRAMS_DEFAULT[0].id);
  const reduced = usePrefersReducedMotion();

  // 저장 base = 백엔드 오버라이드(단일 진실 소스). 초기값은 localStorage 캐시로 시드 —
  // GET 미완료/실패(레이스·오프라인) 구간에 {} 면 다른 프로그램 오버라이드가 PUT 으로 삭제되므로 방지.
  const serverOverrideRef = useRef<Record<string, DiaryCardData[]>>(loadSavedCards());

  // 인증 해제(로그아웃/401 만료) 시 편집 모드 강제 종료 — 카드가 편집 비주얼로 남지 않게.
  useEffect(() => {
    if (!authed) setIsEditing(false);
  }, [authed]);

  // 마운트 시 백엔드에서 오버라이드를 불러와 병합 — 백엔드를 단일 진실 소스로.
  //   초기 렌더는 PROGRAMS_DEFAULT(+localStorage 캐시), fetch 성공 시 setState 로 교체.
  useEffect(() => {
    let cancelled = false;
    villageDiaryAPI
      .get()
      .then((override) => {
        if (cancelled || !override || typeof override !== 'object') return;
        serverOverrideRef.current = override;
        setPrograms(mergePrograms(override));
        // 오프라인 캐시 갱신
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(override));
        } catch {
          // 무시
        }
      })
      .catch((err) => {
        // 네트워크 실패 시 localStorage 캐시/기본값 유지
        console.warn('마을일기 백엔드 로드 실패 (캐시/기본값 사용):', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const program = useMemo(
    () => programs.find((p) => p.id === selected) ?? programs[0],
    [selected, programs],
  );

  // 모바일 전용 콘텐츠 박스 정렬 방향 — program.id 매핑(미지정 시 'right' = 현행).
  //   데스크톱은 card.side 로 카드별 좌우가 정해지므로 이 값과 무관하다.
  const mobileSide: MobileSide = MOBILE_SIDE_MAP[program.id] ?? 'right';

  // 현재 프로그램 카드 (편집 중이면 draft, 아니면 저장된 값)
  const cards = useMemo(() => {
    if (isEditing && draftCards[selected] !== undefined) return draftCards[selected];
    return program.cards;
  }, [isEditing, draftCards, selected, program.cards]);

  const hasContent = cards.length > 0;

  // 동적 레이아웃 산출
  //   카드 top = FIRST_CARD_Y + i*CARD_GAP - 80. 마지막 카드 실제 높이는 사진 유무로 달라진다
  //   (사진 카드 ≈ 430px, 사진 없는 카드 ≈ 290px). 마지막 카드 하단 + 여유 패딩을 모두 덮도록 계산.
  const desktopHeight = useMemo(() => {
    if (!hasContent) return 760;
    const lastTop = FIRST_CARD_Y + (cards.length - 1) * CARD_GAP - 80;
    const lastHasImage = !!cards[cards.length - 1]?.imageUrl;
    const lastCardHeight = lastHasImage ? 460 : 320; // 사진 카드 여유 포함
    const BOTTOM_PAD = 120; // 마지막 카드 아래 여백
    return lastTop + lastCardHeight + BOTTOM_PAD;
  }, [hasContent, cards]);

  // 모바일 컨테이너 높이 — 카드 수가 많아 1620px 를 넘어도 마지막 카드가 잘리지 않게 동적 산출.
  //   카드 top = MOBILE_FIRST_CARD_Y + i*MOBILE_CARD_GAP. 마지막 카드 + 사진 여유 + 하단 패딩.
  const mobileHeight = useMemo(() => {
    if (!hasContent) return 1620;
    const lastTop = MOBILE_FIRST_CARD_Y + (cards.length - 1) * MOBILE_CARD_GAP;
    const lastHasImage = !!cards[cards.length - 1]?.imageUrl;
    const lastCardHeight = lastHasImage ? 320 : 200;
    const BOTTOM_PAD = 100;
    return Math.max(1620, lastTop + lastCardHeight + BOTTOM_PAD);
  }, [hasContent, cards]);
  const pathHeight = useMemo(
    () => (hasContent ? FIRST_CARD_Y + (cards.length - 1) * CARD_GAP - PATH_TOP + PATH_TAIL : 360),
    [hasContent, cards.length],
  );
  const avatarStart = PATH_TOP;
  const avatarEnd = PATH_TOP + pathHeight - AVATAR_TRAVEL_PAD - 112;

  // 편집 시작: 현재 프로그램 카드를 draft로 복사
  const handleEditToggle = () => {
    if (!isEditing) {
      setDraftCards((prev) => ({
        ...prev,
        [selected]: program.cards.map((c) => ({ ...c })),
      }));
      setIsEditing(true);
      return;
    }

    // 완료: draft → programs에 낙관적 반영
    const newPrograms = programs.map((p) => {
      if (p.id === selected && draftCards[selected] !== undefined) {
        return { ...p, cards: draftCards[selected] };
      }
      return p;
    });
    setPrograms(newPrograms);
    setIsEditing(false);

    // 저장 base 는 백엔드 오버라이드(단일 진실 소스) — localStorage 가 아니라 serverOverrideRef.
    //   이렇게 해야 이번 세션에서 건드리지 않은 다른 프로그램의 백엔드 오버라이드가 보존된다.
    const merged: Record<string, DiaryCardData[]> = { ...serverOverrideRef.current };
    Object.entries(draftCards).forEach(([id, dcards]) => {
      merged[id] = dcards;
    });

    // 오프라인 캐시(localStorage)도 함께 갱신 — 백엔드 우선, 캐시는 보조
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {
      // storage full 등 — 무시
    }

    // 백엔드 저장(꿈다락 편집 인증 전용). 실패를 숨기지 않는다.
    villageDiaryAPI
      .save(merged)
      .then((res) => {
        // 서버가 저장한 data 로 ref 동기화(반환 형태는 raw 오버라이드 객체)
        const savedData =
          res && res.success && res.data && typeof res.data === 'object'
            ? (res.data as Record<string, DiaryCardData[]>)
            : merged;
        serverOverrideRef.current = savedData;
      })
      .catch((err) => {
        console.error('마을일기 저장 실패:', err);
        // 꿈다락 인증 만료 → 공유 컨텍스트 logout() + 재로그인 모달 오픈 (사이트 세션과 무관)
        if (err && err.code === 'KKUM_AUTH_EXPIRED') {
          logout();
          if (typeof window !== 'undefined') {
            window.alert('꿈다락 편집 인증이 만료되었습니다. 다시 로그인해주세요.');
          }
          requestLogin();
          return;
        }
        if (typeof window !== 'undefined') {
          window.alert('마을일기 저장에 실패했습니다. 잠시 후 다시 시도해주세요.\n(' + (err?.message || err) + ')');
        }
      });
  };

  // 탭 변경 시 draft 초기화
  const handleTabChange = (id: string) => {
    if (isEditing) {
      // 현재 탭 draft를 programs에 반영
      const newPrograms = programs.map((p) => {
        if (p.id === selected && draftCards[selected] !== undefined) {
          return { ...p, cards: draftCards[selected] };
        }
        return p;
      });
      setPrograms(newPrograms);
      setDraftCards((prev) => ({
        ...prev,
        [id]: (newPrograms.find((p) => p.id === id)?.cards ?? []).map((c) => ({ ...c })),
      }));
    }
    setSelected(id);
  };

  // 카드 필드 업데이트
  const handleCardUpdate = (index: number, field: 'title' | 'date' | 'dot' | 'side' | 'imageUrl', value: string) => {
    setDraftCards((prev) => {
      const arr = [...(prev[selected] ?? cards)];
      arr[index] = { ...arr[index], [field]: value } as DiaryCardData;
      return { ...prev, [selected]: arr };
    });
  };

  // 카드 삭제
  const handleCardDelete = (index: number) => {
    setDraftCards((prev) => {
      const arr = [...(prev[selected] ?? cards)];
      arr.splice(index, 1);
      return { ...prev, [selected]: arr };
    });
  };

  // 카드 추가
  const handleCardAdd = () => {
    setDraftCards((prev) => {
      const arr = [...(prev[selected] ?? cards)];
      const lastSide = arr.length > 0 ? arr[arr.length - 1].side : 'right';
      arr.push({ side: lastSide === 'left' ? 'right' : 'left', title: '', date: 'MM.DD', dot: program.accent });
      return { ...prev, [selected]: arr };
    });
  };

  // 스크롤 진행도 → 아바타 위치 (데스크톱 + 모바일)
  const sectionRef = useRef<HTMLElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const mobileAvatarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // 카드 등장 ref — 아바타(캐릭터) 도달 기준으로 리빌
  const cardEls = useRef<Array<HTMLElement | null>>([]);
  const dotEls = useRef<Array<HTMLElement | null>>([]);
  const connectorEls = useRef<Array<HTMLElement | null>>([]);
  // 모바일 카드용 별도 ref (데스크톱과 별도 DOM)
  const mobileCardEls = useRef<Array<HTMLElement | null>>([]);
  const mobileDotEls = useRef<Array<HTMLElement | null>>([]);
  const mobileConnectorEls = useRef<Array<HTMLElement | null>>([]);
  // 스크롤 콜백에서 최신 isEditing 값에 접근하기 위한 ref
  const isEditingRef = useRef(isEditing);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  // 아바타(캐릭터) 몸통 중심의 "도달 기준선" 오프셋
  //   캐릭터는 .diary-avatar(top 기준)에서 시작해 아래로 그려진다.
  //   데스크톱 캐릭터 ≈ 140*0.86 ≈ 120px, 모바일 ≈ 140*0.62 ≈ 87px.
  //   캐릭터 몸통 중앙쯤이 카드의 dot Y에 닿으면 "도달"로 본다.
  //   모바일: progress=1에서 마지막 dot(1216)에 도달하려면
  //     236 + (1163-236) + reach >= 1216 → reach >= 53. 여유 두고 60.
  //     progress=0에서는 236 + 60 = 296 < 첫 dot(376) → 로드 시 여전히 숨김.
  const DESKTOP_AVATAR_REACH = 70; // 아바타 top 기준 아래로 70px ≈ 몸통 중앙
  const MOBILE_AVATAR_REACH = 60;

  // 아바타 도달 위치(문서 좌표 기준의 논리값)로 카드/dot/connector 리빌.
  //   reflow-free: getBoundingClientRect 대신 progress + 레이아웃 상수로 계산.
  //   숨겨진 쪽(display:none) rect가 0이 되는 문제를 피한다.
  const applyReveal = useCallback(
    (progress: number) => {
      // 편집 모드: 별도 effect에서 전부 visible 처리 — 여기선 토글하지 않음
      if (isEditingRef.current) return;

      // 데스크톱: 아바타 도달 Y = avatarStart + progress*travel + reach
      const desktopTravel = avatarEnd - avatarStart;
      const desktopReachY = avatarStart + progress * desktopTravel + DESKTOP_AVATAR_REACH;
      for (let i = 0; i < cardEls.current.length; i += 1) {
        const dotY = FIRST_CARD_Y + i * CARD_GAP + 24;
        const on = desktopReachY >= dotY;
        cardEls.current[i]?.classList.toggle('is-visible', on);
        dotEls.current[i]?.classList.toggle('is-visible', on);
        connectorEls.current[i]?.classList.toggle('is-visible', on);
      }

      // 모바일: 아바타 도달 Y = MOBILE_AVATAR_START + progress*travel + reach
      const mobileTravel = MOBILE_AVATAR_END - MOBILE_AVATAR_START;
      const mobileReachY = MOBILE_AVATAR_START + progress * mobileTravel + MOBILE_AVATAR_REACH;
      for (let i = 0; i < mobileCardEls.current.length; i += 1) {
        const dotY = MOBILE_FIRST_CARD_Y + i * MOBILE_CARD_GAP + MOBILE_DOT_Y_OFFSET;
        const on = mobileReachY >= dotY;
        mobileCardEls.current[i]?.classList.toggle('is-visible', on);
        mobileDotEls.current[i]?.classList.toggle('is-visible', on);
        mobileConnectorEls.current[i]?.classList.toggle('is-visible', on);
      }
    },
    [avatarStart, avatarEnd],
  );

  const updateAvatar = useCallback(() => {
    rafRef.current = null;
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const sectionHeight = section.offsetHeight;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scrolled = -rect.top;
    const maxScroll = sectionHeight - vh;
    const progress = Math.max(0, Math.min(1, scrolled / Math.max(1, maxScroll)));

    const desktopAvatar = avatarRef.current;
    if (desktopAvatar) {
      const desktopTravel = avatarEnd - avatarStart;
      desktopAvatar.style.transform = `translateY(${Math.round(progress * desktopTravel)}px)`;
    }

    const mobileAvatar = mobileAvatarRef.current;
    if (mobileAvatar) {
      const mobileTravel = MOBILE_AVATAR_END - MOBILE_AVATAR_START;
      mobileAvatar.style.transform = `translateY(${Math.round(progress * mobileTravel)}px)`;
    }

    // 아바타 위치에 도달한 카드부터 리빌
    applyReveal(progress);
  }, [avatarStart, avatarEnd, applyReveal]);

  useEffect(() => {
    if (reduced) {
      if (avatarRef.current) avatarRef.current.style.transform = 'translateY(0)';
      if (mobileAvatarRef.current) mobileAvatarRef.current.style.transform = 'translateY(0)';
      return;
    }
    const onScroll = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(updateAvatar);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateAvatar();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [updateAvatar, reduced, selected, desktopHeight]);

  // 리빌 fallback: reduced-motion → 전부 즉시 visible.
  //   일반 환경에서는 스크롤 핸들러(applyReveal)가 아바타 도달 기준으로 토글한다.
  //   ref 배열을 현재 카드 수에 맞게 트림(이전 프로그램 잔여 ref 제거)도 겸한다.
  useEffect(() => {
    cardEls.current = cardEls.current.slice(0, cards.length);
    dotEls.current = dotEls.current.slice(0, cards.length);
    connectorEls.current = connectorEls.current.slice(0, cards.length);
    mobileCardEls.current = mobileCardEls.current.slice(0, cards.length);
    mobileDotEls.current = mobileDotEls.current.slice(0, cards.length);
    mobileConnectorEls.current = mobileConnectorEls.current.slice(0, cards.length);
    if (reduced) {
      cardEls.current.forEach((el) => el?.classList.add('is-visible'));
      dotEls.current.forEach((el) => el?.classList.add('is-visible'));
      connectorEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileCardEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileDotEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileConnectorEls.current.forEach((el) => el?.classList.add('is-visible'));
    }
  }, [cards.length, reduced, selected]);

  // 편집 모드에서 모든 카드/dot/connector 강제 is-visible (도달 기준 리빌 무시)
  useEffect(() => {
    if (isEditing) {
      cardEls.current.forEach((el) => el?.classList.add('is-visible'));
      dotEls.current.forEach((el) => el?.classList.add('is-visible'));
      connectorEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileCardEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileDotEls.current.forEach((el) => el?.classList.add('is-visible'));
      mobileConnectorEls.current.forEach((el) => el?.classList.add('is-visible'));
    }
  }, [isEditing, cards.length]);

  const setCardRef = (i: number) => (el: HTMLElement | null) => {
    cardEls.current[i] = el;
  };
  const setDotRef = (i: number) => (el: HTMLElement | null) => {
    dotEls.current[i] = el;
  };
  const setConnectorRef = (i: number) => (el: HTMLElement | null) => {
    connectorEls.current[i] = el;
  };
  const setMobileCardRef = (i: number) => (el: HTMLElement | null) => {
    mobileCardEls.current[i] = el;
  };
  const setMobileDotRef = (i: number) => (el: HTMLElement | null) => {
    mobileDotEls.current[i] = el;
  };
  const setMobileConnectorRef = (i: number) => (el: HTMLElement | null) => {
    mobileConnectorEls.current[i] = el;
  };

  const renderFilters = (mobile = false) => (
    <div className="diary-filters">
      {programs.map((p) => (
        <span
          key={p.id}
          role="button"
          tabIndex={0}
          className={p.id === selected ? 'active' : ''}
          style={p.id === selected ? ({ background: p.accent } as React.CSSProperties) : undefined}
          onClick={() => handleTabChange(p.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTabChange(p.id);
            }
          }}
        >
          {mobile && p.name === '기억순환 정류장' ? '기억순환' : p.name}
        </span>
      ))}
    </div>
  );

  // ── 꿈다락 편집 제어 버튼 (인증 시에만 표시) ────────────────────────
  //   로그인 진입은 nav 의 도형 버튼이 담당 — 여기서는 인증된 사용자에게
  //   편집/완료 토글만 노출한다. 비인증 시 아무 것도 렌더하지 않는다.
  const renderEditControls = () => {
    if (!authed) return null;
    return (
      <button
        className={`kd-diary-edit-btn${isEditing ? ' is-editing' : ''}`}
        onClick={handleEditToggle}
      >
        {isEditing ? '완료' : '편집'}
      </button>
    );
  };

  return (
    <section className="kd-figma-diary" ref={sectionRef}>
      {/* 데스크톱 마을일기 카드 모바일 스탬프형 정돈 — 모바일 무영향(min-width:901px) */}
      <style>{DIARY_DESKTOP_CSS}</style>
      <div
        className={`kd-diary-desktop${isEditing ? ' is-editing-flow' : ''}`}
        data-name="마을일기 — Desktop"
        style={{ height: isEditing ? 'auto' : desktopHeight, '--accent': program.accent } as React.CSSProperties}
      >
        <h1>마을일기</h1>
        <p className="diary-sub">프로그램을 따라 마을의 기록을 걷습니다  ·  스크롤하면 캐릭터가 길을 내려갑니다</p>
        <div className="diary-scroll-cue" aria-hidden="true">
          <span>스크롤</span>
          <svg width="24" height="36" viewBox="0 0 24 36" fill="none">
            <rect x="1" y="1" width="22" height="34" rx="11" stroke="#1a1a1a" strokeWidth="2"/>
            <rect className="diary-scroll-wheel" x="10" y="6" width="4" height="8" rx="2" fill="#1a1a1a"/>
          </svg>
        </div>
        <div className="kd-section-rule kd-section-rule--s4" />
        {renderFilters(false)}

        {/* 꿈다락 전용 편집 제어 (로그인 진입은 nav 도형 버튼이 담당) */}
        {renderEditControls()}

        {hasContent && !isEditing && (
          <>
            <div className="diary-path" style={{ height: pathHeight, borderLeftColor: program.accent }} />
            <div className="diary-avatar" ref={avatarRef} style={{ top: avatarStart }}>
              <div className="diary-character-scale">
                <DiaryCharacter src={program.character} name={program.name} />
              </div>
            </div>
          </>
        )}

        {hasContent ? (
          <>
            {cards.map((card, index) => {
              const y = FIRST_CARD_Y + index * CARD_GAP;
              return (
                <React.Fragment key={`${program.id}-${index}`}>
                  {!isEditing && (
                    <>
                      <i
                        ref={setDotRef(index)}
                        className={`diary-dot ${card.side}`}
                        style={{ top: y + 24, background: card.dot }}
                      />
                      <i
                        ref={setConnectorRef(index)}
                        className={`diary-connector ${card.side}`}
                        style={{ top: y + 35 }}
                      />
                    </>
                  )}
                  <DiaryCard
                    title={card.title}
                    date={card.date}
                    dot={card.dot}
                    accent={program.accent}
                    imageUrl={card.imageUrl}
                    className={card.side}
                    style={isEditing ? undefined : { top: y - 80 }}
                    cardRef={setCardRef(index)}
                    isEditing={isEditing}
                    side={card.side}
                    programId={program.id}
                    programName={program.name}
                    onUpdate={(field, value) => handleCardUpdate(index, field, value)}
                    onDelete={() => handleCardDelete(index)}
                  />
                </React.Fragment>
              );
            })}
            {/* + 기록 추가 버튼 (편집 중) */}
            {isEditing && (
              <button
                className="diary-add-card-btn"
                onClick={handleCardAdd}
              >
                + 기록 추가
              </button>
            )}
          </>
        ) : (
          <>
            <div className="diary-empty" style={{ top: 360 }}>
              <div className="diary-empty-character">
                <DiaryCharacter src={program.character} name={program.name} />
              </div>
              <h2>{program.name}</h2>
              <p>일기를 준비하고 있어요.</p>
              <span>곧 마을의 기록으로 채워집니다.</span>
            </div>
            {/* 준비중 프로그램에도 카드 추가 가능 (편집 중) */}
            {isEditing && (
              <button
                className="diary-add-card-btn"
                style={{ top: 560 }}
                onClick={handleCardAdd}
              >
                + 기록 추가
              </button>
            )}
          </>
        )}
      </div>

      <div
        className={`kd-diary-mobile${mobileSide === 'left' ? ' is-mobile-left' : ''}`}
        data-name="마을일기 — Mobile"
        style={{ height: mobileHeight }}
      >
        <div className="kd-section-rule kd-section-rule--s4" />
        <h1>마을일기</h1>
        <p className="diary-sub">프로그램을 따라 걷는 기록</p>
        {renderFilters(true)}

        {hasContent ? (
          <>
            <div
              className="diary-path"
              style={{ borderLeftColor: program.accent, borderRightColor: program.accent }}
            />
            <div
              className="diary-avatar"
              ref={mobileAvatarRef}
              style={{ top: MOBILE_AVATAR_START }}
            >
              <div className="diary-character-scale">
                <DiaryCharacter src={program.character} name={program.name} />
              </div>
            </div>
            {cards.map((card, index) => {
              const y = MOBILE_FIRST_CARD_Y + index * MOBILE_CARD_GAP;
              // dot/connector를 path 시각 중심선(x=48)에 정렬 — side 무관
              const lx = MOBILE_PATH_CENTER_X;
              return (
                <React.Fragment key={`m-${program.id}-${index}`}>
                  <i
                    ref={setMobileDotRef(index)}
                    className="diary-dot"
                    style={
                      mobileSide === 'left'
                        ? { top: y + MOBILE_DOT_Y_OFFSET, right: lx - 11, background: card.dot }
                        : { top: y + MOBILE_DOT_Y_OFFSET, left: lx - 11, background: card.dot }
                    }
                  />
                  <i
                    ref={setMobileConnectorRef(index)}
                    className="diary-connector"
                    style={
                      mobileSide === 'left'
                        ? { top: y + MOBILE_CONNECTOR_Y_OFFSET, right: lx }
                        : { top: y + MOBILE_CONNECTOR_Y_OFFSET, left: lx }
                    }
                  />
                  <DiaryCard
                    title={card.title}
                    date={card.date}
                    dot={card.dot}
                    accent={program.accent}
                    imageUrl={card.imageUrl}
                    style={{ top: y }}
                    cardRef={setMobileCardRef(index)}
                  />
                </React.Fragment>
              );
            })}
          </>
        ) : (
          <div className="diary-empty diary-empty-mobile">
            <div className="diary-empty-character">
              <DiaryCharacter src={program.character} name={program.name} />
            </div>
            <h2>{program.name}</h2>
            <p>일기를 준비하고 있어요.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default VillageDiary;
